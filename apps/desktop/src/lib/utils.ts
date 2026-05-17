import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { resolveImageUrl } from '@pos/supabase'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Map a currency code to a sensible locale for Intl formatting.
 * Defaults to en-GB so anyone outside the explicit list still gets
 * thousands separators and a leading currency prefix.
 */
export function localeForCurrency(currency: string | undefined | null): string {
  switch ((currency ?? '').toUpperCase()) {
    case 'INR': return 'en-IN'
    case 'USD': return 'en-US'
    case 'GBP': return 'en-GB'
    case 'EUR': return 'en-IE'
    case 'AUD': return 'en-AU'
    case 'CAD': return 'en-CA'
    case 'JPY': return 'ja-JP'
    default:    return 'en-GB'
  }
}

/**
 * Format a numeric amount as currency, locale-aware.
 *
 * Intl.NumberFormat is the source of truth — it produces correct symbols,
 * thousands separators, and decimal places for the given currency + locale.
 *
 * The `symbol` argument is honoured only as an override: if the caller has
 * a custom symbol set (e.g. "Rs." instead of "₹") we swap Intl's symbol for
 * the custom one, preserving the locale's number formatting around it.
 */
export function formatCurrency(amount: number, currency = 'GBP', symbol?: string): string {
  const locale = localeForCurrency(currency)
  let formatted: string
  try {
    formatted = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(amount)
  } catch {
    // Currency code unrecognised — fall back to manual format with thousands separators.
    const numeric = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
    return symbol ? `${symbol}${numeric}` : `${currency} ${numeric}`
  }

  // Preserve the user's custom currency symbol if they set one that differs
  // from what Intl produces (e.g. legacy "Rs." instead of "₹").
  if (symbol) {
    try {
      const parts = new Intl.NumberFormat(locale, { style: 'currency', currency }).formatToParts(amount)
      const intlSymbol = parts.find(p => p.type === 'currency')?.value
      if (intlSymbol && intlSymbol !== symbol) {
        // Replace only the symbol part, leave the digits/punctuation alone
        formatted = formatted.replace(intlSymbol, symbol)
      }
    } catch {
      // formatToParts unsupported — leave the Intl-formatted string as-is
    }
  }
  return formatted
}

export function formatDate(dateString: string, locale: string = 'en-GB'): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString))
}

export function formatTime(dateString: string, locale: string = 'en-GB'): string {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString))
}

/**
 * Returns today's date as YYYY-MM-DD in the given IANA timezone.
 *
 * Replaces `new Date().toISOString().split('T')[0]`, which uses UTC and
 * silently rolls a UK 00:30 BST tap to "yesterday" — wrong for every
 * non-UTC org. Built from `Intl.DateTimeFormat` parts so it works for
 * any timezone the runtime knows about, with a UTC fallback if the TZ
 * is rejected (defensive — `get_org_timezone` already validates server-side).
 */
export function todayInTz(timezone: string = 'Europe/London'): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date())
    const y = parts.find(p => p.type === 'year')?.value
    const m = parts.find(p => p.type === 'month')?.value
    const d = parts.find(p => p.type === 'day')?.value
    if (y && m && d) return `${y}-${m}-${d}`
  } catch {
    // Bad TZ — fall through
  }
  return new Date().toISOString().split('T')[0]
}

/**
 * Convert a local-date (YYYY-MM-DD as the operator's calendar sees it) plus
 * a timezone into the UTC ISO instants that bracket that day. Used by any
 * query that needs to filter rows by `created_at` for a business-day —
 * Supabase stores timestamps as UTC, but the operator thinks in
 * Europe/London / Asia/Kolkata / etc.
 *
 * Handles DST correctly because the offset is computed by re-interpreting
 * the candidate UTC instant through the target timezone, not by
 * hard-coding any offset.
 */
export function dayBoundsUtc(
  localDate: string,
  timezone: string = 'Europe/London',
): { startUtc: string; endUtc: string } {
  // Pretend `${localDate}T00:00:00` is UTC; this is wrong by exactly the tz
  // offset for that local date. Re-derive the offset by formatting that
  // instant through the target zone and diffing.
  const naive = new Date(`${localDate}T00:00:00.000Z`)
  let offsetMs = 0
  try {
    // toLocaleString in target tz, then re-parse as UTC. The diff equals
    // the offset (in the convention `offset = utc - local`, so subtracting
    // it from the naive instant gives the real UTC instant).
    const asInTz = new Date(naive.toLocaleString('en-US', { timeZone: timezone }))
    const asUtc = new Date(naive.toLocaleString('en-US', { timeZone: 'UTC' }))
    offsetMs = asUtc.getTime() - asInTz.getTime()
  } catch {
    // Bad TZ — fall back to UTC bounds (will be off by a few hours for
    // non-UTC orgs but won't crash).
  }
  const startUtc = new Date(naive.getTime() + offsetMs)
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000 - 1)
  return { startUtc: startUtc.toISOString(), endUtc: endUtc.toISOString() }
}

export function getOrderStatusColor(status: string): string {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800'
    case 'confirmed':
      return 'bg-blue-100 text-blue-800'
    case 'preparing':
      return 'bg-orange-100 text-orange-800'
    case 'ready':
      return 'bg-green-100 text-green-800'
    case 'served':
      return 'bg-indigo-100 text-indigo-800'
    case 'completed':
      return 'bg-green-100 text-green-800'
    case 'cancelled':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

export function getPaymentStatusColor(status: string): string {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800'
    case 'completed':
      return 'bg-green-100 text-green-800'
    case 'failed':
      return 'bg-red-100 text-red-800'
    case 'refunded':
      return 'bg-purple-100 text-purple-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

export function calculateOrderTotals(
  items: Array<{ quantity: number; unit_price?: number; price?: number }>,
  taxRatePercent = 10,
  serviceChargePercent = 0
) {
  const subtotal = items.reduce((sum, item) => {
    const price = item.unit_price || item.price || 0
    return sum + (item.quantity * price)
  }, 0)

  const taxAmount = subtotal * (taxRatePercent / 100)
  const serviceCharge = subtotal * (serviceChargePercent / 100)
  const totalAmount = subtotal + taxAmount + serviceCharge

  return {
    subtotal,
    taxAmount,
    serviceCharge,
    totalAmount,
  }
}

export function getPreparationTimeDisplay(minutes: number): string {
  if (minutes === 0) return 'No prep time'
  if (minutes < 60) return `${minutes}m`
  
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  
  if (remainingMinutes === 0) return `${hours}h`
  return `${hours}h ${remainingMinutes}m`
}

export function generateOrderNumber(): string {
  const timestamp = Date.now()
  const random = Math.floor(Math.random() * 1000)
  return `ORD${timestamp}${random}`.slice(-10)
}

/**
 * Resolve image URL for display. Handles Supabase storage URLs,
 * legacy /uploads/ paths, and full URLs.
 */
export function imageUrl(url: string | null | undefined): string {
  return resolveImageUrl(url)
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

