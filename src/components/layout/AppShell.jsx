import { useEffect, useState } from 'react'
import { NavLink, Outlet, Link, useLocation } from 'react-router'
import { Landmark, LogOut, Menu, KeyRound, Search, ALargeSmall } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { useAuth } from '@/features/auth/AuthContext'
import { ROLE_LABELS } from '@/lib/permissions'
import { initials } from '@/lib/format'
import { APP_NAME, LGU_NAME, OFFICE_NAME } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { getLargeText, setLargeText } from '@/lib/textSize'
import { useQuery } from '@/hooks/useQuery'
import { getNavCounts } from '@/services/dashboardService'
import { navGroupsFor, bottomNavFor } from './navigation'
import { IdleLogout } from './IdleLogout'
import { GlobalSearch } from './GlobalSearch'

function Brand({ light = false }) {
  return (
    <Link to="/" className="flex min-w-0 items-center gap-3">
      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', light ? 'bg-white/10' : 'bg-primary text-primary-foreground')}>
        <Landmark className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-sm font-semibold">{APP_NAME}</span>
        <span className={cn('block truncate text-xs', light ? 'text-sidebar-foreground/70' : 'text-muted-foreground')}>
          {OFFICE_NAME} · {LGU_NAME}
        </span>
      </span>
    </Link>
  )
}

function CountBadge({ count, className }) {
  if (!count) return null
  return (
    <span className={cn('inline-flex min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-xs leading-5 font-semibold text-white tabular-nums', className)}>
      {count > 99 ? '99+' : count}
    </span>
  )
}

function NavList({ user, counts = {}, onNavigate }) {
  return (
    <nav aria-label="Main menu" className="space-y-5">
      {navGroupsFor(user).map((group) => (
        <div key={group.label}>
          <p className="mb-1 px-3 text-xs font-semibold tracking-wide text-sidebar-foreground/60 uppercase">{group.label}</p>
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/' || item.to === '/field'}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'flex min-h-11 items-center gap-3 rounded-full px-4 py-2 text-[15px] transition-colors',
                      isActive ? 'bg-white font-semibold text-sidebar shadow-sm' : 'text-sidebar-foreground/85 hover:bg-white/10 hover:text-white',
                    )
                  }
                >
                  <item.icon className="size-5 shrink-0" aria-hidden />
                  <span className="flex-1">{item.label}</span>
                  {counts[item.to] > 0 && (
                    <>
                      <CountBadge count={counts[item.to]} />
                      <span className="sr-only">({counts[item.to]} to do)</span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function UserCard({ user, onLogout, onNavigate }) {
  const [large, setLarge] = useState(getLargeText)
  return (
    <div className="space-y-2 border-t border-white/10 pt-4">
      <div className="flex items-center gap-3 px-1">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-semibold" aria-hidden>
          {initials(user.fullName)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{user.fullName}</p>
          <p className="truncate text-xs text-sidebar-foreground/70">{ROLE_LABELS[user.role]}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button asChild variant="ghost" size="sm" className="justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-white">
          <Link to="/account/password" onClick={onNavigate}>
            <KeyRound /> Password
          </Link>
        </Button>
        <Button variant="ghost" size="sm" onClick={onLogout} className="justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-white">
          <LogOut /> Log out
        </Button>
      </div>
      <Button
        variant="ghost"
        size="sm"
        aria-pressed={large}
        onClick={() => {
          setLargeText(!large)
          setLarge(!large)
        }}
        className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
      >
        <ALargeSmall /> {large ? 'Normal text size' : 'Larger text'}
      </Button>
    </div>
  )
}

export function AppShell() {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const location = useLocation()
  const bottomItems = bottomNavFor(user)
  const counts = useQuery(() => getNavCounts(), []).data ?? {}
  const handleLogout = () => logout()

  // Start each new page at the top instead of where the last one was scrolled to.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  // Ctrl+K (or ⌘K) and "/" open the search from anywhere, except while typing in a field.
  useEffect(() => {
    function onKey(e) {
      const typing = e.target.closest?.('input, textarea, select, [contenteditable="true"]')
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only z-50 rounded bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Skip to main content
      </a>
      <IdleLogout />

      {/* Desktop sidebar */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-72 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="px-5 pt-5 pb-4">
          <Brand light />
        </div>
        <div className="px-3 pb-4">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex min-h-11 w-full items-center gap-3 rounded-md bg-white/10 px-3 text-left text-[15px] text-sidebar-foreground/85 transition-colors hover:bg-white/15 hover:text-white"
          >
            <Search className="size-5 shrink-0" aria-hidden />
            <span className="flex-1">Find…</span>
            <kbd className="rounded border border-white/20 px-1.5 text-xs text-sidebar-foreground/70">Ctrl K</kbd>
          </button>
        </div>
        <div className="scrollbar-none flex-1 overflow-y-auto px-3 pb-4">
          <NavList user={user} counts={counts} />
        </div>
        <div className="px-4 pb-4">
          <UserCard user={user} onLogout={handleLogout} />
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col lg:pl-72">

        {/* Phone/tablet top bar */}
        <header className="no-print sticky top-0 z-20 flex items-center justify-between gap-2 bg-card/95 shadow-sm px-4 py-2 backdrop-blur lg:hidden">
          <Brand />
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="icon" onClick={() => setSearchOpen(true)} aria-label="Find a property, taxpayer or page">
              <Search />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setMenuOpen(true)} aria-label="Open menu">
              <Menu />
            </Button>
          </div>
        </header>

        <main id="main" tabIndex={-1} className="print-area mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-28 outline-none sm:px-6 lg:px-8 lg:pb-10">
          <Outlet key={location.pathname} />
        </main>

        {/* Phone bottom navigation */}
        <nav aria-label="Quick menu" className="no-print fixed inset-x-0 bottom-0 z-20 bg-card shadow-[0_-2px_10px_rgb(0_0_0/0.06)] pb-[env(safe-area-inset-bottom)] lg:hidden">
          <ul className="grid grid-cols-5">
            {bottomItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/' || item.to === '/field'}
                  className={({ isActive }) =>
                    cn(
                      'flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-xs',
                      isActive ? 'font-semibold text-primary' : 'text-muted-foreground',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className={cn('relative flex h-8 w-14 items-center justify-center rounded-full transition-colors', isActive && 'bg-primary/10')}>
                        <item.icon className="size-6" aria-hidden />
                        <CountBadge count={counts[item.to]} className="absolute -top-1 right-1.5" />
                      </span>
                      {item.short}
                      {counts[item.to] > 0 && <span className="sr-only">({counts[item.to]} to do)</span>}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
            <li>
              <button type="button" onClick={() => setMenuOpen(true)} className="flex min-h-16 w-full flex-col items-center justify-center gap-1 text-xs text-muted-foreground">
                <span className="flex h-8 w-14 items-center justify-center">
                  <Menu className="size-6" aria-hidden />
                </span>
                Menu
              </button>
            </li>
          </ul>
        </nav>
      </div>

      {/* Full menu drawer (phones/tablets) */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="flex w-80 max-w-[85vw] flex-col gap-0 border-none bg-sidebar p-0 text-sidebar-foreground">
          <SheetHeader className="px-5 py-5">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <SheetDescription className="sr-only">All pages you can open</SheetDescription>
            <Brand light />
          </SheetHeader>
          <div className="scrollbar-none flex-1 overflow-y-auto px-3 pb-4">
            <NavList user={user} counts={counts} onNavigate={() => setMenuOpen(false)} />
          </div>
          <div className="px-4 pb-6">
            <UserCard user={user} onLogout={handleLogout} onNavigate={() => setMenuOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  )
}
