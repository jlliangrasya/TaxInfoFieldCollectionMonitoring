import { ChevronDown } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { Section } from '@/components/common/Cards'
import { AccountStatusBadge, FieldStatusBadge } from '@/components/common/StatusBadge'
import { TERMS } from '@/lib/terms'
import { useAuth } from '@/features/auth/AuthContext'
import { ROLE_LABELS } from '@/lib/permissions'
import { IDLE_TIMEOUT_MINUTES, MAX_FAILED_LOGINS, LOCKOUT_MINUTES } from '@/lib/constants'

const GUIDES = {
  collector: [
    {
      q: 'How do I record a field visit?',
      steps: [
        'Tap Assignments at the bottom of the screen (or My Assignments in the menu).',
        'Find the property. Red cards are follow-ups that are due — visit those first.',
        'Tap Log visit.',
        'Choose the result of the visit (for example “Promised to pay” or “Taxpayer not at home”).',
        'Add remarks and, if needed, a follow-up date.',
        'Optional: tap Attach my location to save where the visit happened.',
        'Tap Save visit.',
      ],
    },
    {
      q: 'How do I record money I collected?',
      steps: [
        'Log a visit and choose “Paid in full” or “Partial payment”.',
        'Choose the tax year and enter the amount received. Tap Full to fill in the remaining balance.',
        'If you issued an Official Receipt, enter its number.',
        'Tap Save visit. The record goes to the Treasury office for checking.',
        'The taxpayer’s balance changes only after the Treasury verifies your record.',
      ],
    },
    {
      q: 'The system says “Possible duplicate entry”. What should I do?',
      steps: [
        'This means a very similar record already exists (same property, tax year, amount and date).',
        'If you are entering the same collection again by mistake, tap Cancel.',
        'If it really is a different collection, tap “Yes, save it anyway”. The Treasury office will review it.',
      ],
    },
    {
      q: 'Where can I see whether my records were accepted?',
      steps: ['Open My Visits, then the “My field records” tab.', 'Each record shows Pending, Verified, or Rejected with the reason.'],
    },
  ],
  treasury: [
    {
      q: 'How do I check (verify) a collector’s field record?',
      steps: [
        'Open Field Record Review. Records flagged in red are possible duplicates — check those carefully.',
        'Compare the record with the Official Receipt.',
        'Tap Verify, confirm the OR No., and save. The amount is then added to the taxpayer’s payments.',
        'If the record is wrong or a duplicate, tap Reject and give a clear reason.',
      ],
    },
    {
      q: 'How do I record a payment made at the Treasury counter?',
      steps: [
        'Open Properties and search for the property (by name, ARP No., PIN or TD No.).',
        'Open the property and tap Record payment.',
        'Choose the tax year, enter the amount, payment date and OR No., then save.',
        'An OR No. can only be used once — the system will stop you if it is already recorded.',
      ],
    },
    {
      q: 'How do I assign an area to a collector?',
      steps: ['Open Collector Assignments and tap New assignment.', 'Choose the collector, the barangay (or one property), and the dates.', 'Save. The collector will immediately see those properties.'],
    },
    {
      q: 'How do I prepare a report?',
      steps: ['Open Reports.', 'Choose a report, set the dates and other filters, then tap View report.', 'Use Print, PDF or Excel to save or share it.'],
    },
  ],
  admin: [
    {
      q: 'How do I add a new user?',
      steps: [
        'Open User Accounts and tap Add user.',
        'Enter the username, full name, role and position. A temporary password is created for you.',
        'Tap Create account and give the login details to the person privately.',
        'They will be asked to choose their own password when they first log in.',
      ],
    },
    {
      q: 'Someone forgot their password or is locked out.',
      steps: ['Open User Accounts.', 'Tap the ⋮ button beside the person and choose Reset password.', 'Give them the new temporary password privately.'],
    },
    {
      q: 'Someone has left the office.',
      steps: ['Open User Accounts, tap ⋮ beside the person and choose Deactivate.', 'They can no longer log in. Their past records are kept.'],
    },
    {
      q: 'How do I see who did what?',
      steps: ['Open Activity Log. You can search by user or action, and filter by date.'],
    },
  ],
}

function Guide({ q, steps }) {
  return (
    <details className="group rounded-lg border bg-card">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 font-medium">
        {q}
        <ChevronDown className="size-5 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <ol className="list-decimal space-y-1.5 px-4 pb-4 pl-9 text-muted-foreground">
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
    </details>
  )
}

export function HelpPage() {
  const { user } = useAuth()
  const mine = GUIDES[user.role] ?? []

  return (
    <>
      <PageHeader title="Help & Guides" description={`Step-by-step guides for ${ROLE_LABELS[user.role]}s, and the meaning of terms used in the system.`} breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Help & Guides' }]} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="How do I…?">
          <div className="space-y-2">
            {mine.map((g) => (
              <Guide key={g.q} {...g} />
            ))}
            <Guide
              q="How do I change my password?"
              steps={['Open the menu and tap Password (next to Log out).', 'Enter your current password, then your new password twice.', 'Use at least 8 characters with letters and numbers.']}
            />
          </div>
        </Section>

        <div className="space-y-6">
          <Section title="Payment status meanings">
            <dl className="space-y-3 text-sm">
              <div><dt><AccountStatusBadge status="paid" /></dt><dd className="mt-1 text-muted-foreground">All tax due has been paid.</dd></div>
              <div><dt><AccountStatusBadge status="partial" /></dt><dd className="mt-1 text-muted-foreground">Part of this year’s tax has been paid; a balance remains.</dd></div>
              <div><dt><AccountStatusBadge status="unpaid" /></dt><dd className="mt-1 text-muted-foreground">Nothing has been paid yet for this year.</dd></div>
              <div><dt><AccountStatusBadge status="outstanding" /></dt><dd className="mt-1 text-muted-foreground">There is an unpaid balance from a previous year.</dd></div>
              <div><dt><FieldStatusBadge status="pending" /></dt><dd className="mt-1 text-muted-foreground">A collector’s field record waiting for Treasury checking. Not yet counted.</dd></div>
            </dl>
          </Section>

          <Section title="Terms used">
            <dl className="space-y-3 text-sm">
              {[
                ['ARP No.', TERMS.ARP],
                ['PIN', TERMS.PIN],
                ['Tax Declaration (TD) No.', TERMS.TD],
                ['Assessed value', TERMS.ASSESSED],
                ['Basic RPT', TERMS.BASIC],
                ['SEF', TERMS.SEF],
                ['OR No.', TERMS.OR],
                ['Field record', TERMS.FIELD_RECORD],
              ].map(([t, d]) => (
                <div key={t}>
                  <dt className="font-semibold">{t}</dt>
                  <dd className="text-muted-foreground">{d}</dd>
                </div>
              ))}
            </dl>
          </Section>

          <Section title="Security reminders">
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
              <li>Never share your password. Treasury staff will never ask for it.</li>
              <li>You are logged out automatically after {IDLE_TIMEOUT_MINUTES} minutes without activity.</li>
              <li>After {MAX_FAILED_LOGINS} wrong passwords, the account is locked for {LOCKOUT_MINUTES} minutes.</li>
              <li>Always log out when using a shared device.</li>
              <li>All important actions are recorded in the Activity Log.</li>
            </ul>
          </Section>
        </div>
      </div>
    </>
  )
}
