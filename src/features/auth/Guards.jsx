import { Link, Navigate, useLocation } from 'react-router'
import { Lock, SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from './AuthContext'

/** Sends signed-out visitors to the login page, and forces a password change when required. */
export function RequireAuth({ children }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (user.mustChangePassword && location.pathname !== '/account/password') {
    return <Navigate to="/account/password" replace />
  }
  return children
}

/** Shows the page only to users with the permission (or any of `anyOf`). */
export function RequirePermission({ permission, anyOf, children }) {
  const { can } = useAuth()
  const ok = permission ? can(permission) : anyOf ? anyOf.some((p) => can(p)) : true
  return ok ? children : <AccessDenied />
}

export function AccessDenied() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <Lock className="size-12 text-muted-foreground" aria-hidden />
      <h1 className="text-2xl font-semibold">Access not allowed</h1>
      <p className="max-w-md text-muted-foreground">
        Your account does not have permission to open this page. If you need access, please contact the System Administrator.
      </p>
      <Button asChild>
        <Link to="/">Go to Dashboard</Link>
      </Button>
    </div>
  )
}

export function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <SearchX className="size-12 text-muted-foreground" aria-hidden />
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="max-w-md text-muted-foreground">The page you are looking for does not exist or may have been moved.</p>
      <Button asChild>
        <Link to="/">Go to Dashboard</Link>
      </Button>
    </div>
  )
}
