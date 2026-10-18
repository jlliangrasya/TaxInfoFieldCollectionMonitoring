// Input rules shared by the forms (instant feedback) and the services
// (final check before saving). Messages are written in plain language.
import { z } from 'zod'
import { subDays } from 'date-fns'
import { isoDate } from './format'
import { OR_NO_PATTERN, VISIT_OUTCOMES } from './constants'
import { passwordProblems } from './crypto'

export const MAX_LATE_ENTRY_DAYS = 30

const pastOrToday = (label = 'Date') =>
  z.iso
    .date({ error: `Please enter a valid ${label.toLowerCase()}.` })
    .refine((d) => d <= isoDate(), `${label} cannot be in the future.`)

const amount = z.coerce
  .number({ error: 'Please enter an amount.' })
  .positive('Amount must be greater than zero.')
  .max(10_000_000, 'Amount is too large. Please check the figure.')
  .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, 'Use at most 2 decimal places.')

const orNo = z.string().trim().regex(OR_NO_PATTERN, 'OR No. must be 6 to 10 digits.')
const remarks = z.string().trim().max(500, 'Maximum of 500 characters.')

export const paymentInputSchema = z.object({
  propertyId: z.string().min(1),
  taxYear: z.coerce.number().int('Please choose a tax year.'),
  amount,
  orNo,
  paymentDate: pastOrToday('Payment date'),
  remarks: remarks.optional().default(''),
  confirmDuplicate: z.boolean().optional(),
})

const gpsSchema = z
  .object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    accuracy: z.number().nonnegative().nullable(),
  })
  .nullable()

export const visitInputSchema = z
  .object({
    propertyId: z.string().min(1),
    visitDate: pastOrToday('Visit date').refine(
      (d) => d >= isoDate(subDays(new Date(), MAX_LATE_ENTRY_DAYS)),
      `Visits older than ${MAX_LATE_ENTRY_DAYS} days must be encoded by the Treasury office.`,
    ),
    outcome: z.enum(
      VISIT_OUTCOMES.map((o) => o.value),
      { error: 'Please choose the result of the visit.' },
    ),
    remarks: remarks.optional().default(''),
    followUpDate: z.union([z.literal(''), z.iso.date()]).optional().default(''),
    gps: gpsSchema.optional().default(null),
    collectionTaxYear: z.union([z.literal(''), z.coerce.number().int()]).optional().default(''),
    collectionAmount: z.union([z.literal(''), amount]).optional().default(''),
    orNoIssued: z.union([z.literal(''), orNo]).optional().default(''),
    confirmDuplicate: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    const collects = VISIT_OUTCOMES.find((o) => o.value === v.outcome)?.collects
    if (collects) {
      if (v.collectionTaxYear === '') ctx.addIssue({ code: 'custom', path: ['collectionTaxYear'], message: 'Please choose the tax year being paid.' })
      if (v.collectionAmount === '') ctx.addIssue({ code: 'custom', path: ['collectionAmount'], message: 'Please enter the amount collected.' })
    }
    if (v.outcome === 'other' && v.remarks.length < 5) {
      ctx.addIssue({ code: 'custom', path: ['remarks'], message: 'Please explain what happened (at least 5 characters).' })
    }
    if (v.followUpDate && v.followUpDate < v.visitDate) {
      ctx.addIssue({ code: 'custom', path: ['followUpDate'], message: 'Follow-up date cannot be before the visit date.' })
    }
  })

export const verifyInputSchema = z.object({
  orNo,
  note: remarks.optional().default(''),
})

export const rejectInputSchema = z.object({
  reason: z.string().trim().min(5, 'Please give the reason (at least 5 characters).').max(500, 'Maximum of 500 characters.'),
})

const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._]{3,30}$/, 'Use 3–30 characters: letters, numbers, dot or underscore only.')

const newPassword = z.string().superRefine((p, ctx) => {
  const problems = passwordProblems(p)
  if (problems.length) ctx.addIssue({ code: 'custom', message: `Password needs ${problems.join(', ')}.` })
})

export const userCreateSchema = z.object({
  username,
  fullName: z.string().trim().min(3, 'Please enter the full name.').max(100, 'Maximum of 100 characters.'),
  role: z.enum(['admin', 'treasury', 'collector'], { error: 'Please choose a role.' }),
  position: z.string().trim().min(2, 'Please enter the position.').max(80, 'Maximum of 80 characters.'),
  tempPassword: newPassword,
})

export const userUpdateSchema = userCreateSchema.omit({ username: true, tempPassword: true })

export const resetPasswordSchema = z.object({ tempPassword: newPassword })

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Please enter your current password.'),
    newPassword,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  })

export const assignmentInputSchema = z
  .object({
    collectorId: z.string().min(1, 'Please choose a collector.'),
    barangayId: z.string().min(1, 'Please choose a barangay.'),
    propertyId: z.string().optional().default(''),
    startDate: z.iso.date({ error: 'Please enter a valid start date.' }),
    endDate: z.iso.date({ error: 'Please enter a valid end date.' }),
    notes: remarks.optional().default(''),
  })
  .refine((v) => v.endDate >= v.startDate, { path: ['endDate'], message: 'End date cannot be before the start date.' })
