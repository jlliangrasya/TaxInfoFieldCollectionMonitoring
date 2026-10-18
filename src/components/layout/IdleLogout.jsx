import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useAuth } from '@/features/auth/AuthContext'
import { IDLE_TIMEOUT_MINUTES, IDLE_WARNING_SECONDS } from '@/lib/constants'

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart']

/** Logs the user out after a period of no activity, with a countdown warning first. */
export function IdleLogout() {
  const { logout } = useAuth()
  const lastActivity = useRef(0)
  const warningShown = useRef(false)
  const [secondsLeft, setSecondsLeft] = useState(null)

  useEffect(() => {
    const timeoutMs = IDLE_TIMEOUT_MINUTES * 60_000
    lastActivity.current = Date.now()

    // While the warning is showing, only the "Stay logged in" button resets the timer.
    const onActivity = () => {
      if (!warningShown.current) lastActivity.current = Date.now()
    }
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }))

    const timer = setInterval(() => {
      const remaining = Math.ceil((timeoutMs - (Date.now() - lastActivity.current)) / 1000)
      if (remaining <= 0) {
        clearInterval(timer)
        logout('Automatic logout after inactivity')
        toast.info('You were logged out because there was no activity for a while. Please log in again.')
      } else if (remaining <= IDLE_WARNING_SECONDS) {
        warningShown.current = true
        setSecondsLeft(remaining)
      }
    }, 1000)

    return () => {
      clearInterval(timer)
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity))
    }
  }, [logout])

  function stayLoggedIn() {
    warningShown.current = false
    lastActivity.current = Date.now()
    setSecondsLeft(null)
  }

  return (
    <AlertDialog open={secondsLeft !== null}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you still there?</AlertDialogTitle>
          <AlertDialogDescription>
            For security, you will be logged out in <strong>{secondsLeft}</strong> seconds because there has been no activity.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => logout('Logged out from inactivity warning')}>Log out now</AlertDialogCancel>
          <AlertDialogAction onClick={stayLoggedIn}>Stay logged in</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
