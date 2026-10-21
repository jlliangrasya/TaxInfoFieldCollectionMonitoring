import { useState } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable } from '@/components/common/DataTable'
import { FilterBar, SearchBox, SelectFilter } from '@/components/common/Filters'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { LoadingState, ErrorState } from '@/components/common/States'
import { AccountStatusBadge } from '@/components/common/StatusBadge'
import { useQuery } from '@/hooks/useQuery'
import { listTaxpayers } from '@/services/taxpayerService'
import { listBarangays } from '@/services/propertyService'
import { peso } from '@/lib/format'

export function TaxpayerListPage() {
  const [query, setQuery] = useState('')
  const [barangayId, setBarangayId] = useState('')
  const q = useDebouncedValue(query)
  const barangays = useQuery(() => listBarangays(), [])
  const { data, loading, error, reload } = useQuery(() => listTaxpayers({ query: q, barangayId }), [q, barangayId])

  const columns = [
    { key: 'name', header: 'Taxpayer' },
    { key: 'id', header: 'Taxpayer ID' },
    { key: 'type', header: 'Type' },
    { key: 'barangayName', header: 'Barangay' },
    { key: 'propertyCount', header: 'Properties', align: 'right' },
    { key: 'balance', header: 'Total Balance', align: 'right', cell: (r) => <span className="font-semibold">{peso(r.balance)}</span> },
    { key: 'status', header: 'Status', cell: (r) => <AccountStatusBadge status={r.status} /> },
  ]

  return (
    <>
      <PageHeader
        title="Taxpayers"
        description="Find a taxpayer by name, Taxpayer ID, or by any of their property numbers (ARP, PIN, TD)."
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Taxpayers' }]}
      />
      <FilterBar showClear={Boolean(query || barangayId)} onClear={() => { setQuery(''); setBarangayId('') }}>
        <SearchBox value={query} onChange={setQuery} placeholder="Name, Taxpayer ID or ARP No." className="sm:col-span-2" />
        <SelectFilter label="Barangay" value={barangayId} onChange={setBarangayId} options={(barangays.data ?? []).map((b) => ({ value: b.id, label: b.name }))} />
      </FilterBar>
      {loading && !data ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <DataTable
          caption="Taxpayer records"
          columns={columns}
          rows={data}
          rowHref={(r) => `/taxpayers/${r.id}`}
          renderCard={(r) => (
            <div className="space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{r.name}</p>
                <AccountStatusBadge status={r.status} />
              </div>
              <p className="text-sm text-muted-foreground">
                {r.id} · {r.propertyCount} propert{r.propertyCount === 1 ? 'y' : 'ies'}
              </p>
              <p className="text-sm">
                Total balance: <span className="font-semibold">{peso(r.balance)}</span>
              </p>
            </div>
          )}
        />
      )}
    </>
  )
}
