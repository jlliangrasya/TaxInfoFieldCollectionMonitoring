import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Building2, ChevronRight, Loader2, Search, User } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { AccountStatusBadge } from '@/components/common/StatusBadge'
import { useQuery } from '@/hooks/useQuery'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useAuth } from '@/features/auth/AuthContext'
import { listProperties } from '@/services/propertyService'
import { listTaxpayers } from '@/services/taxpayerService'
import { PERMISSIONS } from '@/lib/permissions'
import { peso } from '@/lib/format'
import { navGroupsFor } from './navigation'

const MAX_PROPERTIES = 6
const MAX_TAXPAYERS = 4

/** "Find anything" dialog: jump to a property, a taxpayer or a page by typing. */
export function GlobalSearch({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-4 max-h-[calc(100dvh-2rem)] translate-y-0 gap-3 overflow-y-auto p-4 sm:top-[12%] sm:p-6">
        <DialogHeader>
          <DialogTitle>Find</DialogTitle>
          <DialogDescription>Type a taxpayer name, ARP No., PIN, TD No. or the name of a page.</DialogDescription>
        </DialogHeader>
        {open && <SearchBody onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function SearchBody({ onDone }) {
  const { user, can } = useAuth()
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const q = useDebouncedValue(text.trim())
  const ready = q.length >= 2
  const canSearch = can(PERMISSIONS.RECORDS_VIEW)

  const { data, loading } = useQuery(async () => {
    if (!ready || !canSearch) return { properties: [], taxpayers: [] }
    const [properties, taxpayers] = await Promise.all([listProperties({ query: q }), listTaxpayers({ query: q })])
    return { properties: properties.slice(0, MAX_PROPERTIES), taxpayers: taxpayers.slice(0, MAX_TAXPAYERS) }
  }, [q, ready, canSearch])

  const lower = text.trim().toLowerCase()
  const pages = lower
    ? navGroupsFor(user)
        .flatMap((g) => g.items)
        .filter((i) => i.label.toLowerCase().includes(lower) || i.hint.toLowerCase().includes(lower))
    : []

  // Paths in the order shown, so Enter opens the first one.
  const results = [
    ...pages.map((p) => p.to),
    ...(data?.properties ?? []).map((p) => `/properties/${p.id}`),
    ...(data?.taxpayers ?? []).map((t) => `/taxpayers/${t.id}`),
  ]

  function go(to) {
    onDone()
    navigate(to)
  }

  const nothingFound = ready && !loading && data && results.length === 0

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (results[0]) go(results[0])
        }}
        className="relative"
      >
        <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          autoFocus
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Santos or 01-0001-00012"
          className="h-12 pl-10 text-base"
          maxLength={100}
          aria-label="Find a property, taxpayer or page"
        />
        {loading && ready && <Loader2 className="absolute top-1/2 right-3 size-5 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />}
      </form>

      {!lower && <p className="text-sm text-muted-foreground">Tip: press Enter to open the first result. On a computer, press Ctrl + K or / to open this search from any page.</p>}
      {lower && !ready && pages.length === 0 && <p className="text-sm text-muted-foreground">Keep typing…</p>}
      {nothingFound && <p className="text-sm text-muted-foreground">Nothing found for “{q}”. Check the spelling or try the ARP No.</p>}

      <div aria-live="polite" className="space-y-4">
        {pages.length > 0 && (
          <ResultGroup title="Pages">
            {pages.map((p) => (
              <ResultItem key={p.to} icon={p.icon} title={p.label} subtitle={p.hint} onClick={() => go(p.to)} />
            ))}
          </ResultGroup>
        )}
        {data?.properties.length > 0 && (
          <ResultGroup title="Properties">
            {data.properties.map((p) => (
              <ResultItem
                key={p.id}
                icon={Building2}
                title={p.taxpayerName}
                subtitle={`ARP ${p.arpNo} · ${p.barangayName} · Balance ${peso(p.balance)}`}
                badge={<AccountStatusBadge status={p.status} />}
                onClick={() => go(`/properties/${p.id}`)}
              />
            ))}
          </ResultGroup>
        )}
        {data?.taxpayers.length > 0 && (
          <ResultGroup title="Taxpayers">
            {data.taxpayers.map((t) => (
              <ResultItem
                key={t.id}
                icon={User}
                title={t.name}
                subtitle={`${t.id} · ${t.propertyCount} propert${t.propertyCount === 1 ? 'y' : 'ies'} · Balance ${peso(t.balance)}`}
                onClick={() => go(`/taxpayers/${t.id}`)}
              />
            ))}
          </ResultGroup>
        )}
      </div>
    </div>
  )
}

function ResultGroup({ title, children }) {
  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      <ul className="divide-y rounded-lg border">{children}</ul>
    </section>
  )
}

function ResultItem({ icon: Icon, title, subtitle, badge, onClick }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none">
        <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{title}</span>
          <span className="block truncate text-sm text-muted-foreground">{subtitle}</span>
        </span>
        {badge}
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>
    </li>
  )
}
