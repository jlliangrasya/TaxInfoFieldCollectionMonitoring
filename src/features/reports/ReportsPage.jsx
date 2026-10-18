import { useState } from 'react'
import { toast } from 'sonner'
import { FileDown, FileSpreadsheet, Loader2, Play, Printer, ChevronRight, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/common/PageHeader'
import { FilterBar, DateFilter, SelectFilter } from '@/components/common/Filters'
import { EmptyState } from '@/components/common/States'
import { useQuery } from '@/hooks/useQuery'
import { useAuth } from '@/features/auth/AuthContext'
import { availableReports, generateReport } from '@/services/reportService'
import { listCollectors } from '@/services/assignmentService'
import { listBarangays } from '@/services/propertyService'
import { logAction } from '@/services/auditService'
import { peso, number, formatDate, formatDateTime, isoDate } from '@/lib/format'
import { STATUS_LABELS } from '@/lib/rpt'
import { PERMISSIONS } from '@/lib/permissions'
import { DEMO_NOTICE, LGU_NAME, OFFICE_NAME } from '@/lib/constants'
import { showError } from '@/lib/errors'
import { cn } from '@/lib/utils'

function cellText(value, type) {
  if (value === null || value === undefined || value === '') return '—'
  if (type === 'money') return peso(value)
  if (type === 'number') return number(value)
  if (type === 'date') return formatDate(value)
  return value
}

const firstOfMonth = () => `${isoDate().slice(0, 7)}-01`

export function ReportsPage() {
  const { user, can } = useAuth()
  const reports = availableReports(user)
  const [selectedId, setSelectedId] = useState(reports[0]?.id)
  const [filters, setFilters] = useState({ from: firstOfMonth(), to: isoDate(), barangayId: '', collectorId: '', status: '' })
  const [report, setReport] = useState(null)
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState('')
  const collectors = useQuery(() => listCollectors({ includeInactive: true }), [])
  const barangays = useQuery(() => listBarangays(), [])

  const def = reports.find((r) => r.id === selectedId)
  const set = (key) => (value) => setFilters((f) => ({ ...f, [key]: value }))
  const canFilterCollector = can(PERMISSIONS.REPORTS_VIEW)

  async function run() {
    setBusy(true)
    try {
      const f = {}
      if (def.filters.includes('dateRange')) Object.assign(f, { from: filters.from, to: filters.to })
      if (def.filters.includes('barangay')) f.barangayId = filters.barangayId
      if (def.filters.includes('collector')) f.collectorId = filters.collectorId
      if (def.filters.includes('status')) f.status = filters.status
      setReport(await generateReport(def.id, f))
    } catch (err) {
      showError(err)
    } finally {
      setBusy(false)
    }
  }

  async function doExport(kind) {
    setExporting(kind)
    try {
      // Export libraries are loaded only when needed, to keep the app fast on mobile data.
      if (kind === 'pdf') (await import('./exporters')).exportPdf(report)
      else if (kind === 'excel') await (await import('./exporters')).exportExcel(report)
      else window.print()
      logAction('Report exported', `${report.title} (${kind.toUpperCase()}) — ${report.filtersText}`)
      if (kind !== 'print') toast.success('Your file has been downloaded.')
    } catch (err) {
      showError(err)
    } finally {
      setExporting('')
    }
  }

  return (
    <>
      <div className="no-print">
        <PageHeader
          title="Reports"
          description={
            canFilterCollector
              ? 'Choose a report, set the filters, then view, print or download it as PDF or Excel.'
              : 'Reports of your own field activity. Choose a report and period, then view, print or download it.'
          }
          breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Reports' }]}
        />

        <h2 className="mb-2 font-semibold">Step 1 — Choose a report</h2>
        <div className="mb-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-3" role="radiogroup" aria-label="Report type">
          {reports.map((r) => (
            <button
              key={r.id}
              type="button"
              role="radio"
              aria-checked={selectedId === r.id}
              onClick={() => {
                setSelectedId(r.id)
                setReport(null)
              }}
              className={cn(
                'flex items-start gap-3 rounded-xl border bg-card p-4 text-left transition-colors',
                selectedId === r.id ? 'border-primary ring-2 ring-primary/30' : 'hover:bg-accent',
              )}
            >
              <span className={cn('mt-1 size-4 shrink-0 rounded-full border-2', selectedId === r.id ? 'border-primary bg-primary' : 'border-input')} aria-hidden />
              <span>
                <span className="block font-semibold">{r.title}</span>
                <span className="block text-sm text-muted-foreground">{r.description}</span>
              </span>
            </button>
          ))}
        </div>

        {def && (
          <>
            <h2 className="mb-2 font-semibold">Step 2 — Set filters</h2>
            <FilterBar>
              {def.filters.includes('dateRange') && (
                <>
                  <DateFilter label="From" value={filters.from} onChange={set('from')} max={isoDate()} />
                  <DateFilter label="To" value={filters.to} onChange={set('to')} max={isoDate()} />
                </>
              )}
              {def.filters.includes('barangay') && (
                <SelectFilter label="Barangay" value={filters.barangayId} onChange={set('barangayId')} options={(barangays.data ?? []).map((b) => ({ value: b.id, label: b.name }))} />
              )}
              {def.filters.includes('collector') && canFilterCollector && (
                <SelectFilter label="Collector" value={filters.collectorId} onChange={set('collectorId')} options={(collectors.data ?? []).map((c) => ({ value: c.id, label: c.fullName }))} />
              )}
              {def.filters.includes('status') && (
                <SelectFilter label="Status" value={filters.status} onChange={set('status')} options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))} />
              )}
            </FilterBar>
            <Button size="lg" onClick={run} disabled={busy} className="mb-6">
              {busy ? <Loader2 className="animate-spin" /> : <Play />}
              View report
            </Button>
          </>
        )}
      </div>

      {report && (
        <section aria-label="Report preview" className="rounded-xl border bg-card shadow-xs">
          <div className="no-print flex flex-wrap items-center justify-between gap-2 border-b p-4">
            <h2 className="flex items-center gap-1 font-semibold">
              Step 3 <ChevronRight className="size-4" aria-hidden /> Print or download
            </h2>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => doExport('print')} disabled={Boolean(exporting)}>
                <Printer /> Print
              </Button>
              <Button variant="outline" onClick={() => doExport('pdf')} disabled={Boolean(exporting)}>
                {exporting === 'pdf' ? <Loader2 className="animate-spin" /> : <FileDown />} PDF
              </Button>
              <Button variant="outline" onClick={() => doExport('excel')} disabled={Boolean(exporting)}>
                {exporting === 'excel' ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />} Excel
              </Button>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            <p className="mb-3 flex items-center justify-center gap-1.5 rounded bg-warning-soft px-3 py-1.5 text-center text-xs font-semibold">
              <TriangleAlert className="size-3.5" aria-hidden /> {DEMO_NOTICE}
            </p>
            <p className="text-sm text-muted-foreground">{OFFICE_NAME} — {LGU_NAME}</p>
            <h3 className="text-xl font-semibold">{report.title}</h3>
            <p className="text-sm text-muted-foreground">{report.filtersText}</p>
            <p className="mb-4 text-sm text-muted-foreground">
              Generated by {report.generatedBy} on {formatDateTime(report.generatedAt)}
            </p>

            {report.rows.length === 0 ? (
              <EmptyState title="No records match the selected filters">Try a wider date range or choose “All”.</EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60">
                    <tr>
                      {report.columns.map((c) => (
                        <th key={c.key} scope="col" className={cn('px-2 py-2 text-left font-semibold whitespace-nowrap', (c.type === 'money' || c.type === 'number') && 'text-right')}>
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((row, i) => (
                      <tr key={i} className="border-t">
                        {report.columns.map((c) => (
                          <td key={c.key} className={cn('px-2 py-2 align-top', (c.type === 'money' || c.type === 'number') && 'text-right tabular-nums', c.key === 'remarks' && 'min-w-48')}>
                            {cellText(row[c.key], c.type)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  {report.totals && (
                    <tfoot>
                      <tr className="border-t-2 bg-muted/40 font-semibold">
                        {report.columns.map((c) => (
                          <td key={c.key} className={cn('px-2 py-2', (c.type === 'money' || c.type === 'number') && 'text-right tabular-nums')}>
                            {report.totals[c.key] !== undefined ? cellText(report.totals[c.key], c.type) : ''}
                          </td>
                        ))}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        </section>
      )}
    </>
  )
}
