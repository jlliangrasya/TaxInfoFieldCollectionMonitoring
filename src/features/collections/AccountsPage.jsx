import { PageHeader } from '@/components/common/PageHeader'
import { DataTable } from '@/components/common/DataTable'
import { FilterBar, SearchBox, SelectFilter } from '@/components/common/Filters'
import { useUrlState, useUrlSearchText } from '@/hooks/useUrlState'
import { LoadingState, ErrorState } from '@/components/common/States'
import { AccountStatusBadge } from '@/components/common/StatusBadge'
import { useQuery } from '@/hooks/useQuery'
import { listAccounts } from '@/services/collectionService'
import { listBarangays } from '@/services/propertyService'
import { listCollectors } from '@/services/assignmentService'
import { peso, formatDate } from '@/lib/format'
import { STATUS_LABELS, round2 } from '@/lib/rpt'
import { FOLLOW_UP_FILTERS } from '@/lib/constants'
import { cn } from '@/lib/utils'

const CHIPS = [{ value: '', label: 'All accounts' }, ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))]

export function AccountsPage() {
  const [{ status, query, barangayId, followUp, collectorId }, set] = useUrlState({ status: '', query: '', barangayId: '', followUp: '', collectorId: '' })
  const [text, setText] = useUrlSearchText(query, (v) => set('query', v))
  const barangays = useQuery(() => listBarangays(), [])
  const collectors = useQuery(() => listCollectors(), [])
  const { data, loading, error, reload } = useQuery(
    () => listAccounts({ query, status, barangayId, followUp, collectorId }),
    [query, status, barangayId, followUp, collectorId],
  )

  const setStatus = (value) => set('status', value)
  const clearFilters = () => set({ query: '', barangayId: '', followUp: '', collectorId: '' })
  const totals = data && {
    due: round2(data.reduce((s, r) => s + r.totalDue, 0)),
    paid: round2(data.reduce((s, r) => s + r.totalPaid, 0)),
    balance: round2(data.reduce((s, r) => s + r.balance, 0)),
    pending: round2(data.reduce((s, r) => s + r.pendingFieldAmount, 0)),
  }

  const columns = [
    { key: 'arpNo', header: 'ARP No.' },
    { key: 'taxpayerName', header: 'Taxpayer' },
    { key: 'barangayName', header: 'Barangay' },
    { key: 'totalDue', header: 'Amount Due', align: 'right', cell: (r) => peso(r.totalDue) },
    { key: 'totalPaid', header: 'Paid', align: 'right', cell: (r) => peso(r.totalPaid) },
    { key: 'balance', header: 'Balance', align: 'right', cell: (r) => <span className="font-semibold">{peso(r.balance)}</span> },
    { key: 'status', header: 'Status', cell: (r) => <AccountStatusBadge status={r.status} /> },
    {
      key: 'followUpStatus',
      header: 'Follow-up',
      cell: (r) => (
        <span>
          {r.followUpStatus}
          {r.followUpDate && <span className="block text-xs text-muted-foreground">{formatDate(r.followUpDate)}</span>}
        </span>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Collection Monitoring"
        description="Paid, partially paid, unpaid and outstanding accounts, based on payments recorded by the Treasury. Field records count only after verification."
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Collection Monitoring' }]}
      />

      <div role="group" aria-label="Filter by payment status" className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
        {CHIPS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => setStatus(c.value)}
            aria-pressed={status === c.value}
            className={cn(
              'min-h-11 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors',
              status === c.value ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-accent',
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <FilterBar showClear={Boolean(query || barangayId || followUp || collectorId)} onClear={clearFilters}>
        <SearchBox value={text} onChange={setText} placeholder="Name, ARP No., PIN or TD No." />
        <SelectFilter label="Barangay" value={barangayId} onChange={(v) => set('barangayId', v)} options={(barangays.data ?? []).map((b) => ({ value: b.id, label: b.name }))} />
        <SelectFilter label="Follow-up" value={followUp} onChange={(v) => set('followUp', v)} options={FOLLOW_UP_FILTERS} />
        <SelectFilter
          label="Assigned collector"
          value={collectorId}
          onChange={(v) => set('collectorId', v)}
          options={[...(collectors.data ?? []).map((c) => ({ value: c.id, label: c.fullName })), { value: 'unassigned', label: 'No collector assigned' }]}
        />
      </FilterBar>

      {totals && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ['Accounts shown', data.length.toLocaleString()],
            ['Total amount due', peso(totals.due)],
            ['Total paid', peso(totals.paid)],
            ['Total balance', peso(totals.balance)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="font-semibold tabular-nums">{value}</p>
            </div>
          ))}
        </div>
      )}

      {loading && !data ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <DataTable
          caption="Property accounts"
          columns={columns}
          rows={data}
          rowHref={(r) => `/properties/${r.id}`}
          renderCard={(r) => (
            <div className="space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{r.taxpayerName}</p>
                <AccountStatusBadge status={r.status} />
              </div>
              <p className="text-sm text-muted-foreground">ARP {r.arpNo} · {r.barangayName}</p>
              <div className="flex justify-between text-sm">
                <span>Balance: <span className="font-semibold">{peso(r.balance)}</span></span>
                <span className="text-muted-foreground">{r.followUpStatus}</span>
              </div>
            </div>
          )}
        />
      )}
    </>
  )
}
