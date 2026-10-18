import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { Eye, EyeOff, Landmark, Loader2, LogIn, ShieldCheck, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/common/FormField'
import { useAuth } from './AuthContext'
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '@/data/seed'
import { ROLE_LABELS } from '@/lib/permissions'
import { APP_FULL_NAME, LGU_NAME, OFFICE_NAME } from '@/lib/constants'

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={location.state?.from ?? '/'} replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!username.trim() || !password) {
      setError('Please enter your username and password.')
      return
    }
    setBusy(true)
    try {
      await login(username, password)
      navigate(location.state?.from ?? '/', { replace: true })
    } catch (err) {
      setError(err?.message ?? 'Unable to log in. Please try again.')
      setPassword('')
    } finally {
      setBusy(false)
    }
  }

  function fillDemoAccount(acc) {
    setUsername(acc.username)
    setPassword(DEMO_PASSWORD)
    setError('')
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Welcome panel */}
      <div className="hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-xl bg-white/10">
            <Landmark className="size-6" aria-hidden />
          </span>
          <div>
            <p className="font-semibold">{OFFICE_NAME}</p>
            <p className="text-sm text-sidebar-foreground/70">{LGU_NAME}</p>
          </div>
        </div>
        <div className="max-w-lg space-y-4">
          <h1 className="text-4xl leading-tight font-semibold text-white">{APP_FULL_NAME}</h1>
          <p className="text-lg text-sidebar-foreground/80">
            Look up taxpayer and property records, monitor Real Property Tax collections, and record field visits — from any phone, tablet or computer.
          </p>
        </div>
        <p className="flex items-center gap-2 text-sm text-sidebar-foreground/70">
          <ShieldCheck className="size-4" aria-hidden />
          Authorized personnel only. All activity is recorded.
        </p>
      </div>

      {/* Login form */}
      <div className="flex flex-col">
        <div role="note" className="border-b border-warning/30 bg-warning-soft px-4 py-2 text-center text-sm">
          <TriangleAlert className="mr-1 inline size-4 align-[-3px]" aria-hidden />
          <strong>DEMO MODE</strong> — sample data only. Not an official record.
        </div>
        <div className="flex flex-1 items-center justify-center px-4 py-10">
          <div className="w-full max-w-md space-y-6">
            <div className="space-y-2 text-center lg:text-left">
              <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground lg:hidden">
                <Landmark className="size-6" aria-hidden />
              </span>
              <h2 className="text-2xl font-semibold">Log in to your account</h2>
              <p className="text-muted-foreground lg:hidden">{APP_FULL_NAME}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {error && (
                <div role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
                  {error}
                </div>
              )}
              <Field label="Username">
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={50}
                />
              </Field>
              <Field label="Password" controlId="login-password">
                {(aria) => (
                <div className="relative">
                  <Input
                    {...aria}
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="pr-12"
                    maxLength={100}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                </div>
                )}
              </Field>
              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <LogIn />}
                {busy ? 'Checking…' : 'Log in'}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Forgot your password? Please ask the System Administrator to reset it.
              </p>
            </form>

            <div className="rounded-xl border bg-card p-4">
              <p className="font-semibold">Demo accounts</p>
              <p className="mb-3 text-sm text-muted-foreground">
                Tap an account to fill in the login form. Password for all: <code className="rounded bg-muted px-1.5 py-0.5 font-mono">{DEMO_PASSWORD}</code>
              </p>
              <ul className="divide-y">
                {DEMO_ACCOUNTS.map((acc) => (
                  <li key={acc.username}>
                    <button
                      type="button"
                      onClick={() => fillDemoAccount(acc)}
                      className="flex min-h-11 w-full items-center justify-between gap-3 rounded px-2 py-2 text-left hover:bg-accent"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{acc.fullName}</span>
                        <span className="block text-xs text-muted-foreground">{ROLE_LABELS[acc.role]}</span>
                      </span>
                      <code className="shrink-0 font-mono text-xs text-muted-foreground">{acc.username}</code>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
