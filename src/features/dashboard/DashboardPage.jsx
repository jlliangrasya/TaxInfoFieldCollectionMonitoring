import { Link } from 'react-router'
import { format } from 'date-fns'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Banknote,
  TrendingUp,
  Wallet,
  ShieldCheck,
  AlertTriangle,
  CalendarClock,
  MapPin,
  Footprints,
  Clock3,
  ChevronRight,
  XCircle,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatCard, Section } from '@/components/common/Cards'
import { LoadingState, ErrorState, EmptyState } from '@/components/common/States'
import { AccountStatusBadge } from '@/components/common/StatusBadge'
import { useQuery } from '@/hooks/useQuery'
import { useAuth } from '@/features/auth/AuthContext'
import { getDashboard } from '@/services/dashboardService'
import { peso, number, formatDate, timeAgo } from '@/lib/format'
import { PERMISSIONS, ROLE_LABELS } from '@/lib/permissions'
import { quickActionsFor } from '@/components/layout/navigation'
import { ACCOUNT_STATUS } from '@/lib/rpt'

const compactPeso = (v) => (v >= 1_000_000 ? `₱${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `₱${Math.round(v / 1000)}k` : `₱${v}`)

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export function DashboardPage() {
  const { user } = useAuth()
  const { data, loading, error, reload } = useQuery(() => getDashboard(), [])

  return (
    <div className="space-y-8">
      <WelcomeHero user={user} />
      <QuickActions user={user} />
      {loading && !data ? (
        <LoadingState rows={5} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : data.kind === 'collector' ? (
        <CollectorDashboard data={data} />
      ) : (
        <OfficeDashboard data={data} />
      )}
    </div>
  )
}

function WelcomeHero({ user }) {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-sidebar px-5 py-6 text-sidebar-foreground shadow-sm sm:px-8 sm:py-8">
      {/* Decorative shapes */}
      <span className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-white/5" aria-hidden />
      <span className="pointer-events-none absolute -right-4 -bottom-24 size-48 rounded-full bg-maroon/40" aria-hidden />

      <div className="relative">
        <p className="text-sm font-medium text-sidebar-foreground/75">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          {greeting()}, {user.fullName.split(' ')[0]}!
        </h1>
        <p className="mt-2 max-w-xl text-sidebar-foreground/85">What would you like to do today? Pick a task below to get started.</p>
        <span className="mt-4 inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-medium">{ROLE_LABELS[user.role]}</span>
      </div>
    </section>
  )
}

const ACTION_TONES = ['bg-primary/10 text-primary', 'bg-maroon-soft text-maroon', 'bg-success-soft text-success', 'bg-info-soft text-info']

function QuickActions({ user }) {
  const actions = quickActionsFor(user)
  if (actions.length === 0) return null
  return (
    <section aria-labelledby="quick-actions-title">
      <h2 id="quick-actions-title" className="mb-3 text-lg font-semibold">
        Quick tasks
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {actions.map((a, i) => (
          <li key={a.to}>
            <Link
              to={a.to}
              className="group flex h-full items-center gap-4 rounded-xl border bg-card p-4 shadow-xs transition hover:-translate-y-0.5 hover:border-maroon/40 hover:shadow-md sm:flex-col sm:items-start sm:p-5"
            >
              <span className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${ACTION_TONES[i % ACTION_TONES.length]}`}>
                <a.icon className="size-6" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{a.label}</span>
                <span className="block text-sm text-muted-foreground">{a.hint}</span>
              </span>
              <span className="flex items-center gap-1 text-sm font-medium text-primary sm:mt-auto">
                <span className="hidden sm:inline">Open</span>
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function StatusTiles({ counts, linkable }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Object.values(ACCOUNT_STATUS).map((s) => {
        const body = (
          <div className="flex h-full flex-col gap-2 rounded-xl border bg-card p-4 shadow-xs">
            <AccountStatusBadge status={s} className="self-start" />
            <p className="text-2xl font-semibold tabular-nums">{number(counts[s])}</p>
            <p className="text-xs text-muted-foreground">accounts</p>
          </div>
        )
        return linkable ? (
          <Link key={s} to={`/accounts?status=${s}`} className="rounded-xl transition-shadow hover:shadow-md">
            {body}
          </Link>
        ) : (
          <div key={s}>{body}</div>
        )
      })}
    </div>
  )
}

