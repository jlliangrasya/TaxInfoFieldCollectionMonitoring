import { toast } from 'sonner'

/**
 * Shows an error to the user in plain language. If a react-hook-form instance
 * is given, field-specific messages are placed under the matching inputs.
 */
export function showError(error, form) {
  if (error?.name === 'ValidationError' && form && error.fieldErrors) {
    const entries = Object.entries(error.fieldErrors)
    for (const [field, message] of entries) form.setError(field, { type: 'server', message })
    if (entries.length) {
      toast.error(error.message)
      return
    }
  }
  if (error?.name === 'AuthError') {
    toast.error(error.message)
    window.dispatchEvent(new Event('rpt:session-ended'))
    return
  }
  if (['ValidationError', 'PermissionError'].includes(error?.name)) {
    toast.error(error.message)
    return
  }
  console.error(error)
  toast.error('Something went wrong. Please try again. If the problem continues, contact the System Administrator.')
}
