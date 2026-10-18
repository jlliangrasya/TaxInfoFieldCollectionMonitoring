import { addMinutes, differenceInMinutes } from 'date-fns'
import { getDb, commit } from '@/data/store'
import { verifyPassword, hashPassword, createPasswordRecord, passwordProblems } from '@/lib/crypto'
import { MAX_FAILED_LOGINS, LOCKOUT_MINUTES } from '@/lib/constants'
import {
  delay,
  setSessionUserId,
  getSessionUser,
  requireUser,
  publicUser,
  writeAudit,
  ValidationError,
} from './core'

// DEMO NOTE: the session is kept in sessionStorage, so it ends when the browser
// tab is closed. A real system would use a secure, HTTP-only cookie set by the server.
const SESSION_KEY = 'rpt-demo-session'
const GENERIC_LOGIN_ERROR = 'Incorrect username or password.'

function saveSession(userId) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ userId, loginAt: new Date().toISOString() }))
  } catch {
    // Session will last until the page is refreshed.
  }
}

function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // ignore
  }
}

export function restoreSession() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null')
    if (saved?.userId) {
      setSessionUserId(saved.userId)
      const user = getSessionUser()
      if (user) return publicUser(user)
    }
  } catch {
    // fall through
  }
  setSessionUserId(null)
  clearSession()
  return null
}

export function getCurrentUser() {
  return publicUser(getSessionUser())
}

export async function login(username, password) {
  await delay(400)
  const name = String(username ?? '').trim().toLowerCase()
  const db = getDb()
  const user = db.users.find((u) => u.username.toLowerCase() === name)

  if (!user) {
    // Spend the same time as a real check so the response does not reveal whether the username exists.
    await hashPassword(String(password ?? ''), '00'.repeat(16))
    commit((d) => writeAudit(d, { id: null, username: name || '(blank)' }, 'Failed login', 'Unknown username'))
    throw new ValidationError(GENERIC_LOGIN_ERROR)
  }

  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    const minutes = Math.max(1, differenceInMinutes(new Date(user.lockedUntil), new Date()) + 1)
    throw new ValidationError(
      `This account is temporarily locked after too many failed attempts. Please try again in ${minutes} minute(s) or contact the System Administrator.`,
    )
  }

  const ok = await verifyPassword(String(password ?? ''), user.salt, user.passwordHash)
  if (!ok) {
    commit((d) => {
      const u = d.users.find((x) => x.id === user.id)
      u.failedAttempts += 1
      writeAudit(d, u, 'Failed login', `Wrong password (attempt ${u.failedAttempts} of ${MAX_FAILED_LOGINS})`)
      if (u.failedAttempts >= MAX_FAILED_LOGINS) {
        u.lockedUntil = addMinutes(new Date(), LOCKOUT_MINUTES).toISOString()
        u.failedAttempts = 0
        writeAudit(d, u, 'Account locked', `Locked for ${LOCKOUT_MINUTES} minutes after ${MAX_FAILED_LOGINS} failed attempts`)
      }
    })
    throw new ValidationError(GENERIC_LOGIN_ERROR)
  }

  if (!user.active) {
    commit((d) => writeAudit(d, user, 'Failed login', 'Account is deactivated'))
    throw new ValidationError('This account has been deactivated. Please contact the System Administrator.')
  }

  commit((d) => {
    const u = d.users.find((x) => x.id === user.id)
    u.failedAttempts = 0
    u.lockedUntil = null
    u.lastLoginAt = new Date().toISOString()
    writeAudit(d, u, 'Logged in')
  })
  setSessionUserId(user.id)
  saveSession(user.id)
  return publicUser(user)
}

export async function logout(reason = '') {
  const user = getSessionUser()
  if (user) commit((d) => writeAudit(d, user, 'Logged out', reason))
  setSessionUserId(null)
  clearSession()
}

export async function changePassword({ currentPassword, newPassword }) {
  await delay()
  const user = requireUser()
  if (!(await verifyPassword(String(currentPassword ?? ''), user.salt, user.passwordHash))) {
    throw new ValidationError('Please correct the highlighted fields.', {
      currentPassword: 'Your current password is incorrect.',
    })
  }
  const problems = passwordProblems(newPassword)
  if (problems.length) {
    throw new ValidationError('Please correct the highlighted fields.', {
      newPassword: `Password needs ${problems.join(', ')}.`,
    })
  }
  if (newPassword === currentPassword) {
    throw new ValidationError('Please correct the highlighted fields.', {
      newPassword: 'New password must be different from the current password.',
    })
  }
  const record = await createPasswordRecord(newPassword)
  commit((d) => {
    const u = d.users.find((x) => x.id === user.id)
    Object.assign(u, record, { mustChangePassword: false })
    writeAudit(d, u, 'Password changed')
  })
  return publicUser(getSessionUser())
}
