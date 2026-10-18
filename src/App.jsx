import { useEffect } from 'react'
import { RouterProvider } from 'react-router/dom'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/features/auth/AuthContext'
import { ErrorBoundary } from '@/components/layout/ErrorBoundary'
import { router } from './routes'

export function App({ storeStatus }) {
  useEffect(() => {
    if (storeStatus?.recovered) {
      toast.warning('The saved demo data could not be read, so fresh sample data was loaded.')
    }
  }, [storeStatus])

  return (
    <ErrorBoundary>
      <AuthProvider>
        <TooltipProvider>
          <RouterProvider router={router} />
          <Toaster position="top-center" richColors closeButton />
        </TooltipProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
