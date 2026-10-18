import { getDb, commit, nextId } from '@/data/store'
import { PERMISSIONS, ROLE_LABELS } from '@/lib/permissions'
import { createPasswordRecord } from '@/lib/crypto'
import { userCreateSchema, userUpdateSchema, resetPasswordSchema } from '@/lib/validation'
import { delay, requirePermission, publicUser, writeAudit, parseOrThrow, ValidationError } from './core'

export async function listUsers() {
  await delay()
  requirePermission(PERMISSIONS.USERS_MANAGE)
  const now = new Date().toISOString()
  return getDb()
    .users.map((u) => ({ ...publicUser(u), locked: Boolean(u.lockedUntil && u.lockedUntil > now) }))
    .sort((a, b) => a.role.localeCompare(b.role) || a.fullName.localeCompare(b.fullName))
}

export async function createUser(input) {
  await delay()
  const admin = requirePermission(PERMISSIONS.USERS_MANAGE)
  const data = parseOrThrow(userCreateSchema, input)
  if (getDb().users.some((u) => u.username.toLowerCase() === data.username)) {
    throw new ValidationError('Please correct the highlighted fields.', { username: 'This username is already taken.' })
  }
  const record = await createPasswordRecord(data.tempPassword)
  return commit((d) => {
    const user = {
      id: nextId('U', 3),
      username: data.username,
      fullName: data.fullName,
      role: data.role,
      position: data.position,
      ...record,
      active: true,
      mustChangePassword: true,
      failedAttempts: 0,
      lockedUntil: null,
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
    }
    d.users.push(user)
    writeAudit(d, admin, 'User created', `${user.username} (${ROLE_LABELS[user.role]})`)
    return publicUser(user)
  })
}

export async function updateUser(id, input) {
  await delay()
  const admin = requirePermission(PERMISSIONS.USERS_MANAGE)
  const data = parseOrThrow(userUpdateSchema, input)
  const target = getDb().users.find((u) => u.id === id)
  if (!target) throw new ValidationError('This user was not found.')
  if (id === admin.id && data.role !== admin.role) {
    throw new ValidationError('You cannot change your own role. Ask another administrator.')
  }
  commit((d) => {
    const u = d.users.find((x) => x.id === id)
    const changes = Object.keys(data).filter((k) => u[k] !== data[k])
    Object.assign(u, data)
    writeAudit(d, admin, 'User updated', `${u.username}: changed ${changes.join(', ') || 'nothing'}`)
  })
}

export async function setUserActive(id, active) {
  await delay()
  const admin = requirePermission(PERMISSIONS.USERS_MANAGE)
  if (id === admin.id && !active) throw new ValidationError('You cannot deactivate your own account.')
  const db = getDb()
  const target = db.users.find((u) => u.id === id)
  if (!target) throw new ValidationError('This user was not found.')
  if (!active && target.role === 'admin' && db.users.filter((u) => u.role === 'admin' && u.active).length <= 1) {
    throw new ValidationError('At least one active System Administrator is required.')
  }
  commit((d) => {
    const u = d.users.find((x) => x.id === id)
    u.active = active
    writeAudit(d, admin, active ? 'User activated' : 'User deactivated', u.username)
  })
}

export async function resetUserPassword(id, input) {
  await delay()
  const admin = requirePermission(PERMISSIONS.USERS_MANAGE)
  const data = parseOrThrow(resetPasswordSchema, input)
  if (!getDb().users.some((u) => u.id === id)) throw new ValidationError('This user was not found.')
  const record = await createPasswordRecord(data.tempPassword)
  commit((d) => {
    const u = d.users.find((x) => x.id === id)
    Object.assign(u, record, { mustChangePassword: true, failedAttempts: 0, lockedUntil: null })
    writeAudit(d, admin, 'Password reset', `${u.username} must set a new password at next login`)
  })
}

export async function unlockUser(id) {
  await delay()
  const admin = requirePermission(PERMISSIONS.USERS_MANAGE)
  commit((d) => {
    const u = d.users.find((x) => x.id === id)
    if (!u) throw new ValidationError('This user was not found.')
    u.lockedUntil = null
    u.failedAttempts = 0
    writeAudit(d, admin, 'User unlocked', u.username)
  })
}
