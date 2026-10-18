import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
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
