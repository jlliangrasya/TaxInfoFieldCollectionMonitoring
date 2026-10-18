import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { ClipboardPen, Pencil, Receipt, Loader2, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PageHeader } from '@/components/common/PageHeader'
import { Section, InfoList } from '@/components/common/Cards'
import { LoadingState, ErrorState, EmptyState } from '@/components/common/States'
import { AccountStatusBadge, FieldStatusBadge, DuplicateBadge, NotOfficialReceiptNote } from '@/components/common/StatusBadge'
import { HelpTip } from '@/components/common/HelpTip'
import { TERMS } from '@/lib/terms'
import { Field } from '@/components/common/FormField'
import { GpsLink } from '@/components/common/GpsLink'
import { RecordPaymentDialog } from '@/features/collections/RecordPaymentDialog'
import { useQuery } from '@/hooks/useQuery'
import { useAuth } from '@/features/auth/AuthContext'
import { getProperty, updatePropertyLocation } from '@/services/propertyService'
import { peso, number, formatDate } from '@/lib/format'
import { outcomeLabel } from '@/lib/constants'
import { PERMISSIONS } from '@/lib/permissions'
import { showError } from '@/lib/errors'

function SimpleTable({ head, rows, empty }) {
  if (!rows.length) return <p className="text-muted-foreground">{empty}</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            {head.map((h) => (
              <th key={h.label} scope="col" className={`px-2 py-2 font-semibold whitespace-nowrap ${h.right ? 'text-right' : ''}`}>
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  )
}

const td = 'px-2 py-2.5 align-top'
const tdr = `${td} text-right tabular-nums`

export function PropertyDetailPage() {
  const { id } = useParams()
  const { can } = useAuth()
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const { data: p, loading, error, reload } = useQuery(() => getProperty(id), [id])

  const crumbs = [{ label: 'Dashboard', to: '/' }, { label: 'Properties', to: '/properties' }]

  if (loading && !p) return <LoadingState rows={6} />
  if (error) {
    return (
      <>
        <PageHeader title="Property" breadcrumbs={crumbs} />
        <ErrorState error={error} onRetry={reload} />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={`ARP No. ${p.arpNo}`}
        description={`${p.kind} · ${p.classification} · ${p.location}`}
        breadcrumbs={[...crumbs, { label: p.arpNo }]}
        actions={
          <>
            {can(PERMISSIONS.FIELD_RECORD) && (
              <Button asChild size="lg">
                <Link to={`/field/visit/${p.id}`}>
                  <ClipboardPen /> Record a visit
                </Link>
              </Button>
            )}
            {can(PERMISSIONS.PAYMENT_RECORD) && (
              <Button onClick={() => setPaymentOpen(true)} disabled={p.balance <= 0}>
                <Receipt /> Record payment
              </Button>
            )}
            {can(PERMISSIONS.RECORDS_EDIT) && (
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil /> Edit location
              </Button>
            )}
            <Button variant="outline" onClick={() => window.print()}>
              <Printer /> Print
            </Button>
          </>
        }
      />

      {/* Summary */}
      <div className="mb-6 grid gap-3 rounded-xl border bg-card p-4 shadow-xs sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <p className="text-sm text-muted-foreground">Status</p>
          <AccountStatusBadge status={p.status} className="mt-1" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Total balance</p>
          <p className="text-xl font-semibold tabular-nums">{peso(p.balance)}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">From past years</p>
          <p className="text-xl font-semibold tabular-nums">{peso(p.pastBalance)}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Pending field records</p>
          <p className="text-xl font-semibold tabular-nums">{peso(p.pendingFieldAmount)}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Follow-up</p>
          <p className="font-medium">{p.followUpStatus}</p>
          {p.followUpDate && <p className="text-sm text-muted-foreground">on {formatDate(p.followUpDate)}</p>}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Section
            title="Tax due per year"
            description={`Based on Treasury records as of ${formatDate(p.dataAsOf)}. Basic RPT 1% + SEF 1% of the assessed value.`}
          >
            <SimpleTable
              head={[
                { label: 'Tax Year' },
                { label: 'Basic RPT', right: true },
                { label: 'SEF', right: true },
                { label: 'Amount Due', right: true },
                { label: 'Paid', right: true },
                { label: 'Balance', right: true },
                { label: 'Status' },
              ]}
              empty="No assessments recorded."
              rows={p.ledger.map((y) => (
                <tr key={y.taxYear} className="border-b last:border-0">
                  <td className={`${td} font-medium`}>{y.taxYear}</td>
                  <td className={tdr}>{peso(y.basicTax)}</td>
                  <td className={tdr}>{peso(y.sefTax)}</td>
                  <td className={tdr}>{peso(y.amountDue)}</td>
                  <td className={tdr}>{peso(y.amountPaid)}</td>
                  <td className={`${tdr} font-semibold`}>{peso(y.balance)}</td>
                  <td className={td}>
                    <AccountStatusBadge status={y.status} />
                  </td>
                </tr>
              ))}
            />
          </Section>

          <Section title="Payments (Official Receipts)" description="Payments recorded by the Treasury office.">
            <SimpleTable
              head={[{ label: 'Date' }, { label: 'OR No.' }, { label: 'Tax Year' }, { label: 'Amount', right: true }, { label: 'Source' }, { label: 'Recorded by' }]}
              empty="No payments recorded yet."
              rows={p.payments.map((pay) => (
                <tr key={pay.id} className="border-b last:border-0">
                  <td className={td}>{formatDate(pay.paymentDate)}</td>
                  <td className={`${td} font-mono`}>{pay.orNo}</td>
                  <td className={td}>{pay.taxYear}</td>
                  <td className={tdr}>{peso(pay.amount)}</td>
                  <td className={td}>{pay.source === 'field' ? 'Field (verified)' : 'Treasury counter'}</td>
                  <td className={td}>{pay.recordedByName}</td>
                </tr>
              ))}
            />
          </Section>

          <Section
            title="Field records"
            description={
              <span className="flex items-center gap-1">
                Collections entered by Revenue Collectors. <HelpTip term="Field record">{TERMS.FIELD_RECORD}</HelpTip>
              </span>
            }
          >
            <NotOfficialReceiptNote className="mb-3" />
            <SimpleTable
              head={[{ label: 'Ref. No.' }, { label: 'Date' }, { label: 'Tax Year' }, { label: 'Amount', right: true }, { label: 'Collector' }, { label: 'Status' }]}
              empty="No field records."
              rows={p.fieldCollections.map((f) => (
                <tr key={f.id} className="border-b last:border-0">
                  <td className={`${td} font-mono`}>{f.refNo}</td>
                  <td className={td}>{formatDate(f.collectionDate)}</td>
                  <td className={td}>{f.taxYear}</td>
                  <td className={tdr}>{peso(f.amount)}</td>
                  <td className={td}>{f.collectorName}</td>
                  <td className={td}>
                    <div className="flex flex-wrap gap-1">
                      <FieldStatusBadge status={f.status} />
                      {f.possibleDuplicate && f.status === 'pending' && <DuplicateBadge />}
                    </div>
                  </td>
                </tr>
              ))}
            />
          </Section>

          <Section title="Field visit history">
            {p.visits.length === 0 ? (
              <EmptyState title="No visits yet">No field visits have been recorded for this property.</EmptyState>
            ) : (
              <ol className="space-y-4">
                {p.visits.map((v) => (
                  <li key={v.id} className="border-l-2 border-primary/30 pl-4">
                    <p className="font-medium">
                      {formatDate(v.visitDate)} — {outcomeLabel(v.outcome)}
                    </p>
                    <p className="text-sm text-muted-foreground">By {v.collectorName}</p>
                    {v.remarks && <p className="mt-1 text-sm">“{v.remarks}”</p>}
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      {v.followUpDate && <span>Follow-up: {formatDate(v.followUpDate)}</span>}
                      <span className="inline-flex gap-1">
                        Location: <GpsLink gps={v.gps} />
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Property details">
            <InfoList
              columns={1}
              items={[
                { label: 'ARP No.', value: p.arpNo, help: <HelpTip term="ARP No.">{TERMS.ARP}</HelpTip> },
                { label: 'PIN', value: p.pin, help: <HelpTip term="PIN">{TERMS.PIN}</HelpTip> },
                { label: 'Tax Declaration No.', value: p.tdNo, help: <HelpTip term="Tax Declaration">{TERMS.TD}</HelpTip> },
                { label: 'Barangay', value: p.barangayName },
                { label: 'Location', value: p.location },
                { label: 'Kind / Classification', value: `${p.kind} · ${p.classification}` },
                { label: 'Area', value: `${number(p.areaSqm)} sq. m.` },
                { label: 'Market value', value: peso(p.marketValue) },
                { label: 'Assessment level', value: `${Math.round(p.assessmentLevel * 100)}%` },
                { label: 'Assessed value', value: peso(p.assessedValue), help: <HelpTip term="Assessed value">{TERMS.ASSESSED}</HelpTip> },
                { label: 'Assigned collector', value: p.assignedCollectorName },
              ]}
            />
          </Section>

          {p.taxpayer && (
            <Section title="Owner / Taxpayer">
              <InfoList
                columns={1}
                items={[
                  {
                    label: 'Name',
                    value: (
                      <Link to={`/taxpayers/${p.taxpayer.id}`} className="text-primary hover:underline">
                        {p.taxpayer.name}
                      </Link>
                    ),
                  },
                  { label: 'Taxpayer ID', value: p.taxpayer.id },
                  { label: 'Type', value: p.taxpayer.type },
                  { label: 'Address', value: p.taxpayer.address },
                  { label: 'Contact no.', value: p.taxpayer.contactNo || '—' },
                ]}
              />
            </Section>
          )}
        </div>
      </div>

      {can(PERMISSIONS.PAYMENT_RECORD) && <RecordPaymentDialog property={p} open={paymentOpen} onOpenChange={setPaymentOpen} />}
      {can(PERMISSIONS.RECORDS_EDIT) && <EditLocationDialog property={p} open={editOpen} onOpenChange={setEditOpen} />}
    </>
  )
}

function EditLocationDialog({ property, open, onOpenChange }) {
  const form = useForm({ values: { location: property.location } })
  const { register, handleSubmit, formState } = form

  async function onSubmit(values) {
    try {
      await updatePropertyLocation(property.id, values)
      toast.success('Property location updated.')
      onOpenChange(false)
    } catch (err) {
      showError(err, form)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit property location</DialogTitle>
          <DialogDescription>Assessment details can only be changed through the Assessor's Office.</DialogDescription>
        </DialogHeader>
        <form id="location-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Field label="Location" required error={formState.errors.location?.message}>
            <Input maxLength={200} {...register('location')} />
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="location-form" disabled={formState.isSubmitting}>
            {formState.isSubmitting && <Loader2 className="animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
