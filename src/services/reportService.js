import { getDb } from '@/data/store'
import { can, PERMISSIONS, PermissionError } from '@/lib/permissions'
import { round2, STATUS_LABELS, ACCOUNT_STATUS } from '@/lib/rpt'
import { outcomeLabel, FIELD_STATUS_LABELS } from '@/lib/constants'
import { formatDate } from '@/lib/format'
import { delay, requireUser, accessiblePropertyIds, userName, barangayName } from './core'
import { computeAccounts } from './accounts'

export const REPORT_TYPES = [
  {
    id: 'collector_activity',
    title: 'Collection Activity by Collector',
    description: 'Visits made and amounts collected in the field by each Revenue Collector.',
    filters: ['dateRange', 'barangay', 'collector'],
    collectorAllowed: true,
  },
  {
    id: 'barangay_activity',
    title: 'Collection Activity by Barangay',
    description: 'Visits, payments and outstanding balances for each barangay.',
    filters: ['dateRange', 'barangay'],
  },
  {
    id: 'status_summary',
    title: 'Paid / Unpaid Account Summary',
    description: 'Number of accounts and amounts per payment status.',
    filters: ['barangay'],
  },
  {
    id: 'outstanding',
    title: 'Outstanding Balances',
    description: 'Properties that still have an unpaid balance, largest first.',
    filters: ['barangay', 'status'],
  },
  {
    id: 'payments',
    title: 'Payments Recorded',
    description: 'Treasury-recorded payments with Official Receipt numbers.',
    filters: ['dateRange', 'barangay'],
  },
  {
    id: 'visit_log',
    title: 'Field Visit Log',
    description: 'Every field visit with its result and remarks.',
    filters: ['dateRange', 'barangay', 'collector'],
    collectorAllowed: true,
  },
]

export function availableReports(user) {
  if (can(user, PERMISSIONS.REPORTS_VIEW)) return REPORT_TYPES
  if (can(user, PERMISSIONS.FIELD_RECORD)) return REPORT_TYPES.filter((r) => r.collectorAllowed)
  return []
}

const inRange = (date, { from, to }) => (!from || date >= from) && (!to || date <= to)

function filtersText(f, db) {
  const parts = []
  if (f.from || f.to) parts.push(`Period: ${f.from ? formatDate(f.from) : 'beginning'} to ${f.to ? formatDate(f.to) : 'today'}`)
  parts.push(`Barangay: ${f.barangayId ? barangayName(f.barangayId, db) : 'All'}`)
  if (f.collectorId !== undefined) parts.push(`Collector: ${f.collectorId ? userName(f.collectorId, db) : 'All'}`)
  if (f.status) parts.push(`Status: ${STATUS_LABELS[f.status]}`)
  return parts.join(' · ')
}

/**
 * @param type one of REPORT_TYPES ids
 * @param filters { from, to, barangayId, collectorId, status }
 * @returns { title, filtersText, columns, rows, totals }
 */
