import { Link, useLocation, useNavigate } from 'react-router'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Title area shown at the top of every page.
 * @param breadcrumbs [{ label, to? }]
 * Pages deeper than one level (e.g. a property's details) also get a large Back
 * button on phones, which returns to the previous screen with its filters kept.
 */
export function PageHeader({ title, description, breadcrumbs = [], actions }) {
  const parent = breadcrumbs.length >= 3 ? breadcrumbs[breadcrumbs.length - 2] : null

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {parent?.to && <BackButton parent={parent} />}
        {breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className={cn('mb-1 no-print', parent?.to && 'hidden sm:block')}>
            <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
              {breadcrumbs.map((b, i) => (
                <li key={i} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="size-3.5" aria-hidden />}
                  {b.to ? (
                    <Link to={b.to} className="hover:text-foreground hover:underline">
                      {b.label}
                    </Link>
                  ) : (
                    <span aria-current="page">{b.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 no-print">{actions}</div>}
    </div>
  )
}

function BackButton({ parent }) {
  const navigate = useNavigate()
  const location = useLocation()
  // Opened directly (bookmark or shared link): there is no previous screen, so go to the parent page.
  const hasHistory = location.key !== 'default'

  return (
    <Button
      variant="ghost"
      className="no-print mb-2 -ml-3 h-11 px-3 text-base sm:hidden"
      onClick={() => (hasHistory ? navigate(-1) : navigate(parent.to))}
    >
      <ArrowLeft className="size-5" /> {hasHistory ? 'Back' : `Back to ${parent.label}`}
    </Button>
  )
}
