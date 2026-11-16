import { useId } from 'react'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { cn } from '@/lib/utils'

/**
 * Chart colours for the dark zinc surface (zinc-900 cards). The categorical
 * slots are a validated dark-mode palette (adjacent-pair CVD ΔE ≥ 8.4,
 * ≥ 3:1 against #18181b) — assign by entity in a fixed order, never by rank.
 */
export const CHART = {
  current: '#10b981', // emerald-500, the app accent: "this period"
  currentSoft: '#047857', // emerald-700, non-peak bars
  previous: '#71717a', // zinc-500, the comparison period
  grid: '#27272a', // zinc-800
  axis: '#71717a', // zinc-500
  cursor: 'rgba(63, 63, 70, 0.35)', // zinc-700 @ 35%
}

export const SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#0ca30c', '#9085e9', '#e66767']

const axisTick = { fill: CHART.axis, fontSize: 12 }

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

export interface TooltipRow {
  label: string
  value: string
  color?: string
  dashed?: boolean
  muted?: boolean
}

export function TooltipCard({ title, rows }: { title: string; rows: TooltipRow[] }) {
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-950/95 px-3 py-2 shadow-xl backdrop-blur text-xs min-w-[150px]">
      <div className="font-medium text-zinc-200 mb-1.5">{title}</div>
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-zinc-400">
              {r.color && (
                <span
                  className="inline-block w-3 h-0.5 rounded-full"
                  style={
                    r.dashed
                      ? { backgroundImage: `linear-gradient(90deg, ${r.color} 60%, transparent 60%)`, backgroundSize: '4px 2px' }
                      : { backgroundColor: r.color }
                  }
                />
              )}
              {r.label}
            </span>
            <span className={cn('tabular-nums', r.muted ? 'text-zinc-400' : 'text-zinc-100 font-medium')}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Legend chip shown above a chart: solid swatch for current, dashed for previous. */
export function LegendItem({ label, color, dashed }: { label: string; color: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
      <span
        className="inline-block w-4 h-0.5 rounded-full"
        style={
          dashed
            ? { backgroundImage: `linear-gradient(90deg, ${color} 55%, transparent 55%)`, backgroundSize: '5px 2px' }
            : { backgroundColor: color }
        }
      />
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Trend (area = this period, dashed line = previous period)
// ---------------------------------------------------------------------------

export interface TrendPoint {
  /** Axis label */
  label: string
  /** Tooltip heading for the current point */
  title: string
  /** Tooltip label for the matching previous point */
  prevTitle?: string
  /** null = hasn't happened yet (rest of today) */
  current: number | null
  previous: number | null
}

export function TrendChart({
  data,
  formatValue,
  formatAxis,
  currentLabel,
  previousLabel,
  height = 260,
}: {
  data: TrendPoint[]
  formatValue: (n: number) => string
  formatAxis: (n: number) => string
  currentLabel: string
  previousLabel: string
  height?: number
}) {
  const gradientId = useId().replace(/:/g, '')

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART.current} stopOpacity={0.28} />
            <stop offset="100%" stopColor={CHART.current} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={CHART.grid} />
        <XAxis
          dataKey="label"
          tick={axisTick}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={16}
          tickMargin={8}
          padding={{ left: 12, right: 12 }}
        />
        <YAxis
          tick={axisTick}
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={formatAxis}
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ stroke: CHART.axis, strokeWidth: 1, strokeDasharray: '3 3' }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const p = payload[0].payload as TrendPoint
            const rows: TooltipRow[] = []
            if (p.current !== null) rows.push({ label: currentLabel, value: formatValue(p.current), color: CHART.current })
            if (p.previous !== null) {
              rows.push({
                label: p.prevTitle ?? previousLabel,
                value: formatValue(p.previous),
                color: CHART.previous,
                dashed: true,
                muted: true,
              })
              if (p.current !== null && p.previous > 0) {
                const d = ((p.current - p.previous) / p.previous) * 100
                rows.push({ label: 'Change', value: `${d >= 0 ? '+' : ''}${d.toFixed(1)}%`, muted: true })
              }
            }
            return <TooltipCard title={p.title} rows={rows} />
          }}
        />
        <Line
          type="monotone"
          dataKey="previous"
          stroke={CHART.previous}
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={false}
          activeDot={{ r: 4, fill: CHART.previous, stroke: '#18181b', strokeWidth: 2 }}
          isAnimationActive={false}
          connectNulls
        />
        <Area
          type="monotone"
          dataKey="current"
          stroke={CHART.current}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={data.length === 1 ? { r: 4, fill: CHART.current } : false}
          activeDot={{ r: 5, fill: CHART.current, stroke: '#18181b', strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Single-series bars (hour of day, day of week). The peak bar is lit.
// ---------------------------------------------------------------------------

export interface BarPoint {
  label: string
  title: string
  value: number
  rows: TooltipRow[]
}

export function ColumnChart({
  data,
  formatAxis,
  height = 220,
}: {
  data: BarPoint[]
  formatAxis: (n: number) => string
  height?: number
}) {
  const peak = Math.max(0, ...data.map((d) => d.value))
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="18%">
        <CartesianGrid vertical={false} stroke={CHART.grid} />
        <XAxis
          dataKey="label"
          tick={axisTick}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={12}
          tickMargin={8}
        />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} width={56} tickFormatter={formatAxis} allowDecimals={false} />
        <Tooltip
          cursor={{ fill: CHART.cursor }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const p = payload[0].payload as BarPoint
            return <TooltipCard title={p.title} rows={p.rows} />
          }}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.label} fill={peak > 0 && d.value === peak ? CHART.current : CHART.currentSoft} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Share bar: one 100% bar split by entity, with a legend table beneath.