export async function generateReport(type, filters = {}) {
  await delay()
  const user = requireUser()
  const def = availableReports(user).find((r) => r.id === type)
  if (!def) throw new PermissionError('You do not have access to this report.')

  const db = getDb()
  const f = { ...filters }
  // Collectors only ever see their own activity.
  if (!can(user, PERMISSIONS.REPORTS_VIEW)) f.collectorId = user.id
  if (!def.filters.includes('collector')) delete f.collectorId
  else f.collectorId ??= ''

  const accounts = computeAccounts(db, accessiblePropertyIds(user, db))
  const propertyMap = new Map(db.properties.map((p) => [p.id, p]))
  const inBarangay = (propertyId) => !f.barangayId || propertyMap.get(propertyId)?.barangayId === f.barangayId

  let columns
  let rows
  let totals

  switch (type) {
    case 'collector_activity': {
      const collectors = db.users.filter((u) => u.role === 'collector' && (!f.collectorId || u.id === f.collectorId))
      columns = [
        { key: 'collector', label: 'Collector' },
        { key: 'visits', label: 'Visits', type: 'number' },
        { key: 'properties', label: 'Properties Visited', type: 'number' },
        { key: 'collections', label: 'Field Records', type: 'number' },
        { key: 'verified', label: 'Verified Amount', type: 'money' },
        { key: 'pending', label: 'Pending Verification', type: 'money' },
        { key: 'followUps', label: 'Follow-ups Set', type: 'number' },
      ]
      rows = collectors.map((c) => {
        const visits = db.visits.filter((v) => v.collectorId === c.id && inRange(v.visitDate, f) && inBarangay(v.propertyId))
        const fcs = db.fieldCollections.filter(
          (x) => x.collectorId === c.id && x.status !== 'rejected' && inRange(x.collectionDate, f) && inBarangay(x.propertyId),
        )
        return {
          collector: c.fullName + (c.active ? '' : ' (inactive)'),
          visits: visits.length,
          properties: new Set(visits.map((v) => v.propertyId)).size,
          collections: fcs.length,
          verified: round2(fcs.filter((x) => x.status === 'verified').reduce((s, x) => s + x.amount, 0)),
          pending: round2(fcs.filter((x) => x.status === 'pending').reduce((s, x) => s + x.amount, 0)),
          followUps: visits.filter((v) => v.followUpDate).length,
        }
      })
      totals = sumColumns(rows, ['visits', 'properties', 'collections', 'verified', 'pending', 'followUps'])
      totals.collector = 'TOTAL'
      break
    }
    case 'barangay_activity': {
      columns = [
        { key: 'barangay', label: 'Barangay' },
        { key: 'properties', label: 'Properties', type: 'number' },
        { key: 'visits', label: 'Field Visits', type: 'number' },
        { key: 'fieldVerified', label: 'Field Collections (Verified)', type: 'money' },
        { key: 'payments', label: 'Total Payments Recorded', type: 'money' },
        { key: 'balance', label: 'Outstanding Balance', type: 'money' },
      ]
      rows = db.barangays
        .filter((b) => !f.barangayId || b.id === f.barangayId)
        .map((b) => {
          const accts = accounts.filter((a) => a.barangayId === b.id)
          const ids = new Set(accts.map((a) => a.id))
          const pays = db.payments.filter((p) => ids.has(p.propertyId) && inRange(p.paymentDate, f))
          return {
            barangay: b.name,
            properties: accts.length,
            visits: db.visits.filter((v) => ids.has(v.propertyId) && inRange(v.visitDate, f)).length,
            fieldVerified: round2(pays.filter((p) => p.source === 'field').reduce((s, p) => s + p.amount, 0)),
            payments: round2(pays.reduce((s, p) => s + p.amount, 0)),
            balance: round2(accts.reduce((s, a) => s + a.balance, 0)),
          }
        })
        .filter((r) => r.properties > 0)
      totals = { barangay: 'TOTAL', ...sumColumns(rows, ['properties', 'visits', 'fieldVerified', 'payments', 'balance']) }
      break
    }
    case 'status_summary': {
      columns = [
        { key: 'status', label: 'Status' },
        { key: 'accounts', label: 'Accounts', type: 'number' },
        { key: 'totalDue', label: 'Total Amount Due', type: 'money' },
        { key: 'totalPaid', label: 'Total Paid', type: 'money' },
        { key: 'balance', label: 'Balance', type: 'money' },
      ]
      const scoped = accounts.filter((a) => !f.barangayId || a.barangayId === f.barangayId)
      rows = Object.values(ACCOUNT_STATUS).map((s) => {
        const list = scoped.filter((a) => a.status === s)
        return {
          status: STATUS_LABELS[s],
          accounts: list.length,
          totalDue: round2(list.reduce((t, a) => t + a.totalDue, 0)),
          totalPaid: round2(list.reduce((t, a) => t + a.totalPaid, 0)),
          balance: round2(list.reduce((t, a) => t + a.balance, 0)),
        }
      })
      totals = { status: 'TOTAL', ...sumColumns(rows, ['accounts', 'totalDue', 'totalPaid', 'balance']) }
      break
    }
    case 'outstanding': {
      columns = [
        { key: 'arpNo', label: 'ARP No.' },
        { key: 'taxpayer', label: 'Taxpayer' },
        { key: 'barangay', label: 'Barangay' },
        { key: 'status', label: 'Status' },
        { key: 'pastBalance', label: 'Past Years', type: 'money' },
        { key: 'balance', label: 'Total Balance', type: 'money' },
        { key: 'lastVisit', label: 'Last Visit', type: 'date' },
        { key: 'followUp', label: 'Follow-up Status' },
      ]
      rows = accounts
        .filter((a) => a.balance > 0)
        .filter((a) => !f.barangayId || a.barangayId === f.barangayId)
        .filter((a) => !f.status || a.status === f.status)
        .sort((a, b) => b.balance - a.balance)
        .map((a) => ({
          arpNo: a.arpNo,
          taxpayer: a.taxpayerName,
          barangay: a.barangayName,
          status: STATUS_LABELS[a.status],
          pastBalance: a.pastBalance,
          balance: a.balance,
          lastVisit: a.lastVisitDate,
          followUp: a.followUpStatus,
        }))
      totals = { arpNo: 'TOTAL', ...sumColumns(rows, ['pastBalance', 'balance']) }
      break
    }
    case 'payments': {
      columns = [
        { key: 'date', label: 'Payment Date', type: 'date' },
        { key: 'orNo', label: 'OR No.' },
        { key: 'arpNo', label: 'ARP No.' },
        { key: 'taxpayer', label: 'Taxpayer' },
        { key: 'barangay', label: 'Barangay' },
        { key: 'taxYear', label: 'Tax Year' },
        { key: 'source', label: 'Source' },
        { key: 'amount', label: 'Amount', type: 'money' },
      ]
      const allowed = new Set(accounts.map((a) => a.id))
      rows = db.payments
        .filter((p) => allowed.has(p.propertyId) && inRange(p.paymentDate, f) && inBarangay(p.propertyId))
        .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate))
        .map((p) => {
          const a = accounts.find((x) => x.id === p.propertyId)
          return {
            date: p.paymentDate,
            orNo: p.orNo,
            arpNo: a.arpNo,
            taxpayer: a.taxpayerName,
            barangay: a.barangayName,
            taxYear: String(p.taxYear),
            source: p.source === 'field' ? 'Field (verified)' : 'Treasury counter',
            amount: p.amount,
          }
        })
      totals = { date: 'TOTAL', ...sumColumns(rows, ['amount']) }
      break
    }
    case 'visit_log': {
      columns = [
        { key: 'date', label: 'Visit Date', type: 'date' },
        { key: 'collector', label: 'Collector' },
        { key: 'arpNo', label: 'ARP No.' },
        { key: 'taxpayer', label: 'Taxpayer' },
        { key: 'barangay', label: 'Barangay' },
        { key: 'outcome', label: 'Result' },
        { key: 'amount', label: 'Amount Collected', type: 'money' },
        { key: 'recordStatus', label: 'Record Status' },
        { key: 'followUpDate', label: 'Follow-up', type: 'date' },
        { key: 'remarks', label: 'Remarks' },
      ]
      rows = db.visits
        .filter((v) => (!f.collectorId || v.collectorId === f.collectorId) && inRange(v.visitDate, f) && inBarangay(v.propertyId))
        .sort((a, b) => b.visitDate.localeCompare(a.visitDate))
        .map((v) => {
          const a = accounts.find((x) => x.id === v.propertyId) ?? {}
          const fc = v.fieldCollectionId ? db.fieldCollections.find((x) => x.id === v.fieldCollectionId) : null
          return {
            date: v.visitDate,
            collector: userName(v.collectorId, db),
            arpNo: a.arpNo ?? propertyMap.get(v.propertyId)?.arpNo ?? '—',
            taxpayer: a.taxpayerName ?? '—',
            barangay: barangayName(propertyMap.get(v.propertyId)?.barangayId, db),
            outcome: outcomeLabel(v.outcome),
            amount: fc?.amount ?? null,
            recordStatus: fc ? FIELD_STATUS_LABELS[fc.status] : '',
            followUpDate: v.followUpDate,
            remarks: v.remarks,
          }
        })
      totals = { date: 'TOTAL', collector: `${rows.length} visit(s)`, ...sumColumns(rows, ['amount']) }
      break
    }
    default:
      throw new PermissionError('Unknown report.')
  }

  return {
    id: def.id,
    title: def.title,
    filtersText: filtersText(f, db),
    columns,
    rows,
    totals,
    generatedBy: user.fullName,
    generatedAt: new Date().toISOString(),
  }
}

function sumColumns(rows, keys) {
  const totals = {}
  for (const k of keys) totals[k] = round2(rows.reduce((s, r) => s + (Number(r[k]) || 0), 0))
  return totals
}
