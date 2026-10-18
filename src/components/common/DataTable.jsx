import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { EmptyState } from './States'

/**
 * Simple, accessible table with sorting and paging.
 * On phones it shows each row as a card (renderCard) instead of a wide table.
 *
 * columns: [{ key, header, cell?(row), align?: 'right', sortable?: true, sortValue?(row), className? }]
 */
export function DataTable({
  columns,
  rows,
  getRowKey = (r) => r.id,
  rowHref,
  renderCard,
  pageSize = 15,
  emptyTitle = 'No records found',
  emptyText = 'Try a different search or clear the filters.',
  caption,
}) {
  const navigate = useNavigate()
  const [sort, setSort] = useState(null)
  const [page, setPage] = useState(0)

  const sorted = useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    const value = col?.sortValue ?? ((r) => r[sort.key])
    return [...rows].sort((a, b) => {
      const va = value(a)
      const vb = value(b)
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va ?? '').localeCompare(String(vb ?? ''))
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }, [rows, sort, columns])

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const current = Math.min(page, pageCount - 1)
  const visible = sorted.slice(current * pageSize, current * pageSize + pageSize)

  if (!rows.length) return <EmptyState title={emptyTitle}>{emptyText}</EmptyState>

  function toggleSort(key) {
    setPage(0)
    setSort((s) => (s?.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : null))
  }

  return (
    <div className="space-y-3">
      {/* Phone view: cards */}
      {renderCard && (
        <ul className="space-y-3 md:hidden">
          {visible.map((row) => {
            const href = rowHref?.(row)
            return (
              <li key={getRowKey(row)}>
                {href ? (
                  <Link
                    to={href}
                    className="block rounded-lg border bg-card p-4 shadow-xs transition-colors hover:bg-accent focus-visible:bg-accent"
                  >
                    {renderCard(row)}
                  </Link>
                ) : (
                  <div className="rounded-lg border bg-card p-4 shadow-xs">{renderCard(row)}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* Larger screens: table */}
      <div className={cn('overflow-x-auto rounded-lg border bg-card', renderCard && 'hidden md:block')}>
        <table className="w-full text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className="bg-muted/60">
            <tr>
              {columns.map((c) => {
                const active = sort?.key === c.key
                const SortIcon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={cn('px-3 py-3 text-left font-semibold whitespace-nowrap text-foreground', c.align === 'right' && 'text-right', c.className)}
                  >
                    {c.sortable === false ? (
                      c.header
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key)}
                        className={cn('inline-flex items-center gap-1 hover:underline', c.align === 'right' && 'flex-row-reverse')}
                      >
                        {c.header}
                        <SortIcon className="size-3.5 text-muted-foreground" aria-hidden />
                      </button>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const href = rowHref?.(row)
              return (
                <tr
                  key={getRowKey(row)}
                  onClick={href ? (e) => !e.target.closest('a,button') && navigate(href) : undefined}
                  className={cn('border-t', href && 'cursor-pointer hover:bg-accent/60')}
                >
                  {columns.map((c, i) => (
                    <td key={c.key} className={cn('px-3 py-3 align-top', c.align === 'right' && 'text-right tabular-nums', c.className)}>
                      {i === 0 && href ? (
                        <Link to={href} className="font-medium text-primary hover:underline">
                          {c.cell ? c.cell(row) : row[c.key]}
                        </Link>
                      ) : c.cell ? (
                        c.cell(row)
                      ) : (
                        row[c.key]
                      )}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col items-center justify-between gap-2 text-sm text-muted-foreground sm:flex-row">
        <p aria-live="polite">
          Showing {current * pageSize + 1}–{Math.min(sorted.length, (current + 1) * pageSize)} of {sorted.length}
        </p>
        {pageCount > 1 && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(current - 1)} disabled={current === 0}>
              <ChevronLeft /> Previous
            </Button>
            <span>
              Page {current + 1} of {pageCount}
            </span>
            <Button variant="outline" size="sm" onClick={() => setPage(current + 1)} disabled={current >= pageCount - 1}>
              Next <ChevronRight />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
