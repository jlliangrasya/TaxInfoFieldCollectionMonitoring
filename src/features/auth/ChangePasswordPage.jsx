import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { KeyRound, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Field } from '@/components/common/FormField'
import { PageHeader } from '@/components/common/PageHeader'
import { Section } from '@/components/common/Cards'
import { changePasswordSchema } from '@/lib/validation'
import { passwordStrength } from '@/lib/crypto'
import { showError } from '@/lib/errors'
import { changePassword } from '@/services/authService'
import { useAuth } from './AuthContext'

const STRENGTH_LABELS = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong']

export function ChangePasswordPage() {
  const { user, refresh } = useAuth()
  const navigate = useNavigate()
  const form = useForm({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })
  const { register, handleSubmit, formState } = form
  const newPassword = useWatch({ control: form.control, name: 'newPassword' })
  const strength = passwordStrength(newPassword)
  const forced = user?.mustChangePassword

  async function onSubmit(values) {
    try {
      await changePassword(values)
      refresh()
      toast.success('Your password has been changed.')
      navigate('/')
    } catch (err) {
      showError(err, form)
    }
  }

  return (
    <>
      <PageHeader
        title="Change Password"
        description={
          forced
            ? 'Your password was set by the System Administrator. Please choose your own password to continue.'
            : 'Choose a password that only you know. Do not share it with anyone.'
        }
        breadcrumbs={forced ? [] : [{ label: 'Home', to: '/' }, { label: 'Change Password' }]}
      />
      <Section className="max-w-xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field label="Current password" required error={formState.errors.currentPassword?.message}>
            <Input type="password" autoComplete="current-password" {...register('currentPassword')} />
          </Field>
          <Field
            label="New password"
            required
            hint="At least 8 characters, with letters and numbers."
            error={formState.errors.newPassword?.message}
          >
            <Input type="password" autoComplete="new-password" {...register('newPassword')} />
          </Field>
          {newPassword && (
            <div className="space-y-1" aria-live="polite">
              <Progress value={(strength / 4) * 100} aria-label="Password strength" />
              <p className="text-sm text-muted-foreground">Strength: {STRENGTH_LABELS[strength]}</p>
            </div>
          )}
          <Field label="Type the new password again" required error={formState.errors.confirmPassword?.message}>
            <Input type="password" autoComplete="new-password" {...register('confirmPassword')} />
          </Field>
          <Button type="submit" disabled={formState.isSubmitting}>
            {formState.isSubmitting ? <Loader2 className="animate-spin" /> : <KeyRound />}
            Save new password
          </Button>
        </form>
      </Section>
    </>
  )
}
