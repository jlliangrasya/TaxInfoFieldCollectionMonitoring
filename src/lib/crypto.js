// DEMO-GRADE password hashing using the browser's built-in Web Crypto API
// (PBKDF2 with SHA-256 and a random salt per user). Passwords are never stored
// in plain text. A production system must hash passwords on the server
// (e.g. Argon2 or bcrypt) — never rely on code that runs in the browser.

const ITERATIONS = 100_000

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function fromHex(hex) {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return bytes
}

export function generateSalt() {
  return toHex(crypto.getRandomValues(new Uint8Array(16)))
}

export async function hashPassword(password, saltHex) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations: ITERATIONS },
    key,
    256,
  )
  return toHex(bits)
}

/** Compares in constant time so the check does not leak how many characters matched. */
export async function verifyPassword(password, saltHex, expectedHash) {
  const actual = await hashPassword(password, saltHex)
  if (actual.length !== expectedHash.length) return false
  let diff = 0
  for (let i = 0; i < actual.length; i++) diff |= actual.charCodeAt(i) ^ expectedHash.charCodeAt(i)
  return diff === 0
}

export async function createPasswordRecord(password) {
  const salt = generateSalt()
  return { salt, passwordHash: await hashPassword(password, salt) }
}

/** Password rule shown to users: at least 8 characters with letters and numbers. */
export function passwordProblems(password = '') {
  const problems = []
  if (password.length < 8) problems.push('at least 8 characters')
  if (!/[A-Za-z]/.test(password)) problems.push('at least one letter')
  if (!/\d/.test(password)) problems.push('at least one number')
  return problems
}

/** Random temporary password such as "Kp7m-Wx3r-Q9" (avoids look-alike characters). */
export function generateTempPassword() {
  const letters = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz'
  const digits = '23456789'
  const pick = (set, n) => [...crypto.getRandomValues(new Uint32Array(n))].map((v) => set[v % set.length]).join('')
  return `${pick(letters, 2)}${pick(digits, 1)}${pick(letters, 1)}-${pick(letters, 2)}${pick(digits, 1)}${pick(letters, 1)}-${pick(letters, 1)}${pick(digits, 1)}`
}

/** 0–4 score for the strength meter. */
export function passwordStrength(password = '') {
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++
  return score
}
