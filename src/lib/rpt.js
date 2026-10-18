// Real Property Tax calculations used throughout the demo.
// Amounts follow the general structure of the Local Government Code:
// Basic RPT (1% of assessed value) + Special Education Fund (1%).
// Penalties and discounts are out of scope for this demo.

export const BASIC_RATE = 0.01
export const SEF_RATE = 0.01

export const ACCOUNT_STATUS = {
  PAID: 'paid',
  PARTIAL: 'partial',
  UNPAID: 'unpaid',
  OUTSTANDING: 'outstanding', // unpaid balance from a previous tax year
}

export const STATUS_LABELS = {
  paid: 'Paid',
  partial: 'Partially Paid',
  unpaid: 'Unpaid',
  outstanding: 'Outstanding (Past Years)',
}

export function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100
}

export function computeTaxDue(assessedValue) {
  const basicTax = round2(assessedValue * BASIC_RATE)
  const sefTax = round2(assessedValue * SEF_RATE)
  return { basicTax, sefTax, amountDue: round2(basicTax + sefTax) }
}

/** Status of one property for one tax year. */
export function yearStatus(amountDue, amountPaid) {
  if (amountPaid >= amountDue - 0.005) return ACCOUNT_STATUS.PAID
  if (amountPaid > 0) return ACCOUNT_STATUS.PARTIAL
  return ACCOUNT_STATUS.UNPAID
}

/**
 * Builds the year-by-year ledger of a property.
 * Only Treasury-recorded payments count. Field records count only after verification
 * (at which point a payment entry is created for them).
 */
export function buildLedger(assessments, payments) {
  return assessments
    .slice()
    .sort((a, b) => b.taxYear - a.taxYear)
    .map((a) => {
      const amountPaid = round2(
        payments.filter((p) => p.taxYear === a.taxYear).reduce((sum, p) => sum + p.amount, 0),
      )
      const balance = round2(Math.max(0, a.amountDue - amountPaid))
      return { ...a, amountPaid, balance, status: yearStatus(a.amountDue, amountPaid) }
    })
}

/**
 * Overall status of a property account.
 * Any unpaid balance from a past year → Outstanding. Otherwise the current year's status.
 */
export function accountSummary(ledger, currentYear) {
  const totalDue = round2(ledger.reduce((s, y) => s + y.amountDue, 0))
  const totalPaid = round2(ledger.reduce((s, y) => s + y.amountPaid, 0))
  const balance = round2(ledger.reduce((s, y) => s + y.balance, 0))
  const pastBalance = round2(
    ledger.filter((y) => y.taxYear < currentYear).reduce((s, y) => s + y.balance, 0),
  )
  const current = ledger.find((y) => y.taxYear === currentYear)

  let status
  if (pastBalance > 0) status = ACCOUNT_STATUS.OUTSTANDING
  else if (!current) status = balance > 0 ? ACCOUNT_STATUS.UNPAID : ACCOUNT_STATUS.PAID
  else status = current.status

  return { totalDue, totalPaid, balance, pastBalance, status }
}
