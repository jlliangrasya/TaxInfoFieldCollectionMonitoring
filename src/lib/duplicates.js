// Duplicate-entry rules for collection records.
//   BLOCK  — the record cannot be saved.
//   WARN   — the user is asked to confirm; if saved, it is flagged for Treasury review.

import { round2 } from './rpt'

export function normalizeOrNo(orNo) {
  return String(orNo ?? '').replace(/\s+/g, '').toUpperCase()
}

/** An Official Receipt number may only be used once. */
export function findOrNoConflict(orNo, payments) {
  const key = normalizeOrNo(orNo)
  if (!key) return null
  return payments.find((p) => p.orNo && normalizeOrNo(p.orNo) === key) ?? null
}

/**
 * Finds existing records for the same property, same tax year, same amount and same date.
 * Rejected field records are ignored.
 */
export function findSimilarRecords({ propertyId, taxYear, amount, date }, { payments, fieldCollections }) {
  const amt = round2(amount)
  const samePayments = payments.filter(
    (p) =>
      p.propertyId === propertyId &&
      p.taxYear === taxYear &&
      round2(p.amount) === amt &&
      p.paymentDate === date,
  )
  const sameField = fieldCollections.filter(
    (f) =>
      f.status !== 'rejected' &&
      f.propertyId === propertyId &&
      f.taxYear === taxYear &&
      round2(f.amount) === amt &&
      f.collectionDate === date,
  )
  return [...samePayments, ...sameField]
}

/** Amount may not exceed the remaining balance (including pending field records). */
export function exceedsBalance(amount, balance) {
  return round2(amount) > round2(balance) + 0.005
}
