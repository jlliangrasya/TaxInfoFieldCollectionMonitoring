import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { initStore, resetStore, getDb, __setDbForTests } from '@/data/store'
import { DEMO_PASSWORD } from '@/data/seed'
import { login, logout, changePassword } from '@/services/authService'
import { listProperties, getProperty } from '@/services/propertyService'
import { listTaxpayers } from '@/services/taxpayerService'
import { recordPayment, verifyFieldCollection, rejectFieldCollection, listFieldCollections, listAccounts } from '@/services/collectionService'
import { logVisit, listMyAssignments, listVisits } from '@/services/fieldVisitService'
import { createUser, setUserActive } from '@/services/userService'
import { generateReport } from '@/services/reportService'
import { getDashboard, getNavCounts } from '@/services/dashboardService'
import { isoDate } from '@/lib/format'

const as = (username) => login(username, DEMO_PASSWORD)

beforeAll(async () => {
  localStorage.clear()
  await initStore()
})

beforeEach(async () => {
  await logout()
  await resetStore()
})

describe('sample data', () => {
  it('has consistent records', () => {
    const db = getDb()
    expect(db.users).toHaveLength(7)
    expect(db.barangays).toHaveLength(8)
    expect(db.taxpayers).toHaveLength(60)
    expect(db.properties.length).toBeGreaterThan(70)
    expect(db.fieldCollections.some((f) => f.status === 'pending')).toBe(true)
    expect(db.fieldCollections.some((f) => f.possibleDuplicate)).toBe(true)
    const ors = db.payments.map((p) => p.orNo)
    expect(new Set(ors).size).toBe(ors.length)
  })
})

describe('login and access control', () => {
  it('rejects wrong passwords with a generic message and locks after 5 attempts', async () => {
    for (let i = 0; i < 5; i++) {
      await expect(login('collector1', 'wrong-pass1')).rejects.toThrow('Incorrect username or password.')
    }
    await expect(login('collector1', DEMO_PASSWORD)).rejects.toThrow(/temporarily locked/)
    await expect(login('nobody', 'x')).rejects.toThrow('Incorrect username or password.')
  })

  it('blocks deactivated users', async () => {
    await as('admin')
    const u = getDb().users.find((x) => x.username === 'collector2')
    await setUserActive(u.id, false)
    await logout()
    await expect(as('collector2')).rejects.toThrow(/deactivated/)
  })

  it('never returns password data', async () => {
    const user = await as('admin')
    expect(user.passwordHash).toBeUndefined()
    expect(user.salt).toBeUndefined()
  })

  it('new users must change their temporary password', async () => {
    await as('admin')
    await createUser({ username: 'new.collector', fullName: 'New Collector', role: 'collector', position: 'Revenue Collector', tempPassword: 'Temp1234' })
    await logout()
    const u = await login('new.collector', 'Temp1234')
    expect(u.mustChangePassword).toBe(true)
    const updated = await changePassword({ currentPassword: 'Temp1234', newPassword: 'Better5678' })
    expect(updated.mustChangePassword).toBe(false)
  })

  it('enforces permissions inside services, not just in the screens', async () => {
    await as('collector1')
    await expect(createUser({})).rejects.toThrow(/permission/)
    await expect(recordPayment({})).rejects.toThrow(/permission/)
    await logout()
    await expect(listProperties()).rejects.toThrow(/session has ended/)
  })
})

describe('collector scope and privacy', () => {
  it('collectors see only their assigned barangays, with masked contacts and hidden GPS', async () => {
    const all = getDb().properties.length
    await as('collector1')
    const mine = await listProperties()
    expect(mine.length).toBeGreaterThan(0)
    expect(mine.length).toBeLessThan(all)
    expect(new Set(mine.map((p) => p.barangayId)).size).toBeLessThanOrEqual(2)

    const taxpayers = await listTaxpayers()
    expect(taxpayers.every((t) => t.contactNo.includes('•'))).toBe(true)

    const outside = getDb().properties.find((p) => !mine.some((m) => m.id === p.id))
    await expect(getProperty(outside.id)).rejects.toThrow(/assigned area/)
  })
})

