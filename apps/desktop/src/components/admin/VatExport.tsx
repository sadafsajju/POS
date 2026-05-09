import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { Loader2, Download, AlertCircle, FileSpreadsheet } from 'lucide-react'
import { reportsDb } from '@pos/supabase'
import { useSettingsStore } from '@pos/core'
import { formatCurrency, todayInTz } from '@/lib/utils'

interface VatLine {
  business_date: string
  order_id: string
  order_number: string
  order_type: string | null
  dining_mode: string | null
  customer_name: string | null
  payment_method: string | null
  order_source: string | null
  vat_rate: number
  net_amount: number
  vat_amount: number
  gross_amount: number
  item_count: number
}

interface VatRateRow {
  vat_rate: number
  net_total: number
  vat_total: number
  gross_total: number
  order_count: number
}

interface VatExportData {
  period_start: string
  period_end: string
  timezone: string
  location_id: string | null
  summary: {
    box_1_vat_due_sales: number
    box_6_total_sales_ex_vat: number
    gross_total: number
    order_count: number
    item_count: number
  }
  by_rate: VatRateRow[]
  lines: VatLine[]
}

/**
 * Default to the current calendar quarter — most UK VAT returns are quarterly.
 */
function currentQuarter(today: string): { start: string; end: string } {
  const d = new Date(today + 'T00:00:00Z')
  const month = d.getUTCMonth()
  const quarterStartMonth = Math.floor(month / 3) * 3
  const start = new Date(Date.UTC(d.getUTCFullYear(), quarterStartMonth, 1))
  const end = new Date(Date.UTC(d.getUTCFullYear(), quarterStartMonth + 3, 0))
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function buildCsv(data: VatExportData, restaurantName: string, vatNumber: string | undefined): string {
  // RFC 4180-style CSV. The summary block at the top makes the file readable
  // both as a flat sheet (skip 5 lines) and as a human-checkable document.
  const headerLines = [
    `# VAT Sales Export`,
    `# Business: ${restaurantName}`,
    `# VAT Number: ${vatNumber ?? '—'}`,
    `# Period: ${data.period_start} to ${data.period_end} (${data.timezone})`,
    `# Box 1 (VAT due on sales): ${data.summary.box_1_vat_due_sales.toFixed(2)}`,
    `# Box 6 (Total sales ex VAT): ${data.summary.box_6_total_sales_ex_vat}`,
    `# Gross total: ${data.summary.gross_total.toFixed(2)}`,
    `# Orders: ${data.summary.order_count}`,
    `#`,
  ]

  const columns = [
    'business_date',
    'order_number',
    'order_type',
    'dining_mode',
    'order_source',
    'payment_method',
    'customer_name',
    'vat_rate',
    'net_amount',
    'vat_amount',
    'gross_amount',
    'item_count',
  ]

  const rows = data.lines.map(line => columns.map(c => csvEscape((line as any)[c])).join(','))
  return [...headerLines, columns.join(','), ...rows].join('\r\n') + '\r\n'
}

function downloadCsv(content: string, filename: string): void {
  // Prepend BOM so Excel reads UTF-8 special characters (£, €) correctly.
  const blob = new Blob(['﻿', content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function VatExport() {
  const { settings } = useSettingsStore()
  const format = (n: number) => formatCurrency(n, settings.currency, settings.currencySymbol)
  const today = todayInTz(settings.timezone)
  const initial = useMemo(() => currentQuarter(today), [today])

  const [periodStart, setPeriodStart] = useState(initial.start)
  const [periodEnd, setPeriodEnd] = useState(initial.end)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['vat-export', periodStart, periodEnd],
    queryFn: async () => {
      const res = await reportsDb.getVatExport({ period_start: periodStart, period_end: periodEnd })
      if (!res.success) throw new Error(res.message || 'Failed to load VAT export')
      return res.data as VatExportData
    },
  })

  const handleDownload = () => {
    if (!data) return
    const csv = buildCsv(data, settings.restaurantName, settings.vatNumber)
    const filename = `vat-export-${data.period_start}-to-${data.period_end}.csv`
    downloadCsv(csv, filename)
  }

  if (settings.taxRegime !== 'uk_vat') {
    return (
      <div className="h-full overflow-y-auto bg-zinc-950 text-zinc-100 p-6">
        <div className="max-w-3xl mx-auto">
        <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              VAT Export
            </CardTitle>
            <CardDescription>
              This report is only available when the tax regime is set to UK VAT.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-500">
              Switch to UK VAT in Settings → Financial to enable MTD-compatible sales export.
            </p>
          </CardContent>
        </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-zinc-950 text-zinc-100 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">VAT Export</h2>
          <p className="text-sm text-zinc-500 mt-1">
            MTD-compatible sales export. Hand the CSV to your accountant or upload it into bridging software.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="text-xs font-medium text-zinc-400 mb-1 block">From</label>
            <DatePicker value={periodStart} onChange={setPeriodStart} max={today} className="w-40" />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-400 mb-1 block">To</label>
            <DatePicker value={periodEnd} onChange={setPeriodEnd} max={today} className="w-40" />
          </div>
          <Button variant="outline" size="sm" className="bg-zinc-800 text-zinc-200 border-zinc-700 hover:bg-zinc-700 hover:text-zinc-100" onClick={() => {
            const q = currentQuarter(today)
            setPeriodStart(q.start)
            setPeriodEnd(q.end)
          }}>This quarter</Button>
        </div>
      </div>

      {isError && (
        <div className="p-4 bg-red-500/15 text-red-400 border border-red-500/20 rounded-lg flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4" />
          {(error as Error)?.message || 'Failed to load VAT export'}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-600" />
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
              <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-zinc-500">Box 1 — VAT due</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold tabular-nums">{format(data.summary.box_1_vat_due_sales)}</div></CardContent>
            </Card>
            <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
              <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-zinc-500">Box 6 — Sales ex VAT</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums">{format(data.summary.box_6_total_sales_ex_vat)}</div>
                <div className="text-[10px] text-zinc-500 mt-1">Whole pounds (HMRC rule)</div>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
              <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-zinc-500">Gross total</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold tabular-nums">{format(data.summary.gross_total)}</div></CardContent>
            </Card>
            <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
              <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-zinc-500">Orders</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold tabular-nums">{data.summary.order_count}</div></CardContent>
            </Card>
          </div>

          <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
            <CardHeader>
              <CardTitle className="text-base">Breakdown by VAT rate</CardTitle>
              <CardDescription>What an MTD bridge needs as the minimum input.</CardDescription>
            </CardHeader>
            <CardContent>
              {data.by_rate.length === 0 ? (
                <p className="text-sm text-zinc-500">No qualifying orders in this period.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-zinc-500 border-b border-zinc-800">
                      <th className="text-left py-2 font-medium">Rate</th>
                      <th className="text-right py-2 font-medium">Orders</th>
                      <th className="text-right py-2 font-medium">Net</th>
                      <th className="text-right py-2 font-medium">VAT</th>
                      <th className="text-right py-2 font-medium">Gross</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_rate.map(r => (
                      <tr key={r.vat_rate} className="border-b border-zinc-800/50">
                        <td className="py-2 font-medium">{r.vat_rate}%</td>
                        <td className="py-2 text-right tabular-nums">{r.order_count}</td>
                        <td className="py-2 text-right tabular-nums">{format(r.net_total)}</td>
                        <td className="py-2 text-right tabular-nums">{format(r.vat_total)}</td>
                        <td className="py-2 text-right tabular-nums">{format(r.gross_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-zinc-500">
              {data.summary.item_count} line items · {data.summary.order_count} orders · {data.timezone}
            </p>
            <Button onClick={handleDownload} disabled={data.lines.length === 0} className="bg-emerald-600 text-white hover:bg-emerald-500">
              <Download className="w-4 h-4 mr-2" />
              Download CSV
            </Button>
          </div>
        </>
      ) : null}
      </div>
    </div>
  )
}
