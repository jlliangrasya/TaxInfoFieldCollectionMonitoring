import { useEffect, useState } from 'react'

/** Waits until the user stops typing before using the value (avoids searching on every key). */
export function useDebouncedValue(value, ms = 250) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}
