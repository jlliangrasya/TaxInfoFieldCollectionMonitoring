// Field collection monitoring: collectors' assignments, visit logging and
// field-recorded collections.
import { getDb, commit, nextId } from '@/data/store'
import { can, PERMISSIONS, PermissionError } from '@/lib/permissions'
import { round2 } from '@/lib/rpt'
import { peso, isoDate } from '@/lib/format'
import { VISIT_OUTCOMES, outcomeLabel } from '@/lib/constants'
import { findSimilarRecords, findOrNoConflict, exceedsBalance, normalizeOrNo } from '@/lib/duplicates'
import { visitInputSchema } from '@/lib/validation'
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
import { computeAccounts } from './accounts'
import { yearPosition } from './collectionService'

/** Collector's work list: properties in their area that still have a balance. */
export async function listMyAssignments(filters = {}) {
  await delay()
  const user = requirePermission(PERMISSIONS.FIELD_RECORD)
  const db = getDb()
  const today = isoDate()
  const q = String(filters.query ?? '').trim().toLowerCase()
  return computeAccounts(db, accessiblePropertyIds(user, db))
    .filter((r) => (filters.includePaid ? true : r.balance > 0))
    .filter((r) => !filters.barangayId || r.barangayId === filters.barangayId)
    .filter((r) => !q || [r.taxpayerName, r.arpNo, r.location].some((v) => v.toLowerCase().includes(q)))
    .map((r) => ({ ...r, followUpDue: Boolean(r.followUpDate && r.followUpDate <= today) }))
    .sort((a, b) => {
      // Due follow-ups first, then never-visited, then by largest balance.
      if (a.followUpDue !== b.followUpDue) return a.followUpDue ? -1 : 1
      if (a.followUpDue && b.followUpDue) return a.followUpDate.localeCompare(b.followUpDate)
      if (!a.lastVisitDate !== !b.lastVisitDate) return a.lastVisitDate ? 1 : -1
      return b.balance - a.balance
    })
}

export async function getMyAreas() {
  await delay(0)
  const user = requirePermission(PERMISSIONS.FIELD_RECORD)
  const db = getDb()
  const today = isoDate()
  return db.assignments
    .filter((a) => a.collectorId === user.id && a.active && a.startDate <= today && a.endDate >= today)
    .map((a) => ({
      ...a,
      barangayName: barangayName(a.barangayId, db),
      propertyArpNo: a.propertyId ? db.properties.find((p) => p.id === a.propertyId)?.arpNo : null,
    }))
}

