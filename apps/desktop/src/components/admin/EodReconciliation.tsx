import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { DatePicker } from '@/components/ui/date-picker'
import { Loader2, Printer, Save, AlertCircle, CheckCircle2 } from 'lucide-react'
import { reportsDb, ordersDb } from '@pos/supabase'
import { useSettingsStore } from '@pos/core'
import { formatCurrency, todayInTz } from '@/lib/utils'
import { getPlatform } from '@/lib/platforms'
import type { EodReconciliationData, TipPoolData } from '@pos/types'

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  credit_card: 'Credit card',
  debit_card: 'Debit card',
  digital_wallet: 'Digital wallet',
}

interface EodReconciliationProps {
  /** When provided, the date picker hides and the parent owns the date. */
  date?: string
  /** When true, render without the page chrome (title, padding, max-width) — used when embedded. */
  embedded?: boolean
}

export function EodReconciliation({ date: externalDate, embedded = false }: EodReconciliationProps = {}) {
  const queryClient = useQueryClient()
  const { settings } = useSettingsStore()
  const format = (n: number) => formatCurrency(n, settings.currency, settings.currencySymbol)

  const [internalDate, setInternalDate] = useState<string>(todayInTz(settings.timezone))
  const date = externalDate ?? internalDate
  const setDate = setInternalDate
  const isControlled = externalDate !== undefined

  // Manager-entered values (live, before save)
  const [pedTotal, setPedTotal] = useState<string>('')
  const [cashCounted, setCashCounted] = useState<string>('')
  const [openingFloat, setOpeningFloat] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; message: string } | null>(null)

  const queryKey = ['eod', date]
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await reportsDb.getEodReconciliation({ date })
      if (!res.success) throw new Error(res.message || 'Failed to load EOD data')
      return res.data as EodReconciliationData
    },
  })

  // Tips for the day (only when tipping is enabled)
  const tipQuery = useQuery({
    queryKey: ['eod-tips', date],
    enabled: settings.tippingEnabled,
    queryFn: async () => {
      const res = await ordersDb.getTipPool({ period_start: date, period_end: date })
      if (!res.success) throw new Error(res.message || 'Failed to load tips')
      return res.data as TipPoolData
    },
  })

  // Hydrate manager inputs from existing recorded reconciliation when date changes
  useEffect(() => {
    if (!data) return
    const r = data.recorded
    setPedTotal(r?.ped_settlement_total != null ? String(r.ped_settlement_total) : '')
    setCashCounted(r?.cash_drawer_counted != null ? String(r.cash_drawer_counted) : '')
    setOpeningFloat(r?.opening_float != null ? String(r.opening_float) : '')
    setNotes(r?.notes ?? '')
    setFeedback(null)
  }, [data?.recorded?.id, date]) // eslint-disable-line react-hooks/exhaustive-deps

  // Computed totals from the live breakdown (independent of saved record)
  const totals = useMemo(() => {
    if (!data) return null
    const cardMethods = data.payment_methods.filter(m =>
      m.payment_method === 'credit_card' || m.payment_method === 'debit_card'
    )
    const cashMethod = data.payment_methods.find(m => m.payment_method === 'cash')
    const posCardTotal = cardMethods.reduce((s, m) => s + Number(m.amount || 0), 0)
    const posCashTotal = Number(cashMethod?.amount || 0)
    const opening = parseFloat(openingFloat) || 0
    const expectedDrawer = opening + posCashTotal
    const enteredPed = pedTotal === '' ? null : parseFloat(pedTotal)
    const enteredCash = cashCounted === '' ? null : parseFloat(cashCounted)
    const cardVariance = enteredPed === null || Number.isNaN(enteredPed) ? null : enteredPed - posCardTotal
    const cashVariance = enteredCash === null || Number.isNaN(enteredCash) ? null : enteredCash - expectedDrawer
    return { posCardTotal, posCashTotal, expectedDrawer, cardVariance, cashVariance }
  }, [data, pedTotal, cashCounted, openingFloat])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await reportsDb.recordEodReconciliation({
        businessDate: date,
        pedSettlementTotal: pedTotal === '' ? null : parseFloat(pedTotal),
        cashDrawerCounted: cashCounted === '' ? null : parseFloat(cashCounted),
        openingFloat: openingFloat === '' ? null : parseFloat(openingFloat),
        notes: notes || null,
      })
      if (!res.success) throw new Error(res.message || 'Failed to save')
      return res.data
    },
    onSuccess: () => {
      setFeedback({ kind: 'ok', message: 'Reconciliation saved' })
      queryClient.invalidateQueries({ queryKey })
    },
    onError: (e: any) => {
      setFeedback({ kind: 'err', message: e?.message ?? 'Failed to save' })
    },
  })

  const handlePrint = () => {
    window.print()
  }

  if (isLoading) {
    const loader = (
      <div className={embedded ? 'flex items-center justify-center py-8' : 'h-full bg-zinc-950 text-zinc-100 flex items-center justify-center'}>
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    )
    return loader
  }
  if (isError || !data) {
    return (
      <div className={embedded ? 'p-6 text-center text-zinc-400' : 'h-full bg-zinc-950 text-zinc-100 p-6 text-center'}>
        Failed to load report.
        <div className="mt-3">
          <Button variant="outline" className="bg-zinc-800 text-zinc-200 border-zinc-700 hover:bg-zinc-700 hover:text-zinc-100" onClick={() => refetch()}>Retry</Button>
        </div>
      </div>
    )
  }

  const summary = data.summary

  const body = (
    <div className="space-y-6">
      {!isControlled && (
        <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Day-end report</h1>
            <p className="text-sm text-muted-foreground">
              Reconcile POS totals against PED settlement and cash drawer count.
            </p>
          </div>
          <div className="flex items-end gap-3">
            <div>
              <label className="text-xs font-medium text-zinc-400 mb-1 block">Date</label>
              <DatePicker
                value={date}
                onChange={setDate}
                max={todayInTz(settings.timezone)}
                className="w-44"
              />
            </div>
            <Button variant="outline" className="bg-zinc-800 text-zinc-200 border-zinc-700 hover:bg-zinc-700 hover:text-zinc-100" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
          </div>
        </div>
      )}

      {/* Headline */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-zinc-500">Revenue</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{format(summary.revenue)}</div></CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-zinc-500">Orders</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{summary.orders_count}</div></CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-zinc-500">Tax / VAT</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{format(summary.tax_total)}</div></CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-zinc-500">Discounts</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{format(summary.discount_total)}</div></CardContent>
        </Card>
      </div>

      {/* Card reconciliation */}
      <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
        <CardHeader>
          <CardTitle className="text-base">Card payments</CardTitle>
          <CardDescription>
            POS recorded card total vs the PED settlement statement.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <div className="text-xs uppercase text-zinc-500 mb-1">POS card total</div>
            <div className="text-2xl font-bold tabular-nums">{format(totals?.posCardTotal ?? 0)}</div>
          </div>
          <div>
            <label className="text-xs uppercase text-zinc-500 mb-1 block">PED settlement total</label>
            <Input
              type="number"
              step="0.01"
              value={pedTotal}
              onChange={(e) => setPedTotal(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
              className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-zinc-600"
            />
          </div>
          <VarianceBadge value={totals?.cardVariance ?? null} format={format} />
        </CardContent>
      </Card>

      {/* Cash reconciliation */}
      <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
        <CardHeader>
          <CardTitle className="text-base">Cash drawer</CardTitle>
          <CardDescription>
            Expected = opening float + cash payments. Variance = counted − expected.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="text-xs uppercase text-zinc-500 mb-1 block">Opening float</label>
            <Input
              type="number"
              step="0.01"
              value={openingFloat}
              onChange={(e) => setOpeningFloat(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
              className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-zinc-600"
            />
          </div>
          <div>
            <div className="text-xs uppercase text-zinc-500 mb-1">Cash collected</div>
            <div className="text-2xl font-bold tabular-nums">{format(totals?.posCashTotal ?? 0)}</div>
            <div className="text-xs text-zinc-500 mt-0.5">Expected: {format(totals?.expectedDrawer ?? 0)}</div>
          </div>
          <div>
            <label className="text-xs uppercase text-zinc-500 mb-1 block">Counted in drawer</label>
            <Input
              type="number"
              step="0.01"
              value={cashCounted}
              onChange={(e) => setCashCounted(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
              className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-zinc-600"
            />
          </div>
          <VarianceBadge value={totals?.cashVariance ?? null} format={format} />
        </CardContent>
      </Card>

      {/* Per payment method */}
      <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
        <CardHeader>
          <CardTitle className="text-base">Payment methods</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-zinc-500">
              <tr>
                <th className="text-left font-medium pb-2">Method</th>
                <th className="text-right font-medium pb-2">Count</th>
                <th className="text-right font-medium pb-2">Amount</th>
                <th className="text-right font-medium pb-2 hidden sm:table-cell">Cash received</th>
                <th className="text-right font-medium pb-2 hidden sm:table-cell">Change given</th>
              </tr>
            </thead>
            <tbody>
              {data.payment_methods.length === 0 && (
                <tr><td colSpan={5} className="text-zinc-500 py-2">No completed payments.</td></tr>
              )}
              {data.payment_methods.map(m => (
                <tr key={m.payment_method} className="border-t border-zinc-800">
                  <td className="py-2">{PAYMENT_METHOD_LABELS[m.payment_method] ?? m.payment_method}</td>
                  <td className="py-2 text-right tabular-nums">{m.count}</td>
                  <td className="py-2 text-right tabular-nums font-semibold">{format(Number(m.amount))}</td>
                  <td className="py-2 text-right tabular-nums hidden sm:table-cell">
                    {m.payment_method === 'cash' ? format(Number(m.cash_received)) : '—'}
                  </td>
                  <td className="py-2 text-right tabular-nums hidden sm:table-cell">
                    {m.payment_method === 'cash' ? format(Number(m.change_given)) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Order sources */}
      <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
        <CardHeader>
          <CardTitle className="text-base">Order sources</CardTitle>
          <CardDescription>Tick aggregator rows off against each platform's own statement.</CardDescription>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-zinc-500">
              <tr>
                <th className="text-left font-medium pb-2">Source</th>
                <th className="text-right font-medium pb-2">Count</th>
                <th className="text-right font-medium pb-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.order_sources.length === 0 && (
                <tr><td colSpan={3} className="text-zinc-500 py-2">No completed orders.</td></tr>
              )}
              {data.order_sources.map(s => {
                const platform = getPlatform(s.order_source)
                return (
                  <tr key={s.order_source} className="border-t border-zinc-800">
                    <td className="py-2">
                      {platform ? (
                        <Badge variant="outline" className={platform.badgeClass}>{platform.label}</Badge>
                      ) : (
                        <span className="capitalize">{String(s.order_source).replace('_', ' ')}</span>
                      )}
                    </td>
                    <td className="py-2 text-right tabular-nums">{s.count}</td>
                    <td className="py-2 text-right tabular-nums font-semibold">{format(Number(s.amount))}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Tips (UK Tipping Act 2023) */}
      {settings.tippingEnabled && tipQuery.data && (
        <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
          <CardHeader>
            <CardTitle className="text-base">Tips</CardTitle>
            <CardDescription>
              Pool for {date}. Allocate to staff on the
              {' '}
              <a href="/admin/tips" className="text-emerald-400 underline">tips page</a>.
              {tipQuery.data.allocation?.locked_at && ' Allocation locked.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-6 flex-wrap">
              <div>
                <div className="text-xs uppercase text-zinc-500 mb-1">Total tips</div>
                <div className="text-2xl font-bold text-emerald-400">{format(tipQuery.data.total_tips)}</div>
              </div>
              {tipQuery.data.by_method.map(m => (
                <div key={m.tip_method ?? 'unknown'}>
                  <div className="text-xs uppercase text-zinc-500 mb-1">
                    {m.tip_method ?? 'unspecified'} · {m.count}
                  </div>
                  <div className="text-lg font-semibold">{format(Number(m.amount))}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Voids + refunds */}
      {(data.voids.length > 0 || data.refunds.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
            <CardHeader>
              <CardTitle className="text-base">Voids / cancellations</CardTitle>
            </CardHeader>
            <CardContent>
              {data.voids.length === 0 ? (
                <p className="text-sm text-zinc-500">None.</p>
              ) : (
                <ul className="text-sm space-y-1">
                  {data.voids.map(v => (
                    <li key={v.id} className="flex justify-between gap-2">
                      <span className="text-zinc-400">#{v.order_number}</span>
                      <span className="tabular-nums">{format(Number(v.total_amount))}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
            <CardHeader>
              <CardTitle className="text-base">Refunds</CardTitle>
            </CardHeader>
            <CardContent>
              {data.refunds.length === 0 ? (
                <p className="text-sm text-zinc-500">None.</p>
              ) : (
                <ul className="text-sm space-y-1">
                  {data.refunds.map(r => (
                    <li key={r.id} className="flex justify-between gap-2">
                      <span className="text-zinc-400">
                        #{r.order_number} <span className="text-zinc-600">· {r.payment_method}</span>
                      </span>
                      <span className="tabular-nums">{format(Number(r.amount))}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Notes + save */}
      <Card className="bg-zinc-900 border-zinc-800 text-zinc-100 print:hidden">
        <CardHeader>
          <CardTitle className="text-base">Notes &amp; save</CardTitle>
          <CardDescription>
            Saving creates an audit row stamped with your user ID and the variance snapshot.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-xs uppercase text-zinc-500 mb-1 block">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Anything unusual about today's cash-up? Float carried over? Discrepancy explanation?"
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
          </div>
          {feedback && (
            <div className={`flex items-center gap-2 text-sm ${feedback.kind === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
              {feedback.kind === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {feedback.message}
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="bg-emerald-600 text-white hover:bg-emerald-500">
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save reconciliation
            </Button>
          </div>
          {data.recorded?.recorded_by && (
            <p className="text-xs text-zinc-500">
              Last saved {new Date(data.recorded.updated_at).toLocaleString('en-GB', { timeZone: settings.timezone })}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )

  if (embedded) return body
  return (
    <div className="h-full overflow-y-auto bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-5xl mx-auto">{body}</div>
    </div>
  )
}

function VarianceBadge({ value, format }: { value: number | null; format: (n: number) => string }) {
  if (value === null || Number.isNaN(value)) {
    return (
      <div>
        <div className="text-xs uppercase text-zinc-500 mb-1">Variance</div>
        <div className="text-zinc-500 text-sm">Awaiting input</div>
      </div>
    )
  }
  const isZero = Math.abs(value) < 0.005
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  const abs = Math.abs(value)
  const tone = isZero
    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
    : 'bg-red-500/15 text-red-300 border-red-500/30'
  return (
    <div>
      <div className="text-xs uppercase text-zinc-500 mb-1">Variance</div>
      <div className={`inline-flex items-center px-3 py-1.5 rounded-lg border text-base font-bold tabular-nums ${tone}`}>
        {isZero ? format(0) : `${sign}${format(abs)}`}
      </div>
    </div>
  )
}
