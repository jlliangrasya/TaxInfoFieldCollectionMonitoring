import { MapPin, EyeOff } from 'lucide-react'

/** Shows a recorded GPS point as a map link, or a notice when the viewer may not see it. */
export function GpsLink({ gps }) {
  if (!gps) return <span className="text-muted-foreground">Not recorded</span>
  if (gps === 'hidden') {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <EyeOff className="size-3.5" aria-hidden /> Recorded (Treasury only)
      </span>
    )
  }
  const href = `https://www.openstreetmap.org/?mlat=${gps.lat}&mlon=${gps.lng}#map=18/${gps.lat}/${gps.lng}`
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
      <MapPin className="size-3.5" aria-hidden />
      {gps.lat.toFixed(4)}, {gps.lng.toFixed(4)}
      <span className="sr-only">(opens map in a new tab)</span>
    </a>
  )
}