export async function logVisit(input) {
  await delay()
  const user = requirePermission(PERMISSIONS.FIELD_RECORD)
  const data = parseOrThrow(visitInputSchema, input)
  const db = getDb()
  const property = db.properties.find((p) => p.id === data.propertyId)
  if (!property) throw new ValidationError('This property record was not found.')
  assertPropertyAccess(user, property.id, db)

  const collects = VISIT_OUTCOMES.find((o) => o.value === data.outcome)?.collects
  let flagDuplicate = false

  if (collects) {
    const taxYear = Number(data.collectionTaxYear)
    const amount = round2(data.collectionAmount)
    const pos = yearPosition(db, property.id, taxYear)

    if (exceedsBalance(amount, pos.balance)) {
      throw new ValidationError('Please correct the highlighted fields.', {
        collectionAmount: `Amount is more than the remaining balance of ${peso(pos.balance)} for tax year ${taxYear}.`,
      })
    }
    if (data.orNoIssued) {
      const conflict = findOrNoConflict(data.orNoIssued, db.payments)
      if (conflict) {
        throw new ValidationError('Please correct the highlighted fields.', {
          orNoIssued: `OR No. ${data.orNoIssued} is already recorded by Treasury. Please check the receipt number.`,
        })
      }
    }

    const similar = findSimilarRecords({ propertyId: property.id, taxYear, amount, date: data.visitDate }, db)
    const sameOr = data.orNoIssued
      ? db.fieldCollections.filter(
          (f) => f.status !== 'rejected' && f.orNoIssued && normalizeOrNo(f.orNoIssued) === normalizeOrNo(data.orNoIssued),
        )
      : []
    const overPending = pos.pending > 0 && exceedsBalance(amount, pos.available)
    const reasons = []
    if (similar.length) reasons.push('A record with the same property, tax year, amount and date already exists.')
    if (sameOr.length) reasons.push(`OR No. ${data.orNoIssued} was already entered in another field record.`)
    if (overPending) reasons.push(`Other field records of ${peso(pos.pending)} for this tax year are still waiting for verification.`)

    if (reasons.length) {
      if (!data.confirmDuplicate) {
        throw new DuplicateWarning(`${reasons.join(' ')} Is this a different collection?`, [
          ...similar.map((m) => (m.orNo ? `Treasury payment OR No. ${m.orNo} — ${peso(m.amount)}` : `Field record ${m.refNo} — ${peso(m.amount)} (${m.status})`)),
          ...sameOr.map((m) => `Field record ${m.refNo} — OR No. ${m.orNoIssued}`),
        ])
      }
      flagDuplicate = true
    }
  }

  return commit((d) => {
    const visitId = nextId('V', 4)
    let fieldCollection = null
    if (collects) {
      const fcId = nextId('FC', 4)
      fieldCollection = {
        id: fcId,
        refNo: `FR-${new Date().getFullYear()}-${String(d.meta.counters.FC).padStart(5, '0')}`,
        propertyId: property.id,
        taxYear: Number(data.collectionTaxYear),
        amount: round2(data.collectionAmount),
        collectionDate: data.visitDate,
        collectorId: user.id,
        visitId,
        remarks: data.remarks,
        orNoIssued: data.orNoIssued,
        status: 'pending',
        possibleDuplicate: flagDuplicate,
        reviewedBy: null,
        reviewedAt: null,
        reviewNote: '',
        createdAt: new Date().toISOString(),
      }
      d.fieldCollections.push(fieldCollection)
    }
    const visit = {
      id: visitId,
      propertyId: property.id,
      collectorId: user.id,
      visitDate: data.visitDate,
      outcome: data.outcome,
      remarks: data.remarks,
      followUpDate: data.followUpDate || null,
      gps: data.gps
        ? { lat: Math.round(data.gps.lat * 1e4) / 1e4, lng: Math.round(data.gps.lng * 1e4) / 1e4, accuracy: data.gps.accuracy }
        : null,
      fieldCollectionId: fieldCollection?.id ?? null,
      createdAt: new Date().toISOString(),
    }
    d.visits.push(visit)
    writeAudit(
      d,
      user,
      'Field visit recorded',
      `${property.arpNo}: ${outcomeLabel(data.outcome)}${visit.gps ? ' (with GPS location)' : ''}`,
    )
    if (fieldCollection) {
      writeAudit(
        d,
        user,
        'Field collection recorded',
        `${fieldCollection.refNo} (${property.arpNo}) TY ${fieldCollection.taxYear}: ${peso(fieldCollection.amount)} — pending verification${flagDuplicate ? ' — FLAGGED as possible duplicate' : ''}`,
      )
    }
    return { visit, fieldCollection }
  })
}

/**
 * Field visit history.
 * @param filters { query, from, to, collectorId, barangayId, propertyId, outcome }
 */
export async function listVisits(filters = {}) {
  await delay()
  const user = requireUser()
  const db = getDb()
  const viewAll = can(user, PERMISSIONS.VISITS_VIEW_ALL)
  if (!viewAll && !can(user, PERMISSIONS.FIELD_RECORD)) throw new PermissionError()
  const showGps = can(user, PERMISSIONS.GPS_VIEW)
  const properties = new Map(db.properties.map((p) => [p.id, p]))
  const taxpayers = new Map(db.taxpayers.map((t) => [t.id, t]))
  const q = String(filters.query ?? '').trim().toLowerCase()

  return db.visits
    .filter((v) => viewAll || v.collectorId === user.id)
    .filter((v) => !filters.collectorId || v.collectorId === filters.collectorId)
    .filter((v) => !filters.propertyId || v.propertyId === filters.propertyId)
    .filter((v) => !filters.outcome || v.outcome === filters.outcome)
    .filter((v) => !filters.from || v.visitDate >= filters.from)
    .filter((v) => !filters.to || v.visitDate <= filters.to)
    .filter((v) => !filters.barangayId || properties.get(v.propertyId)?.barangayId === filters.barangayId)
    .map((v) => {
      const p = properties.get(v.propertyId)
      const fc = v.fieldCollectionId ? db.fieldCollections.find((f) => f.id === v.fieldCollectionId) : null
      return {
        ...v,
        gps: showGps ? v.gps : v.gps ? 'hidden' : null,
        arpNo: p?.arpNo ?? '—',
        taxpayerName: taxpayers.get(p?.taxpayerId)?.name ?? '—',
        barangayName: barangayName(p?.barangayId, db),
        collectorName: userName(v.collectorId, db),
        outcomeLabel: outcomeLabel(v.outcome),
        collectionAmount: fc?.amount ?? null,
        collectionStatus: fc?.status ?? null,
      }
    })
    .filter((v) => !q || [v.taxpayerName, v.arpNo, v.remarks].some((s) => s?.toLowerCase().includes(q)))
    .sort((a, b) => b.visitDate.localeCompare(a.visitDate) || b.createdAt.localeCompare(a.createdAt))
}
