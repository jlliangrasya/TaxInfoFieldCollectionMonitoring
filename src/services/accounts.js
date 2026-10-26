// Builds the "account" view of each property (balances, status, follow-up)
// used by property lists, collection monitoring, dashboards and reports.
import { buildLedger, accountSummary, round2 } from '@/lib/rpt'
import { FOLLOW_UP_LABELS } from '@/lib/constants'
import { assignedCollectorId } from './core'

function groupBy(items, key) {
  const map = new Map()
  for (const item of items) {
    const k = item[key]
    if (!map.has(k)) map.set(k, [])
    map.get(k).push(item)
  }
  return map
}

export function latestVisit(visits = []) {
  return visits.reduce((latest, v) => {
    if (!latest) return v
    if (v.visitDate !== latest.visitDate) return v.visitDate > latest.visitDate ? v : latest
    return v.createdAt > latest.createdAt ? v : latest
  }, null)
}

/** @param propertyIds Set of allowed IDs, or null for all. */
export function computeAccounts(db, propertyIds = null) {
  const currentYear = new Date().getFullYear()
  const assessmentsBy = groupBy(db.assessments, 'propertyId')
  const paymentsBy = groupBy(db.payments, 'propertyId')
  const pendingBy = groupBy(db.fieldCollections.filter((f) => f.status === 'pending'), 'propertyId')
  const visitsBy = groupBy(db.visits, 'propertyId')
  const taxpayers = new Map(db.taxpayers.map((t) => [t.id, t]))
  const barangays = new Map(db.barangays.map((b) => [b.id, b]))
  const users = new Map(db.users.map((u) => [u.id, u]))

  return db.properties
    .filter((p) => !propertyIds || propertyIds.has(p.id))
    .map((p) => {
      const ledger = buildLedger(assessmentsBy.get(p.id) ?? [], paymentsBy.get(p.id) ?? [])
      const summary = accountSummary(ledger, currentYear)
      const pendingFieldAmount = round2((pendingBy.get(p.id) ?? []).reduce((s, f) => s + f.amount, 0))
      const visits = visitsBy.get(p.id) ?? []
      const last = latestVisit(visits)
      const collectorId = assignedCollectorId(p, db)
      const needsFollowUp = summary.balance > 0
      return {
        ...p,
        taxpayerName: taxpayers.get(p.taxpayerId)?.name ?? '—',
        barangayName: barangays.get(p.barangayId)?.name ?? '—',
        ledger,
        ...summary,
        pendingFieldAmount,
        visitCount: visits.length,
        lastVisitDate: last?.visitDate ?? null,
        lastOutcome: last?.outcome ?? null,
        followUpStatus: needsFollowUp && last ? FOLLOW_UP_LABELS[last.outcome] ?? 'For follow-up' : needsFollowUp ? 'Not yet visited' : '—',
        followUpDate: needsFollowUp ? last?.followUpDate ?? null : null,
        assignedCollectorId: collectorId,
        assignedCollectorName: collectorId ? users.get(collectorId)?.fullName ?? '—' : 'Unassigned',
      }
    })
}

export function matchesQuery(row, query) {
  const q = String(query ?? '').trim().toLowerCase()
  if (!q) return true
  return [row.taxpayerName, row.taxpayerId, row.arpNo, row.pin, row.tdNo, row.id, row.barangayName]
    .filter(Boolean)
    .some((v) => String(v).toLowerCase().includes(q))
}
