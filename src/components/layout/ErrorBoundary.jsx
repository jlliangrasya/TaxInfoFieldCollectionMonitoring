import { Component } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Shows a friendly message instead of a blank screen if something unexpected breaks. */
export class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Unexpected error:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
        <AlertTriangle className="size-12 text-warning" aria-hidden />
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="max-w-md text-muted-foreground">
          The page could not be displayed. Your saved records are not affected. Please go back to the Home page and try again.
        </p>
        <Button
          onClick={() => {
            this.setState({ error: null })
            window.location.hash = '#/'
          }}
        >
          Go to Home page
        </Button>
      </div>
    )
  }
}
