import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'

import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col sm:flex-row gap-4',
        month: 'flex flex-col gap-4',
        month_caption: 'flex justify-center pt-1 relative items-center',
        caption_label: 'text-sm font-medium',
        nav: 'flex items-center gap-1',
        button_previous: cn(
          buttonVariants({ variant: 'outline' }),
          'absolute left-1 top-1 size-7 bg-transparent p-0 opacity-70 hover:opacity-100 border-zinc-700 text-zinc-200 hover:bg-zinc-800'
        ),
        button_next: cn(
          buttonVariants({ variant: 'outline' }),
          'absolute right-1 top-1 size-7 bg-transparent p-0 opacity-70 hover:opacity-100 border-zinc-700 text-zinc-200 hover:bg-zinc-800'
        ),
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday: 'text-zinc-500 rounded-md w-8 font-normal text-[0.8rem]',
        week: 'flex w-full mt-1',
        day: 'relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-zinc-800 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md',
        day_button: cn(
          buttonVariants({ variant: 'ghost' }),
          'size-8 p-0 font-normal aria-selected:opacity-100 hover:bg-zinc-800 hover:text-zinc-100'
        ),
        range_start: 'day-range-start',
        range_end: 'day-range-end',
        selected:
          '[&>button]:bg-emerald-600 [&>button]:text-white [&>button]:hover:bg-emerald-600 [&>button]:hover:text-white [&>button]:focus:bg-emerald-600 [&>button]:focus:text-white',
        today: '[&>button]:bg-zinc-800 [&>button]:text-zinc-100',
        outside:
          'day-outside text-zinc-600 aria-selected:text-zinc-600',
        disabled: 'text-zinc-700 opacity-50',
        range_middle: 'aria-selected:bg-zinc-800 aria-selected:text-zinc-100',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...rest }) =>
          orientation === 'left' ? <ChevronLeft className="size-4" {...rest} /> : <ChevronRight className="size-4" {...rest} />,
      }}
      {...props}
    />
  )
}

export { Calendar }
