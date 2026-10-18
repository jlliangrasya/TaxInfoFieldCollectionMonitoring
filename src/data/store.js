// Demo data store. Keeps all records in memory and saves them to the browser's
// local storage so changes survive a page refresh. Nothing leaves the browser.
//
// Only the service layer (src/services) may use this module. When a real
// backend is introduced, the services will call the server instead.
import { databaseSchema } from './schemas'
import { buildSeedData, SCHEMA_VERSION } from './seed'

const STORAGE_KEY = 'rpt-demo-data'

let db = null
const listeners = new Set()
const status = {
  persistent: true, // false when the browser blocks local storage (e.g. private mode)
  recovered: false, // true when saved data was damaged/outdated and was replaced
}

function readSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return undefined // unreadable
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
    status.persistent = true
  } catch {
    status.persistent = false
  }
}

function notify() {
  for (const fn of listeners) fn()
}

export async function initStore() {
  if (db) return status
  const saved = readSaved()
  if (saved) {
    const parsed = databaseSchema.safeParse(saved)
    if (parsed.success && parsed.data.meta.schemaVersion === SCHEMA_VERSION) {
      db = parsed.data
      return status
    }
    status.recovered = true
  } else if (saved === undefined) {
    status.recovered = true
  }
  db = await buildSeedData()
  persist()
  return status
}

export function getStoreStatus() {
  return { ...status }
}

/** Read-only access to the data. Never modify the returned objects directly. */
export function getDb() {
  if (!db) throw new Error('Data store is not ready.')
  return db
}

/** All changes go through here so they are saved and the screens refresh. */
export function commit(mutator) {
  const result = mutator(getDb())
  persist()
  notify()
  return result
}

/** Generates a readable record number, e.g. nextId('FC') → "FC-0045". */
export function nextId(prefix, len = 4) {
  const counters = getDb().meta.counters
  counters[prefix] = (counters[prefix] ?? 0) + 1
  return `${prefix}-${String(counters[prefix]).padStart(len, '0')}`
}

export async function resetStore() {
  db = await buildSeedData()
  status.recovered = false
  persist()
  notify()
}

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** For automated tests only. */
export function __setDbForTests(value) {
  db = value
}
