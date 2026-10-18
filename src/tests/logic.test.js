import { describe, it, expect } from 'vitest'
import { can, PERMISSIONS as P } from '@/lib/permissions'
import { buildLedger, accountSummary, computeTaxDue, yearStatus } from '@/lib/rpt'
import { findOrNoConflict, findSimilarRecords, exceedsBalance } from '@/lib/duplicates'
import { hashPassword, verifyPassword, createPasswordRecord, passwordProblems } from '@/lib/crypto'
import { maskPhone } from '@/lib/format'
import { safeCell } from '@/features/reports/exporters'

describe('permissions', () => {
  const admin = { role: 'admin', active: true }
  const treasury = { role: 'treasury', active: true }
  const collector = { role: 'collector', active: true }

  it('only admins manage users and reset demo data', () => {
    expect(can(admin, P.USERS_MANAGE)).toBe(true)
    expect(can(treasury, P.USERS_MANAGE)).toBe(false)
    expect(can(collector, P.USERS_MANAGE)).toBe(false)
    expect(can(admin, P.DEMO_RESET)).toBe(true)
    expect(can(treasury, P.DEMO_RESET)).toBe(false)
  })
  it('only treasury records payments and verifies field records', () => {
    for (const perm of [P.PAYMENT_RECORD, P.FIELD_VERIFY, P.ASSIGNMENTS_MANAGE, P.RECORDS_EDIT]) {
      expect(can(treasury, perm)).toBe(true)
      expect(can(admin, perm)).toBe(false)
      expect(can(collector, perm)).toBe(false)
    }
  })
  it('only collectors record field collections, and cannot see everything', () => {
    expect(can(collector, P.FIELD_RECORD)).toBe(true)
    expect(can(treasury, P.FIELD_RECORD)).toBe(false)
    expect(can(collector, P.RECORDS_VIEW_ALL)).toBe(false)
    expect(can(collector, P.GPS_VIEW)).toBe(false)
    expect(can(collector, P.CONTACT_VIEW_FULL)).toBe(false)
    expect(can(collector, P.REPORTS_VIEW)).toBe(false)
  })
  it('deactivated or missing users have no permissions', () => {
    expect(can({ role: 'admin', active: false }, P.USERS_MANAGE)).toBe(false)
    expect(can(null, P.RECORDS_VIEW)).toBe(false)
  })
})

describe('RPT calculations', () => {
  it('computes basic tax + SEF at 1% each', () => {
    expect(computeTaxDue(100000)).toEqual({ basicTax: 1000, sefTax: 1000, amountDue: 2000 })
  })
  it('classifies paid, partial and unpaid years', () => {
    expect(yearStatus(2000, 2000)).toBe('paid')
    expect(yearStatus(2000, 500)).toBe('partial')
    expect(yearStatus(2000, 0)).toBe('unpaid')
  })
  it('marks an account outstanding when a past year has a balance', () => {
    const assessments = [
      { taxYear: 2025, amountDue: 1000 },
      { taxYear: 2026, amountDue: 1000 },
    ]
    const ledger = buildLedger(assessments, [{ taxYear: 2026, amount: 1000 }, { taxYear: 2025, amount: 400 }])
    const s = accountSummary(ledger, 2026)
    expect(s.status).toBe('outstanding')
    expect(s.balance).toBe(600)
    expect(s.pastBalance).toBe(600)
  })
  it('uses the current year status when past years are settled', () => {
    const ledger = buildLedger(
      [{ taxYear: 2025, amountDue: 1000 }, { taxYear: 2026, amountDue: 1000 }],
      [{ taxYear: 2025, amount: 1000 }, { taxYear: 2026, amount: 250 }],
    )
    expect(accountSummary(ledger, 2026).status).toBe('partial')
  })
})

describe('duplicate detection', () => {
  const payments = [{ propertyId: 'P1', taxYear: 2026, amount: 500, paymentDate: '2026-05-01', orNo: '4500001' }]
  const fieldCollections = [
    { propertyId: 'P1', taxYear: 2026, amount: 300, collectionDate: '2026-06-01', status: 'pending' },
    { propertyId: 'P1', taxYear: 2026, amount: 200, collectionDate: '2026-06-02', status: 'rejected' },
  ]
  it('blocks reused OR numbers, ignoring spaces', () => {
    expect(findOrNoConflict(' 4500001 ', payments)).toBeTruthy()
    expect(findOrNoConflict('4500002', payments)).toBeNull()
  })
  it('finds records with the same property, year, amount and date', () => {
    expect(findSimilarRecords({ propertyId: 'P1', taxYear: 2026, amount: 500, date: '2026-05-01' }, { payments, fieldCollections })).toHaveLength(1)
    expect(findSimilarRecords({ propertyId: 'P1', taxYear: 2026, amount: 300, date: '2026-06-01' }, { payments, fieldCollections })).toHaveLength(1)
    expect(findSimilarRecords({ propertyId: 'P1', taxYear: 2026, amount: 200, date: '2026-06-02' }, { payments, fieldCollections })).toHaveLength(0)
  })
  it('detects amounts above the balance', () => {
    expect(exceedsBalance(100.01, 100)).toBe(true)
    expect(exceedsBalance(100, 100)).toBe(false)
  })
})

describe('passwords', () => {
  it('hashes with a salt and verifies correctly', async () => {
    const rec = await createPasswordRecord('Secret123')
    expect(rec.passwordHash).not.toContain('Secret123')
    expect(await verifyPassword('Secret123', rec.salt, rec.passwordHash)).toBe(true)
    expect(await verifyPassword('secret123', rec.salt, rec.passwordHash)).toBe(false)
    const other = await createPasswordRecord('Secret123')
    expect(other.passwordHash).not.toBe(rec.passwordHash)
    expect(await hashPassword('x', rec.salt)).toHaveLength(64)
  })
  it('enforces the password rule', () => {
    expect(passwordProblems('short1')).toContain('at least 8 characters')
    expect(passwordProblems('abcdefgh')).toContain('at least one number')
    expect(passwordProblems('abcd1234')).toEqual([])
  })
})

describe('privacy and export safety', () => {
  it('masks phone numbers', () => {
    expect(maskPhone('09171234567')).toBe('09•• ••• 4567')
  })
  it('neutralises spreadsheet formulas in exported cells', () => {
    expect(safeCell('=HYPERLINK("x")')).toBe("'=HYPERLINK(\"x\")")
    expect(safeCell('+123')).toBe("'+123")
    expect(safeCell('@SUM(A1)')).toBe("'@SUM(A1)")
    expect(safeCell('Juan Dela Cruz')).toBe('Juan Dela Cruz')
    expect(safeCell(1500)).toBe(1500)
  })
})
