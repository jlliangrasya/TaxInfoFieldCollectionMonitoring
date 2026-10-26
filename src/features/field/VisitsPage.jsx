import { PageHeader } from '@/components/common/PageHeader'
import { DataTable } from '@/components/common/DataTable'
import { FilterBar, DateFilter, SelectFilter, SearchBox, DatePresets } from '@/components/common/Filters'
import { useUrlState, useUrlSearchText } from '@/hooks/useUrlState'
import { LoadingState, ErrorState } from '@/components/common/States'
import { FieldStatusBadge } from '@/components/common/StatusBadge'
import { GpsLink } from '@/components/common/GpsLink'
import { useQuery } from '@/hooks/useQuery'
import { listVisits } from '@/services/fieldVisitService'
import { listCollectors } from '@/services/assignmentService'
import { listBarangays } from '@/services/propertyService'
import { peso, formatDate, isoDate } from '@/lib/format'
import { VISIT_OUTCOMES } from '@/lib/constants'

export function VisitsPage() {
  const [filters, setFilter, clear] = useUrlState({ query: '', from: '', to: '', collectorId: '', barangayId: '', outcome: '' })
  const set = (key) => (value) => setFilter(key, value)
  const [text, setText] = useUrlSearchText(filters.query, (v) => setFilter('query', v))
  const collectors = useQuery(() => listCollectors({ includeInactive: true }), [])
  const barangays = useQuery(() => listBarangays(), [])
  const { query, from, to, collectorId, barangayId, outcome } = filters
  const { data, loading, error, reload } = useQuery(
    () => listVisits({ query, from, to, collectorId, barangayId, outcome }),
    [query, from, to, collectorId, barangayId, outcome],
  )

  return (
    <>
      <PageHeader
        title="Field Visits"
        description="Activity of all Revenue Collectors: visits, results, collections and follow-ups."
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Field Visits' }]}
      />
      <DatePresets
        className="mb-3"
        from={from}
        to={to}
        onPick={(f, t) => setFilter({ from: f, to: t })}
      />
      <FilterBar showClear={Object.values(filters).some(Boolean)} onClear={clear}>
        <SearchBox value={text} onChange={setText} placeholder="Taxpayer, ARP No. or remarks" />
        <DateFilter label="From" value={filters.from} onChange={set('from')} max={isoDate()} />
        <DateFilter label="To" value={filters.to} onChange={set('to')} max={isoDate()} />
        <SelectFilter label="Collector" value={filters.collectorId} onChange={set('collectorId')} options={(collectors.data ?? []).map((c) => ({ value: c.id, label: c.fullName }))} />
        <SelectFilter label="Barangay" value={filters.barangayId} onChange={set('barangayId')} options={(barangays.data ?? []).map((b) => ({ value: b.id, label: b.name }))} />
        <SelectFilter label="Result" value={filters.outcome} onChange={set('outcome')} options={VISIT_OUTCOMES.map((o) => ({ value: o.value, label: o.label }))} />
      </FilterBar>

      {loading && !data ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <DataTable
          caption="Field visits"
          rows={data}
          rowHref={(r) => `/properties/${r.propertyId}`}
          columns={[
            { key: 'visitDate', header: 'Date', cell: (r) => formatDate(r.visitDate) },
            { key: 'collectorName', header: 'Collector' },
            { key: 'taxpayerName', header: 'Taxpayer', cell: (r) => <span>{r.taxpayerName}<span className="block text-xs text-muted-foreground">ARP {r.arpNo} · {r.barangayName}</span></span> },
            { key: 'outcomeLabel', header: 'Result', cell: (r) => <span>{r.outcomeLabel}{r.remarks && <span className="block max-w-xs text-xs text-muted-foreground">“{r.remarks}”</span>}</span> },
            {
              key: 'collectionAmount',
              header: 'Collected',
              align: 'right',
              cell: (r) => (r.collectionAmount ? <span>{peso(r.collectionAmount)}<span className="mt-1 block"><FieldStatusBadge status={r.collectionStatus} /></span></span> : '—'),
            },
            { key: 'followUpDate', header: 'Follow-up', cell: (r) => formatDate(r.followUpDate) },
            { key: 'gps', header: 'GPS', sortable: false, cell: (r) => <GpsLink gps={r.gps} /> },
          ]}
          renderCard={(r) => (
            <div className="space-y-1">
              <div className="flex justify-between gap-2">
                <p className="font-semibold">{r.taxpayerName}</p>
                <span className="text-sm text-muted-foreground">{formatDate(r.visitDate)}</span>
              </div>
              <p className="text-sm text-muted-foreground">{r.collectorName} · ARP {r.arpNo}</p>
              <p className="text-sm">{r.outcomeLabel}{r.collectionAmount ? ` — ${peso(r.collectionAmount)}` : ''}</p>
            </div>
          )}
        />
      )}
    </>
  )
}
