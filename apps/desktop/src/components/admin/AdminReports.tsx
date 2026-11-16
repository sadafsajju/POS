import { useMemo, useState, type ReactNode } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  Coins,
  DatabaseZap,
  Download,
  FileSpreadsheet,
  Loader2,
  Minus,
  Package,
  Receipt,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { reportsDb } from '@pos/supabase'
import { useSettingsStore } from '@pos/core'
import { DatePicker } from '@/components/ui/date-picker'
import { cn, formatCurrency } from '@/lib/utils'
import {
  BarList,
  CHART,
  ColumnChart,
  LegendItem,
  SERIES,
  ShareBar,
  TrendChart,
  type BarPoint,
  type TrendPoint,
} from './reports/charts'
import {
  MAX_RANGE_DAYS,
  PRESETS,
  WEEKDAY_LABELS,
  currentBusinessDate,
  daysBetween,
  formatCompareRange,
  formatDay,
  formatDayMonth,
  formatHour,
  formatRange,
  formatWeekdayShort,
  presetRange,
  type DateRange,
  type PresetId,
} from './reports/report-dates'

type ReportsOverview = reportsDb.ReportsOverview

// ---------------------------------------------------------------------------
// Labels & fixed colour assignment (colour follows the entity, never rank)
// ---------------------------------------------------------------------------

const CHANNEL_META: Record<string, { label: string; slot: number }> = {
  dine_in: { label: 'Dine-in', slot: 0 },
  takeout: { label: 'Takeaway', slot: 1 },
  delivery: { label: 'Delivery', slot: 2 },
  deliveroo: { label: 'Deliveroo', slot: 3 },
  uber_eats: { label: 'Uber Eats', slot: 4 },
  just_eat: { label: 'Just Eat', slot: 5 },
  swiggy: { label: 'Swiggy', slot: 6 },
  zomato: { label: 'Zomato', slot: 7 },
}
const AGGREGATOR_CHANNELS = new Set(['deliveroo', 'uber_eats', 'just_eat', 'swiggy', 'zomato'])

const PAYMENT_META: Record<string, { label: string; slot: number }> = {
  cash: { label: 'Cash', slot: 0 },
  credit_card: { label: 'Credit card', slot: 1 },
  debit_card: { label: 'Debit card', slot: 2 },
  digital_wallet: { label: 'Digital wallet', slot: 3 },
}

const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

// ---------------------------------------------------------------------------
// Safe accessors — API payloads are untrusted shapes
// ---------------------------------------------------------------------------

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}
function arr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : []
}

class ReportError extends Error {
  code?: string
  constructor(message: string, code?: string) {
    super(message)
    this.code = code
  }
}

/** The RPC ships in a migration; until it's pushed PostgREST returns PGRST202. */
function isMissingFunction(err: unknown): boolean {
  if (!(err instanceof ReportError)) return false
  return (
    err.code === 'PGRST202' ||
    err.code === '42883' ||
    /could not find the function|does not exist/i.test(err.message)
  )
}

function localHour(timezone: string): number {
  try {
    return Number(
      new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', hourCycle: 'h23' }).format(new Date()),
    )
  } catch {
    return new Date().getHours()
  }
}

