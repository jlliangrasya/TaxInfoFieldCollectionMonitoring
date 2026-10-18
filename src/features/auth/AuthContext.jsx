import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as authService from '@/services/authService'
import { can } from '@/lib/permissions'
import { subscribe } from '@/data/store'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => authService.restoreSession())

  // Keep the signed-in user up to date (e.g. after a password change or deactivation).
  useEffect(
    () =>
      subscribe(() => {
        setUser((prev) => (prev ? authService.getCurrentUser() : prev))
      }),
    [],
  )

  const login = useCallback(async (username, password) => {
    const u = await authService.login(username, password)
    setUser(u)
    return u
  }, [])

  const logout = useCallback(async (reason) => {
    await authService.logout(reason)
    setUser(null)
  }, [])

  useEffect(() => {
    const onEnded = () => setUser(null)
    window.addEventListener('rpt:session-ended', onEnded)
    return () => window.removeEventListener('rpt:session-ended', onEnded)
  }, [])

  const value = useMemo(
    () => ({
      user,
      login,
      logout,
      refresh: () => setUser(authService.getCurrentUser()),
      can: (permission) => can(user, permission),
    }),
    [user, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
