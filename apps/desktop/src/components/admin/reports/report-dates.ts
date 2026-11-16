import { businessDayStartUtc } from '@/lib/utils'

/**
 * Date helpers for the Reports page. Everything here works on org-local
 * business dates as 'YYYY-MM-DD' strings; the server turns them into UTC
 * instants (get_reports_overview), so the browser's own timezone never
 * matters. Date arithmetic runs on UTC-midnight Dates purely as a calendar.
 */

export type PresetId = 'today' | 'yesterday' | 'this_week' | 'last_7' | 'last_30' | 'this_month' | 'custom'

export const PRESETS: Array<{ id: PresetId; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'this_week', label: 'This week' },
  { id: 'last_7', label: 'Last 7 days' },
  { id: 'last_30', label: 'Last 30 days' },
  { id: 'this_month', label: 'This month' },
  { id: 'custom', label: 'Custom' },
]

export interface DateRange {
  start: string
  end: string
}

/** Max span the RPC accepts. */
export const MAX_RANGE_DAYS = 366

/**
 * The business date "now" falls in, honouring the org timezone and the
 * business_day_start rollover (so at 00:40 with a 02:00 rollover it is
 * still yesterday's trading day).
 */
export function currentBusinessDate(timezone: string, dayStart: string): string {
  const start = businessDayStartUtc(timezone, dayStart)
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(start)
  } catch {
    return start.toISOString().slice(0, 10)
  }
}

function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`)
}

export function addDays(iso: string, days: number): string {
  const d = toDate(iso)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Inclusive day count between two ISO dates. */
export function daysBetween(start: string, end: string): number {
  return Math.round((toDate(end).getTime() - toDate(start).getTime()) / 86_400_000) + 1
}

/** ISO weekday, 1 = Monday … 7 = Sunday. */
export function isoWeekday(iso: string): number {
  return ((toDate(iso).getUTCDay() + 6) % 7) + 1
}

export function presetRange(preset: Exclude<PresetId, 'custom'>, today: string): DateRange {
  switch (preset) {
    case 'today':
      return { start: today, end: today }
    case 'yesterday': {
      const y = addDays(today, -1)
      return { start: y, end: y }
    }
    case 'this_week':
      return { start: addDays(today, 1 - isoWeekday(today)), end: today }
    case 'last_7':
      return { start: addDays(today, -6), end: today }
    case 'last_30':
      return { start: addDays(today, -29), end: today }
    case 'this_month':
      return { start: `${today.slice(0, 8)}01`, end: today }
  }
}

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...opts })
const dayMonth = fmt({ day: 'numeric', month: 'short' })
const dayMonthYear = fmt({ day: 'numeric', month: 'short', year: 'numeric' })
const weekdayDayMonth = fmt({ weekday: 'short', day: 'numeric', month: 'short' })
const weekdayShort = fmt({ weekday: 'short' })

/** "Mon 10 Nov" */
export function formatDay(iso: string): string {
  return weekdayDayMonth.format(toDate(iso))
}

/** "10 Nov" */
export function formatDayMonth(iso: string): string {
  return dayMonth.format(toDate(iso))
}

/** "Mon" for an ISO date. */
export function formatWeekdayShort(iso: string): string {
  return weekdayShort.format(toDate(iso))
}

/** "Mon 10 Nov" for one day, "10 – 16 Nov 2026" / "28 Oct – 3 Nov 2026" for a range. */
export function formatRange(start: string, end: string): string {
  if (start === end) return `${formatDay(start)} ${start.slice(0, 4)}`
  const sameYear = start.slice(0, 4) === end.slice(0, 4)
  const sameMonth = sameYear && start.slice(5, 7) === end.slice(5, 7)
  if (sameMonth) return `${Number(start.slice(8, 10))} – ${dayMonthYear.format(toDate(end))}`
  if (sameYear) return `${formatDayMonth(start)} – ${dayMonthYear.format(toDate(end))}`
  return `${dayMonthYear.format(toDate(start))} – ${dayMonthYear.format(toDate(end))}`
}

/** Short label for the comparison period: "vs 3 – 9 Nov" / "vs Sun 9 Nov". */
export function formatCompareRange(start: string, end: string): string {
  if (start === end) return `vs ${formatDay(start)}`
  const sameMonth = start.slice(0, 7) === end.slice(0, 7)
  return sameMonth
    ? `vs ${Number(start.slice(8, 10))} – ${formatDayMonth(end)}`
    : `vs ${formatDayMonth(start)} – ${formatDayMonth(end)}`
}

export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** "9am", "12pm", "12am" */
export function formatHour(hour: number): string {
  const h = ((hour % 24) + 24) % 24
  const suffix = h < 12 ? 'am' : 'pm'
  const twelve = h % 12 === 0 ? 12 : h % 12
  return `${twelve}${suffix}`
}
