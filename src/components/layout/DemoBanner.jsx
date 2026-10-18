import { TriangleAlert } from 'lucide-react'
import { getStoreStatus } from '@/data/store'

export function DemoBanner() {
  const { persistent } = getStoreStatus()
  return (
    <div role="note" className="no-print border-b border-warning/30 bg-warning-soft px-4 py-2 text-center text-sm text-[oklch(0.4_0.1_70)]">
      <TriangleAlert className="mr-1.5 inline size-4 align-[-3px]" aria-hidden />
      <strong>DEMO MODE</strong> — sample data only. Not an official record.
      {!persistent && <span className="ml-1">Your browser is blocking storage, so changes will be lost when the page is refreshed.</span>}
    </div>
  )
}
