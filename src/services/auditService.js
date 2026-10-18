import { getDb, commit, resetStore, getStoreStatus } from '@/data/store'
import { PERMISSIONS } from '@/lib/permissions'
import { delay, requireUser, requirePermission, writeAudit } from './core'

/** @param filters { query, action, userId, from, to } */
export async function listAuditLog(filters = {}) {
  await delay()
  requirePermission(PERMISSIONS.AUDIT_VIEW)
  const q = String(filters.query ?? '').trim().toLowerCase()
  return getDb().auditLog.filter((e) => {
    if (filters.action && e.action !== filters.action) return false
    if (filters.userId && e.userId !== filters.userId) return false
    const day = e.at.slice(0, 10)
    if (filters.from && day < filters.from) return false
    if (filters.to && day > filters.to) return false
    if (q && ![e.username, e.action, e.details].some((v) => v.toLowerCase().includes(q))) return false
    return true
  })
}

export async function listAuditActions() {
  await delay(0)
  requirePermission(PERMISSIONS.AUDIT_VIEW)
  return [...new Set(getDb().auditLog.map((e) => e.action))].sort()
}

/** Records an action that happens outside the services (e.g. a report export). */
export function logAction(action, details) {
  const user = requireUser()
  commit((d) => writeAudit(d, user, action, details))
}

export async function resetDemoData() {
  await delay(400)
  const user = requirePermission(PERMISSIONS.DEMO_RESET)
  await resetStore()
  commit((d) => writeAudit(d, user, 'Demo data reset', 'All demo records were restored to the original sample data.'))
}

export function getDemoStatus() {
  const db = getDb()
  return { ...getStoreStatus(), seededAt: db.meta.seededAt, dataAsOf: db.meta.dataAsOf }
}
