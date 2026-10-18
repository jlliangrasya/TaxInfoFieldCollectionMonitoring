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
export const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [{ to: '/', label: 'Dashboard', short: 'Home', icon: LayoutDashboard }],
  },
  {
    label: 'Field Work',
    items: [
      { to: '/field', label: 'My Assignments', short: 'Assignments', icon: ClipboardList, permission: P.FIELD_RECORD },
      { to: '/field/history', label: 'My Visits', short: 'Visits', icon: History, permission: P.FIELD_RECORD },
    ],
  },
  {
    label: 'Records',
    items: [
      { to: '/properties', label: 'Properties', short: 'Search', icon: Building2, permission: P.RECORDS_VIEW },
      { to: '/taxpayers', label: 'Taxpayers', short: 'Taxpayers', icon: Users, permission: P.RECORDS_VIEW },
    ],
  },
  {
    label: 'Collections',
    items: [
      { to: '/accounts', label: 'Collection Monitoring', short: 'Collections', icon: Wallet, permission: P.RECORDS_VIEW_ALL },
      { to: '/verifications', label: 'Field Record Review', short: 'Review', icon: ShieldCheck, permission: P.FIELD_VERIFY },
      { to: '/visits', label: 'Field Visits', short: 'Visits', icon: Footprints, permission: P.VISITS_VIEW_ALL },
      { to: '/assignments', label: 'Collector Assignments', short: 'Assign', icon: Route, permission: P.ASSIGNMENTS_MANAGE },
      { to: '/reports', label: 'Reports', short: 'Reports', icon: FileBarChart, anyOf: [P.REPORTS_VIEW, P.FIELD_RECORD] },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/admin/users', label: 'User Accounts', short: 'Users', icon: UserCog, permission: P.USERS_MANAGE },
      { to: '/audit', label: 'Activity Log', short: 'Log', icon: ScrollText, permission: P.AUDIT_VIEW },
      { to: '/settings', label: 'Demo Settings', short: 'Settings', icon: Settings, permission: P.DEMO_RESET },
    ],
  },
  {
    label: 'Support',
    items: [{ to: '/help', label: 'Help & Guides', short: 'Help', icon: LifeBuoy }],
  },
]

const BOTTOM_NAV = {
  collector: ['/', '/field', '/properties', '/field/history'],
  treasury: ['/', '/accounts', '/verifications', '/reports'],
  admin: ['/', '/properties', '/admin/users', '/audit'],
}

function allowed(user, item) {
  if (item.permission) return can(user, item.permission)
  if (item.anyOf) return item.anyOf.some((p) => can(user, p))
  return true
}

export function navGroupsFor(user) {
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => allowed(user, i)) })).filter((g) => g.items.length)
}

export function bottomNavFor(user) {
  const all = NAV_GROUPS.flatMap((g) => g.items)
  return (BOTTOM_NAV[user?.role] ?? ['/']).map((to) => all.find((i) => i.to === to)).filter((i) => i && allowed(user, i))
}
