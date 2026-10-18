// Generates fictional sample data for the demo. All names, numbers and
// places are made up. The same sample data is produced every time (fixed random
// seed), with dates placed relative to today so the demo always looks current.
import { addDays, subDays, startOfYear, differenceInCalendarDays } from 'date-fns'
import { computeTaxDue, buildLedger, round2 } from '@/lib/rpt'
import { createPasswordRecord } from '@/lib/crypto'
import { isoDate } from '@/lib/format'

export const SCHEMA_VERSION = 1
export const DEMO_PASSWORD = 'Demo@2026'

export const DEMO_ACCOUNTS = [
  { username: 'admin', fullName: 'Ramon D. Villanueva', role: 'admin', position: 'System Administrator' },
  { username: 'treasurer', fullName: 'Elena C. Ramos', role: 'treasury', position: 'Municipal Treasurer' },
  { username: 'treasury.staff', fullName: 'Josefina A. Cruz', role: 'treasury', position: 'Revenue Collection Clerk' },
  { username: 'collector1', fullName: 'Mark Anthony B. Reyes', role: 'collector', position: 'Revenue Collector' },
  { username: 'collector2', fullName: 'Kristine M. Garcia', role: 'collector', position: 'Revenue Collector' },
  { username: 'collector3', fullName: 'Paolo R. Mendoza', role: 'collector', position: 'Revenue Collector' },
  { username: 'collector4', fullName: 'Liza T. Fernandez', role: 'collector', position: 'Revenue Collector' },
]

const BARANGAYS = [
  'Poblacion', 'San Isidro', 'Santa Cruz', 'San Roque',
  'Bagong Silang', 'Malinis', 'Mabini', 'Rizal',
]

const FIRST_NAMES = [
  'Juan', 'Maria', 'Jose', 'Ana', 'Pedro', 'Rosa', 'Antonio', 'Carmen', 'Manuel', 'Teresa',
  'Ricardo', 'Luzviminda', 'Eduardo', 'Corazon', 'Roberto', 'Milagros', 'Fernando', 'Remedios',
  'Rogelio', 'Lourdes', 'Danilo', 'Erlinda', 'Arnel', 'Marites', 'Jerome', 'Charmaine',
]
const MIDDLE_INITIALS = 'ABCDEFGLMPRSTV'
const LAST_NAMES = [
  'Dela Cruz', 'Santos', 'Reyes', 'Bautista', 'Ocampo', 'Aquino', 'Mercado', 'Navarro',
  'Pascual', 'Soriano', 'Domingo', 'Castillo', 'Gonzales', 'Lim', 'Tan', 'Salazar',
  'Valdez', 'Ramirez', 'Torres', 'Flores', 'Del Rosario', 'Manalo', 'Agustin', 'Ilagan',
]
const CORPORATIONS = [
  'Golden Harvest Agri Ventures Inc.',
  'Northpoint Hardware and Construction Supply',
  'Bayview Lodging Corporation',
  'Sunrise Rice Mill Cooperative',
  'Evergreen Poultry Farms Inc.',
  'Riverside Commercial Holdings Corp.',
]
const STREETS = ['Rizal', 'Mabini', 'Bonifacio', 'Luna', 'Burgos', 'Del Pilar', 'Quezon', 'Magsaysay', 'Sampaguita', 'Narra']

const UNIT_VALUE = { Residential: 1500, Commercial: 4200, Agricultural: 65, Industrial: 2600 }
const LAND_LEVEL = { Residential: 0.2, Commercial: 0.5, Agricultural: 0.4, Industrial: 0.5 }
const BUILDING_LEVEL = { Residential: 0.2, Commercial: 0.5, Agricultural: 0.3, Industrial: 0.5 }

// Fictional base coordinates used only for sample GPS points.
const BASE_LAT = 12.8797
const BASE_LNG = 121.774

function createRandom(seed) {
  let a = seed
  const next = () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    weighted: (entries) => {
      const total = entries.reduce((s, [, w]) => s + w, 0)
      let r = next() * total
      for (const [value, w] of entries) {
        if ((r -= w) < 0) return value
      }
      return entries[entries.length - 1][0]
    },
  }
}

const pad = (n, len) => String(n).padStart(len, '0')

