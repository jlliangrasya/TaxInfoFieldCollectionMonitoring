// RPT collection monitoring: Treasury payments, and review of collections
// recorded by Revenue Collectors in the field.
//
// IMPORTANT DISTINCTION
//  • Treasury payment  — recorded by Treasury with an Official Receipt (OR) No.; counts toward the balance.
//  • Field record      — entered by a collector; NOT an Official Receipt. It does not reduce the
//                        balance until Treasury verifies it against the OR.
import { getDb, commit, nextId } from '@/data/store'
import { can, PERMISSIONS, PermissionError } from '@/lib/permissions'
import { buildLedger, round2 } from '@/lib/rpt'
import { peso, isoDate } from '@/lib/format'
import { findOrNoConflict, findSimilarRecords, exceedsBalance } from '@/lib/duplicates'
import { paymentInputSchema, verifyInputSchema, rejectInputSchema } from '@/lib/validation'
import {
  delay,
  requireUser,
  requirePermission,
  accessiblePropertyIds,
  assertPropertyAccess,
  userName,
  barangayName,
  writeAudit,
  parseOrThrow,
  ValidationError,
  DuplicateWarning,
} from './core'
import { computeAccounts, matchesQuery } from './accounts'

/** Balance of one tax year and the total of field records still waiting for verification. */
export function yearPosition(db, propertyId, taxYear, excludeFieldId = null) {
  const ledger = buildLedger(
    db.assessments.filter((a) => a.propertyId === propertyId),
    db.payments.filter((p) => p.propertyId === propertyId),
  )
  const year = ledger.find((y) => y.taxYear === taxYear)
  if (!year) throw new ValidationError(`There is no assessment for tax year ${taxYear} on this property.`)
  const pending = round2(
    db.fieldCollections
      .filter((f) => f.propertyId === propertyId && f.taxYear === taxYear && f.status === 'pending' && f.id !== excludeFieldId)
      .reduce((s, f) => s + f.amount, 0),
  )
  return { balance: year.balance, pending, available: round2(Math.max(0, year.balance - pending)) }
}

function describeMatch(db, m) {
  if (m.orNo) return `Treasury payment OR No. ${m.orNo} — ${peso(m.amount)} on ${m.paymentDate}`
  return `Field record ${m.refNo} by ${userName(m.collectorId, db)} — ${peso(m.amount)} on ${m.collectionDate} (${m.status})`
}

function matchesFollowUp(r, followUp, today) {
  if (!followUp) return true
  if (r.balance <= 0) return false
  if (followUp === 'due') return Boolean(r.followUpDate && r.followUpDate <= today)
  if (followUp === 'scheduled') return Boolean(r.followUpDate && r.followUpDate > today)
  if (followUp === 'not_visited') return !r.lastVisitDate
  return r.lastOutcome === followUp
}

/**
 * @param filters { query, status, barangayId, followUp, collectorId }
 *   followUp: one of FOLLOW_UP_FILTERS values; collectorId: a user ID or 'unassigned'
 */
export async function listAccounts(filters = {}) {
  await delay()
  const user = requirePermission(PERMISSIONS.RECORDS_VIEW)
  const db = getDb()
  const today = isoDate()
  return computeAccounts(db, accessiblePropertyIds(user, db))
    .filter((r) => matchesQuery(r, filters.query))
    .filter((r) => !filters.status || r.status === filters.status)
    .filter((r) => !filters.barangayId || r.barangayId === filters.barangayId)
    .filter((r) => matchesFollowUp(r, filters.followUp, today))
    .filter((r) => !filters.collectorId || (r.assignedCollectorId ?? 'unassigned') === filters.collectorId)
    .sort((a, b) => b.balance - a.balance)
}

export async function recordPayment(input) {
  await delay()
  const user = requirePermission(PERMISSIONS.PAYMENT_RECORD)
  const data = parseOrThrow(paymentInputSchema, input)
  const db = getDb()
  const property = db.properties.find((p) => p.id === data.propertyId)
  if (!property) throw new ValidationError('This property record was not found.')

  const conflict = findOrNoConflict(data.orNo, db.payments)
  if (conflict) {
    throw new ValidationError('Please correct the highlighted fields.', {
      orNo: `OR No. ${data.orNo} is already recorded (${peso(conflict.amount)} on ${conflict.paymentDate}). Each OR No. can only be used once.`,
    })
  }
  const pos = yearPosition(db, data.propertyId, data.taxYear)
  if (exceedsBalance(data.amount, pos.balance)) {
    throw new ValidationError('Please correct the highlighted fields.', {
      amount: `Amount is more than the remaining balance of ${peso(pos.balance)} for tax year ${data.taxYear}.`,
    })
  }
  if (!data.confirmDuplicate) {
    const similar = findSimilarRecords(
      { propertyId: data.propertyId, taxYear: data.taxYear, amount: data.amount, date: data.paymentDate },
      db,
    )
    if (similar.length) {
      throw new DuplicateWarning(
        'A record with the same property, tax year, amount and date already exists. Is this a different payment?',
        similar.map((m) => describeMatch(db, m)),
      )
    }
    if (pos.pending > 0 && exceedsBalance(data.amount, pos.available)) {
      throw new DuplicateWarning(
        `There is a field record of ${peso(pos.pending)} for tax year ${data.taxYear} still waiting for verification. This payment may be the same collection. Please verify the field record instead if so.`,
      )
    }
  }

  return commit((d) => {
    const payment = {
      id: nextId('PAY', 5),
      propertyId: data.propertyId,
      taxYear: data.taxYear,
      amount: round2(data.amount),
      orNo: data.orNo,
      paymentDate: data.paymentDate,
      source: 'treasury',
      fieldCollectionId: null,
      remarks: data.remarks,
      recordedBy: user.id,
      recordedAt: new Date().toISOString(),
    }
    d.payments.push(payment)
    writeAudit(
      d,
      user,
      'Payment recorded',
      `${property.arpNo} TY ${data.taxYear}: ${peso(data.amount)}, OR No. ${data.orNo}${data.confirmDuplicate ? ' (confirmed despite similar record)' : ''}`,
    )
    return payment
  })
}

