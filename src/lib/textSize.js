// "Larger text" preference for staff who find the normal size hard to read.
// Saved only in this browser; if storage is blocked the normal size is used.
const KEY = 'rpt-text-size'

export function getLargeText() {
  try {
    return localStorage.getItem(KEY) === 'large'
  } catch {
    return false
  }
}

export function applyLargeText(on = getLargeText()) {
  document.documentElement.classList.toggle('text-large', on)
}

export function setLargeText(on) {
  try {
    if (on) localStorage.setItem(KEY, 'large')
    else localStorage.removeItem(KEY)
  } catch {
    // Storage blocked: the setting still applies until the page is closed.
  }
  applyLargeText(on)
}
