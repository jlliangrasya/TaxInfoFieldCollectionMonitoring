import { z } from 'zod'
import { getDb, commit } from '@/data/store'
import { can, PERMISSIONS } from '@/lib/permissions'
import { maskPhone } from '@/lib/format'
import { ACCOUNT_STATUS, round2 } from '@/lib/rpt'
import {
  delay,
  requirePermission,
  accessiblePropertyIds,
  barangayName,
  writeAudit,
  parseOrThrow,
  ValidationError,
} from './core'
import { computeAccounts } from './accounts'
import { PermissionError } from '@/lib/permissions'

// Worst status first, used to summarise a taxpayer with several properties.
const STATUS_RANK = [ACCOUNT_STATUS.OUTSTANDING, ACCOUNT_STATUS.UNPAID, ACCOUNT_STATUS.PARTIAL, ACCOUNT_STATUS.PAID]

function summarise(taxpayer, accounts, db) {
  const balance = round2(accounts.reduce((s, a) => s + a.balance, 0))
  const status = STATUS_RANK.find((s) => accounts.some((a) => a.status === s)) ?? ACCOUNT_STATUS.PAID
  return {
    ...taxpayer,
    barangayName: barangayName(taxpayer.barangayId, db),
    propertyCount: accounts.length,
    balance,
    status,
  }
}

/** @param filters { query, barangayId } */
export async function listTaxpayers(filters = {}) {
  await delay()
  const user = requirePermission(PERMISSIONS.RECORDS_VIEW)
  const db = getDb()
  const accounts = computeAccounts(db, accessiblePropertyIds(user, db))
  const byTaxpayer = new Map()
  for (const a of accounts) {
    if (!byTaxpayer.has(a.taxpayerId)) byTaxpayer.set(a.taxpayerId, [])
    byTaxpayer.get(a.taxpayerId).push(a)
  }
  const q = String(filters.query ?? '').trim().toLowerCase()
  const showContact = can(user, PERMISSIONS.CONTACT_VIEW_FULL)

  return db.taxpayers
    .filter((t) => byTaxpayer.has(t.id))
    .map((t) => summarise({ ...t, contactNo: showContact ? t.contactNo : maskPhone(t.contactNo) }, byTaxpayer.get(t.id), db))
    .filter((t) => {
      if (!q) return true
      const props = byTaxpayer.get(t.id)
      return (
        t.name.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        props.some((p) => [p.arpNo, p.pin, p.tdNo].some((v) => v.toLowerCase().includes(q)))
      )
    })
    .filter((t) => !filters.barangayId || t.barangayId === filters.barangayId || byTaxpayer.get(t.id).some((p) => p.barangayId === filters.barangayId))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function getTaxpayer(id) {
  await delay()
  const user = requirePermission(PERMISSIONS.RECORDS_VIEW)
  const db = getDb()
  const taxpayer = db.taxpayers.find((t) => t.id === id)
  if (!taxpayer) throw new ValidationError('This taxpayer record was not found.')
  const accounts = computeAccounts(db, accessiblePropertyIds(user, db)).filter((a) => a.taxpayerId === id)
  if (!accounts.length && !can(user, PERMISSIONS.RECORDS_VIEW_ALL)) {
    throw new PermissionError('This taxpayer has no properties in your assigned area.')
  }
  const showContact = can(user, PERMISSIONS.CONTACT_VIEW_FULL)
  return {
    ...summarise({ ...taxpayer, contactNo: showContact ? taxpayer.contactNo : maskPhone(taxpayer.contactNo) }, accounts, db),
    properties: accounts,
    dataAsOf: db.meta.dataAsOf,
  }
}

export const taxpayerEditSchema = z.object({
  name: z.string().trim().min(2, 'Please enter the taxpayer name.').max(120, 'Maximum of 120 characters.'),
  address: z.string().trim().min(5, 'Please enter the address.').max(200, 'Maximum of 200 characters.'),
  contactNo: z
    .string()
    .trim()
    .regex(/^(09\d{9})?$/, 'Use an 11-digit mobile number starting with 09, or leave blank.'),
})

export async function updateTaxpayer(id, input) {
  await delay()
  const user = requirePermission(PERMISSIONS.RECORDS_EDIT)
  const data = parseOrThrow(taxpayerEditSchema, input)
  commit((db) => {
    const t = db.taxpayers.find((x) => x.id === id)
    if (!t) throw new ValidationError('This taxpayer record was not found.')
    const changed = Object.keys(data).filter((k) => t[k] !== data[k])
    Object.assign(t, data)
    writeAudit(db, user, 'Taxpayer record updated', `${t.id}: changed ${changed.join(', ') || 'nothing'}`)
  })
}
