import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { subDays } from 'date-fns'
import { toast } from 'sonner'
import { Loader2, LocateFixed, MapPin, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { PageHeader } from '@/components/common/PageHeader'
import { Section } from '@/components/common/Cards'
import { LoadingState, ErrorState } from '@/components/common/States'
import { AccountStatusBadge, NotOfficialReceiptNote } from '@/components/common/StatusBadge'
import { Field, NativeSelect } from '@/components/common/FormField'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { DuplicateWarningDialog } from '@/components/common/DuplicateWarningDialog'
import { HelpTip } from '@/components/common/HelpTip'
import { TERMS } from '@/lib/terms'
import { useQuery } from '@/hooks/useQuery'
import { useAuth } from '@/features/auth/AuthContext'
import { getProperty } from '@/services/propertyService'
import { getPayableYears } from '@/services/collectionService'
import { logVisit } from '@/services/fieldVisitService'
import { visitInputSchema, MAX_LATE_ENTRY_DAYS } from '@/lib/validation'
import { VISIT_OUTCOMES } from '@/lib/constants'
import { isoDate, peso } from '@/lib/format'
import { showError } from '@/lib/errors'
import { cn } from '@/lib/utils'

export function LogVisitPage() {
  const { propertyId } = useParams()
  const { data, loading, error, reload } = useQuery(
    async () => {
      const [property, years] = await Promise.all([getProperty(propertyId), getPayableYears(propertyId)])
      return { property, years }
    },
    [propertyId],
  )

  const crumbs = [{ label: 'Dashboard', to: '/' }, { label: 'My Assignments', to: '/field' }, { label: 'Record a visit' }]
  if (loading && !data) return <LoadingState rows={6} />
  if (error) {
    return (
      <>
        <PageHeader title="Record a visit" breadcrumbs={crumbs} />
        <ErrorState error={error} onRetry={reload} />
      </>
    )
  }
  return <VisitForm property={data.property} years={data.years} crumbs={crumbs} />
}

function VisitForm({ property, years, crumbs }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [gps, setGps] = useState(null)
  const [gpsConsentOpen, setGpsConsentOpen] = useState(false)
  const [gpsBusy, setGpsBusy] = useState(false)
  const [gpsError, setGpsError] = useState('')
  const [warning, setWarning] = useState(null)

  const oldestYear = years[years.length - 1]
  const form = useForm({
    resolver: zodResolver(visitInputSchema),
    defaultValues: {
      propertyId: property.id,
      visitDate: isoDate(),
      outcome: '',
      remarks: '',
      followUpDate: '',
      collectionTaxYear: oldestYear ? String(oldestYear.taxYear) : '',
      collectionAmount: '',
      orNoIssued: '',
    },
  })
  const { register, handleSubmit, formState, setValue, control } = form
  const [outcome, remarksValue, collectionTaxYear, visitDate] = useWatch({ control, name: ['outcome', 'remarks', 'collectionTaxYear', 'visitDate'] })
  const remarks = remarksValue ?? ''
  const selected = VISIT_OUTCOMES.find((o) => o.value === outcome)
  const selectedYear = years.find((y) => String(y.taxYear) === String(collectionTaxYear))

  function captureLocation() {
    setGpsConsentOpen(false)
    setGpsError('')
    if (!('geolocation' in navigator)) {
      setGpsError('This device does not support location.')
      return
    }
    setGpsBusy(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) })
        setGpsBusy(false)
      },
      (err) => {
        setGpsBusy(false)
        setGpsError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission was not given. You can still save the visit without it.'
            : 'Your location could not be found. Move to an open area and try again, or save without it.',
        )
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    )
  }

  async function save(values, confirmDuplicate = false) {
    try {
      const { fieldCollection } = await logVisit({ ...values, gps, confirmDuplicate })
      setWarning(null)
      toast.success(
        fieldCollection
          ? `Visit saved. Field record ${fieldCollection.refNo} (${peso(fieldCollection.amount)}) was sent to Treasury for verification.`
          : 'Visit saved.',
      )
      navigate('/field')
    } catch (err) {
      if (err.name === 'DuplicateWarning') setWarning({ message: err.message, matches: err.matches, values })
      else showError(err, form)
    }
  }

  return (
    <>
      <PageHeader title="Record a visit" description="Fill in what happened during your visit. Fields marked * are required." breadcrumbs={crumbs} />

      <div className="mb-6 rounded-xl border bg-card p-4 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-lg font-semibold">{property.taxpayerName}</p>
            <p className="text-sm text-muted-foreground">ARP {property.arpNo} · {property.location}</p>
          </div>
          <AccountStatusBadge status={property.status} />
        </div>
        <p className="mt-2">
          Balance: <span className="font-semibold">{peso(property.balance)}</span>
          {property.pendingFieldAmount > 0 && <span className="text-sm text-warning"> ({peso(property.pendingFieldAmount)} pending verification)</span>}
        </p>
      </div>

      <form onSubmit={handleSubmit((v) => save(v))} className="max-w-3xl space-y-6" noValidate>
        <Section title="1. Visit details">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date of visit" required error={formState.errors.visitDate?.message} hint={`Today or up to ${MAX_LATE_ENTRY_DAYS} days ago.`}>
              <Input type="date" max={isoDate()} min={isoDate(subDays(new Date(), MAX_LATE_ENTRY_DAYS))} {...register('visitDate')} />
            </Field>
            <Field label="Collector">
              <Input value={user.fullName} readOnly disabled />
            </Field>
          </div>
        </Section>

        <Section title="2. Result of the visit *">
          <fieldset>
            <legend className="sr-only">Result of the visit</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {VISIT_OUTCOMES.map((o) => (
                <label
                  key={o.value}
                  className={cn(
                    'flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors',
                    outcome === o.value ? 'border-primary bg-primary/5 ring-2 ring-primary/30' : 'hover:bg-accent',
                    o.collects && years.length === 0 && 'cursor-not-allowed opacity-50',
                  )}
                >
                  <input type="radio" value={o.value} className="size-5 accent-[var(--primary)]" disabled={o.collects && years.length === 0} {...register('outcome')} />
                  <span className="font-medium">{o.label}</span>
                </label>
              ))}
            </div>
            {formState.errors.outcome && (
              <p role="alert" className="mt-2 text-sm font-medium text-danger">{formState.errors.outcome.message}</p>
            )}
          </fieldset>
        </Section>

        {selected?.collects && (
          <Section title="3. Amount collected">
            <NotOfficialReceiptNote className="mb-4" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tax year being paid" required error={formState.errors.collectionTaxYear?.message}>
                <NativeSelect {...register('collectionTaxYear')}>
                  {years
                    .slice()
                    .reverse()
                    .map((y) => (
                      <option key={y.taxYear} value={y.taxYear}>
                        {y.taxYear} — balance {peso(y.balance)}
                      </option>
                    ))}
                </NativeSelect>
              </Field>
              <Field
                label="Amount received (₱)"
                controlId="collection-amount"
                required
                error={formState.errors.collectionAmount?.message}
                hint={selectedYear ? `Remaining for ${selectedYear.taxYear}: ${peso(selectedYear.available)}${selectedYear.pending ? ` (after ${peso(selectedYear.pending)} pending)` : ''}` : undefined}
              >
                {(aria) => (
                <div className="flex gap-2">
                  <Input type="number" inputMode="decimal" step="0.01" min="0" {...aria} {...register('collectionAmount')} />
                  {selectedYear && (
                    <Button type="button" variant="outline" onClick={() => setValue('collectionAmount', String(selectedYear.available), { shouldValidate: true })}>
                      Full
                    </Button>
                  )}
                </div>
                )}
              </Field>
              <Field
                label="OR No. issued (if any)"
                labelExtra={<HelpTip term="OR No.">{TERMS.OR}</HelpTip>}
                hint="Leave blank if no Official Receipt was issued in the field."
                error={formState.errors.orNoIssued?.message}
                className="sm:col-span-2"
              >
                <Input inputMode="numeric" maxLength={10} autoComplete="off" {...register('orNoIssued')} />
              </Field>
            </div>
          </Section>
        )}

        <Section title={`${selected?.collects ? '4' : '3'}. Remarks and follow-up`}>
          <div className="space-y-4">
            <Field
              label="Remarks"
              required={outcome === 'other'}
              error={formState.errors.remarks?.message}
              hint={`${remarks.length}/500 characters. Do not include sensitive personal information.`}
            >
              <Textarea rows={3} maxLength={500} placeholder="What happened during the visit?" {...register('remarks')} />
            </Field>
            {(selected?.followUp || outcome === 'other' || outcome === 'paid_partial') && (
              <Field label="Next follow-up date (optional)" error={formState.errors.followUpDate?.message}>
                <Input type="date" min={visitDate} {...register('followUpDate')} />
              </Field>
            )}
          </div>
        </Section>

        <Section title="Location (optional)" description="Attach your current location to show the visit took place. Only Treasury and Administrators can see it.">
          {gps ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-success-soft p-3">
              <p className="flex items-center gap-2 text-success">
                <MapPin className="size-5" aria-hidden />
                <span>
                  Location attached ({gps.lat.toFixed(4)}, {gps.lng.toFixed(4)}) · accuracy about {gps.accuracy} m
                </span>
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => setGps(null)}>
                <Trash2 /> Remove
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Button type="button" variant="outline" onClick={() => setGpsConsentOpen(true)} disabled={gpsBusy}>
                {gpsBusy ? <Loader2 className="animate-spin" /> : <LocateFixed />}
                {gpsBusy ? 'Finding your location…' : 'Attach my location'}
              </Button>
              {gpsError && <p role="alert" className="text-sm text-danger">{gpsError}</p>}
            </div>
          )}
        </Section>

        <div className="sticky bottom-20 z-10 flex gap-2 rounded-xl border bg-card/95 p-3 shadow-lg backdrop-blur lg:bottom-4">
          <Button type="button" variant="outline" size="lg" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" size="lg" className="flex-1" disabled={formState.isSubmitting}>
            {formState.isSubmitting ? <Loader2 className="animate-spin" /> : <Save />}
            Save visit
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={gpsConsentOpen}
        onOpenChange={setGpsConsentOpen}
        title="Share your location for this visit?"
        confirmLabel="Yes, attach my location"
        onConfirm={() => captureLocation()}
      >
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Your location is taken <strong>once</strong>, only now, and saved with this visit record.</li>
          <li>It is used only to confirm that the field visit took place.</li>
          <li>Only Treasury personnel and System Administrators can see it.</li>
          <li>Your phone may ask for permission. You can say no and still save the visit.</li>
        </ul>
        <p className="text-xs text-muted-foreground">In accordance with the Data Privacy Act of 2012 (RA 10173).</p>
      </ConfirmDialog>

      <DuplicateWarningDialog
        warning={warning}
        onCancel={() => setWarning(null)}
        onConfirm={async () => {
          await save(warning.values, true)
          return false
        }}
      />
    </>
  )
}