// ---------------------------------------------------------------------------

export interface ShareItem {
  key: string
  label: string
  color: string
  value: number
  /** Right-aligned primary figure (e.g. formatted amount) */
  display: string
  /** Secondary figure (e.g. "42 orders") */
  detail?: string
}

export function ShareBar({ items }: { items: ShareItem[] }) {
  const total = items.reduce((s, i) => s + Math.max(0, i.value), 0)
  return (
    <div className="space-y-4">
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-zinc-800">
        {total > 0 &&
          items
            .filter((i) => i.value > 0)
            .map((i) => (
              <div
                key={i.key}
                className="h-full first:rounded-l-full last:rounded-r-full"
                style={{ width: `${(i.value / total) * 100}%`, backgroundColor: i.color }}
                title={`${i.label}: ${i.display}`}
              />
            ))}
      </div>
      <ul className="divide-y divide-zinc-800/80">
        {items.map((i) => {
          const pct = total > 0 ? (i.value / total) * 100 : 0
          return (
            <li key={i.key} className="flex items-center gap-3 py-2.5 text-sm">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: i.color }} />
              <span className="flex-1 min-w-0 truncate text-zinc-200">{i.label}</span>
              {i.detail && <span className="hidden sm:inline text-xs text-zinc-500 tabular-nums">{i.detail}</span>}
              <span className="w-12 text-right text-xs text-zinc-400 tabular-nums">{pct.toFixed(0)}%</span>
              <span className="w-24 text-right font-medium text-zinc-100 tabular-nums">{i.display}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Horizontal bar list (categories, discounts)
// ---------------------------------------------------------------------------

export interface BarListItem {
  key: string
  label: string
  value: number
  display: string
  detail?: string
  color?: string
}

export function BarList({ items, emptyText }: { items: BarListItem[]; emptyText?: string }) {
  const max = Math.max(0, ...items.map((i) => i.value))
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-zinc-500">{emptyText ?? 'Nothing to show'}</p>
  }
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.key}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 text-zinc-200">
              {i.color && <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: i.color }} />}
              <span className="truncate">{i.label}</span>
            </span>
            <span className="flex shrink-0 items-baseline gap-3">
              {i.detail && <span className="text-xs text-zinc-500 tabular-nums">{i.detail}</span>}
              <span className="font-medium text-zinc-100 tabular-nums">{i.display}</span>
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full"
              style={{ width: `${max > 0 ? Math.max(2, (i.value / max) * 100) : 0}%`, backgroundColor: CHART.current }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
