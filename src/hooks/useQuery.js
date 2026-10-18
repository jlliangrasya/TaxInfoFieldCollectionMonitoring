import { useCallback, useEffect, useRef, useState } from 'react'
import { subscribe } from '@/data/store'

/**
 * Loads data from a service function and reloads it automatically whenever
 * demo data changes. Returns { data, loading, error, reload }.
 */
export function useQuery(fetcher, deps = []) {
  const [state, setState] = useState({ data: undefined, loading: true, error: null })
  const requestId = useRef(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fetcher, deps)

  const load = useCallback(
    async (silent = false) => {
      const id = ++requestId.current
      if (!silent) setState((s) => ({ ...s, loading: true, error: null }))
      try {
        const data = await run()
        if (id === requestId.current) setState({ data, loading: false, error: null })
      } catch (error) {
        if (id === requestId.current) setState((s) => ({ ...s, loading: false, error }))
      }
    },
    [run],
  )

  useEffect(() => {
    load()
    return subscribe(() => load(true))
  }, [load])

  return { ...state, reload: load }
}
