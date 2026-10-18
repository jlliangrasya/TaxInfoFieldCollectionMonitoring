import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2, Receipt } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, NativeSelect } from '@/components/common/FormField'
import { HelpTip } from '@/components/common/HelpTip'
import { TERMS } from '@/lib/terms'
import { DuplicateWarningDialog } from '@/components/common/DuplicateWarningDialog'
import { paymentInputSchema } from '@/lib/validation'
import { isoDate, peso } from '@/lib/format'
import { showError } from '@/lib/errors'
import { recordPayment, getPayableYears } from '@/services/collectionService'

/** Treasury-only: records a payment backed by an Official Receipt. */
export function RecordPaymentDialog({ property, open, onOpenChange }) {
  const [years, setYears] = useState([])
  const [warning, setWarning] = useState(null)
  const form = useForm({
    resolver: zodResolver(paymentInputSchema),
    defaultValues: { propertyId: property.id, taxYear: '', amount: '', orNo: '', paymentDate: isoDate(), remarks: '' },
  })
  const { register, handleSubmit, formState, reset, setValue } = form
  const taxYear = useWatch({ control: form.control, name: 'taxYear' })

  useEffect(() => {
    if (!open) return
    getPayableYears(property.id)
      .then((list) => {
        setYears(list)
        const first = list[list.length - 1] // oldest year first
        reset({
          propertyId: property.id,
          taxYear: first?.taxYear ?? '',
          amount: first ? String(first.balance) : '',
          orNo: '',
          paymentDate: isoDate(),
          remarks: '',
        })
      })
      .catch((e) => showError(e))
  }, [open, property.id, reset])

  const selectedYear = years.find((y) => String(y.taxYear) === String(taxYear))

  async function save(values, confirmDuplicate = false) {
    try {
      const payment = await recordPayment({ ...values, confirmDuplicate })
      toast.success(`Payment of ${peso(payment.amount)} recorded under OR No. ${payment.orNo}.`)
      setWarning(null)
      onOpenChange(false)
    } catch (err) {
      if (err.name === 'DuplicateWarning') setWarning({ message: err.message, matches: err.matches, values })
      else showError(err, form)
    }
  }

  return (
    <>
      <Dialog open={open && !warning} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Record Treasury payment</DialogTitle>
            <DialogDescription>
              {property.arpNo} · {property.taxpayerName}. Enter the details exactly as printed on the Official Receipt.
            </DialogDescription>
          </DialogHeader>

          {years.length === 0 ? (
            <p className="rounded-md bg-success-soft p-4 text-success">This property has no remaining balance. No payment is needed.</p>
          ) : (
            <form id="payment-form" onSubmit={handleSubmit((v) => save(v))} className="space-y-4" noValidate>
              <Field label="Tax year" required error={formState.errors.taxYear?.message}>
                <NativeSelect
                  {...register('taxYear', {
                    onChange: (e) => {
                      const y = years.find((x) => String(x.taxYear) === e.target.value)
                      if (y) setValue('amount', String(y.balance))
                    },
                  })}
                >
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
              {selectedYear?.pending > 0 && (
                <p className="rounded-md border border-warning/30 bg-warning-soft p-3 text-sm">
                  There is a field record of {peso(selectedYear.pending)} for this tax year waiting for verification. If this payment is the
                  same collection, verify the field record instead.
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Amount paid (₱)" required error={formState.errors.amount?.message}>
                  <Input type="number" inputMode="decimal" step="0.01" min="0" {...register('amount')} />
                </Field>
                <Field label="Payment date" required error={formState.errors.paymentDate?.message}>
                  <Input type="date" max={isoDate()} {...register('paymentDate')} />
                </Field>
              </div>
              <Field
                label="Official Receipt (OR) No."
                required
                labelExtra={<HelpTip term="OR No.">{TERMS.OR}</HelpTip>}
                hint="6 to 10 digits. Each OR No. can only be used once."
                error={formState.errors.orNo?.message}
              >
                <Input inputMode="numeric" autoComplete="off" maxLength={10} {...register('orNo')} />
              </Field>
              <Field label="Remarks (optional)" error={formState.errors.remarks?.message}>
                <Textarea rows={2} maxLength={500} {...register('remarks')} />
              </Field>
            </form>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {years.length > 0 && (
              <Button type="submit" form="payment-form" disabled={formState.isSubmitting}>
                {formState.isSubmitting ? <Loader2 className="animate-spin" /> : <Receipt />}
                Save payment
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
