import { useState } from 'react'
import { Link } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { BadgeCheck, Loader2, XCircle, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/common/PageHeader'
import { LoadingState, ErrorState, EmptyState } from '@/components/common/States'
import { FieldStatusBadge, DuplicateBadge, NotOfficialReceiptNote } from '@/components/common/StatusBadge'
import { Field } from '@/components/common/FormField'
import { HelpTip } from '@/components/common/HelpTip'
import { TERMS } from '@/lib/terms'
import { useQuery } from '@/hooks/useQuery'
import { listFieldCollections, verifyFieldCollection, rejectFieldCollection } from '@/services/collectionService'
import { verifyInputSchema, rejectInputSchema } from '@/lib/validation'
import { peso, formatDate, formatDateTime } from '@/lib/format'
import { showError } from '@/lib/errors'

export function VerificationPage() {
  const [tab, setTab] = useState('pending')
  const [verifying, setVerifying] = useState(null)
  const [rejecting, setRejecting] = useState(null)
  const { data, loading, error, reload } = useQuery(() => listFieldCollections({ status: tab }), [tab])

  return (
    <>
      <PageHeader
        title="Field Record Review"
        description="Check each collection entered by Revenue Collectors against the Official Receipt. Verified records are added to the taxpayer's payments; rejected records are not counted."
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Field Record Review' }]}
      />

      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList className="h-auto">
          <TabsTrigger value="pending" className="min-h-10 px-4">Waiting for review</TabsTrigger>
          <TabsTrigger value="verified" className="min-h-10 px-4">Verified</TabsTrigger>
          <TabsTrigger value="rejected" className="min-h-10 px-4">Rejected</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading && !data ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : data.length === 0 ? (
        <EmptyState title={tab === 'pending' ? 'All caught up' : 'No records'}>
          {tab === 'pending' ? 'There are no field records waiting for review.' : 'No field records in this list yet.'}
        </EmptyState>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {data.map((f) => (
            <li key={f.id} className={`rounded-xl border bg-card p-4 shadow-xs ${f.possibleDuplicate && f.status === 'pending' ? 'border-danger/50' : ''}`}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm text-muted-foreground">{f.refNo}</span>
                <FieldStatusBadge status={f.status} />
                {f.possibleDuplicate && f.status === 'pending' && <DuplicateBadge />}
              </div>
              <p className="text-2xl font-semibold tabular-nums">{peso(f.amount)}</p>
              <p className="text-sm text-muted-foreground">Tax year {f.taxYear} · collected {formatDate(f.collectionDate)}</p>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Taxpayer</dt>
                <dd className="font-medium">{f.taxpayerName}</dd>
                <dt className="text-muted-foreground">Property</dt>
                <dd>
                  <Link to={`/properties/${f.propertyId}`} className="text-primary hover:underline">ARP {f.arpNo}</Link> · {f.barangayName}
                </dd>
                <dt className="text-muted-foreground">Collector</dt>
                <dd>{f.collectorName}</dd>
                <dt className="text-muted-foreground">OR No. given</dt>
                <dd className="font-mono">{f.orNoIssued || '— not entered —'}</dd>
                {f.remarks && (
                  <>
                    <dt className="text-muted-foreground">Remarks</dt>
                    <dd>{f.remarks}</dd>
                  </>
                )}
                {f.yearBalance !== null && (
                  <>
                    <dt className="text-muted-foreground">Year balance</dt>
                    <dd className="tabular-nums">{peso(f.yearBalance)}</dd>
                  </>
                )}
                {f.reviewedByName && (
                  <>
                    <dt className="text-muted-foreground">Reviewed</dt>
                    <dd>
                      {f.reviewedByName}, {formatDateTime(f.reviewedAt)}
                      {f.reviewNote && <span className="block text-muted-foreground">“{f.reviewNote}”</span>}
                    </dd>
                  </>
                )}
              </dl>
              {f.exceedsBalance && (
                <p className="mt-3 flex items-start gap-2 rounded-md bg-danger-soft p-2 text-sm text-danger">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  The amount is more than the remaining balance for this tax year. It may have already been paid.
                </p>
              )}
              {f.status === 'pending' && (
                <>
                  <NotOfficialReceiptNote className="mt-3" />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button onClick={() => setVerifying(f)} disabled={f.exceedsBalance}>
                      <BadgeCheck /> Verify
                    </Button>
                    <Button variant="outline" onClick={() => setRejecting(f)}>
                      <XCircle /> Reject
                    </Button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {verifying && <VerifyDialog record={verifying} onClose={() => setVerifying(null)} />}
      {rejecting && <RejectDialog record={rejecting} onClose={() => setRejecting(null)} />}
    </>
  )
}

function VerifyDialog({ record, onClose }) {
  const form = useForm({ resolver: zodResolver(verifyInputSchema), defaultValues: { orNo: record.orNoIssued ?? '', note: '' } })
  const { register, handleSubmit, formState } = form

  async function onSubmit(values) {
    try {
      await verifyFieldCollection(record.id, values)
      toast.success(`${record.refNo} verified. ${peso(record.amount)} is now counted as paid.`)
      onClose()
    } catch (err) {
      showError(err, form)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Verify field record {record.refNo}</DialogTitle>
          <DialogDescription>
            {peso(record.amount)} for tax year {record.taxYear} — {record.taxpayerName}. Confirm the Official Receipt number that matches this collection.
          </DialogDescription>
        </DialogHeader>
        {record.possibleDuplicate && (
          <p className="flex items-start gap-2 rounded-md bg-danger-soft p-3 text-sm text-danger">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            This record was flagged as a possible duplicate. Make sure it is a separate payment before verifying.
          </p>
        )}
        <form id="verify-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field label="Official Receipt (OR) No." required labelExtra={<HelpTip term="OR No.">{TERMS.OR}</HelpTip>} error={formState.errors.orNo?.message}>
            <Input inputMode="numeric" maxLength={10} autoComplete="off" {...register('orNo')} />
          </Field>
          <Field label="Note (optional)" error={formState.errors.note?.message}>
            <Textarea rows={2} maxLength={500} {...register('note')} />
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="verify-form" disabled={formState.isSubmitting}>
            {formState.isSubmitting ? <Loader2 className="animate-spin" /> : <BadgeCheck />}
            Verify and add to payments
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RejectDialog({ record, onClose }) {
  const form = useForm({
    resolver: zodResolver(rejectInputSchema),
    defaultValues: { reason: record.possibleDuplicate ? 'Duplicate entry of an earlier field record.' : '' },
  })
  const { register, handleSubmit, formState } = form

  async function onSubmit(values) {
    try {
      await rejectFieldCollection(record.id, values)
      toast.success(`${record.refNo} rejected. The collector will see your reason.`)
      onClose()
    } catch (err) {
      showError(err, form)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject field record {record.refNo}</DialogTitle>
          <DialogDescription>The amount will not be counted. Please give a clear reason for the collector.</DialogDescription>
        </DialogHeader>
        <form id="reject-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Field label="Reason" required error={formState.errors.reason?.message}>
            <Textarea rows={3} maxLength={500} {...register('reason')} />
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="reject-form" variant="destructive" disabled={formState.isSubmitting}>
            {formState.isSubmitting ? <Loader2 className="animate-spin" /> : <XCircle />}
            Reject record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
