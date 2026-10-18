export const APP_NAME = 'RPT Field Collection Monitoring'
export const APP_FULL_NAME =
  'Real Property Tax Information and Field Collection Monitoring System'
export const LGU_NAME = 'Demo Municipality'
export const OFFICE_NAME = "Municipal Treasurer's Office"

export const DEMO_NOTICE = 'DEMO — SAMPLE DATA ONLY, NOT AN OFFICIAL RECORD'

// Security settings
export const MAX_FAILED_LOGINS = 5
export const LOCKOUT_MINUTES = 5
export const IDLE_TIMEOUT_MINUTES = 15
export const IDLE_WARNING_SECONDS = 60

export const VISIT_OUTCOMES = [
  { value: 'paid_full', label: 'Paid in full (field collection)', collects: true },
  { value: 'paid_partial', label: 'Partial payment (field collection)', collects: true },
  { value: 'promised', label: 'Promised to pay', followUp: true },
  { value: 'not_home', label: 'Taxpayer not at home', followUp: true },
  { value: 'refused', label: 'Refused to pay', followUp: true },
  { value: 'not_found', label: 'Taxpayer or property not found' },
  { value: 'other', label: 'Other (explain in remarks)' },
]

export function outcomeLabel(value) {
  return VISIT_OUTCOMES.find((o) => o.value === value)?.label ?? value
}

// Follow-up status shown on an account, derived from the latest field visit.
export const FOLLOW_UP_LABELS = {
  paid_full: 'Collected in field',
  paid_partial: 'Partially collected in field',
  promised: 'Promised to pay',
  not_home: 'For follow-up',
  refused: 'Refused',
  not_found: 'Taxpayer not found',
  other: 'For follow-up',
}

export const FIELD_STATUS_LABELS = {
  pending: 'Pending verification',
  verified: 'Verified by Treasury',
  rejected: 'Rejected',
}

export const OR_NO_PATTERN = /^\d{6,10}$/
export const ARP_PATTERN = /^\d{2}-\d{4}-\d{5}$/
