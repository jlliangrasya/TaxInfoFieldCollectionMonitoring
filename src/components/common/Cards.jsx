import { Link } from 'react-router'
import { cn } from '@/lib/utils'

const TONES = {
  default: 'bg-primary/10 text-primary',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
}

/** A single headline number on a dashboard. */
export function StatCard({ label, value, hint, icon: Icon, tone = 'default', to }) {
  const body = (
    <div className="flex h-full items-start gap-3 rounded-xl border bg-card p-4 shadow-xs">
      {Icon && (
        <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-lg', TONES[tone])}>
          <Icon className="size-5" aria-hidden />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold tabular-nums sm:text-2xl">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  )
  return to ? (
    <Link to={to} className="block rounded-xl transition-shadow hover:shadow-md">
      {body}
    </Link>
  ) : (
    body
  )
}

/** Card section with a title, used on detail pages. */
export function Section({ title, description, actions, children, className }) {
  return (
    <section className={cn('rounded-xl border bg-card shadow-xs', className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-2 border-b px-4 py-3 sm:px-5">
          <div>
            {title && <h2 className="text-lg font-semibold">{title}</h2>}
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2 no-print">{actions}</div>}
        </div>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  )
}

/** Label/value pairs, e.g. property details. */
export function InfoList({ items, columns = 2 }) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-4', columns === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3')}>
      {items.filter(Boolean).map((item) => (
        <div key={item.label}>
          <dt className="flex items-center gap-1 text-sm text-muted-foreground">
            {item.label}
            {item.help}
          </dt>
          <dd className="mt-0.5 font-medium break-words">{item.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  )
}
