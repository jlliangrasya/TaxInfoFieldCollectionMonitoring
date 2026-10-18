import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns'

const pesoFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const numberFormatter = new Intl.NumberFormat('en-PH')

export function peso(amount) {
  return pesoFormatter.format(Number(amount) || 0)
}

export function number(value) {
  return numberFormatter.format(Number(value) || 0)
}

function toDate(value) {
  if (!value) return null
  const d = value instanceof Date ? value : parseISO(value)
  return isValid(d) ? d : null
}

/** 18 Oct 2026 */
export function formatDate(value) {
  const d = toDate(value)
  return d ? format(d, 'd MMM yyyy') : '—'
}

/** 18 Oct 2026, 2:05 PM */
export function formatDateTime(value) {
  const d = toDate(value)
  return d ? format(d, 'd MMM yyyy, h:mm a') : '—'
}

export function timeAgo(value) {
  const d = toDate(value)
  return d ? formatDistanceToNow(d, { addSuffix: true }) : '—'
}

/** yyyy-MM-dd in local time (for date inputs and comparisons) */
export function isoDate(value = new Date()) {
  const d = toDate(value) ?? new Date()
  return format(d, 'yyyy-MM-dd')
}

/** 09•• ••• 4321 — hides most of a phone number */
export function maskPhone(phone) {
  if (!phone) return '—'
  const digits = String(phone).replace(/\D/g, '')
  if (digits.length < 7) return '•••'
  return `${digits.slice(0, 2)}•• ••• ${digits.slice(-4)}`
}

export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w) && !w.endsWith('.'))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}
