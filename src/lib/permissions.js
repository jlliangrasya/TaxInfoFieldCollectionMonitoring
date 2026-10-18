// Single source of truth for who may do what.
// Used by route guards, menus and buttons (to show/hide) AND by every service
// function (to enforce). A future server must enforce the same rules.

export const ROLES = {
  ADMIN: 'admin',
  TREASURY: 'treasury',
  COLLECTOR: 'collector',
}

export const ROLE_LABELS = {
  admin: 'System Administrator',
  treasury: 'Treasury Personnel',
  collector: 'Revenue Collector',
}

export const PERMISSIONS = {
  USERS_MANAGE: 'users.manage',
  AUDIT_VIEW: 'audit.view',
  RECORDS_VIEW: 'records.view',
  RECORDS_VIEW_ALL: 'records.viewAll', // without it, only assigned areas are visible
  RECORDS_EDIT: 'records.edit',
  CONTACT_VIEW_FULL: 'contact.viewFull',
  PAYMENT_RECORD: 'payment.record',
  FIELD_RECORD: 'field.record',
  FIELD_VERIFY: 'field.verify',
  VISITS_VIEW_ALL: 'visits.viewAll',
  GPS_VIEW: 'gps.view',
  ASSIGNMENTS_MANAGE: 'assignments.manage',
  REPORTS_VIEW: 'reports.view',
  DEMO_RESET: 'demo.reset',
}

const P = PERMISSIONS

const ROLE_PERMISSIONS = {
  admin: [
    P.USERS_MANAGE,
    P.AUDIT_VIEW,
    P.RECORDS_VIEW,
    P.RECORDS_VIEW_ALL,
    P.CONTACT_VIEW_FULL,
    P.VISITS_VIEW_ALL,
    P.GPS_VIEW,
    P.REPORTS_VIEW,
    P.DEMO_RESET,
  ],
  treasury: [
    P.AUDIT_VIEW,
    P.RECORDS_VIEW,
    P.RECORDS_VIEW_ALL,
    P.RECORDS_EDIT,
    P.CONTACT_VIEW_FULL,
    P.PAYMENT_RECORD,
    P.FIELD_VERIFY,
    P.VISITS_VIEW_ALL,
    P.GPS_VIEW,
    P.ASSIGNMENTS_MANAGE,
    P.REPORTS_VIEW,
  ],
  collector: [P.RECORDS_VIEW, P.FIELD_RECORD],
}

export function can(user, permission) {
  if (!user || !user.active) return false
  return (ROLE_PERMISSIONS[user.role] ?? []).includes(permission)
}

export class PermissionError extends Error {
  constructor(message = 'You do not have permission to do this.') {
    super(message)
    this.name = 'PermissionError'
  }
}
