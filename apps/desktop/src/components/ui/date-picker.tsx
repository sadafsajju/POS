import * as React from 'react'
import { format } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface DatePickerProps {
  /** Controlled value as ISO date string YYYY-MM-DD. Empty string = no selection. */
  value: string
  onChange: (next: string) => void
  /** Maximum selectable date (inclusive) as ISO YYYY-MM-DD. */
  max?: string
  /** Minimum selectable date (inclusive) as ISO YYYY-MM-DD. */
  min?: string
  placeholder?: string
  className?: string
  disabled?: boolean
}

/**
 * Parses a YYYY-MM-DD string as a local-time Date so the calendar selects
 * the right cell regardless of browser timezone (an ISO date with no time
 * component is otherwise treated as UTC midnight by `new Date()`).
 */
function parseISO(value: string): Date | undefined {
  if (!value) return undefined
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!m) return undefined
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function toISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function DatePicker({
  value,
  onChange,
  max,
  min,
  placeholder = 'Pick a date',
  className,
  disabled,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const selected = parseISO(value)
  const maxDate = parseISO(max ?? '')
  const minDate = parseISO(min ?? '')

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            'justify-start text-left font-normal',
            'bg-zinc-800 border-zinc-700 text-zinc-100 hover:bg-zinc-700 hover:text-zinc-100',
            !selected && 'text-zinc-500',
            className
          )}
        >
          <CalendarIcon className="mr-2 size-4 text-zinc-400" />
          {selected ? format(selected, 'PP') : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => {
            if (date) {
              onChange(toISO(date))
              setOpen(false)
            }
          }}
          disabled={(d) => {
            if (maxDate && d > maxDate) return true
            if (minDate && d < minDate) return true
            return false
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}