describe('field collection workflow', () => {
  async function pickProperty() {
    const list = await listMyAssignments()
    const target = list.find((p) => p.pendingFieldAmount === 0 && p.ledger.some((y) => y.balance > 100))
    const year = target.ledger.find((y) => y.balance > 100)
    return { target, year }
  }

  it('records, warns on duplicates, and only counts after Treasury verification', async () => {
    await as('collector1')
    const { target, year } = await pickProperty()
    const visit = {
      propertyId: target.id,
      visitDate: isoDate(),
      outcome: 'paid_partial',
      remarks: 'Test collection',
      collectionTaxYear: year.taxYear,
      collectionAmount: 50,
    }
    const { fieldCollection } = await logVisit(visit)
    expect(fieldCollection.status).toBe('pending')

    // Same entry again → warning; confirmed → saved but flagged
    await expect(logVisit(visit)).rejects.toMatchObject({ name: 'DuplicateWarning' })
    const second = await logVisit({ ...visit, confirmDuplicate: true })
    expect(second.fieldCollection.possibleDuplicate).toBe(true)

    // Balance unchanged until verified
    const before = (await getProperty(target.id)).ledger.find((y) => y.taxYear === year.taxYear).balance
    expect(before).toBe(year.balance)

    await logout()
    await as('treasurer')
    const queue = await listFieldCollections({ status: 'pending' })
    expect(queue[0].possibleDuplicate).toBe(true)
    await verifyFieldCollection(fieldCollection.id, { orNo: '7777001' })
    await rejectFieldCollection(second.fieldCollection.id, { reason: 'Duplicate of earlier entry' })
    const after = (await getProperty(target.id)).ledger.find((y) => y.taxYear === year.taxYear).balance
    expect(after).toBeCloseTo(year.balance - 50, 2)

    // OR No. cannot be reused
    await expect(
      recordPayment({ propertyId: target.id, taxYear: year.taxYear, amount: 10, orNo: '7777001', paymentDate: isoDate() }),
    ).rejects.toMatchObject({ fieldErrors: { orNo: expect.stringMatching(/already recorded/) } })
  })

  it('blocks amounts over the balance and future dates', async () => {
    await as('collector1')
    const { target, year } = await pickProperty()
    await expect(
      logVisit({ propertyId: target.id, visitDate: isoDate(), outcome: 'paid_full', collectionTaxYear: year.taxYear, collectionAmount: year.balance + 1 }),
    ).rejects.toMatchObject({ fieldErrors: { collectionAmount: expect.stringMatching(/more than the remaining balance/) } })
    await expect(
      logVisit({ propertyId: target.id, visitDate: '2999-01-01', outcome: 'not_home' }),
    ).rejects.toMatchObject({ name: 'ValidationError' })
  })
})

describe('reports and dashboards', () => {
  it('collectors only get their own activity', async () => {
    const me = await as('collector1')
    const r = await generateReport('visit_log', { collectorId: '' })
    expect(r.rows.every((row) => row.collector === me.fullName)).toBe(true)
    await expect(generateReport('payments')).rejects.toThrow(/access/)
    const d = await getDashboard()
    expect(d.kind).toBe('collector')
  })
  it('treasury dashboard and reports work', async () => {
    await as('treasurer')
    const d = await getDashboard()
    expect(d.kind).toBe('office')
    expect(d.totalProperties).toBe(getDb().properties.length)
    const r = await generateReport('status_summary')
    expect(r.totals.accounts).toBe(getDb().properties.length)
  })
})

describe('store safety', () => {
  it('recovers from damaged saved data', async () => {
    localStorage.setItem('rpt-demo-data', '{"broken": tr')
    __setDbForTests(null)
    const status = await initStore()
    expect(status.recovered).toBe(true)
    expect(getDb().users).toHaveLength(7)
  })
})

describe('monitoring filters and menu counts', () => {
  it('filters accounts by follow-up and assigned collector', async () => {
    await as('treasurer')
    const today = isoDate()
    const due = await listAccounts({ followUp: 'due' })
    expect(due.length).toBeGreaterThan(0)
    expect(due.every((a) => a.balance > 0 && a.followUpDate <= today)).toBe(true)

    const notVisited = await listAccounts({ followUp: 'not_visited' })
    expect(notVisited.every((a) => a.balance > 0 && !a.lastVisitDate)).toBe(true)

    const collector = getDb().users.find((u) => u.username === 'collector1')
    const theirs = await listAccounts({ collectorId: collector.id })
    expect(theirs.length).toBeGreaterThan(0)
    expect(theirs.every((a) => a.assignedCollectorId === collector.id)).toBe(true)
  })

  it('searches visits by taxpayer or ARP No.', async () => {
    await as('treasurer')
    const [first] = await listVisits()
    const byArp = await listVisits({ query: first.arpNo })
    expect(byArp.length).toBeGreaterThan(0)
    expect(byArp.every((v) => v.arpNo === first.arpNo || v.remarks.includes(first.arpNo))).toBe(true)
  })

  it('shows menu counts only for work the user can do', async () => {
    await as('treasurer')
    const office = await getNavCounts()
    expect(office['/verifications']).toBe(getDb().fieldCollections.filter((f) => f.status === 'pending').length)
    expect(office['/field']).toBeUndefined()

    await logout()
    await as('collector1')
    const field = await getNavCounts()
    expect(field['/verifications']).toBeUndefined()
    expect(field['/field']).toBe((await getDashboard()).followUpsDue)

    await logout()
    await as('admin')
    expect(await getNavCounts()).toEqual({})
  })
})
