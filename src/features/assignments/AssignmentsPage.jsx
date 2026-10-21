import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2, Plus, CircleStop } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable } from '@/components/common/DataTable'
import { LoadingState, ErrorState } from '@/components/common/States'
import { Field, NativeSelect } from '@/components/common/FormField'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { useQuery } from '@/hooks/useQuery'
import { listAssignments, createAssignment, endAssignment, listCollectors } from '@/services/assignmentService'
import { listBarangays, listProperties } from '@/services/propertyService'
import { assignmentInputSchema } from '@/lib/validation'
import { formatDate, isoDate } from '@/lib/format'
import { showError } from '@/lib/errors'

const STATE_STYLES = {
  current: 'bg-success-soft text-success',
  upcoming: 'bg-info-soft text-info',
  expired: 'bg-muted text-muted-foreground',
  ended: 'bg-muted text-muted-foreground',
}
const STATE_LABELS = { current: 'Active', upcoming: 'Upcoming', expired: 'Expired', ended: 'Ended' }

export function AssignmentsPage() {
  const [showEnded, setShowEnded] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [ending, setEnding] = useState(null)
  const { data, loading, error, reload } = useQuery(() => listAssignments({ showEnded }), [showEnded])

  return (
    <>
      <PageHeader
        title="Collector Assignments"
        description="Assign barangays or individual properties to Revenue Collectors. Collectors can only see records in their assigned area."
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Collector Assignments' }]}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus /> New assignment
          </Button>
        }
      />
      <div className="mb-4 flex items-center gap-2">
        <Checkbox id="show-ended" checked={showEnded} onCheckedChange={(v) => setShowEnded(Boolean(v))} className="size-5" />
        <Label htmlFor="show-ended">Show ended and expired assignments</Label>
      </div>
      {loading && !data ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <DataTable
          caption="Collector assignments"
          rows={data}
          emptyTitle="No assignments"
          emptyText="Create an assignment so collectors can see their properties."
          columns={[
            { key: 'collectorName', header: 'Collector' },
            { key: 'barangayName', header: 'Area', cell: (r) => (r.propertyArpNo ? `ARP ${r.propertyArpNo} (Brgy. ${r.barangayName})` : `Brgy. ${r.barangayName} (whole barangay)`) },
            { key: 'startDate', header: 'Period', cell: (r) => `${formatDate(r.startDate)} – ${formatDate(r.endDate)}` },
            { key: 'state', header: 'Status', cell: (r) => <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATE_STYLES[r.state]}`}>{STATE_LABELS[r.state]}</span> },
            { key: 'notes', header: 'Notes', cell: (r) => <span className="text-muted-foreground">{r.notes || '—'}</span> },
            {
              key: 'actions',
              header: <span className="sr-only">Actions</span>,
              sortable: false,
              cell: (r) =>
                r.active && (
                  <Button variant="outline" size="sm" onClick={() => setEnding(r)}>
                    <CircleStop /> End
                  </Button>
                ),
            },
          ]}
          renderCard={(r) => (
            <div className="space-y-1">
              <div className="flex justify-between gap-2">
                <p className="font-semibold">{r.collectorName}</p>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATE_STYLES[r.state]}`}>{STATE_LABELS[r.state]}</span>
              </div>
              <p className="text-sm">{r.propertyArpNo ? `ARP ${r.propertyArpNo}` : `Brgy. ${r.barangayName}`}</p>
              <p className="text-sm text-muted-foreground">{formatDate(r.startDate)} – {formatDate(r.endDate)}</p>
              {r.active && (
                <Button variant="outline" size="sm" className="mt-2" onClick={() => setEnding(r)}>
                  <CircleStop /> End assignment
                </Button>
              )}
            </div>
          )}
        />
      )}

      {createOpen && <CreateAssignmentDialog onClose={() => setCreateOpen(false)} />}
      <ConfirmDialog
        open={Boolean(ending)}
        onOpenChange={(o) => !o && setEnding(null)}
        title="End this assignment?"
        description={ending && `${ending.collectorName} will no longer see properties in ${ending.propertyArpNo ? `ARP ${ending.propertyArpNo}` : `Brgy. ${ending.barangayName}`}. Their past visits are kept.`}
        confirmLabel="End assignment"
        destructive
        onConfirm={async () => {
          try {
            await endAssignment(ending.id)
            toast.success('Assignment ended.')
          } catch (err) {
            showError(err)
            return false
          }
        }}
      />
    </>
  )
}

function CreateAssignmentDialog({ onClose }) {
  const year = new Date().getFullYear()
  const collectors = useQuery(() => listCollectors(), [])
  const barangays = useQuery(() => listBarangays(), [])
  const form = useForm({
    resolver: zodResolver(assignmentInputSchema),
    defaultValues: { collectorId: '', barangayId: '', propertyId: '', startDate: isoDate(), endDate: `${year}-12-31`, notes: '' },
  })
  const { register, handleSubmit, formState } = form
  const barangayId = useWatch({ control: form.control, name: 'barangayId' })
  const properties = useQuery(() => (barangayId ? listProperties({ barangayId }) : Promise.resolve([])), [barangayId])

  async function onSubmit(values) {
    try {
      await createAssignment(values)
      toast.success('Assignment created.')
      onClose()
    } catch (err) {
      showError(err, form)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New assignment</DialogTitle>
          <DialogDescription>Choose a collector and the area they will cover.</DialogDescription>
        </DialogHeader>
        <form id="assignment-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field label="Revenue Collector" required error={formState.errors.collectorId?.message}>
            <NativeSelect {...register('collectorId')}>
              <option value="">Choose a collector…</option>
              {(collectors.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.fullName}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Barangay" required error={formState.errors.barangayId?.message}>
            <NativeSelect {...register('barangayId')}>
              <option value="">Choose a barangay…</option>
              {(barangays.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Specific property (optional)" hint="Leave as 'Whole barangay' to assign all properties in the barangay." error={formState.errors.propertyId?.message}>
            <NativeSelect {...register('propertyId')} disabled={!barangayId}>
              <option value="">Whole barangay</option>
              {(properties.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>ARP {p.arpNo} — {p.taxpayerName}</option>
              ))}
            </NativeSelect>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Start date" required error={formState.errors.startDate?.message}>
              <Input type="date" {...register('startDate')} />
            </Field>
            <Field label="End date" required error={formState.errors.endDate?.message}>
              <Input type="date" {...register('endDate')} />
            </Field>
          </div>
          <Field label="Notes (optional)" error={formState.errors.notes?.message}>
            <Textarea rows={2} maxLength={500} {...register('notes')} />
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="assignment-form" disabled={formState.isSubmitting}>
            {formState.isSubmitting ? <Loader2 className="animate-spin" /> : <Plus />}
            Create assignment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
