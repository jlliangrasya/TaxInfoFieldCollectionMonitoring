import { Info } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

/** Small ⓘ button that explains an unfamiliar term. Works by tap on phones. */
export function HelpTip({ term, children }) {
  return (
    <Popover>
      <PopoverTrigger
        type="button"
        className="inline-flex size-6 items-center justify-center rounded-full align-middle text-muted-foreground hover:text-foreground"
        aria-label={`What is ${term}?`}
      >
        <Info className="size-4" aria-hidden />
      </PopoverTrigger>
      <PopoverContent className="w-72 text-sm">
        <p className="mb-1 font-semibold">{term}</p>
        <p className="text-muted-foreground">{children}</p>
      </PopoverContent>
    </Popover>
  )
}
