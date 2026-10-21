/** Full-screen message shown while the app is starting. */
export function Splash({ message }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="size-10 animate-spin rounded-full border-4 border-primary/20 border-t-maroon" aria-hidden />
      <p className="text-muted-foreground" role="status">
        {message}
      </p>
    </div>
  )
}
