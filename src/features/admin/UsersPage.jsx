import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2, MoreVertical, Pencil, KeyRound, UserPlus, UserX, UserCheck, Unlock, RefreshCw, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable } from '@/components/common/DataTable'
import { LoadingState, ErrorState } from '@/components/common/States'
import { Field, NativeSelect } from '@/components/common/FormField'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { useQuery } from '@/hooks/useQuery'
import { useAuth } from '@/features/auth/AuthContext'
import { listUsers, createUser, updateUser, setUserActive, resetUserPassword, unlockUser } from '@/services/userService'
import { userCreateSchema, userUpdateSchema, resetPasswordSchema } from '@/lib/validation'
import { generateTempPassword } from '@/lib/crypto'
import { ROLE_LABELS } from '@/lib/permissions'
import { formatDateTime } from '@/lib/format'
import { showError } from '@/lib/errors'

function UserStatus({ u }) {
  if (!u.active) return <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">Deactivated</span>
  if (u.locked) return <span className="rounded-full bg-danger-soft px-2.5 py-0.5 text-xs font-semibold text-danger">Locked</span>
  return <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success">Active</span>
}

export function UsersPage() {
  const { user: me } = useAuth()
  const [dialog, setDialog] = useState(null) // { type: 'create'|'edit'|'reset'|'toggle', user }
  const { data, loading, error, reload } = useQuery(() => listUsers(), [])
  const close = () => setDialog(null)

  const actions = (u) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Actions for ${u.fullName}`}>
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => setDialog({ type: 'edit', user: u })}><Pencil /> Edit details</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setDialog({ type: 'reset', user: u })}><KeyRound /> Reset password</DropdownMenuItem>
        {u.locked && (
          <DropdownMenuItem
            onSelect={async () => {
              try {
                await unlockUser(u.id)
                toast.success(`${u.fullName} can log in again.`)
              } catch (err) {
                showError(err)
              }
            }}
          >
            <Unlock /> Unlock account
          </DropdownMenuItem>
        )}
        {u.id !== me.id && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setDialog({ type: 'toggle', user: u })} variant={u.active ? 'destructive' : 'default'}>
              {u.active ? <><UserX /> Deactivate</> : <><UserCheck /> Activate</>}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <>
      <PageHeader
        title="User Accounts"
        description="Create accounts, set roles, reset passwords, and activate or deactivate users. All changes are recorded in the Activity Log."
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'User Accounts' }]}
        actions={<Button onClick={() => setDialog({ type: 'create' })}><UserPlus /> Add user</Button>}
      />
      {loading && !data ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <DataTable
          caption="User accounts"
          rows={data}
          columns={[
            { key: 'fullName', header: 'Name', cell: (u) => <span className="font-medium">{u.fullName}{u.id === me.id && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}</span> },
            { key: 'username', header: 'Username', cell: (u) => <code className="font-mono text-xs">{u.username}</code> },
            { key: 'role', header: 'Role', cell: (u) => ROLE_LABELS[u.role] },
            { key: 'position', header: 'Position' },
            { key: 'active', header: 'Status', cell: (u) => <UserStatus u={u} /> },
            { key: 'lastLoginAt', header: 'Last login', cell: (u) => (u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Never') },
            { key: 'actions', header: <span className="sr-only">Actions</span>, sortable: false, cell: actions },
          ]}
          renderCard={(u) => (
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <p className="font-semibold">{u.fullName}</p>
                <p className="text-sm text-muted-foreground">{ROLE_LABELS[u.role]} · <code className="font-mono">{u.username}</code></p>
                <UserStatus u={u} />
              </div>
              {actions(u)}
            </div>
          )}
        />
      )}

      {dialog?.type === 'create' && <UserFormDialog onClose={close} />}
      {dialog?.type === 'edit' && <UserFormDialog user={dialog.user} onClose={close} />}
      {dialog?.type === 'reset' && <ResetPasswordDialog user={dialog.user} onClose={close} />}
      <ConfirmDialog
        open={dialog?.type === 'toggle'}
        onOpenChange={(o) => !o && close()}
        title={dialog?.user?.active ? `Deactivate ${dialog?.user?.fullName}?` : `Activate ${dialog?.user?.fullName}?`}
        description={dialog?.user?.active ? 'This person will no longer be able to log in. Their past records are kept.' : 'This person will be able to log in again.'}
        confirmLabel={dialog?.user?.active ? 'Deactivate' : 'Activate'}
        destructive={dialog?.user?.active}
        onConfirm={async () => {
          try {
            await setUserActive(dialog.user.id, !dialog.user.active)
            toast.success(dialog.user.active ? 'User deactivated.' : 'User activated.')
          } catch (err) {
            showError(err)
            return false
          }
        }}
      />
    </>
  )
}

function TempPasswordField({ register, setValue, error }) {
  return (
    <Field label="Temporary password" required hint="Give this to the user privately. They must change it when they first log in." error={error} controlId="temp-password">
      {(aria) => (
      <div className="flex gap-2">
        <Input autoComplete="off" spellCheck={false} className="font-mono" {...aria} {...register('tempPassword')} />
        <Button type="button" variant="outline" size="icon" aria-label="Generate a password" onClick={() => setValue('tempPassword', generateTempPassword(), { shouldValidate: true })}>
          <RefreshCw />
        </Button>
      </div>
      )}
    </Field>
  )
}

function copyText(text) {
  navigator.clipboard?.writeText(text).then(
    () => toast.success('Copied.'),
    () => toast.error('Could not copy. Please write it down instead.'),
  )
}

function UserFormDialog({ user, onClose }) {
  const editing = Boolean(user)
  const [created, setCreated] = useState(null)
  const form = useForm({
    resolver: zodResolver(editing ? userUpdateSchema : userCreateSchema),
    defaultValues: editing
      ? { fullName: user.fullName, role: user.role, position: user.position }
      : { username: '', fullName: '', role: 'collector', position: 'Revenue Collector', tempPassword: generateTempPassword() },
  })
  const { register, handleSubmit, formState, setValue } = form

  async function onSubmit(values) {
    try {
      if (editing) {
        await updateUser(user.id, values)
        toast.success('User details saved.')
        onClose()
      } else {
        await createUser(values)
        setCreated(values)
      }
    } catch (err) {
      showError(err, form)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${user.fullName}` : created ? 'Account created' : 'Add user'}</DialogTitle>
          <DialogDescription>
            {created ? 'Give these login details to the user privately. This password will not be shown again.' : 'Fields marked * are required.'}
          </DialogDescription>
        </DialogHeader>
        {created ? (
          <div className="space-y-3 rounded-lg bg-muted p-4">
            <p>Username: <code className="font-mono font-semibold">{created.username}</code></p>
            <p className="flex items-center gap-2">
              Temporary password: <code className="font-mono font-semibold">{created.tempPassword}</code>
              <Button variant="ghost" size="icon" aria-label="Copy password" onClick={() => copyText(created.tempPassword)}><Copy /></Button>
            </p>
          </div>
        ) : (
          <form id="user-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {!editing && (
              <Field label="Username" required hint="Letters, numbers, dot or underscore. Example: juan.delacruz" error={formState.errors.username?.message}>
                <Input autoCapitalize="none" autoComplete="off" spellCheck={false} maxLength={30} {...register('username')} />
              </Field>
            )}
            <Field label="Full name" required error={formState.errors.fullName?.message}>
              <Input maxLength={100} {...register('fullName')} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Role" required error={formState.errors.role?.message}>
                <NativeSelect {...register('role')}>
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Position / Designation" required error={formState.errors.position?.message}>
                <Input maxLength={80} {...register('position')} />
              </Field>
            </div>
            {!editing && <TempPasswordField register={register} setValue={setValue} error={formState.errors.tempPassword?.message} />}
          </form>
        )}
        <DialogFooter>
          {created ? (
            <Button onClick={onClose}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" form="user-form" disabled={formState.isSubmitting}>
                {formState.isSubmitting && <Loader2 className="animate-spin" />}
                {editing ? 'Save changes' : 'Create account'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ResetPasswordDialog({ user, onClose }) {
  const [done, setDone] = useState(null)
  const form = useForm({ resolver: zodResolver(resetPasswordSchema), defaultValues: { tempPassword: generateTempPassword() } })
  const { register, handleSubmit, formState, setValue } = form

  async function onSubmit(values) {
    try {
      await resetUserPassword(user.id, values)
      setDone(values.tempPassword)
    } catch (err) {
      showError(err, form)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password for {user.fullName}</DialogTitle>
          <DialogDescription>
            {done ? 'Give this temporary password to the user privately. It will not be shown again.' : 'The user will be asked to choose a new password when they log in. This also unlocks the account.'}
          </DialogDescription>
        </DialogHeader>
        {done ? (
          <p className="flex items-center gap-2 rounded-lg bg-muted p-4">
            Temporary password: <code className="font-mono font-semibold">{done}</code>
            <Button variant="ghost" size="icon" aria-label="Copy password" onClick={() => copyText(done)}><Copy /></Button>
          </p>
        ) : (
          <form id="reset-form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <TempPasswordField register={register} setValue={setValue} error={formState.errors.tempPassword?.message} />
          </form>
        )}
        <DialogFooter>
          {done ? (
            <Button onClick={onClose}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" form="reset-form" disabled={formState.isSubmitting}>
                {formState.isSubmitting && <Loader2 className="animate-spin" />}
                Reset password
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
