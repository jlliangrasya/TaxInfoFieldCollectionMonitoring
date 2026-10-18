import { z } from 'zod'
import { getDb, commit } from '@/data/store'
import { can, PERMISSIONS } from '@/lib/permissions'
import { maskPhone } from '@/lib/format'
import {
  delay,
  requirePermission,
  accessiblePropertyIds,
  assertPropertyAccess,
  userName,
  writeAudit,
  parseOrThrow,
  ValidationError,
} from './core'
import { computeAccounts, matchesQuery } from './accounts'

export async function listBarangays() {
  await delay(0)
  requirePermission(PERMISSIONS.RECORDS_VIEW)
  return getDb().barangays.map((b) => ({ ...b }))
}

/**
 * Lists properties the user may see.
 * @param filters { query, barangayId, status, classification }
 */
export async function listProperties(filters = {}) {
  await delay()
  const user = requirePermission(PERMISSIONS.RECORDS_VIEW)
  const db = getDb()
  return computeAccounts(db, accessiblePropertyIds(user, db))
    .filter((r) => matchesQuery(r, filters.query))
    .filter((r) => !filters.barangayId || r.barangayId === filters.barangayId)
    .filter((r) => !filters.status || r.status === filters.status)
    .filter((r) => !filters.classification || r.classification === filters.classification)
    .sort((a, b) => a.taxpayerName.localeCompare(b.taxpayerName))
}

export async function getProperty(id) {
  await delay()
  const user = requirePermission(PERMISSIONS.RECORDS_VIEW)
  const db = getDb()
  const property = db.properties.find((p) => p.id === id)
  if (!property) throw new ValidationError('This property record was not found.')
  assertPropertyAccess(user, id, db)

  const [account] = computeAccounts(db, new Set([id]))
  const taxpayer = db.taxpayers.find((t) => t.id === property.taxpayerId)
  const showContact = can(user, PERMISSIONS.CONTACT_VIEW_FULL)
  const showGps = can(user, PERMISSIONS.GPS_VIEW)

  return {
    ...account,
    dataAsOf: db.meta.dataAsOf,
    taxpayer: taxpayer && {
      ...taxpayer,
      contactNo: showContact ? taxpayer.contactNo : maskPhone(taxpayer.contactNo),
    },
    payments: db.payments
      .filter((p) => p.propertyId === id)
      .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate))
      .map((p) => ({ ...p, recordedByName: userName(p.recordedBy, db) })),
    fieldCollections: db.fieldCollections
      .filter((f) => f.propertyId === id)
      .sort((a, b) => b.collectionDate.localeCompare(a.collectionDate))
      .map((f) => ({ ...f, collectorName: userName(f.collectorId, db) })),
    visits: db.visits
      .filter((v) => v.propertyId === id)
      .sort((a, b) => b.visitDate.localeCompare(a.visitDate) || b.createdAt.localeCompare(a.createdAt))
      .map((v) => ({ ...v, gps: showGps ? v.gps : v.gps ? 'hidden' : null, collectorName: userName(v.collectorId, db) })),
  }
}

const propertyEditSchema = z.object({
  location: z.string().trim().min(3, 'Please enter the property location.').max(200, 'Maximum of 200 characters.'),
})

export async function updatePropertyLocation(id, input) {
  await delay()
  const user = requirePermission(PERMISSIONS.RECORDS_EDIT)
  const data = parseOrThrow(propertyEditSchema, input)
  commit((db) => {
    const p = db.properties.find((x) => x.id === id)
    if (!p) throw new ValidationError('This property record was not found.')
    const before = p.location
    p.location = data.location
    writeAudit(db, user, 'Property record updated', `${p.arpNo}: location changed from "${before}" to "${data.location}"`)
  })
}
