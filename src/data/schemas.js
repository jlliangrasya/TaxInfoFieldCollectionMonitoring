// Shape of the demo data saved in the browser. On every load the saved data is
// checked against these rules; if anything is missing or damaged the demo
// safely starts over from fresh sample data instead of crashing.
import { z } from 'zod'

const id = z.string().min(1)
const date = z.iso.date()
const dateTime = z.string().min(1)
const money = z.number().nonnegative()

export const userSchema = z.looseObject({
  id,
  username: z.string().min(1),
  fullName: z.string().min(1),
  role: z.enum(['admin', 'treasury', 'collector']),
  position: z.string(),
  salt: z.string().min(1),
  passwordHash: z.string().min(1),
  active: z.boolean(),
  mustChangePassword: z.boolean(),
  failedAttempts: z.number().int().nonnegative(),
  lockedUntil: z.string().nullable(),
  createdAt: dateTime,
  lastLoginAt: z.string().nullable(),
})

export const barangaySchema = z.looseObject({ id, name: z.string().min(1), code: z.string() })

export const taxpayerSchema = z.looseObject({
  id,
  name: z.string().min(1),
  type: z.enum(['Individual', 'Corporation']),
  address: z.string(),
  barangayId: id,
  contactNo: z.string(),
})

export const propertySchema = z.looseObject({
  id,
  arpNo: z.string().min(1),
  pin: z.string(),
  tdNo: z.string(),
  taxpayerId: id,
  barangayId: id,
  location: z.string(),
  kind: z.enum(['Land', 'Building', 'Machinery']),
  classification: z.enum(['Residential', 'Agricultural', 'Commercial', 'Industrial']),
  areaSqm: z.number().nonnegative(),
  marketValue: money,
  assessmentLevel: z.number().min(0).max(1),
  assessedValue: money,
})

export const assessmentSchema = z.looseObject({
  id,
  propertyId: id,
  taxYear: z.number().int(),
  assessedValue: money,
  basicTax: money,
  sefTax: money,
  amountDue: money,
})

export const paymentSchema = z.looseObject({
  id,
  propertyId: id,
  taxYear: z.number().int(),
  amount: z.number().positive(),
  orNo: z.string().min(1),
  paymentDate: date,
  source: z.enum(['treasury', 'field']),
  fieldCollectionId: z.string().nullable(),
  recordedBy: id,
  recordedAt: dateTime,
})

export const fieldCollectionSchema = z.looseObject({
  id,
  refNo: z.string().min(1),
  propertyId: id,
  taxYear: z.number().int(),
  amount: z.number().positive(),
  collectionDate: date,
  collectorId: id,
  visitId: z.string().nullable(),
  remarks: z.string(),
  orNoIssued: z.string(),
  status: z.enum(['pending', 'verified', 'rejected']),
  possibleDuplicate: z.boolean(),
  reviewedBy: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  reviewNote: z.string(),
  createdAt: dateTime,
})

export const visitSchema = z.looseObject({
  id,
  propertyId: id,
  collectorId: id,
  visitDate: date,
  outcome: z.string().min(1),
  remarks: z.string(),
  followUpDate: date.nullable(),
  gps: z
    .object({ lat: z.number(), lng: z.number(), accuracy: z.number().nullable() })
    .nullable(),
  fieldCollectionId: z.string().nullable(),
  createdAt: dateTime,
})

export const assignmentSchema = z.looseObject({
  id,
  collectorId: id,
  barangayId: id,
  propertyId: z.string().nullable(),
  startDate: date,
  endDate: date,
  notes: z.string(),
  active: z.boolean(),
  createdBy: id,
  createdAt: dateTime,
})

export const auditSchema = z.looseObject({
  id,
  at: dateTime,
  userId: z.string().nullable(),
  username: z.string(),
  action: z.string().min(1),
  details: z.string(),
})

export const databaseSchema = z.object({
  meta: z.looseObject({
    schemaVersion: z.number().int(),
    seededAt: dateTime,
    dataAsOf: date,
    counters: z.record(z.string(), z.number().int()),
  }),
  users: z.array(userSchema),
  barangays: z.array(barangaySchema),
  taxpayers: z.array(taxpayerSchema),
  properties: z.array(propertySchema),
  assessments: z.array(assessmentSchema),
  payments: z.array(paymentSchema),
  fieldCollections: z.array(fieldCollectionSchema),
  visits: z.array(visitSchema),
  assignments: z.array(assignmentSchema),
  auditLog: z.array(auditSchema),
})
