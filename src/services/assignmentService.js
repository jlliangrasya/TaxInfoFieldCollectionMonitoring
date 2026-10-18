import { getDb, commit, nextId } from '@/data/store'
import { PERMISSIONS, PermissionError, can } from '@/lib/permissions'
import { isoDate, formatDate } from '@/lib/format'
import { assignmentInputSchema } from '@/lib/validation'
import {
  delay,
  requireUser,
  requirePermission,
  userName,
  barangayName,
  writeAudit,
  parseOrThrow,
  ValidationError,
} from './core'

export async function listCollectors({ includeInactive = false } = {}) {
  await delay(0)
  requireUser()
  return getDb()
    .users.filter((u) => u.role === 'collector' && (includeInactive || u.active))
    .map((u) => ({ id: u.id, fullName: u.fullName, active: u.active }))
}

export async function listAssignments({ showEnded = false } = {}) {
  await delay()
  const user = requireUser()
  if (!can(user, PERMISSIONS.ASSIGNMENTS_MANAGE) && !can(user, PERMISSIONS.RECORDS_VIEW_ALL)) throw new PermissionError()
  const db = getDb()
  const today = isoDate()
  return db.assignments
    .map((a) => {
      const current = a.active && a.startDate <= today && a.endDate >= today
      const state = !a.active ? 'ended' : a.endDate < today ? 'expired' : a.startDate > today ? 'upcoming' : 'current'
      return {
        ...a,
        current,
        state,
        collectorName: userName(a.collectorId, db),
        barangayName: barangayName(a.barangayId, db),
        propertyArpNo: a.propertyId ? db.properties.find((p) => p.id === a.propertyId)?.arpNo ?? '—' : null,
        createdByName: userName(a.createdBy, db),
      }
    })
    .filter((a) => showEnded || a.state === 'current' || a.state === 'upcoming')
    .sort((a, b) => a.barangayName.localeCompare(b.barangayName) || a.collectorName.localeCompare(b.collectorName))
}

export async function createAssignment(input) {
  await delay()
  const user = requirePermission(PERMISSIONS.ASSIGNMENTS_MANAGE)
  const data = parseOrThrow(assignmentInputSchema, input)
  const db = getDb()
  const collector = db.users.find((u) => u.id === data.collectorId)
  if (!collector || collector.role !== 'collector' || !collector.active) {
    throw new ValidationError('Please correct the highlighted fields.', { collectorId: 'Please choose an active Revenue Collector.' })
  }
  if (!db.barangays.some((b) => b.id === data.barangayId)) {
    throw new ValidationError('Please correct the highlighted fields.', { barangayId: 'Please choose a barangay.' })
  }
  if (data.propertyId) {
    const p = db.properties.find((x) => x.id === data.propertyId)
    if (!p || p.barangayId !== data.barangayId) {
      throw new ValidationError('Please correct the highlighted fields.', { propertyId: 'The property must be in the selected barangay.' })
    }
  }
  const overlap = db.assignments.find(
    (a) =>
      a.active &&
      a.collectorId === data.collectorId &&
      a.barangayId === data.barangayId &&
      (a.propertyId ?? '') === data.propertyId &&
      a.startDate <= data.endDate &&
      a.endDate >= data.startDate,
  )
  if (overlap) {
    throw new ValidationError(
      `${collector.fullName} already has this assignment from ${formatDate(overlap.startDate)} to ${formatDate(overlap.endDate)}.`,
    )
  }

  return commit((d) => {
    const assignment = {
      id: nextId('ASG', 3),
      collectorId: data.collectorId,
      barangayId: data.barangayId,
      propertyId: data.propertyId || null,
      startDate: data.startDate,
      endDate: data.endDate,
      notes: data.notes,
      active: true,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    }
    d.assignments.push(assignment)
    const target = assignment.propertyId
      ? `property ${d.properties.find((p) => p.id === assignment.propertyId)?.arpNo}`
      : `Brgy. ${barangayName(assignment.barangayId, d)}`
    writeAudit(d, user, 'Assignment created', `${collector.fullName} → ${target} (${data.startDate} to ${data.endDate})`)
    return assignment
  })
}

export async function endAssignment(id) {
  await delay()
  const user = requirePermission(PERMISSIONS.ASSIGNMENTS_MANAGE)
  commit((d) => {
    const a = d.assignments.find((x) => x.id === id)
    if (!a) throw new ValidationError('This assignment was not found.')
    a.active = false
    writeAudit(d, user, 'Assignment ended', `${userName(a.collectorId, d)} — Brgy. ${barangayName(a.barangayId, d)}`)
  })
}