/** @param filters { status } — Treasury sees all; a collector sees only their own. */
export async function listFieldCollections(filters = {}) {
  await delay()
  const user = requireUser()
  const db = getDb()
  const canReview = can(user, PERMISSIONS.FIELD_VERIFY) || can(user, PERMISSIONS.VISITS_VIEW_ALL)
  if (!canReview && !can(user, PERMISSIONS.FIELD_RECORD)) throw new PermissionError()

  return db.fieldCollections
    .filter((f) => canReview || f.collectorId === user.id)
    .filter((f) => !filters.status || f.status === filters.status)
    .map((f) => {
      const property = db.properties.find((p) => p.id === f.propertyId)
      const taxpayer = db.taxpayers.find((t) => t.id === property?.taxpayerId)
      const pos = f.status === 'pending' ? yearPosition(db, f.propertyId, f.taxYear, f.id) : null
      return {
        ...f,
        arpNo: property?.arpNo ?? '—',
        taxpayerName: taxpayer?.name ?? '—',
        barangayName: barangayName(property?.barangayId, db),
        collectorName: userName(f.collectorId, db),
        reviewedByName: f.reviewedBy ? userName(f.reviewedBy, db) : null,
        yearBalance: pos?.balance ?? null,
        exceedsBalance: pos ? exceedsBalance(f.amount, pos.balance) : false,
      }
    })
    .sort((a, b) => Number(b.possibleDuplicate) - Number(a.possibleDuplicate) || b.createdAt.localeCompare(a.createdAt))
}

export async function verifyFieldCollection(id, input) {
  await delay()
  const user = requirePermission(PERMISSIONS.FIELD_VERIFY)
  const data = parseOrThrow(verifyInputSchema, input)
  const db = getDb()
  const fc = db.fieldCollections.find((f) => f.id === id)
  if (!fc) throw new ValidationError('This field record was not found.')
  if (fc.status !== 'pending') throw new ValidationError('This field record has already been reviewed.')

  const conflict = findOrNoConflict(data.orNo, db.payments)
  if (conflict) {
    throw new ValidationError('Please correct the highlighted fields.', {
      orNo: `OR No. ${data.orNo} is already recorded (${peso(conflict.amount)} on ${conflict.paymentDate}). If this field record is the same payment, reject it as a duplicate.`,
    })
  }
  const pos = yearPosition(db, fc.propertyId, fc.taxYear, fc.id)
  if (exceedsBalance(fc.amount, pos.balance)) {
    throw new ValidationError(
      `Cannot verify: ${peso(fc.amount)} is more than the remaining balance of ${peso(pos.balance)} for tax year ${fc.taxYear}. This may be a duplicate — please reject it or check the records.`,
    )
  }

  commit((d) => {
    const f = d.fieldCollections.find((x) => x.id === id)
    const property = d.properties.find((p) => p.id === f.propertyId)
    d.payments.push({
      id: nextId('PAY', 5),
      propertyId: f.propertyId,
      taxYear: f.taxYear,
      amount: f.amount,
      orNo: data.orNo,
      paymentDate: f.collectionDate,
      source: 'field',
      fieldCollectionId: f.id,
      recordedBy: user.id,
      recordedAt: new Date().toISOString(),
    })
    Object.assign(f, {
      status: 'verified',
      orNoIssued: data.orNo,
      reviewedBy: user.id,
      reviewedAt: new Date().toISOString(),
      reviewNote: data.note,
    })
    writeAudit(d, user, 'Field record verified', `${f.refNo} (${property?.arpNo}): ${peso(f.amount)} matched to OR No. ${data.orNo}`)
  })
}

export async function rejectFieldCollection(id, input) {
  await delay()
  const user = requirePermission(PERMISSIONS.FIELD_VERIFY)
  const data = parseOrThrow(rejectInputSchema, input)
  const db = getDb()
  const fc = db.fieldCollections.find((f) => f.id === id)
  if (!fc) throw new ValidationError('This field record was not found.')
  if (fc.status !== 'pending') throw new ValidationError('This field record has already been reviewed.')
  commit((d) => {
    const f = d.fieldCollections.find((x) => x.id === id)
    Object.assign(f, {
      status: 'rejected',
      reviewedBy: user.id,
      reviewedAt: new Date().toISOString(),
      reviewNote: data.reason,
    })
    writeAudit(d, user, 'Field record rejected', `${f.refNo}: ${data.reason}`)
  })
}

/** Tax years with a remaining balance, for payment forms. */
export async function getPayableYears(propertyId) {
  await delay(0)
  const user = requirePermission(PERMISSIONS.RECORDS_VIEW)
  const db = getDb()
  assertPropertyAccess(user, propertyId, db)
  const ledger = buildLedger(
    db.assessments.filter((a) => a.propertyId === propertyId),
    db.payments.filter((p) => p.propertyId === propertyId),
  )
  return ledger
    .filter((y) => y.balance > 0)
    .map((y) => ({ taxYear: y.taxYear, balance: y.balance, ...yearPosition(db, propertyId, y.taxYear) }))
}
