import { useState } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable } from '@/components/common/DataTable'
import { FilterBar, SearchBox, SelectFilter } from '@/components/common/Filters'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { LoadingState, ErrorState } from '@/components/common/States'
import { AccountStatusBadge } from '@/components/common/StatusBadge'
import { useQuery } from '@/hooks/useQuery'
import { useAuth } from '@/features/auth/AuthContext'
import { listProperties, listBarangays } from '@/services/propertyService'
import { peso } from '@/lib/format'
import { STATUS_LABELS } from '@/lib/rpt'
import { PERMISSIONS } from '@/lib/permissions'

const CLASSIFICATIONS = ['Residential', 'Agricultural', 'Commercial', 'Industrial']

export function PropertyListPage() {
  const { can } = useAuth()
  const [query, setQuery] = useState('')
  const [barangayId, setBarangayId] = useState('')
  const [status, setStatus] = useState('')
  const [classification, setClassification] = useState('')
  const q = useDebouncedValue(query)

  const barangays = useQuery(() => listBarangays(), [])
  const { data, loading, error, reload } = useQuery(
    () => listProperties({ query: q, barangayId, status, classification }),
    [q, barangayId, status, classification],
  )

  const columns = [
    { key: 'arpNo', header: 'ARP No.' },
    { key: 'taxpayerName', header: 'Taxpayer' },
    { key: 'barangayName', header: 'Barangay' },
    { key: 'classification', header: 'Type', cell: (r) => `${r.kind} · ${r.classification}` },
    { key: 'assessedValue', header: 'Assessed Value', align: 'right', cell: (r) => peso(r.assessedValue) },
    { key: 'balance', header: 'Balance', align: 'right', cell: (r) => <span className="font-semibold">{peso(r.balance)}</span> },
    { key: 'status', header: 'Status', cell: (r) => <AccountStatusBadge status={r.status} /> },
  ]

  return (
    <>
      <PageHeader
        title="Properties"
        description={
          can(PERMISSIONS.RECORDS_VIEW_ALL)
            ? 'Search real property records by taxpayer name, ARP No., PIN, Tax Declaration No. or barangay.'
            : 'Properties in your assigned area. Search by taxpayer name, ARP No., PIN or Tax Declaration No.'
        }
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Properties' }]}
      />
      <FilterBar
        showClear={Boolean(query || barangayId || status || classification)}
        onClear={() => {
          setQuery('')
          setBarangayId('')
          setStatus('')
          setClassification('')
        }}
      >
        <SearchBox value={query} onChange={setQuery} placeholder="Name, ARP No., PIN or TD No." className="sm:col-span-2 lg:col-span-1" />
        <SelectFilter
          label="Barangay"
          value={barangayId}
          onChange={setBarangayId}
          options={(barangays.data ?? []).map((b) => ({ value: b.id, label: b.name }))}
        />
        <SelectFilter
          label="Payment status"
          value={status}
          onChange={setStatus}
          options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <SelectFilter label="Classification" value={classification} onChange={setClassification} options={CLASSIFICATIONS.map((c) => ({ value: c, label: c }))} />
      </FilterBar>

      {loading && !data ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <DataTable
          caption="Property records"
          columns={columns}
          rows={data}
          rowHref={(r) => `/properties/${r.id}`}
          renderCard={(r) => (
            <div className="space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{r.taxpayerName}</p>
                <AccountStatusBadge status={r.status} />
              </div>
              <p className="text-sm text-muted-foreground">
                ARP {r.arpNo} · {r.barangayName}
              </p>
              <p className="text-sm">
                Balance: <span className="font-semibold">{peso(r.balance)}</span>
              </p>
            </div>
          )}
        />
      )}
    </>
  )
}