function formatClock(iso: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
  } catch {
    return iso.slice(11, 16)
  }
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / previous) * 100
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function AdminReports() {
  const { settings } = useSettingsStore()
  const timezone = settings.timezone || 'Europe/London'
  const dayStart = settings.businessDayStart || '00:00'
  const today = currentBusinessDate(timezone, dayStart)

  const [preset, setPreset] = useState<PresetId>('last_7')
  const [custom, setCustom] = useState<DateRange>(() => presetRange('last_7', today))
  const [metric, setMetric] = useState<'revenue' | 'orders'>('revenue')

  const range: DateRange = preset === 'custom' ? custom : presetRange(preset, today)
  const rangeDays = daysBetween(range.start, range.end)
  const rangeError =
    range.end < range.start
      ? 'The end date is before the start date.'
      : rangeDays > MAX_RANGE_DAYS
        ? `Pick a range of ${MAX_RANGE_DAYS} days or less.`
        : null

  const format = (amount: number) => formatCurrency(amount, settings.currency, settings.currencySymbol)
  const compactMoney = useMemo(() => {
    const nf = new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 })
    const symbol = settings.currencySymbol || ''
    return (n: number) => `${symbol}${nf.format(n)}`
  }, [settings.currencySymbol])

  const query = useQuery({
    queryKey: ['reportsOverview', range.start, range.end],
    queryFn: async () => {
      const res = await reportsDb.getReportsOverview({ start: range.start, end: range.end })
      if (!res.success || !res.data) throw new ReportError(res.message || 'Failed to load report', res.error)
      return res.data
    },
    enabled: !rangeError,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    retry: (count, err) => !isMissingFunction(err) && count < 2,
  })

  const data = query.data
  const refreshing = query.isFetching && query.isPlaceholderData
  // While a new range loads, the placeholder still describes the old one.
  const rangeMeta = data?.range && data.range.start === range.start && data.range.end === range.end ? data.range : null

  const choosePreset = (id: PresetId) => {
    if (id === 'custom' && preset !== 'custom') setCustom(range)
    setPreset(id)
  }

  return (
    <div className="h-full overflow-y-auto bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Reports</h1>
            <p className="mt-1 text-sm text-zinc-400">
              <span className="text-zinc-200">{formatRange(range.start, range.end)}</span>
              {rangeMeta && (
                <span className="text-zinc-500">
                  {' '}
                  · {formatCompareRange(rangeMeta.prev_start, rangeMeta.prev_end)}
                </span>
              )}
            </p>
            {rangeMeta?.partial && rangeMeta.compare_until && (
              <p className="mt-0.5 text-xs text-zinc-500">
                Today is still trading, so the comparison stops at the same point: {formatClock(rangeMeta.compare_until, timezone)}{' '}
                on {formatDay(rangeMeta.prev_end)}
              </p>
            )}
            {dayStart !== '00:00' && (
              <p className="mt-0.5 text-xs text-zinc-500">
                Business days run from {dayStart} ({timezone})
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => data && exportCsv(data)}
            disabled={!data}
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-700 hover:text-zinc-100 disabled:opacity-40"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>

        {/* Range controls */}
        <div className="space-y-3">
          <div
            role="tablist"
            aria-label="Date range"
            className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0"
          >
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={preset === p.id}
                onClick={() => choosePreset(p.id)}
                className={cn(
                  'h-11 shrink-0 rounded-lg border px-4 text-sm font-medium transition-colors',
                  preset === p.id
                    ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800 hover:text-zinc-100',
                )}
              >
                {p.label}
              </button>
            ))}
            {refreshing && <Loader2 className="ml-1 h-4 w-4 shrink-0 animate-spin self-center text-zinc-500" />}
          </div>

          {preset === 'custom' && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
              <label className="flex items-center gap-2 text-sm text-zinc-400">
                From
                <DatePicker
                  value={custom.start}
                  max={custom.end || today}
                  onChange={(v) => v && setCustom((c) => ({ ...c, start: v }))}
                  className="h-11 w-44"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-400">
                To
                <DatePicker
                  value={custom.end}
                  min={custom.start}
                  max={today}
                  onChange={(v) => v && setCustom((c) => ({ ...c, end: v }))}
                  className="h-11 w-44"
                />
              </label>
              <span className="text-xs text-zinc-500">
                {rangeError ?? `${rangeDays} day${rangeDays === 1 ? '' : 's'}`}
              </span>
            </div>
          )}
        </div>

        {/* Body */}
        {rangeError ? (
          <Notice icon={<AlertTriangle className="h-5 w-5 text-amber-400" />} title="Check the dates">
            {rangeError}
          </Notice>
        ) : query.isError && !data ? (
          isMissingFunction(query.error) ? (
            <Notice icon={<DatabaseZap className="h-5 w-5 text-amber-400" />} title="Reports need a database update">
              This version of the app expects the <code className="text-zinc-300">get_reports_overview</code> database
              function (migration <code className="text-zinc-300">20261117000002_reports_overview.sql</code>). Apply the
              latest migrations to your Supabase project, then reload.
            </Notice>
          ) : (
            <Notice
              icon={<AlertTriangle className="h-5 w-5 text-rose-400" />}
              title="Couldn't load reports"
              action={
                <button
                  type="button"
                  onClick={() => query.refetch()}
                  className="inline-flex h-11 items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 text-sm font-medium text-zinc-200 hover:bg-zinc-700"
                >
                  <RefreshCw className="h-4 w-4" /> Try again
                </button>
              }
            >
              {(query.error as Error)?.message || 'Something went wrong.'} Check your connection — reports need to be
              online.
            </Notice>
          )
        ) : !data ? (
          <ReportSkeleton />
        ) : (
          <div className={cn('space-y-6 transition-opacity', refreshing && 'opacity-60')}>
            <ReportBody
              data={data}
              format={format}
              compactMoney={compactMoney}
              metric={metric}
              setMetric={setMetric}
              tippingEnabled={!!settings.tippingEnabled}
              onPreset={choosePreset}
              preset={preset}
            />
          </div>
        )}

        {/* Related tools */}
        {(settings.tippingEnabled || settings.taxRegime === 'uk_vat') && (
          <div className="grid gap-3 border-t border-zinc-800/80 pt-6 md:grid-cols-2">
            {settings.tippingEnabled && (
              <QuickLink
                to="/admin/more/tips"
                icon={<Coins className="h-5 w-5 text-emerald-400" />}
                title="Tip allocation"
                subtitle="Split the tip pool to staff (Tipping Act 2023)"
              />
            )}
            {settings.taxRegime === 'uk_vat' && (
              <QuickLink
                to="/admin/more/vat-export"
                icon={<FileSpreadsheet className="h-5 w-5 text-emerald-400" />}
                title="VAT export"
                subtitle="MTD-compatible CSV for the accountant"
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Report body (data loaded)
// ---------------------------------------------------------------------------

function ReportBody({
  data,
  format,
  compactMoney,
  metric,
  setMetric,
  tippingEnabled,
  onPreset,
  preset,
}: {
  data: ReportsOverview
  format: (n: number) => string
  compactMoney: (n: number) => string
  metric: 'revenue' | 'orders'
  setMetric: (m: 'revenue' | 'orders') => void
  tippingEnabled: boolean
  onPreset: (p: PresetId) => void
  preset: PresetId
}) {
  const s = data.summary ?? ({} as ReportsOverview['summary'])
  const p = data.previous ?? ({} as ReportsOverview['previous'])
  const days = num(data.range?.days) || 1
  const cutoffHour = Number((data.range?.business_day_start ?? '00:00').split(':')[0]) || 0
  const orders = num(s.orders)
  const hasSales = orders > 0
  const compareLabel = data.range ? formatCompareRange(data.range.prev_start, data.range.prev_end) : 'vs previous'
  const partial = !!data.range?.partial
  // Position of the current local hour within the business-day hour order;
  // later hours of a day in progress are "not yet", not zero.
  const nowSlot = partial ? (localHour(data.range.timezone) - cutoffHour + 24) % 24 : 23

  const daily = arr<ReportsOverview['daily'][number]>(data.daily)
  const prevDaily = arr<ReportsOverview['previous_daily'][number]>(data.previous_daily)
  const hourly = arr<ReportsOverview['hourly'][number]>(data.hourly)
  const weekday = arr<ReportsOverview['weekday'][number]>(data.weekday)
  const products = arr<ReportsOverview['products'][number]>(data.products)
  const unsold = arr<ReportsOverview['unsold_products'][number]>(data.unsold_products)
  const categories = arr<ReportsOverview['categories'][number]>(data.categories)
  const payments = arr<ReportsOverview['payment_methods'][number]>(data.payment_methods)
  const channels = arr<ReportsOverview['channels'][number]>(data.channels)
  const discounts = arr<ReportsOverview['discounts'][number]>(data.discounts)

  // Hours in business-day order (a 02:00 rollover puts 1am at the end), trimmed
  // to the span that actually traded in either period.
  const hoursOrdered = useMemo(() => {
    const byHour = new Map(hourly.map((h) => [num(h.hour), h]))
    const order = Array.from({ length: 24 }, (_, i) => (cutoffHour + i) % 24)
    const active = order.map((h) => {
      const row = byHour.get(h)
      return num(row?.orders) + num(row?.prev_orders) > 0
    })
    const first = active.indexOf(true)
    const last = active.lastIndexOf(true)
    const span = first === -1 ? order.filter((h) => h >= 9 && h <= 22) : order.slice(first, last + 1)
    return span.map((h) => {
      const row = byHour.get(h)
      return {
        hour: h,
        revenue: num(row?.revenue),
        orders: num(row?.orders),
        prev_revenue: num(row?.prev_revenue),
        prev_orders: num(row?.prev_orders),
      }
    })
  }, [hourly, cutoffHour])

  const pick = (r: { revenue: number; orders: number }) => (metric === 'revenue' ? num(r.revenue) : num(r.orders))
  const fmtMetric = (n: number) => (metric === 'revenue' ? format(n) : `${n.toLocaleString()} order${n === 1 ? '' : 's'}`)
  const axisMetric = (n: number) => (metric === 'revenue' ? compactMoney(n) : n.toLocaleString())

  const trend: TrendPoint[] =
    days === 1
      ? hoursOrdered.map((h) => ({
          label: formatHour(h.hour),
          title: `${formatHour(h.hour)} – ${formatHour(h.hour + 1)}`,
          prevTitle: data.range ? formatDay(data.range.prev_start) : undefined,
          current:
            (h.hour - cutoffHour + 24) % 24 > nowSlot ? null : metric === 'revenue' ? h.revenue : h.orders,
          previous: metric === 'revenue' ? h.prev_revenue : h.prev_orders,
        }))
      : daily.map((d, i) => {
          const prev = prevDaily[i]
          return {
            label: days <= 7 ? `${formatWeekdayShort(d.date)} ${Number(d.date.slice(8, 10))}` : formatDayMonth(d.date),
            title: partial && i === daily.length - 1 ? `${formatDay(d.date)} (so far)` : formatDay(d.date),
            prevTitle: prev ? `${formatDay(prev.date)}${partial && i === daily.length - 1 ? ' (same time)' : ''}` : undefined,
            current: pick(d),
            previous: prev ? pick(prev) : null,
          }
        })

  const peakHour = hoursOrdered.reduce<(typeof hoursOrdered)[number] | null>(
    (best, h) => (h.revenue > (best?.revenue ?? 0) ? h : best),
    null,
  )
  const hourBars: BarPoint[] = hoursOrdered.map((h) => ({
    label: formatHour(h.hour),
    title: `${formatHour(h.hour)} – ${formatHour(h.hour + 1)}`,
    value: h.revenue,
    rows: [
      { label: 'Sales', value: format(h.revenue) },
      { label: 'Orders', value: h.orders.toLocaleString(), muted: true },
      ...(h.orders > 0 ? [{ label: 'Avg order', value: format(h.revenue / h.orders), muted: true }] : []),
    ],
  }))

  const weekdayRows = weekday.map((w) => {
    const n = Math.max(1, num(w.days))
    return {
      dow: num(w.dow),
      days: num(w.days),
      avgRevenue: num(w.revenue) / n,
      avgOrders: num(w.orders) / n,
      revenue: num(w.revenue),
      orders: num(w.orders),
    }
  })
  const bestDay = weekdayRows.reduce<(typeof weekdayRows)[number] | null>(
    (best, w) => (w.avgRevenue > (best?.avgRevenue ?? 0) ? w : best),
    null,
  )
  const weekdayBars: BarPoint[] = weekdayRows.map((w) => ({
    label: WEEKDAY_LABELS[w.dow - 1] ?? String(w.dow),
    title: `${WEEKDAY_LABELS[w.dow - 1]} · average of ${w.days} day${w.days === 1 ? '' : 's'}`,
    value: Math.round(w.avgRevenue * 100) / 100,
    rows: [
      { label: 'Avg sales', value: format(w.avgRevenue) },
      { label: 'Avg orders', value: w.avgOrders.toFixed(1), muted: true },
      { label: 'Total sales', value: format(w.revenue), muted: true },
    ],
  }))

  const channelItems = channels.map((c) => {
    const meta = CHANNEL_META[c.channel]
    return {
      key: c.channel,
      label: meta?.label ?? titleCase(c.channel ?? 'Other'),
      color: SERIES[meta?.slot ?? 7],
      value: num(c.revenue),
      display: format(num(c.revenue)),
      detail: `${num(c.orders).toLocaleString()} orders`,
    }
  })
  const paymentItems = payments.map((m) => {
    const meta = PAYMENT_META[m.method]
    return {
      key: m.method,
      label: meta?.label ?? titleCase(m.method ?? 'Other'),
      color: SERIES[meta?.slot ?? 4],
      value: num(m.amount),
      display: format(num(m.amount)),
      detail: `${num(m.count).toLocaleString()} payments`,
    }
  })
  const hasAggregators = channels.some((c) => AGGREGATOR_CHANNELS.has(c.channel))

  const tips = num(s.tips)
  const showTips = tippingEnabled || tips > 0 || num(p.tips) > 0

  return (
    <>
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Sales"
          value={format(num(s.revenue))}
          current={num(s.revenue)}
          previous={num(p.revenue)}
          previousDisplay={format(num(p.revenue))}
          hint="Paid orders, after discounts, incl. tax"
          compareLabel={compareLabel}
        />
        <KpiCard
          icon={<Receipt className="h-4 w-4" />}
          label="Orders"
          value={orders.toLocaleString()}
          current={orders}
          previous={num(p.orders)}
          previousDisplay={num(p.orders).toLocaleString()}
          hint={days > 1 ? `${(orders / days).toFixed(1)} per day` : undefined}
          compareLabel={compareLabel}
        />
        <KpiCard
          icon={<Wallet className="h-4 w-4" />}
          label="Average order"
          value={format(num(s.avg_order_value))}
          current={num(s.avg_order_value)}
          previous={num(p.avg_order_value)}
          previousDisplay={format(num(p.avg_order_value))}
          compareLabel={compareLabel}
        />
        <KpiCard
          icon={<ShoppingBag className="h-4 w-4" />}
          label="Items sold"
          value={num(s.items_sold).toLocaleString()}
          current={num(s.items_sold)}
          previous={num(p.items_sold)}
          previousDisplay={num(p.items_sold).toLocaleString()}
          hint={orders > 0 ? `${(num(s.items_sold) / orders).toFixed(1)} per order` : undefined}
          compareLabel={compareLabel}
        />
      </div>

      {/* Secondary figures */}
      <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 sm:grid-cols-3 xl:grid-cols-6 [&>*]:border-zinc-800">
        <MiniStat label="Net of tax" value={format(num(s.net))} sub={`Tax ${format(num(s.tax))}`} />
        <MiniStat
          label="Discounts"
          value={format(num(s.discounts))}
          sub={`${num(s.discounted_orders)} order${num(s.discounted_orders) === 1 ? '' : 's'}`}
          delta={pctChange(num(s.discounts), num(p.discounts))}
          invert
        />
        {showTips ? (
          <MiniStat
            label="Tips"
            value={format(tips)}
            sub={`${num(s.tipped_orders)} tipped`}
            delta={pctChange(tips, num(p.tips))}
          />
        ) : (
          <MiniStat label="Gross (pre-discount)" value={format(num(s.subtotal))} sub="Item totals before tax" />
        )}
        <MiniStat
          label="Cancelled"
          value={num(s.cancelled_orders).toLocaleString()}
          sub={num(s.cancelled_orders) > 0 ? format(num(s.cancelled_value)) : 'None'}
          tone={num(s.cancelled_orders) > 0 ? 'warn' : undefined}
        />
        <MiniStat
          label="Unpaid / open"
          value={num(s.open_orders).toLocaleString()}
          sub={num(s.open_orders) > 0 ? `${format(num(s.open_value))} not counted` : 'All settled'}
          tone={num(s.open_orders) > 0 ? 'warn' : undefined}
        />
        <MiniStat
          label="Refunds"
          value={format(num(s.refunds))}
          sub={num(s.refunds) > 0 ? 'Refunded payments' : 'None'}
          tone={num(s.refunds) > 0 ? 'warn' : undefined}
        />
      </div>

      {!hasSales ? (
        <EmptyState preset={preset} onPreset={onPreset} openOrders={num(s.open_orders)} />
      ) : (
        <>
          {/* Trend */}
          <Panel
            title={days === 1 ? 'Sales through the day' : 'Sales trend'}
            subtitle={days === 1 ? 'By hour, compared with the previous day' : 'Each business day, compared with the previous period'}
            action={
              <Segmented
                value={metric}
                onChange={setMetric}
                options={[
                  { value: 'revenue', label: 'Sales' },
                  { value: 'orders', label: 'Orders' },
                ]}
              />
            }
          >
            <div className="mb-3 flex flex-wrap gap-4">
              <LegendItem label="This period" color={CHART.current} />
              <LegendItem label={`Previous (${compareLabel.replace(/^vs /, '')})`} color={CHART.previous} dashed />
            </div>
            <TrendChart
              data={trend}
              formatValue={fmtMetric}
              formatAxis={axisMetric}
              currentLabel="This period"
              previousLabel="Previous"
            />
          </Panel>

          {/* When */}
          <div className={cn('grid gap-4', days >= 7 && 'lg:grid-cols-2')}>
            <Panel
              title="Busiest hours"
              subtitle={
                peakHour
                  ? `Peak ${formatHour(peakHour.hour)}–${formatHour(peakHour.hour + 1)} · ${format(peakHour.revenue)}${days > 1 ? ' total' : ''}`
                  : 'Sales by hour of day'
              }
            >
              <ColumnChart data={hourBars} formatAxis={compactMoney} />
            </Panel>
            {days >= 7 && (
              <Panel
                title="Best days of the week"
                subtitle={
                  bestDay
                    ? `${WEEKDAY_LABELS[bestDay.dow - 1]} averages ${format(bestDay.avgRevenue)} a day`
                    : 'Average sales per weekday'
                }
              >
                <ColumnChart data={weekdayBars} formatAxis={compactMoney} />
              </Panel>
            )}
          </div>

          {/* How */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Sales by channel" subtitle="Dine-in, takeaway and delivery platforms">
              <ShareBar items={channelItems} />
            </Panel>
            <Panel title="Payment methods" subtitle="Completed payments on these orders">
              {paymentItems.length > 0 ? (
                <ShareBar items={paymentItems} />
              ) : (
                <p className="py-6 text-center text-sm text-zinc-500">No payments recorded</p>
              )}
              {hasAggregators && (
                <p className="mt-3 text-xs text-zinc-500">
                  Delivery-platform orders settled by the platform don’t appear here.
                </p>
              )}
            </Panel>
          </div>

          {/* What */}
          <div className="grid gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <ProductsPanel products={products} unsold={unsold} format={format} />
            </div>
            <div className="space-y-4 lg:col-span-2">
              <Panel title="Sales by category" subtitle="Item totals before order discounts">
                <BarList
                  items={categories.map((c) => ({
                    key: c.category_id ?? c.name,
                    label: c.name,
                    value: num(c.revenue),
                    display: format(num(c.revenue)),
                    detail: `${num(c.quantity).toLocaleString()} sold`,
                  }))}
                  emptyText="No items sold"
                />
              </Panel>
              <Panel title="Discounts" subtitle={`${format(num(s.discounts))} given across ${num(s.discounted_orders)} orders`}>
                <BarList
                  items={discounts.map((d) => ({
                    key: d.name,
                    label: d.name,
                    value: num(d.amount),
                    display: format(num(d.amount)),
                    detail: `${num(d.count)}×`,
                  }))}
                  emptyText="No discounts given in this period"
                />
              </Panel>
            </div>
          </div>
        </>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Products (top / slowest / not sold)
// ---------------------------------------------------------------------------

function ProductsPanel({
  products,
  unsold,
  format,
}: {
  products: ReportsOverview['products']
  unsold: ReportsOverview['unsold_products']
  format: (n: number) => string
}) {
  const [tab, setTab] = useState<'top' | 'slow' | 'unsold'>('top')
  const [sortBy, setSortBy] = useState<'revenue' | 'quantity'>('revenue')
  const [showAll, setShowAll] = useState(false)

  const total = products.reduce((sum, p) => sum + num(p.revenue), 0)
  const sorted = useMemo(() => {
    const list = [...products]
    if (tab === 'slow') {
      list.sort((a, b) => num(a.quantity) - num(b.quantity) || num(a.revenue) - num(b.revenue))
    } else {
      list.sort((a, b) =>
        sortBy === 'revenue'
          ? num(b.revenue) - num(a.revenue) || num(b.quantity) - num(a.quantity)
          : num(b.quantity) - num(a.quantity) || num(b.revenue) - num(a.revenue),
      )
    }
    return list
  }, [products, tab, sortBy])

  const LIMIT = 10
  const rows = showAll ? sorted : sorted.slice(0, LIMIT)
  const maxValue = Math.max(0, ...sorted.map((p) => (sortBy === 'revenue' || tab === 'slow' ? num(p.revenue) : num(p.quantity))))

  return (
    <Panel
      title="Menu performance"
      subtitle={`${products.length} item${products.length === 1 ? '' : 's'} sold${unsold.length ? ` · ${unsold.length} available item${unsold.length === 1 ? '' : 's'} didn’t sell` : ''}`}
      action={
        tab === 'top' ? (
          <Segmented
            value={sortBy}
            onChange={setSortBy}
            options={[
              { value: 'revenue', label: 'Sales' },
              { value: 'quantity', label: 'Qty' },
            ]}
          />
        ) : undefined
      }
    >
      <div className="mb-4 flex gap-1 rounded-lg bg-zinc-950/60 p-1">
        {(
          [
            { id: 'top', label: 'Best sellers' },
            { id: 'slow', label: 'Slowest' },
            { id: 'unsold', label: `Not sold${unsold.length ? ` (${unsold.length})` : ''}` },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id)
              setShowAll(false)
            }}
            className={cn(
              'h-10 flex-1 rounded-md px-3 text-sm font-medium transition-colors',
              tab === t.id ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-400 hover:text-zinc-200',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'unsold' ? (
        unsold.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">Every available item sold at least once. Nice.</p>
        ) : (
          <ul className="grid gap-x-6 sm:grid-cols-2">
            {unsold.map((u) => (
              <li key={u.product_id} className="flex items-center gap-3 border-b border-zinc-800/70 py-2.5 text-sm">
                <Package className="h-4 w-4 shrink-0 text-zinc-600" />
                <span className="min-w-0 flex-1 truncate text-zinc-200">{u.name}</span>
                <span className="shrink-0 text-xs text-zinc-500">{u.category}</span>
              </li>
            ))}
          </ul>
        )
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-500">No items sold</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-500">
                  <th className="w-8 pb-2 font-medium">#</th>
                  <th className="pb-2 font-medium">Item</th>
                  <th className="pb-2 text-right font-medium">Qty</th>
                  <th className="pb-2 text-right font-medium">Sales</th>
                  <th className="hidden w-28 pb-2 pl-4 font-medium sm:table-cell">Share</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p, i) => {
                  const share = total > 0 ? (num(p.revenue) / total) * 100 : 0
                  const barValue = sortBy === 'revenue' || tab === 'slow' ? num(p.revenue) : num(p.quantity)
                  return (
                    <tr key={p.product_id ?? `${p.name}-${i}`} className="border-b border-zinc-800/60 last:border-0">
                      <td className="py-2.5 text-xs text-zinc-500 tabular-nums">{i + 1}</td>
                      <td className="py-2.5 pr-3">
                        <div className="truncate text-zinc-100">{p.name}</div>
                        <div className="truncate text-xs text-zinc-500">{p.category}</div>
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-zinc-300">{num(p.quantity).toLocaleString()}</td>
                      <td className="py-2.5 text-right font-medium tabular-nums text-zinc-100">{format(num(p.revenue))}</td>
                      <td className="hidden py-2.5 pl-4 sm:table-cell">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${maxValue > 0 ? Math.max(2, (barValue / maxValue) * 100) : 0}%`,
                                backgroundColor: tab === 'slow' ? CHART.previous : CHART.current,
                              }}
                            />
                          </div>
                          <span className="w-10 text-right text-xs tabular-nums text-zinc-500">{share.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {sorted.length > LIMIT && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-3 h-10 w-full rounded-lg border border-zinc-800 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            >
              {showAll ? 'Show fewer' : `Show all ${sorted.length}`}
            </button>
          )}
        </>
      )}
    </Panel>
  )
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

function Panel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: Array<{ value: T; label: string }>
}) {
  return (
    <div className="flex rounded-lg bg-zinc-950/60 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'h-9 min-w-[64px] rounded-md px-3 text-sm font-medium transition-colors',
            value === o.value ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-400 hover:text-zinc-200',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function DeltaBadge({ delta, invert }: { delta: number | null; invert?: boolean }) {
  if (delta === null) {
    return <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-xs font-medium text-emerald-300">New</span>
  }
  if (Math.abs(delta) < 0.05) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-md bg-zinc-800 px-1.5 py-0.5 text-xs font-medium text-zinc-400">
        <Minus className="h-3 w-3" /> 0%
      </span>
    )
  }
  const up = delta > 0
  const good = invert ? !up : up
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums',
        good ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300',
      )}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(delta) >= 1000 ? '999+' : Math.abs(delta).toFixed(Math.abs(delta) < 10 ? 1 : 0)}%
    </span>
  )
}

function KpiCard({
  icon,
  label,
  value,
  current,
  previous,
  previousDisplay,
  hint,
  compareLabel,
}: {
  icon: ReactNode
  label: string
  value: string
  current: number
  previous: number
  previousDisplay: string
  hint?: string
  compareLabel: string
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2 text-zinc-400">
        <span className="text-sm font-medium">{label}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800/80 text-zinc-400">{icon}</span>
      </div>
      <div className="mt-2 truncate text-2xl font-semibold tracking-tight text-zinc-50 tabular-nums sm:text-3xl">{value}</div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
        <DeltaBadge delta={pctChange(current, previous)} />
        <span className="truncate">
          {compareLabel.replace(/^vs /, 'vs ')}: {previousDisplay}
        </span>
      </div>
      {hint && <div className="mt-1.5 text-xs text-zinc-500">{hint}</div>}
    </div>
  )
}

function MiniStat({
  label,
  value,
  sub,
  delta,
  invert,
  tone,
}: {
  label: string
  value: string
  sub?: string
  delta?: number | null
  invert?: boolean
  tone?: 'warn'
}) {
  return (
    <div className="border-b border-r p-4">
      <div className="text-xs font-medium text-zinc-500">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <span className={cn('text-lg font-semibold tabular-nums', tone === 'warn' ? 'text-amber-300' : 'text-zinc-100')}>
          {value}
        </span>
        {delta !== undefined && <DeltaBadge delta={delta} invert={invert} />}
      </div>
      {sub && <div className="mt-0.5 truncate text-xs text-zinc-500">{sub}</div>}
    </div>
  )
}

function Notice({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode
  title: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-6 sm:flex-row">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-800">{icon}</div>
      <div className="min-w-0 flex-1">
        <h2 className="font-semibold text-zinc-100">{title}</h2>
        <p className="mt-1 text-sm text-zinc-400">{children}</p>
      </div>
      {action}
    </div>
  )
}

function EmptyState({
  preset,
  onPreset,
  openOrders,
}: {
  preset: PresetId
  onPreset: (p: PresetId) => void
  openOrders: number
}) {
  const suggestions = (['last_7', 'last_30'] as const).filter((p) => p !== preset)
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-zinc-800 bg-zinc-900/50 px-6 py-14 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800">
        <Receipt className="h-6 w-6 text-zinc-500" />
      </div>
      <h2 className="text-lg font-semibold text-zinc-100">No paid orders in this period</h2>
      <p className="mt-1 max-w-md text-sm text-zinc-500">
        {openOrders > 0
          ? `There ${openOrders === 1 ? 'is 1 open order' : `are ${openOrders} open orders`} — they’ll show here once paid.`
          : 'Charts and menu insights appear as soon as the first order is paid.'}
      </p>
      {suggestions.length > 0 && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {suggestions.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPreset(p)}
              className="h-11 rounded-lg border border-zinc-700 bg-zinc-800 px-4 text-sm font-medium text-zinc-200 hover:bg-zinc-700"
            >
              View {PRESETS.find((x) => x.id === p)?.label.toLowerCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function QuickLink({ to, icon, title, subtitle }: { to: string; icon: ReactNode; title: string; subtitle: string }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4 transition-all hover:border-emerald-500/40 hover:bg-zinc-900/80"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-zinc-100">{title}</div>
        <div className="mt-0.5 text-xs text-zinc-500">{subtitle}</div>
      </div>
      <ChevronRight className="h-4 w-4 text-zinc-600 transition-colors group-hover:text-zinc-300" />
    </Link>
  )
}

function ReportSkeleton() {
  const block = 'animate-pulse rounded-xl border border-zinc-800 bg-zinc-900'
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading reports">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={cn(block, 'h-[132px] p-5')}>
            <div className="h-3 w-20 rounded bg-zinc-800" />
            <div className="mt-4 h-7 w-28 rounded bg-zinc-800" />
            <div className="mt-4 h-3 w-32 rounded bg-zinc-800/70" />
          </div>
        ))}
      </div>
      <div className={cn(block, 'h-[86px]')} />
      <div className={cn(block, 'h-[340px]')} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={cn(block, 'h-[290px]')} />
        <div className={cn(block, 'h-[290px]')} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

function exportCsv(data: ReportsOverview) {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const money = (v: unknown) => num(v).toFixed(2)
  const lines: string[] = []
  const section = (title: string, header: string[], rows: unknown[][]) => {
    lines.push(esc(title))
    lines.push(header.map(esc).join(','))
    rows.forEach((r) => lines.push(r.map(esc).join(',')))
    lines.push('')
  }
  const s = data.summary
  const p = data.previous
  const r = data.range

  section('Summary', ['Metric', `${r.start} to ${r.end}`, `${r.prev_start} to ${r.prev_end}`], [
    ['Sales', money(s.revenue), money(p.revenue)],
    ['Orders', num(s.orders), num(p.orders)],
    ['Average order', money(s.avg_order_value), money(p.avg_order_value)],
    ['Items sold', num(s.items_sold), num(p.items_sold)],
    ['Net of tax', money(s.net), money(p.net)],
    ['Tax', money(s.tax), ''],
    ['Discounts', money(s.discounts), money(p.discounts)],
    ['Tips', money(s.tips), money(p.tips)],
    ['Cancelled orders', num(s.cancelled_orders), ''],
    ['Cancelled value', money(s.cancelled_value), ''],
    ['Open (unpaid) orders', num(s.open_orders), ''],
    ['Refunds', money(s.refunds), ''],
  ])
  section(
    'Daily sales',
    ['Date', 'Orders', 'Sales'],
    arr<ReportsOverview['daily'][number]>(data.daily).map((d) => [d.date, num(d.orders), money(d.revenue)]),
  )
  section(
    'Sales by hour',
    ['Hour', 'Orders', 'Sales'],
    arr<ReportsOverview['hourly'][number]>(data.hourly).map((h) => [
      `${String(h.hour).padStart(2, '0')}:00`,
      num(h.orders),
      money(h.revenue),
    ]),
  )
  section(
    'Products',
    ['Item', 'Category', 'Quantity', 'Sales'],
    arr<ReportsOverview['products'][number]>(data.products).map((x) => [x.name, x.category, num(x.quantity), money(x.revenue)]),
  )
  section(
    'Categories',
    ['Category', 'Quantity', 'Sales'],
    arr<ReportsOverview['categories'][number]>(data.categories).map((c) => [c.name, num(c.quantity), money(c.revenue)]),
  )
  section(
    'Channels',
    ['Channel', 'Orders', 'Sales'],
    arr<ReportsOverview['channels'][number]>(data.channels).map((c) => [
      CHANNEL_META[c.channel]?.label ?? c.channel,
      num(c.orders),
      money(c.revenue),
    ]),
  )
  section(
    'Payment methods',
    ['Method', 'Payments', 'Amount'],
    arr<ReportsOverview['payment_methods'][number]>(data.payment_methods).map((m) => [
      PAYMENT_META[m.method]?.label ?? m.method,
      num(m.count),
      money(m.amount),
    ]),
  )
  section(
    'Discounts',
    ['Discount', 'Orders', 'Amount'],
    arr<ReportsOverview['discounts'][number]>(data.discounts).map((d) => [d.name, num(d.count), money(d.amount)]),
  )

  const blob = new Blob(['﻿', lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `report_${r.start}_to_${r.end}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

