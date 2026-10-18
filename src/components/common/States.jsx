import { AlertCircle, Inbox, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export function LoadingState({ rows = 4, label = 'Loading…' }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  )
}

export function ErrorState({ error, onRetry }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-lg border border-danger/30 bg-danger-soft p-8 text-center">
      <AlertCircle className="size-8 text-danger" aria-hidden />
      <p className="font-medium">{error?.message || 'Something went wrong while loading this page.'}</p>
      {onRetry && (
        <Button variant="outline" onClick={() => onRetry()}>
          <RefreshCw /> Try again
        </Button>
      )}
    </div>
  )
}

export function EmptyState({ title = 'Nothing to show', children, icon: Icon = Inbox, action }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-center">
      <Icon className="size-9 text-muted-foreground" aria-hidden />
      <p className="text-lg font-medium">{title}</p>
      {children && <div className="max-w-md text-muted-foreground">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
