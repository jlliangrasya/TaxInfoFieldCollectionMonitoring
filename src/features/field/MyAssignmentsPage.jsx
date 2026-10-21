import { useState } from 'react'
import { Link } from 'react-router'
import { CalendarClock, ClipboardPen, MapPin, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/common/PageHeader'
import { FilterBar, SearchBox, SelectFilter } from '@/components/common/Filters'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { LoadingState, ErrorState, EmptyState } from '@/components/common/States'
import { AccountStatusBadge } from '@/components/common/StatusBadge'
import { useQuery } from '@/hooks/useQuery'
import { listMyAssignments, getMyAreas } from '@/services/fieldVisitService'
import { peso, formatDate } from '@/lib/format'

const PAGE = 20

export function MyAssignmentsPage() {
  const [query, setQuery] = useState('')
  const [barangayId, setBarangayId] = useState('')
  const [includePaid, setIncludePaid] = useState(false)
  const [shown, setShown] = useState(PAGE)
  const q = useDebouncedValue(query)
  const areas = useQuery(() => getMyAreas(), [])
  const { data, loading, error, reload } = useQuery(
    () => listMyAssignments({ query: q, barangayId, includePaid }),
    [q, barangayId, includePaid],
  )
  const barangayOptions = [...new Map((areas.data ?? []).map((a) => [a.barangayId, a.barangayName])).entries()].map(([value, label]) => ({ value, label }))

  return (
    <>
      <PageHeader
        title="My Assignments"
        description="Properties in your assigned area that still have a balance. Follow-ups that are due are shown first."
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'My Assignments' }]}
      />

      {areas.data && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Your area:</span>
          {areas.data.length === 0 ? (
            <span className="font-medium text-danger">No active assignment. Please contact the Treasury office.</span>
          ) : (
            areas.data.map((a) => (
              <span key={a.id} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">
                <MapPin className="size-3.5" aria-hidden />
                {a.propertyArpNo ? `ARP ${a.propertyArpNo}` : `Brgy. ${a.barangayName}`}
              </span>
            ))
          )}
        </div>
      )}

      <FilterBar>
        <SearchBox value={query} onChange={setQuery} placeholder="Taxpayer, ARP No. or street" className="sm:col-span-2" />
        <SelectFilter label="Barangay" value={barangayId} onChange={setBarangayId} options={barangayOptions} />
        <div className="flex items-end pb-2.5">
          <div className="flex items-center gap-2">
            <Checkbox id="include-paid" checked={includePaid} onCheckedChange={(v) => setIncludePaid(Boolean(v))} className="size-5" />
            <Label htmlFor="include-paid" className="text-sm">Also show fully paid</Label>
          </div>
        </div>
      </FilterBar>

      {loading && !data ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : data.length === 0 ? (
        <EmptyState title="No properties to visit">All properties in your area are fully paid, or nothing matches your search.</EmptyState>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">{data.length} propert{data.length === 1 ? 'y' : 'ies'}</p>
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.slice(0, shown).map((p) => (
              <li key={p.id} className={`flex flex-col rounded-xl border bg-card p-4 shadow-xs ${p.followUpDue ? 'border-danger/50' : ''}`}>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {p.followUpDue && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2.5 py-0.5 text-xs font-semibold text-danger">
                      <CalendarClock className="size-3.5" aria-hidden /> Follow-up due {formatDate(p.followUpDate)}
                    </span>
                  )}
                  {!p.lastVisitDate && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-info-soft px-2.5 py-0.5 text-xs font-semibold text-info">
                      <Sparkles className="size-3.5" aria-hidden /> Not yet visited
                    </span>
                  )}
                  <AccountStatusBadge status={p.status} />
                </div>
                <p className="text-lg font-semibold">{p.taxpayerName}</p>
                <p className="text-sm text-muted-foreground">ARP {p.arpNo}</p>
                <p className="text-sm text-muted-foreground">{p.location}</p>
                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <span className="text-sm">Balance</span>
                  <span className="text-lg font-semibold tabular-nums">{peso(p.balance)}</span>
                </div>
                {p.pendingFieldAmount > 0 && (
                  <p className="text-xs text-warning">{peso(p.pendingFieldAmount)} pending Treasury verification</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {p.lastVisitDate ? `Last visit ${formatDate(p.lastVisitDate)} · ${p.followUpStatus}` : 'No visits yet'}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 pt-1">
                  <Button asChild>
                    <Link to={`/field/visit/${p.id}`}>
                      <ClipboardPen /> Log visit
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link to={`/properties/${p.id}`}>Details</Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          {shown < data.length && (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" onClick={() => setShown((n) => n + PAGE)}>
                Show more ({data.length - shown} remaining)
              </Button>
            </div>
          )}
        </>
      )}
    </>
  )
}
