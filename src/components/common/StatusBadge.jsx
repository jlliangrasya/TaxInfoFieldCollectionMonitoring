import { CheckCircle2, CircleDashed, CircleAlert, Clock, XCircle, AlertTriangle, CircleMinus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { STATUS_LABELS } from '@/lib/rpt'
import { FIELD_STATUS_LABELS } from '@/lib/constants'

// Every status uses colour + icon + words, so it is readable without relying on colour.
const ACCOUNT_STYLES = {
  paid: { cls: 'bg-success-soft text-success border-success/30', Icon: CheckCircle2 },
  partial: { cls: 'bg-info-soft text-info border-info/30', Icon: CircleDashed },
  unpaid: { cls: 'bg-warning-soft text-warning border-warning/30', Icon: CircleMinus },
  outstanding: { cls: 'bg-danger-soft text-danger border-danger/30', Icon: CircleAlert },
}

const FIELD_STYLES = {
  pending: { cls: 'bg-warning-soft text-warning border-warning/30', Icon: Clock },
  verified: { cls: 'bg-success-soft text-success border-success/30', Icon: CheckCircle2 },
  rejected: { cls: 'bg-danger-soft text-danger border-danger/30', Icon: XCircle },
}

function Pill({ cls, Icon, children, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        cls,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {children}
    </span>
  )
}

export function AccountStatusBadge({ status, className }) {
  const s = ACCOUNT_STYLES[status] ?? ACCOUNT_STYLES.unpaid
  return (
    <Pill {...s} className={className}>
      {STATUS_LABELS[status] ?? status}
    </Pill>
  )
}

export function FieldStatusBadge({ status, className }) {
  const s = FIELD_STYLES[status] ?? FIELD_STYLES.pending
  return (
    <Pill {...s} className={className}>
      {FIELD_STATUS_LABELS[status] ?? status}
    </Pill>
  )
}

export function DuplicateBadge() {
  return (
    <Pill cls="bg-danger-soft text-danger border-danger/30" Icon={AlertTriangle}>
      Possible duplicate
    </Pill>
  )
}

/** Clear reminder that a field record is not an Official Receipt. */
export function NotOfficialReceiptNote({ className }) {
  return (
    <p className={cn('text-xs font-medium text-warning', className)}>
      Field record — NOT an Official Receipt. Counts toward the balance only after Treasury verification.
    </p>
  )
}
