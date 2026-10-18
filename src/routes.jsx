import { createHashRouter } from 'react-router'
import { PERMISSIONS as P } from '@/lib/permissions'
import { AppShell } from '@/components/layout/AppShell'
import { ErrorBoundary } from '@/components/layout/ErrorBoundary'
import { RequireAuth, RequirePermission, NotFound } from '@/features/auth/Guards'
import { LoginPage } from '@/features/auth/LoginPage'
import { ChangePasswordPage } from '@/features/auth/ChangePasswordPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { PropertyListPage } from '@/features/properties/PropertyListPage'
import { PropertyDetailPage } from '@/features/properties/PropertyDetailPage'
import { TaxpayerListPage } from '@/features/taxpayers/TaxpayerListPage'
import { TaxpayerDetailPage } from '@/features/taxpayers/TaxpayerDetailPage'
import { AccountsPage } from '@/features/collections/AccountsPage'
import { VerificationPage } from '@/features/collections/VerificationPage'
import { MyAssignmentsPage } from '@/features/field/MyAssignmentsPage'
import { LogVisitPage } from '@/features/field/LogVisitPage'
import { MyVisitsPage } from '@/features/field/MyVisitsPage'
import { VisitsPage } from '@/features/field/VisitsPage'
import { AssignmentsPage } from '@/features/assignments/AssignmentsPage'
import { ReportsPage } from '@/features/reports/ReportsPage'
import { UsersPage } from '@/features/admin/UsersPage'
import { AuditLogPage } from '@/features/admin/AuditLogPage'
import { DemoSettingsPage } from '@/features/admin/DemoSettingsPage'
import { HelpPage } from '@/features/help/HelpPage'

const guard = (element, permission, anyOf) => (
  <RequirePermission permission={permission} anyOf={anyOf}>
    {element}
  </RequirePermission>
)

// Hash-based URLs (…/#/properties) so the demo works on any static web host.
export const router = createHashRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    errorElement: <ErrorBoundary><NotFound /></ErrorBoundary>,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'account/password', element: <ChangePasswordPage /> },

      { path: 'properties', element: guard(<PropertyListPage />, P.RECORDS_VIEW) },
      { path: 'properties/:id', element: guard(<PropertyDetailPage />, P.RECORDS_VIEW) },
      { path: 'taxpayers', element: guard(<TaxpayerListPage />, P.RECORDS_VIEW) },
      { path: 'taxpayers/:id', element: guard(<TaxpayerDetailPage />, P.RECORDS_VIEW) },

      { path: 'accounts', element: guard(<AccountsPage />, P.RECORDS_VIEW_ALL) },
      { path: 'verifications', element: guard(<VerificationPage />, P.FIELD_VERIFY) },
      { path: 'visits', element: guard(<VisitsPage />, P.VISITS_VIEW_ALL) },
      { path: 'assignments', element: guard(<AssignmentsPage />, P.ASSIGNMENTS_MANAGE) },
      { path: 'reports', element: guard(<ReportsPage />, null, [P.REPORTS_VIEW, P.FIELD_RECORD]) },

      { path: 'field', element: guard(<MyAssignmentsPage />, P.FIELD_RECORD) },
      { path: 'field/visit/:propertyId', element: guard(<LogVisitPage />, P.FIELD_RECORD) },
      { path: 'field/history', element: guard(<MyVisitsPage />, P.FIELD_RECORD) },

      { path: 'admin/users', element: guard(<UsersPage />, P.USERS_MANAGE) },
      { path: 'audit', element: guard(<AuditLogPage />, P.AUDIT_VIEW) },
      { path: 'settings', element: guard(<DemoSettingsPage />, P.DEMO_RESET) },
      { path: 'help', element: <HelpPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])
