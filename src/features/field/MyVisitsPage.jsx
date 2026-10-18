import { useState } from 'react'
import { Link } from 'react-router'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable } from '@/components/common/DataTable'
import { FilterBar, DateFilter } from '@/components/common/Filters'
import { LoadingState, ErrorState, EmptyState } from '@/components/common/States'
import { FieldStatusBadge, DuplicateBadge, NotOfficialReceiptNote } from '@/components/common/StatusBadge'
import { useQuery } from '@/hooks/useQuery'
import { listVisits } from '@/services/fieldVisitService'
import { listFieldCollections } from '@/services/collectionService'
import { peso, formatDate, isoDate } from '@/lib/format'

export function MyVisitsPage() {
  const [tab, setTab] = useState('visits')
  return (
    <>
      <PageHeader
        title="My Visits"
        description="Your field visit history and the status of the collections you recorded."
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'My Visits' }]}
      />
      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList className="h-auto">
          <TabsTrigger value="visits" className="min-h-10 px-4">Visits</TabsTrigger>
          <TabsTrigger value="records" className="min-h-10 px-4">My field records</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === 'visits' ? <VisitHistory /> : <FieldRecords />}
    </>
  )
}

function VisitHistory() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const { data, loading, error, reload } = useQuery(() => listVisits({ from, to }), [from, to])

  return (
    <>
      <FilterBar showClear={Boolean(from || to)} onClear={() => { setFrom(''); setTo('') }}>
        <DateFilter label="From" value={from} onChange={setFrom} max={isoDate()} />
        <DateFilter label="To" value={to} onChange={setTo} max={isoDate()} />
      </FilterBar>
      {loading && !data ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <DataTable
          caption="My field visits"
          rows={data}
          emptyTitle="No visits found"
          emptyText="Visits you record will appear here."
          rowHref={(r) => `/properties/${r.propertyId}`}
          columns={[
            { key: 'visitDate', header: 'Date', cell: (r) => formatDate(r.visitDate) },
            { key: 'taxpayerName', header: 'Taxpayer' },
            { key: 'arpNo', header: 'ARP No.' },
            { key: 'barangayName', header: 'Barangay' },
            { key: 'outcomeLabel', header: 'Result' },
            { key: 'collectionAmount', header: 'Collected', align: 'right', cell: (r) => (r.collectionAmount ? peso(r.collectionAmount) : '—') },
            { key: 'followUpDate', header: 'Follow-up', cell: (r) => formatDate(r.followUpDate) },
          ]}
          renderCard={(r) => (
            <div className="space-y-1">
              <div className="flex justify-between gap-2">
                <p className="font-semibold">{r.taxpayerName}</p>
                <span className="text-sm text-muted-foreground">{formatDate(r.visitDate)}</span>
              </div>
              <p className="text-sm text-muted-foreground">ARP {r.arpNo} · {r.barangayName}</p>
              <p className="text-sm">{r.outcomeLabel}{r.collectionAmount ? ` — ${peso(r.collectionAmount)}` : ''}</p>
              {r.remarks && <p className="text-sm text-muted-foreground">“{r.remarks}”</p>}
            </div>
          )}
        />
      )}
    </>
  )
}

function FieldRecords() {
  const { data, loading, error, reload } = useQuery(() => listFieldCollections(), [])
  if (loading && !data) return <LoadingState />
  if (error) return <ErrorState error={error} onRetry={reload} />
  if (!data.length) return <EmptyState title="No field records yet">When you record a collection during a visit, it appears here until Treasury verifies it.</EmptyState>

  return (
    <>
      <NotOfficialReceiptNote className="mb-3" />
      <ul className="grid gap-3 md:grid-cols-2">
        {data.map((f) => (
          <li key={f.id} className="rounded-xl border bg-card p-4 shadow-xs">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm text-muted-foreground">{f.refNo}</span>
              <FieldStatusBadge status={f.status} />
              {f.possibleDuplicate && f.status === 'pending' && <DuplicateBadge />}
            </div>
            <p className="text-xl font-semibold tabular-nums">{peso(f.amount)}</p>
            <p className="text-sm">
              <Link to={`/properties/${f.propertyId}`} className="text-primary hover:underline">{f.taxpayerName}</Link> · ARP {f.arpNo}
            </p>
            <p className="text-sm text-muted-foreground">Tax year {f.taxYear} · {formatDate(f.collectionDate)}</p>
            {f.status === 'rejected' && f.reviewNote && (
              <p className="mt-2 rounded-md bg-danger-soft p-2 text-sm text-danger">Reason for rejection: {f.reviewNote}</p>
            )}
            {f.status === 'verified' && (
              <p className="mt-2 text-sm text-success">Matched to OR No. {f.orNoIssued}{f.reviewedByName ? ` by ${f.reviewedByName}` : ''}.</p>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}