function OfficeDashboard({ data }) {
  const { can } = useAuth()
  const canVerify = can(PERMISSIONS.FIELD_VERIFY)
  const maxBalance = Math.max(1, ...data.byBarangay.map((b) => b.balance))

  return (
    <div className="space-y-6">
      <h2 className="-mb-3 text-lg font-semibold">At a glance</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Banknote} tone="success" label={`Collected in ${data.currentYear}`} value={peso(data.collectedThisYear)} hint="All payments recorded this year" />
        <StatCard
          icon={TrendingUp}
          tone="info"
          label={`${data.currentYear} collection rate`}
          value={`${data.collectionRate}%`}
          hint={`${peso(data.currentYearPaid)} of ${peso(data.currentYearDue)} due`}
        />
        <StatCard icon={Wallet} tone="danger" label="Total outstanding balance" value={peso(data.outstandingBalance)} hint={`${number(data.totalProperties)} properties · ${number(data.totalTaxpayers)} taxpayers`} />
        <StatCard
          icon={ShieldCheck}
          tone="warning"
          label="Field records to review"
          value={number(data.pendingCount)}
          hint={`${peso(data.pendingAmount)} waiting for verification`}
          to={canVerify ? '/verifications' : undefined}
        />
      </div>

      {canVerify && data.duplicateCount > 0 && (
        <Link
          to="/verifications"
          className="flex items-center gap-3 rounded-xl border border-danger/30 bg-danger-soft p-4 text-danger hover:shadow-md"
        >
          <AlertTriangle className="size-6 shrink-0" aria-hidden />
          <span className="flex-1 font-medium">
            {data.duplicateCount} field record(s) are flagged as possible duplicates. Please review them before verifying.
          </span>
          <ChevronRight aria-hidden />
        </Link>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">Accounts by payment status</h2>
        <StatusTiles counts={data.statusCounts} linkable />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title={`Collections per month (${data.currentYear})`} description="Treasury counter payments and verified field collections.">
          <div className="h-72" role="img" aria-label="Bar chart of monthly collections">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthly} margin={{ left: 0, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickFormatter={compactPeso} tickLine={false} axisLine={false} fontSize={12} width={56} />
                <Tooltip formatter={(v) => peso(v)} cursor={{ fill: 'var(--muted)' }} />
                <Legend />
                <Bar dataKey="treasury" name="Treasury counter" stackId="a" fill="var(--chart-1)" radius={[0, 0, 0, 0]} />
                <Bar dataKey="field" name="Field (verified)" stackId="a" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>

        <Section title="Field visits in the last 30 days" description="Visits made by each Revenue Collector.">
          <div className="h-72" role="img" aria-label="Bar chart of visits per collector">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.visitsByCollector} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                <YAxis type="category" dataKey="name" width={110} tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip
                  formatter={(v, name) => (name === 'Visits' ? v : peso(v))}
                  labelFormatter={(_, p) => p?.[0]?.payload?.fullName}
                  cursor={{ fill: 'var(--muted)' }}
                />
                <Bar dataKey="visits" name="Visits" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Outstanding balance by barangay">
          <ul className="space-y-3">
            {data.byBarangay.map((b) => (
              <li key={b.name}>
                <div className="mb-1 flex justify-between gap-2 text-sm">
                  <span className="font-medium">
                    <MapPin className="mr-1 inline size-3.5 text-muted-foreground" aria-hidden />
                    {b.name}
                  </span>
                  <span className="tabular-nums">{peso(b.balance)}</span>
                </div>
                <div className="h-2 rounded-full bg-muted" aria-hidden>
                  <div className="h-2 rounded-full bg-danger/70" style={{ width: `${(b.balance / maxBalance) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Section>

        {data.recentActivity.length > 0 && (
          <Section title="Recent activity" actions={<Button asChild variant="outline" size="sm"><Link to="/audit">View all</Link></Button>}>
            <ul className="divide-y">
              {data.recentActivity.map((e) => (
                <li key={e.id} className="py-2.5">
                  <p className="text-sm">
                    <span className="font-medium">{e.action}</span>
                    {e.details && <span className="text-muted-foreground"> — {e.details}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {e.name} · {timeAgo(e.at)}
                  </p>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </div>
  )
}

function CollectorDashboard({ data }) {
  return (
    <div className="space-y-6">

      {data.rejectedCount > 0 && (
        <Link to="/field/history" className="flex items-center gap-3 rounded-xl border border-danger/30 bg-danger-soft p-4 text-danger">
          <XCircle className="size-6 shrink-0" aria-hidden />
          <span className="flex-1 font-medium">{data.rejectedCount} of your field record(s) were rejected by Treasury. Tap to see the reason.</span>
          <ChevronRight aria-hidden />
        </Link>
      )}

      <h2 className="-mb-3 text-lg font-semibold">My work at a glance</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={CalendarClock} tone="danger" label="Follow-ups due" value={number(data.followUpsDue)} hint="Today or earlier" to="/field" />
        <StatCard icon={MapPin} tone="warning" label="Not yet visited" value={number(data.notVisited)} hint="With unpaid balance" to="/field" />
        <StatCard icon={Footprints} tone="info" label="My visits today" value={number(data.visitsToday)} hint={`${data.visitsThisMonth} this month`} to="/field/history" />
        <StatCard icon={Clock3} tone="default" label="Pending verification" value={peso(data.pendingAmount)} hint={`${data.pendingCount} field record(s)`} to="/field/history" />
      </div>

      <Section title="My area" description={`${data.withBalance} of ${data.assignedProperties} properties in your assigned area have a balance of ${peso(data.areaBalance)}.`}>
        <StatusTiles counts={data.statusCounts} />
      </Section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Upcoming follow-ups">
          {data.nextFollowUps.length === 0 ? (
            <EmptyState title="No follow-ups scheduled">Follow-up dates you set when recording a visit will appear here.</EmptyState>
          ) : (
            <ul className="divide-y">
              {data.nextFollowUps.map((p) => (
                <li key={p.id}>
                  <Link to={`/field/visit/${p.id}`} className="flex items-center gap-3 py-3 hover:bg-accent/50">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{p.taxpayerName}</p>
                      <p className="text-sm text-muted-foreground">
                        {p.arpNo} · {p.barangayName} · {peso(p.balance)}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-medium">{formatDate(p.followUpDate)}</span>
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="My recent visits" actions={<Button asChild variant="outline" size="sm"><Link to="/field/history">View all</Link></Button>}>
          {data.recentVisits.length === 0 ? (
            <EmptyState title="No visits yet">Open <strong>My Assignments</strong> and tap a property to record your first visit.</EmptyState>
          ) : (
            <ul className="divide-y">
              {data.recentVisits.map((v) => (
                <li key={v.id}>
                  <Link to={`/properties/${v.propertyId}`} className="flex items-center gap-3 py-3 hover:bg-accent/50">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{v.taxpayerName}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(v.visitDate)} · {v.arpNo} · {v.outcomeLabel}
                      </p>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  )
}
