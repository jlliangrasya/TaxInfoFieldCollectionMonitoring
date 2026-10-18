import { useState } from 'react'
import { useParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PageHeader } from '@/components/common/PageHeader'
import { Section, InfoList } from '@/components/common/Cards'
import { DataTable } from '@/components/common/DataTable'
import { LoadingState, ErrorState } from '@/components/common/States'
import { AccountStatusBadge } from '@/components/common/StatusBadge'
import { Field } from '@/components/common/FormField'
import { useQuery } from '@/hooks/useQuery'
import { useAuth } from '@/features/auth/AuthContext'
import { getTaxpayer, updateTaxpayer, taxpayerEditSchema } from '@/services/taxpayerService'
import { peso, formatDate } from '@/lib/format'
import { PERMISSIONS } from '@/lib/permissions'
import { showError } from '@/lib/errors'

export function TaxpayerDetailPage() {
  const { id } = useParams()
  const { can } = useAuth()
  const [editOpen, setEditOpen] = useState(false)
  const { data: t, loading, error, reload } = useQuery(() => getTaxpayer(id), [id])
  const crumbs = [{ label: 'Dashboard', to: '/' }, { label: 'Taxpayers', to: '/taxpayers' }]

  if (loading && !t) return <LoadingState rows={5} />
  if (error) {
    return (
      <>
        <PageHeader title="Taxpayer" breadcrumbs={crumbs} />
        <ErrorState error={error} onRetry={reload} />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={t.name}
        description={`Taxpayer ID ${t.id} · ${t.type}`}
        breadcrumbs={[...crumbs, { label: t.name }]}
        actions={
          can(PERMISSIONS.RECORDS_EDIT) && (
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil /> Edit details
            </Button>
          )
        }
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <Section title="Taxpayer details">
          <InfoList
            columns={1}
            items={[
              { label: 'Status', value: <AccountStatusBadge status={t.status} /> },
              { label: 'Total balance', value: <span className="text-lg">{peso(t.balance)}</span> },
              { label: 'Address', value: t.address },
              { label: 'Contact no.', value: t.contactNo || '—' },
              { label: 'Number of properties', value: t.propertyCount },
            ]}
          />
          <p className="mt-4 text-xs text-muted-foreground">Based on Treasury records as of {formatDate(t.dataAsOf)}.</p>
        </Section>
        <Section title="Properties" className="xl:col-span-2">
          <DataTable
            caption="Properties owned"
            pageSize={10}
            rows={t.properties}
            rowHref={(r) => `/properties/${r.id}`}
            emptyTitle="No properties in your area"
            columns={[
              { key: 'arpNo', header: 'ARP No.' },
              { key: 'barangayName', header: 'Barangay' },
              { key: 'classification', header: 'Type', cell: (r) => `${r.kind} · ${r.classification}` },
              { key: 'balance', header: 'Balance', align: 'right', cell: (r) => peso(r.balance) },
              { key: 'status', header: 'Status', cell: (r) => <AccountStatusBadge status={r.status} /> },
            ]}
            renderCard={(r) => (
              <div className="space-y-1">
                <div className="flex justify-between gap-2">
                  <p className="font-semibold">ARP {r.arpNo}</p>
                  <AccountStatusBadge status={r.status} />
                </div>
                <p className="text-sm text-muted-foreground">{r.location}</p>
                <p className="text-sm">Balance: <span className="font-semibold">{peso(r.balance)}</span></p>
              </div>
            )}
          />
        </Section>
      </div>
      {can(PERMISSIONS.RECORDS_EDIT) && <EditTaxpayerDialog taxpayer={t} open={editOpen} onOpenChange={setEditOpen} />}
    </>
  )
}

function EditTaxpayerDialog({ taxpayer, open, onOpenChange }) {
  const form = useForm({
    resolver: zodResolver(taxpayerEditSchema),
    values: { name: taxpayer.name, address: taxpayer.address, contactNo: taxpayer.contactNo ?? '' },
  })
  const { register, handleSubmit, formState } = form

  async function onSubmit(values) {
    try {
      await updateTaxpayer(taxpayer.id, values)
      toast.success('Taxpayer details updated.')
      onOpenChange(false)
    } catch (err) {
      showError(err, form)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit taxpayer details</DialogTitle>
          <DialogDescription>Changes are recorded in the Activity Log.</DialogDescription>
        </DialogHeader>
        <form id="taxpayer-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field label="Taxpayer name" required error={formState.errors.name?.message}>
            <Input maxLength={120} {...register('name')} />
          </Field>
          <Field label="Address" required error={formState.errors.address?.message}>
            <Input maxLength={200} {...register('address')} />
          </Field>
          <Field label="Mobile number" hint="11 digits, starting with 09. Leave blank if none." error={formState.errors.contactNo?.message}>
            <Input inputMode="tel" maxLength={11} {...register('contactNo')} />
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="taxpayer-form" disabled={formState.isSubmitting}>
            {formState.isSubmitting && <Loader2 className="animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