export async function buildSeedData(today = new Date()) {
  const rnd = createRandom(20261018)
  const nowIso = today.toISOString()
  const currentYear = today.getFullYear()
  const years = [currentYear - 2, currentYear - 1, currentYear]
  const counters = {}
  const nextId = (prefix, len = 4) => {
    counters[prefix] = (counters[prefix] ?? 0) + 1
    return `${prefix}-${pad(counters[prefix], len)}`
  }

  // Users — every demo account uses the same demo password.
  const users = []
  for (const acc of DEMO_ACCOUNTS) {
    const { salt, passwordHash } = await createPasswordRecord(DEMO_PASSWORD)
    users.push({
      id: nextId('U', 3),
      ...acc,
      salt,
      passwordHash,
      active: true,
      mustChangePassword: false,
      failedAttempts: 0,
      lockedUntil: null,
      createdAt: subDays(today, 300).toISOString(),
      lastLoginAt: null,
    })
  }
  const treasuryUsers = users.filter((u) => u.role === 'treasury')
  const collectors = users.filter((u) => u.role === 'collector')

  const barangays = BARANGAYS.map((name, i) => ({ id: `B-${pad(i + 1, 2)}`, name, code: pad(i + 1, 4) }))

  // Taxpayers
  const taxpayers = []
  const usedNames = new Set()
  for (let i = 0; i < 60; i++) {
    const isCorp = i < CORPORATIONS.length
    let name
    if (isCorp) name = CORPORATIONS[i]
    else {
      do {
        name = `${rnd.pick(FIRST_NAMES)} ${rnd.pick(MIDDLE_INITIALS.split(''))}. ${rnd.pick(LAST_NAMES)}`
      } while (usedNames.has(name))
    }
    usedNames.add(name)
    const brgy = rnd.pick(barangays)
    taxpayers.push({
      id: `TP-${currentYear - 3}-${pad(i + 1, 4)}`,
      name,
      type: isCorp ? 'Corporation' : 'Individual',
      address: `${rnd.int(1, 450)} ${rnd.pick(STREETS)} St., Brgy. ${brgy.name}, ${'Demo Municipality'}`,
      barangayId: brgy.id,
      contactNo: `09${rnd.int(10, 99)}${pad(rnd.int(0, 9999999), 7)}`,
    })
  }

  // Properties and assessments
  const properties = []
  const assessments = []
  let parcel = 0
  for (const tp of taxpayers) {
    const count = tp.type === 'Corporation' ? rnd.int(1, 3) : rnd.weighted([[1, 65], [2, 35]])
    for (let k = 0; k < count; k++) {
      parcel++
      const brgy = rnd.chance(0.8) ? barangays.find((b) => b.id === tp.barangayId) : rnd.pick(barangays)
      const isBuilding = k > 0 && rnd.chance(0.5)
      const classification =
        tp.type === 'Corporation'
          ? rnd.weighted([['Commercial', 60], ['Industrial', 25], ['Agricultural', 15]])
          : rnd.weighted([['Residential', 65], ['Agricultural', 25], ['Commercial', 10]])
      let areaSqm
      let marketValue
      let assessmentLevel
      if (isBuilding) {
        areaSqm = rnd.int(40, classification === 'Residential' ? 220 : 900)
        marketValue = round2(areaSqm * rnd.int(9000, 16000))
        assessmentLevel = BUILDING_LEVEL[classification]
      } else {
        areaSqm =
          classification === 'Agricultural' ? rnd.int(5000, 30000) : rnd.int(120, classification === 'Residential' ? 600 : 3000)
        marketValue = round2(areaSqm * UNIT_VALUE[classification])
        assessmentLevel = LAND_LEVEL[classification]
      }
      const assessedValue = Math.round((marketValue * assessmentLevel) / 10) * 10
      const property = {
        id: `P-${pad(parcel, 4)}`,
        arpNo: `01-${brgy.code}-${pad(parcel * 7 + 100, 5)}`,
        pin: `999-01-${brgy.code}-${pad(rnd.int(1, 20), 3)}-${pad(rnd.int(1, 40), 2)}`,
        tdNo: `TD-${currentYear - 2}-${pad(parcel, 5)}`,
        taxpayerId: tp.id,
        barangayId: brgy.id,
        location: `${rnd.chance(0.5) ? `Lot ${rnd.int(1, 80)}, ` : ''}${rnd.pick(STREETS)} St., Brgy. ${brgy.name}`,
        kind: isBuilding ? 'Building' : 'Land',
        classification,
        areaSqm,
        marketValue,
        assessmentLevel,
        assessedValue,
      }
      properties.push(property)
      for (const y of years) {
        assessments.push({
          id: nextId('AS', 5),
          propertyId: property.id,
          taxYear: y,
          assessedValue,
          ...computeTaxDue(assessedValue),
        })
      }
    }
  }

  // Treasury payments (with Official Receipt numbers)
  const payments = []
  let orNo = 4500000
  const dayInYear = (y, latest) => {
    const start = startOfYear(new Date(y, 0, 1))
    const end = y === currentYear ? subDays(latest, 1) : new Date(y, 11, 20)
    const span = Math.max(1, differenceInCalendarDays(end, start))
    return isoDate(addDays(start, rnd.int(4, span)))
  }
  const addPayment = (propertyId, taxYear, amount, paymentDate, extra = {}) => {
    const p = {
      id: nextId('PAY', 5),
      propertyId,
      taxYear,
      amount: round2(amount),
      orNo: String(++orNo),
      paymentDate,
      source: 'treasury',
      fieldCollectionId: null,
      recordedBy: rnd.pick(treasuryUsers).id,
      recordedAt: `${paymentDate}T09:${pad(rnd.int(0, 59), 2)}:00.000Z`,
      ...extra,
    }
    payments.push(p)
    return p
  }

  for (const prop of properties) {
    const profile = rnd.weighted([['good', 50], ['current_pending', 15], ['partial', 15], ['late', 12], ['delinquent', 8]])
    for (const y of years) {
      const due = assessments.find((a) => a.propertyId === prop.id && a.taxYear === y).amountDue
      const isCurrent = y === currentYear
      let fraction = 1
      if (profile === 'current_pending' && isCurrent) fraction = 0
      if (profile === 'partial' && isCurrent) fraction = rnd.int(30, 60) / 100
      if (profile === 'late' && y >= currentYear - 1) fraction = isCurrent ? 0 : rnd.int(0, 1) * 0.5
      if (profile === 'delinquent' && y >= currentYear - 1) fraction = 0
      if (fraction <= 0) continue
      const amount = round2(due * fraction)
      if (fraction === 1 && rnd.chance(0.25)) {
        const first = round2(amount / 2)
        addPayment(prop.id, y, first, dayInYear(y, today))
        addPayment(prop.id, y, round2(amount - first), dayInYear(y, today))
      } else {
        addPayment(prop.id, y, amount, dayInYear(y, today))
      }
    }
  }

  // Collection assignments: two barangays per collector for the current year
  const assignments = barangays.map((b, i) => ({
    id: nextId('ASG', 3),
    collectorId: collectors[Math.floor(i / 2)].id,
    barangayId: b.id,
    propertyId: null,
    startDate: `${currentYear}-01-01`,
    endDate: `${currentYear}-12-31`,
    notes: 'Regular barangay assignment',
    active: true,
    createdBy: treasuryUsers[0].id,
    createdAt: `${currentYear}-01-02T08:00:00.000Z`,
  }))
  const collectorFor = (barangayId) => assignments.find((a) => a.barangayId === barangayId).collectorId

  // Field visits and field-recorded collections
  const visits = []
  const fieldCollections = []
  const addFieldCollection = (prop, taxYear, amount, date, collectorId, visitId, status, extra = {}) => {
    const fc = {
      id: nextId('FC', 4),
      refNo: `FR-${currentYear}-${pad(counters.FC, 5)}`,
      propertyId: prop.id,
      taxYear,
      amount: round2(amount),
      collectionDate: date,
      collectorId,
      visitId,
      remarks: '',
      orNoIssued: '',
      status,
      possibleDuplicate: false,
      reviewedBy: null,
      reviewedAt: null,
      reviewNote: '',
      createdAt: `${date}T10:${pad(rnd.int(0, 59), 2)}:00.000Z`,
      ...extra,
    }
    fieldCollections.push(fc)
    return fc
  }

  const REMARKS = {
    promised: ['Taxpayer promised to pay at the Treasury office next week.', 'Will pay after harvest season.', 'Promised to settle on payday.'],
    not_home: ['No one at home. Left a notice with neighbor.', 'House closed during visit.', 'Taxpayer is working abroad; spoke with caretaker.'],
    refused: ['Taxpayer disputes the assessed value; advised to visit the Assessor.', 'Refused to pay; asked for written notice.'],
    not_found: ['Address could not be located. Needs verification with Assessor.'],
    paid_full: ['Collected full amount for the tax year.'],
    paid_partial: ['Partial payment received; balance to follow.'],
    other: ['Taxpayer requested a statement of account.'],
  }

  let pendingCount = 0
  for (const prop of properties) {
    const ledger = buildLedger(
      assessments.filter((a) => a.propertyId === prop.id),
      payments.filter((p) => p.propertyId === prop.id),
    )
    const withBalance = ledger.filter((y) => y.balance > 0).sort((a, b) => a.taxYear - b.taxYear)
    if (!withBalance.length || !rnd.chance(0.65)) continue
    const collectorId = collectorFor(prop.barangayId)
    const visitCount = rnd.int(1, 3)
    const offsets = Array.from({ length: visitCount }, () => rnd.int(1, 90)).sort((a, b) => b - a)
    let pendingOnThis = 0
    for (const offset of offsets) {
      const visitDate = isoDate(subDays(today, offset))
      const target = withBalance[0]
      if (!target) break
      const outcome = rnd.weighted([
        ['promised', 30], ['not_home', 25], ['refused', 8], ['not_found', 4],
        ['paid_full', 13], ['paid_partial', 15], ['other', 5],
      ])
      const visit = {
        id: nextId('V', 4),
        propertyId: prop.id,
        collectorId,
        visitDate,
        outcome,
        remarks: rnd.pick(REMARKS[outcome]),
        followUpDate: ['promised', 'not_home', 'refused', 'other'].includes(outcome)
          ? isoDate(addDays(subDays(today, offset), rnd.int(7, 21)))
          : null,
        gps: rnd.chance(0.5)
          ? { lat: round2((BASE_LAT + rnd.next() * 0.05) * 1e4) / 1e4, lng: round2((BASE_LNG + rnd.next() * 0.05) * 1e4) / 1e4, accuracy: rnd.int(5, 25) }
          : null,
        fieldCollectionId: null,
        createdAt: `${visitDate}T10:00:00.000Z`,
      }
      if (outcome === 'paid_full' || outcome === 'paid_partial') {
        const amount = outcome === 'paid_full' ? target.balance : round2(target.balance * rnd.int(30, 60) / 100)
        const pending = offset <= 14 || (pendingCount < 6 && rnd.chance(0.3))
        if (pending && pendingOnThis === 0) {
          const fc = addFieldCollection(prop, target.taxYear, amount, visitDate, collectorId, visit.id, 'pending', {
            remarks: visit.remarks,
            orNoIssued: rnd.chance(0.6) ? String(4600000 + counters.FC) : '',
          })
          visit.fieldCollectionId = fc.id
          pendingCount++
          pendingOnThis++
          target.balance = round2(target.balance - amount)
        } else if (!pending) {
          const fc = addFieldCollection(prop, target.taxYear, amount, visitDate, collectorId, visit.id, 'verified', {
            remarks: visit.remarks,
            reviewedBy: treasuryUsers[0].id,
            reviewedAt: addDays(subDays(today, offset), 2).toISOString(),
            reviewNote: 'Matched with Official Receipt.',
          })
          const payment = addPayment(prop.id, target.taxYear, amount, visitDate, {
            source: 'field',
            fieldCollectionId: fc.id,
            recordedBy: treasuryUsers[0].id,
          })
          fc.orNoIssued = payment.orNo
          visit.fieldCollectionId = fc.id
          target.balance = round2(target.balance - amount)
        } else {
          visit.outcome = 'promised'
          visit.remarks = rnd.pick(REMARKS.promised)
          visit.followUpDate = isoDate(addDays(subDays(today, offset), 10))
        }
        if (target.balance <= 0) withBalance.shift()
      }
      visits.push(visit)
    }
  }

  // Two sample "possible duplicate" entries for the Treasury review queue
  const pendingSamples = fieldCollections.filter((f) => f.status === 'pending').slice(0, 2)
  for (const original of pendingSamples) {
    const prop = properties.find((p) => p.id === original.propertyId)
    addFieldCollection(prop, original.taxYear, original.amount, original.collectionDate, original.collectorId, null, 'pending', {
      remarks: 'Entered again from the field.',
      possibleDuplicate: true,
    })
  }

  return {
    meta: {
      schemaVersion: SCHEMA_VERSION,
      seededAt: nowIso,
      dataAsOf: isoDate(today),
      counters: { ...counters, OR: orNo },
    },
    users,
    barangays,
    taxpayers,
    properties,
    assessments,
    payments,
    fieldCollections,
    visits,
    assignments,
    auditLog: [
      {
        id: 'LOG-000001',
        at: nowIso,
        userId: null,
        username: 'system',
        action: 'Demo data created',
        details: 'Fresh sample data was generated.',
      },
    ],
  }
}
