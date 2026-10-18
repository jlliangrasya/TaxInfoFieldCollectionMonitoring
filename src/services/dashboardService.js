import { subDays, format } from 'date-fns'
import { getDb } from '@/data/store'
import { can, PERMISSIONS } from '@/lib/permissions'
import { round2, ACCOUNT_STATUS } from '@/lib/rpt'
import { isoDate } from '@/lib/format'
import { outcomeLabel } from '@/lib/constants'
import { delay, requireUser, accessiblePropertyIds, userName } from './core'
import { computeAccounts } from './accounts'

const sum = (list, key) => round2(list.reduce((s, x) => s + (x[key] ?? 0), 0))

export async function getDashboard() {
  await delay()
  const user = requireUser()
  const db = getDb()
  const today = isoDate()
  const currentYear = new Date().getFullYear()
  const accounts = computeAccounts(db, accessiblePropertyIds(user, db))
  const ids = new Set(accounts.map((a) => a.id))

  const statusCounts = Object.fromEntries(
    Object.values(ACCOUNT_STATUS).map((s) => [s, accounts.filter((a) => a.status === s).length]),
  )

  if (can(user, PERMISSIONS.FIELD_RECORD)) {
    const myVisits = db.visits.filter((v) => v.collectorId === user.id)
    const myFc = db.fieldCollections.filter((f) => f.collectorId === user.id)
    const monthPrefix = today.slice(0, 7)
    const withBalance = accounts.filter((a) => a.balance > 0)
    const followUps = withBalance
      .filter((a) => a.followUpDate)
      .sort((a, b) => a.followUpDate.localeCompare(b.followUpDate))
    return {
      kind: 'collector',
      statusCounts,
      assignedProperties: accounts.length,
      withBalance: withBalance.length,
      areaBalance: sum(withBalance, 'balance'),
      visitsToday: myVisits.filter((v) => v.visitDate === today).length,
      visitsThisMonth: myVisits.filter((v) => v.visitDate.startsWith(monthPrefix)).length,
      followUpsDue: followUps.filter((a) => a.followUpDate <= today).length,
      notVisited: withBalance.filter((a) => !a.lastVisitDate).length,
      pendingAmount: sum(myFc.filter((f) => f.status === 'pending'), 'amount'),
      pendingCount: myFc.filter((f) => f.status === 'pending').length,
      verifiedThisMonth: sum(myFc.filter((f) => f.status === 'verified' && f.collectionDate.startsWith(monthPrefix)), 'amount'),
      rejectedCount: myFc.filter((f) => f.status === 'rejected').length,
      nextFollowUps: followUps.slice(0, 5),
      recentVisits: myVisits
        .slice()
        .sort((a, b) => b.visitDate.localeCompare(a.visitDate) || b.createdAt.localeCompare(a.createdAt))
        .slice(0, 5)
        .map((v) => ({
          ...v,
          outcomeLabel: outcomeLabel(v.outcome),
          arpNo: db.properties.find((p) => p.id === v.propertyId)?.arpNo,
          taxpayerName: accounts.find((a) => a.id === v.propertyId)?.taxpayerName ?? '—',
        })),
    }
  }

  // Administrator and Treasury
  const yearPayments = db.payments.filter((p) => ids.has(p.propertyId) && p.paymentDate.startsWith(String(currentYear)))
  const currentYearDue = round2(
    db.assessments.filter((a) => a.taxYear === currentYear && ids.has(a.propertyId)).reduce((s, a) => s + a.amountDue, 0),
  )
  const currentYearPaid = round2(
    db.payments.filter((p) => p.taxYear === currentYear && ids.has(p.propertyId)).reduce((s, p) => s + p.amount, 0),
  )
  const pending = db.fieldCollections.filter((f) => f.status === 'pending')

  const monthNow = new Date().getMonth()
  const monthly = Array.from({ length: monthNow + 1 }, (_, m) => {
    const prefix = `${currentYear}-${String(m + 1).padStart(2, '0')}`
    const list = yearPayments.filter((p) => p.paymentDate.startsWith(prefix))
    return {
      month: format(new Date(currentYear, m, 1), 'MMM'),
      treasury: sum(list.filter((p) => p.source === 'treasury'), 'amount'),
      field: sum(list.filter((p) => p.source === 'field'), 'amount'),
    }
  })

  const since = isoDate(subDays(new Date(), 30))
  const visitsByCollector = db.users
    .filter((u) => u.role === 'collector' && u.active)
    .map((c) => {
      const v = db.visits.filter((x) => x.collectorId === c.id && x.visitDate >= since)
      const fc = db.fieldCollections.filter((x) => x.collectorId === c.id && x.collectionDate >= since && x.status !== 'rejected')
      return { name: c.fullName.split(' ')[0] + ' ' + c.fullName.split(' ').slice(-1), fullName: c.fullName, visits: v.length, collected: sum(fc, 'amount') }
    })

  const byBarangay = db.barangays
    .map((b) => {
      const list = accounts.filter((a) => a.barangayId === b.id)
      return { name: b.name, balance: sum(list, 'balance'), accounts: list.length }
    })
    .sort((a, b) => b.balance - a.balance)

  return {
    kind: 'office',
    statusCounts,
    totalTaxpayers: new Set(accounts.map((a) => a.taxpayerId)).size,
    totalProperties: accounts.length,
    collectedThisYear: sum(yearPayments, 'amount'),
    currentYear,
    currentYearDue,
    currentYearPaid,
    collectionRate: currentYearDue ? Math.round((currentYearPaid / currentYearDue) * 1000) / 10 : 0,
    outstandingBalance: sum(accounts, 'balance'),
    pendingCount: pending.length,
    pendingAmount: sum(pending, 'amount'),
    duplicateCount: pending.filter((f) => f.possibleDuplicate).length,
    visitsLast30: db.visits.filter((v) => v.visitDate >= since).length,
    monthly,
    visitsByCollector,
    byBarangay,
    recentActivity: can(user, PERMISSIONS.AUDIT_VIEW)
      ? db.auditLog.slice(0, 8).map((e) => ({ ...e, name: e.userId ? userName(e.userId, db) : e.username }))
      : [],
  }
}
