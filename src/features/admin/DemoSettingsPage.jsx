import { useState } from 'react'
import { toast } from 'sonner'
import { RotateCcw, Database, HardDrive, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/common/PageHeader'
import { Section, InfoList } from '@/components/common/Cards'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { getDemoStatus, resetDemoData } from '@/services/auditService'
import { formatDateTime, formatDate } from '@/lib/format'
import { showError } from '@/lib/errors'

export function DemoSettingsPage() {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [status, setStatus] = useState(() => getDemoStatus())

  return (
    <>
      <PageHeader
        title="Demo Settings"
        description="This is a demonstration version. All records are fictional sample data stored only in this web browser."
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Demo Settings' }]}
      />
      <div className="grid max-w-4xl gap-6">
        <Section title="Demo data">
          <InfoList
            items={[
              { label: 'Sample data created', value: formatDateTime(status.seededAt) },
              { label: 'Records "as of" date', value: formatDate(status.dataAsOf) },
              { label: 'Where data is stored', value: 'This browser only (local storage). Nothing is sent to a server.' },
              { label: 'Saving changes', value: status.persistent ? 'Working — changes stay after refresh.' : 'Blocked by the browser — changes are lost on refresh.' },
            ]}
          />
        </Section>

        <Section title="Reset demo data" description="Use this before a presentation, or if the demo data gets messy.">
          <p className="mb-4 text-muted-foreground">
            All visits, payments, users and other changes made during the demo will be removed and replaced with the original sample data. Everyone using this browser will be affected.
          </p>
          <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
            <RotateCcw /> Reset demo data
          </Button>
        </Section>

        <Section title="About this demo">
          <ul className="space-y-3 text-sm">
            <li className="flex gap-3">
              <Database className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <span>There is no database in this demo. The production system will use a central database on a secure government server, with regular encrypted backups.</span>
            </li>
            <li className="flex gap-3">
              <ShieldAlert className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <span>Login security here is for demonstration. In production, passwords and permissions will be checked by the server over a secure (HTTPS) connection.</span>
            </li>
            <li className="flex gap-3">
              <HardDrive className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <span>Do not enter real taxpayer information in this demo.</span>
            </li>
          </ul>
        </Section>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Reset all demo data?"
        description="This cannot be undone. All changes made during the demo will be lost."
        confirmLabel="Yes, reset everything"
        destructive
        onConfirm={async () => {
          try {
            await resetDemoData()
            setStatus(getDemoStatus())
            toast.success('Demo data has been reset to the original sample data.')
          } catch (err) {
            showError(err)
            return false
          }
        }}
      />
    </>
  )
}
