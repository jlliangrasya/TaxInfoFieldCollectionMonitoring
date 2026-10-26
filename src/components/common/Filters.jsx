import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { subDays } from 'date-fns'
import { isoDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { NativeSelect } from './FormField'

export function FilterBar({ children, onClear, showClear }) {
  return (
    <div className="mb-4 rounded-xl border bg-card p-3 shadow-xs sm:p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
      {showClear && (
        <div className="mt-3 flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X /> Clear filters
          </Button>
        </div>
      )}
    </div>
  )
}

export function SearchBox({ value, onChange, label = 'Search', placeholder, className }) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-sm font-medium">{label}</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pl-10"
          maxLength={100}
          aria-label={label}
        />
      </div>
    </div>
  )
}

export function SelectFilter({ label, value, onChange, options, allLabel = 'All' }) {
  return (
    <div>
      <Label className="mb-1.5 block text-sm font-medium">{label}</Label>
      <NativeSelect value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
    </div>
  )
}

export function DateFilter({ label, value, onChange, max }) {
  return (
    <div>
      <Label className="mb-1.5 block text-sm font-medium">{label}</Label>
      <Input type="date" value={value} max={max} onChange={(e) => onChange(e.target.value)} aria-label={label} />
    </div>
  )
}

const DATE_PRESETS = [
  { label: 'Today', range: () => [isoDate(), isoDate()] },
  { label: 'Last 7 days', range: () => [isoDate(subDays(new Date(), 6)), isoDate()] },
  { label: 'This month', range: () => [`${isoDate().slice(0, 7)}-01`, isoDate()] },
  { label: 'This year', range: () => [`${isoDate().slice(0, 4)}-01-01`, isoDate()] },
]

/** One-tap date ranges, so nobody has to pick two dates by hand. */
export function DatePresets({ from, to, onPick, className }) {
  return (
    <div role="group" aria-label="Quick date range" className={cn('flex flex-wrap gap-2', className)}>
      {DATE_PRESETS.map((p) => {
        const [f, t] = p.range()
        const active = from === f && to === t
        return (
          <button
            key={p.label}
            type="button"
            aria-pressed={active}
            onClick={() => onPick(f, t)}
            className={cn(
              'min-h-9 rounded-full border px-3 text-sm font-medium transition-colors',
              active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-accent',
            )}
          >
            {p.label}
          </button>
        )
      })}
    </div>
  )
}
