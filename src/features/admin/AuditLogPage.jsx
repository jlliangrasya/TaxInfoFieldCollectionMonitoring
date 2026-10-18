import { useState } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable } from '@/components/common/DataTable'
import { FilterBar, SearchBox, SelectFilter, DateFilter } from '@/components/common/Filters'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { LoadingState, ErrorState } from '@/components/common/States'
import { useQuery } from '@/hooks/useQuery'
import { listAuditLog, listAuditActions } from '@/services/auditService'
import { formatDateTime, isoDate } from '@/lib/format'

export function AuditLogPage() {
  const [query, setQuery] = useState('')
  const [action, setAction] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const q = useDebouncedValue(query)
  const actions = useQuery(() => listAuditActions(), [])
  const { data, loading, error, reload } = useQuery(() => listAuditLog({ query: q, action, from, to }), [q, action, from, to])

  return (
    <>
      <PageHeader
        title="Activity Log"
        description="A permanent record of important actions: logins, changes to records, payments, field collections, verifications and report downloads. Entries cannot be edited or deleted."
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Activity Log' }]}
      />
      <FilterBar showClear={Boolean(query || action || from || to)} onClear={() => { setQuery(''); setAction(''); setFrom(''); setTo('') }}>
        <SearchBox value={query} onChange={setQuery} placeholder="User, action or details" />
        <SelectFilter label="Action" value={action} onChange={setAction} options={(actions.data ?? []).map((a) => ({ value: a, label: a }))} />
        <DateFilter label="From" value={from} onChange={setFrom} max={isoDate()} />
        <DateFilter label="To" value={to} onChange={setTo} max={isoDate()} />
      </FilterBar>
      {loading && !data ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <DataTable
          caption="Activity log"
          rows={data}
          pageSize={25}
          columns={[
            { key: 'at', header: 'Date & time', cell: (e) => <span className="whitespace-nowrap">{formatDateTime(e.at)}</span> },
            { key: 'username', header: 'User', cell: (e) => <code className="font-mono text-xs">{e.username}</code> },
            { key: 'action', header: 'Action', cell: (e) => <span className="font-medium">{e.action}</span> },
            { key: 'details', header: 'Details', cell: (e) => <span className="text-muted-foreground">{e.details || '—'}</span> },
          ]}
          renderCard={(e) => (
            <div className="space-y-0.5">
              <p className="font-medium">{e.action}</p>
              {e.details && <p className="text-sm text-muted-foreground">{e.details}</p>}
              <p className="text-xs text-muted-foreground">{e.username} · {formatDateTime(e.at)}</p>
            </div>
          )}
        />
      )}
    </>
  )
}
