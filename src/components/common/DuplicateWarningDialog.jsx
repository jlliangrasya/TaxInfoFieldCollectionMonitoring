import { AlertTriangle } from 'lucide-react'
import { ConfirmDialog } from './ConfirmDialog'

/**
 * Shown when a new record looks like one that already exists.
 * If the user saves anyway, the record is flagged for Treasury review.
 */
export function DuplicateWarningDialog({ warning, onCancel, onConfirm }) {
  return (
    <ConfirmDialog
      open={Boolean(warning)}
      onOpenChange={(open) => !open && onCancel()}
      title="Possible duplicate entry"
      description={warning?.message}
      confirmLabel="Yes, save it anyway"
      onConfirm={onConfirm}
    >
      {warning?.matches?.length > 0 && (
        <div className="rounded-md border border-warning/30 bg-warning-soft p-3 text-sm">
          <p className="mb-1 flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="size-4" aria-hidden /> Existing record(s):
          </p>
          <ul className="list-disc space-y-0.5 pl-5">
            {warning.matches.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        If you are not sure, choose <strong>Cancel</strong> and check with the Treasury office first.
      </p>
    </ConfirmDialog>
  )
}
