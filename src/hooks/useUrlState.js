import { useCallback, useEffect, useEffectEvent, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useDebouncedValue } from './useDebouncedValue'

/**
 * Filter values kept in the page address (…/#/properties?barangayId=B01), so they
 * are still there after opening a record and pressing Back, and can be bookmarked.
 * Returns [values, set, clearAll]; call set(key, value) or set({ key: value, … }).
 */
export function useUrlState(defaults) {
  const [params, setParams] = useSearchParams()
  const values = Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, params.get(key) ?? fallback]))

  const set = useCallback(
    (keyOrValues, value) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          const updates = typeof keyOrValues === 'string' ? { [keyOrValues]: value } : keyOrValues
          for (const [k, v] of Object.entries(updates)) {
            if (v) next.set(k, v)
            else next.delete(k)
          }
          return next
        },
        { replace: true },
      ),
    [setParams],
  )
  const clear = useCallback(() => setParams({}, { replace: true }), [setParams])

  return [values, set, clear]
}

/**
 * Search box text for a filter kept in the address. The box updates instantly
 * while typing; the address (and so the search) updates once typing pauses.
 * Returns [text, setText].
 */
export function useUrlSearchText(value, onCommit) {
  const [text, setText] = useState(value)
  const [seen, setSeen] = useState(value)
  if (value !== seen) {
    // Changed elsewhere (Clear filters, Back): show the new value.
    setSeen(value)
    setText(value)
  }
  const debounced = useDebouncedValue(text)
  const commit = useEffectEvent((v) => {
    if (v !== value) onCommit(v)
  })
  useEffect(() => commit(debounced), [debounced])
  return [text, setText]
}
