// Shared helpers for all services: the signed-in user, permission checks,
// audit logging, and which records a user is allowed to see.
import { getDb } from '@/data/store'
import { can, PermissionError, PERMISSIONS } from '@/lib/permissions'
import { isoDate } from '@/lib/format'

const LATENCY_MS = import.meta.env.MODE === 'test' ? 0 : 180
const MAX_AUDIT_ENTRIES = 3000

let sessionUserId = null

export class AuthError extends Error {
  constructor(message = 'Your session has ended. Please log in again.') {
    super(message)
    this.name = 'AuthError'
  }
}

export class ValidationError extends Error {
  constructor(message, fieldErrors = {}) {
    super(message)
    this.name = 'ValidationError'
    this.fieldErrors = fieldErrors
  }
}

/** Raised when a record looks like a duplicate. The user may confirm and save anyway. */
export class DuplicateWarning extends Error {
  constructor(message, matches = []) {
    super(message)
    this.name = 'DuplicateWarning'
    this.matches = matches
  }
}

/** Simulates network time so loading states behave like the real system. */
export function delay(ms = LATENCY_MS) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function setSessionUserId(id) {
  sessionUserId = id
}

export function getSessionUser() {
  if (!sessionUserId) return null
  const user = getDb().users.find((u) => u.id === sessionUserId)
  return user && user.active ? user : null
}

export function requireUser() {
  const user = getSessionUser()
  if (!user) throw new AuthError()
  return user
}

export function requirePermission(permission) {
  const user = requireUser()
  if (!can(user, permission)) throw new PermissionError()
  return user
}

/** Never send password data to the screens. */
export function publicUser(user) {
  if (!user) return null
  // eslint-disable-next-line no-unused-vars
  const { salt, passwordHash, ...rest } = user
  return rest
}

export function writeAudit(db, user, action, details = '') {
  const counters = db.meta.counters
  counters.LOG = (counters.LOG ?? 1) + 1
  db.auditLog.unshift({
    id: `LOG-${String(counters.LOG).padStart(6, '0')}`,
    at: new Date().toISOString(),
    userId: user?.id ?? null,
    username: user?.username ?? 'unknown',
    action,
    details,
  })
  if (db.auditLog.length > MAX_AUDIT_ENTRIES) db.auditLog.length = MAX_AUDIT_ENTRIES
}

function isActiveAssignment(a, today) {
  return a.active && a.startDate <= today && a.endDate >= today
}

/**
 * Returns null when the user may see every property; otherwise the property
 * IDs within the collector's active assignments.
 */
export function accessiblePropertyIds(user, db = getDb()) {
  if (can(user, PERMISSIONS.RECORDS_VIEW_ALL)) return null
  const today = isoDate()
  const mine = db.assignments.filter((a) => a.collectorId === user.id && isActiveAssignment(a, today))
  const barangayIds = new Set(mine.filter((a) => !a.propertyId).map((a) => a.barangayId))
  const ids = new Set(mine.filter((a) => a.propertyId).map((a) => a.propertyId))
  for (const p of db.properties) if (barangayIds.has(p.barangayId)) ids.add(p.id)
  return ids
}

export function assertPropertyAccess(user, propertyId, db = getDb()) {
  const ids = accessiblePropertyIds(user, db)
  if (ids && !ids.has(propertyId)) {
    throw new PermissionError('This property is not in your assigned area.')
  }
}

/** Current collector responsible for a property (property assignment first, then barangay). */
export function assignedCollectorId(property, db = getDb()) {
  const today = isoDate()
  const active = db.assignments.filter((a) => isActiveAssignment(a, today))
  return (
    active.find((a) => a.propertyId === property.id)?.collectorId ??
    active.find((a) => !a.propertyId && a.barangayId === property.barangayId)?.collectorId ??
    null
  )
}

export function userName(id, db = getDb()) {
  return db.users.find((u) => u.id === id)?.fullName ?? '—'
}

export function barangayName(id, db = getDb()) {
  return db.barangays.find((b) => b.id === id)?.name ?? '—'
}

/** Turns zod errors into a ValidationError with a message per field. */
export function parseOrThrow(schema, input) {
  const result = schema.safeParse(input)
  if (result.success) return result.data
  const fieldErrors = {}
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || 'form'
    fieldErrors[key] ??= issue.message
  }
  throw new ValidationError('Please correct the highlighted fields.', fieldErrors)
}
