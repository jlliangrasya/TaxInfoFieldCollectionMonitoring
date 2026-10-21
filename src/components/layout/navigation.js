import {
  LayoutDashboard,
  ClipboardList,
  History,
  Building2,
  Users,
  Wallet,
  ShieldCheck,
  Footprints,
  Route,
  FileBarChart,
  UserCog,
  ScrollText,
  Settings,
  LifeBuoy,
} from 'lucide-react'
import { can, PERMISSIONS as P } from '@/lib/permissions'

// `short` is the label used in the phone's bottom navigation bar.
// `hint` is a plain-language line shown on the Home page shortcuts.
export const NAV_GROUPS = [
  {
    label: 'Main',
    items: [{ to: '/', label: 'Home', short: 'Home', hint: 'Your summary for today', icon: LayoutDashboard }],
  },
  {
    label: 'My Field Work',
    items: [
      { to: '/field', label: 'My Assignments', short: 'Assignments', hint: 'Properties you need to visit', icon: ClipboardList, permission: P.FIELD_RECORD },
      { to: '/field/history', label: 'My Visits', short: 'Visits', hint: 'Visits you have already recorded', icon: History, permission: P.FIELD_RECORD },
    ],
  },
  {
    label: 'Look Up Records',
    items: [
      { to: '/properties', label: 'Properties', short: 'Search', hint: 'Find a property by ARP No. or owner', icon: Building2, permission: P.RECORDS_VIEW },
      { to: '/taxpayers', label: 'Taxpayers', short: 'Taxpayers', hint: 'Find a taxpayer and their properties', icon: Users, permission: P.RECORDS_VIEW },
    ],
  },
  {
    label: 'Collections',
    items: [
      { to: '/accounts', label: 'Collection Monitoring', short: 'Collections', hint: 'See who has paid and who still owes', icon: Wallet, permission: P.RECORDS_VIEW_ALL },
      { to: '/verifications', label: 'Field Record Review', short: 'Review', hint: 'Check payments collected in the field', icon: ShieldCheck, permission: P.FIELD_VERIFY },
      { to: '/visits', label: 'Field Visits', short: 'Visits', hint: 'All visits made by collectors', icon: Footprints, permission: P.VISITS_VIEW_ALL },
      { to: '/assignments', label: 'Collector Assignments', short: 'Assign', hint: 'Choose which areas each collector covers', icon: Route, permission: P.ASSIGNMENTS_MANAGE },
      { to: '/reports', label: 'Reports', short: 'Reports', hint: 'Print or download summaries', icon: FileBarChart, anyOf: [P.REPORTS_VIEW, P.FIELD_RECORD] },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/admin/users', label: 'User Accounts', short: 'Users', hint: 'Add staff or reset their passwords', icon: UserCog, permission: P.USERS_MANAGE },
      { to: '/audit', label: 'Activity Log', short: 'Log', hint: 'See who did what, and when', icon: ScrollText, permission: P.AUDIT_VIEW },
      { to: '/settings', label: 'Demo Settings', short: 'Settings', hint: 'Reset the sample data', icon: Settings, permission: P.DEMO_RESET },
    ],
  },
  {
    label: 'Need Help?',
    items: [{ to: '/help', label: 'Help & Guides', short: 'Help', hint: 'Step-by-step instructions', icon: LifeBuoy }],
  },
]

const BOTTOM_NAV = {
  collector: ['/', '/field', '/properties', '/field/history'],
  treasury: ['/', '/accounts', '/verifications', '/reports'],
  admin: ['/', '/properties', '/admin/users', '/audit'],
}

// The most common tasks for each role, shown as large shortcuts on the Home page.
const QUICK_ACTIONS = {
  collector: ['/field', '/properties', '/field/history', '/help'],
  treasury: ['/verifications', '/accounts', '/properties', '/reports'],
  admin: ['/admin/users', '/properties', '/audit', '/help'],
}

function allowed(user, item) {
  if (item.permission) return can(user, item.permission)
  if (item.anyOf) return item.anyOf.some((p) => can(user, p))
  return true
}

function pick(user, paths) {
  const all = NAV_GROUPS.flatMap((g) => g.items)
  return paths.map((to) => all.find((i) => i.to === to)).filter((i) => i && allowed(user, i))
}

export function navGroupsFor(user) {
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => allowed(user, i)) })).filter((g) => g.items.length)
}

export function bottomNavFor(user) {
  return pick(user, BOTTOM_NAV[user?.role] ?? ['/'])
}

export function quickActionsFor(user) {
  return pick(user, QUICK_ACTIONS[user?.role] ?? ['/help'])
}
