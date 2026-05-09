import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { Loader2, Lock, AlertCircle, CheckCircle2, Coins } from 'lucide-react'
import { ordersDb, usersDb } from '@pos/supabase'
import { useSettingsStore } from '@pos/core'
import { formatCurrency, todayInTz } from '@/lib/utils'
import type { TipAllocationMethod, TipPoolData } from '@pos/types'

function daysAgoInTz(days: number, tz: string) {
  const today = todayInTz(tz)
  const d = new Date(today + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

interface AllocRow {
  user_id: string
  full_name: string
  role: string
  amount: string
  hours: string
}

export function TipAllocation() {
  const queryClient = useQueryClient()
  const { settings } = useSettingsStore()
  const format = (n: number) => formatCurrency(n, settings.currency, settings.currencySymbol)
  const today = todayInTz(settings.timezone)

  const [periodStart, setPeriodStart] = useState(today)
  const [periodEnd, setPeriodEnd] = useState(today)
  const [method, setMethod] = useState<TipAllocationMethod>(settings.tipDefaultAllocationMethod ?? 'equal')
  const [rows, setRows] = useState<AllocRow[]>([])
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; message: string } | null>(null)
  const [notes, setNotes] = useState('')

  const poolQuery = useQuery({
    queryKey: ['tip-pool', periodStart, periodEnd],
    queryFn: async () => {
      const res = await ordersDb.getTipPool({ period_start: periodStart, period_end: periodEnd })
      if (!res.success) throw new Error(res.message || 'Failed to load tip pool')
      return res.data as TipPoolData
    },
  })

  const staffQuery = useQuery({
    queryKey: ['staff-for-tips'],
    queryFn: async () => {
      const res = await usersDb.getUsers({ per_page: 200 })
      if (!res.success) throw new Error(res.message || 'Failed to load staff')
      return Array.isArray(res.data) ? res.data : []
    },
  })

  const totalTips = poolQuery.data?.total_tips ?? 0
  const isLocked = !!poolQuery.data?.allocation?.locked_at

  // Hydrate rows on data change
  useEffect(() => {
    if (!staffQuery.data || !poolQuery.data) return
    const staff = staffQuery.data
    const existingLines = poolQuery.data.lines || []

    setRows(staff.map((u: any) => {
      const existing = existingLines.find((l) => l.user_id === u.id)
      return {
        user_id: u.id,
        full_name: `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || u.username || u.id.slice(0, 8),
        role: u.role,
        amount: existing ? String(existing.amount) : '',
        hours: existing?.hours_worked != null ? String(existing.hours_worked) : '',
      }
    }))
    setNotes(poolQuery.data.allocation?.notes ?? '')
  }, [staffQuery.data, poolQuery.data?.allocation?.id])

  // Recompute amounts whenever method or hours change (for non-manual modes)
  const recompute = () => {
    if (method === 'manual') return
    setRows(prev => {
      const eligible = prev.filter(r => method === 'equal' ? true : (parseFloat(r.hours) || 0) > 0)
      if (method === 'equal') {
        if (eligible.length === 0) return prev
        const each = totalTips / eligible.length
        return prev.map(r => ({ ...r, amount: each ? each.toFixed(2) : '0.00' }))
      }
      // hours_weighted
      const totalHours = eligible.reduce((s, r) => s + (parseFloat(r.hours) || 0), 0)
      if (totalHours <= 0) return prev.map(r => ({ ...r, amount: '0.00' }))
      return prev.map(r => {
        const h = parseFloat(r.hours) || 0
        if (h <= 0) return { ...r, amount: '0.00' }
        return { ...r, amount: (totalTips * (h / totalHours)).toFixed(2) }
      })
    })
  }

  const updateRow = (idx: number, patch: Partial<AllocRow>) => {
    setRows(prev => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  const allocSum = useMemo(
    () => rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0),
    [rows]
  )
  const remaining = totalTips - allocSum

  const saveMutation = useMutation({
    mutationFn: async () => {
      const allocations = rows
        .map(r => ({
          user_id: r.user_id,
          amount: parseFloat(r.amount) || 0,
          hours_worked: r.hours ? parseFloat(r.hours) : undefined,
        }))
        .filter(a => a.amount > 0)
      const res = await ordersDb.allocateTips({
        period_start: periodStart,
        period_end: periodEnd,
        method,
        allocations,
        notes: notes || null,
      })
      if (!res.success) throw new Error(res.message || 'Failed to save')
      return res.data
    },
    onSuccess: () => {
      setFeedback({ kind: 'ok', message: 'Allocation locked' })
      queryClient.invalidateQueries({ queryKey: ['tip-pool', periodStart, periodEnd] })
    },
    onError: (e: Error) => setFeedback({ kind: 'err', message: e.message }),
  })

  if (poolQuery.isLoading || staffQuery.isLoading) {
    return (
      <div className="h-full bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-zinc-950 text-zinc-100 p-6">
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Coins className="w-6 h-6 text-emerald-400" />
            Tip allocation
          </h1>
          <p className="text-sm text-muted-foreground">
            Allocate the tip pool to staff per the Employment (Allocation of Tips) Act 2023.
            {settings.tippingPolicyUrl && (
              <> {' '}
                <a href={settings.tippingPolicyUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline">
                  View tipping policy
                </a>
              </>
            )}
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
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="bg-zinc-800 text-zinc-200 border-zinc-700 hover:bg-zinc-700 hover:text-zinc-100" onClick={() => { setPeriodStart(today); setPeriodEnd(today) }}>Today</Button>
            <Button variant="outline" size="sm" className="bg-zinc-800 text-zinc-200 border-zinc-700 hover:bg-zinc-700 hover:text-zinc-100" onClick={() => { setPeriodStart(daysAgoInTz(6, settings.timezone)); setPeriodEnd(today) }}>Week</Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-zinc-500">Tip pool</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-emerald-400">{format(totalTips)}</div></CardContent>
        </Card>
        {(poolQuery.data?.by_method ?? []).map(m => (
          <Card key={m.tip_method ?? 'unknown'}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase text-zinc-500">
                {m.tip_method ?? 'Unspecified'} · {m.count}
              </CardTitle>
            </CardHeader>
            <CardContent><div className="text-xl font-semibold">{format(Number(m.amount))}</div></CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
        <CardHeader>
          <CardTitle className="text-base">Allocation method</CardTitle>
          <CardDescription>
            Equal: split evenly across all staff. Hours-weighted: split by hours worked. Manual: enter amounts directly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {(['equal', 'hours_weighted', 'manual'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                disabled={isLocked}
                className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                  method === m
                    ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300'
                    : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                } disabled:opacity-50`}
              >
                {m === 'equal' ? 'Equal' : m === 'hours_weighted' ? 'Hours-weighted' : 'Manual'}
              </button>
            ))}
            {method !== 'manual' && !isLocked && (
              <Button variant="outline" size="sm" className="bg-zinc-800 text-zinc-200 border-zinc-700 hover:bg-zinc-700 hover:text-zinc-100" onClick={recompute}>Recalculate</Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
        <CardHeader>
          <CardTitle className="text-base">Per-staff allocation</CardTitle>
          <CardDescription>
            Allocation total must equal pool total before saving. Once saved, the record is locked for audit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-zinc-500">
              <tr>
                <th className="text-left font-medium pb-2">Staff</th>
                <th className="text-left font-medium pb-2 hidden md:table-cell">Role</th>
                <th className="text-right font-medium pb-2">Hours</th>
                <th className="text-right font-medium pb-2">Amount</th>
                <th className="text-right font-medium pb-2 hidden md:table-cell">Share</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={5} className="text-zinc-500 py-2">No staff loaded.</td></tr>
              )}
              {rows.map((r, i) => {
                const amt = parseFloat(r.amount) || 0
                const share = totalTips > 0 ? (amt * 100) / totalTips : 0
                return (
                  <tr key={r.user_id} className="border-t border-zinc-800">
                    <td className="py-2 pr-2">{r.full_name}</td>
                    <td className="py-2 pr-2 hidden md:table-cell text-zinc-500 capitalize">{r.role}</td>
                    <td className="py-2 pr-2 text-right">
                      <Input
                        type="number"
                        step="0.25"
                        min="0"
                        value={r.hours}
                        onChange={(e) => updateRow(i, { hours: e.target.value })}
                        disabled={isLocked || method === 'equal'}
                        className="h-8 w-20 text-sm text-right ml-auto bg-zinc-900 border-zinc-700"
                        placeholder="0"
                      />
                    </td>
                    <td className="py-2 pr-2 text-right">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={r.amount}
                        onChange={(e) => updateRow(i, { amount: e.target.value })}
                        disabled={isLocked || method !== 'manual'}
                        className="h-8 w-24 text-sm text-right ml-auto bg-zinc-900 border-zinc-700 font-semibold"
                        placeholder="0.00"
                      />
                    </td>
                    <td className="py-2 text-right hidden md:table-cell text-zinc-500 tabular-nums">
                      {share.toFixed(1)}%
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-zinc-700">
                <td colSpan={3} className="py-2 pr-2 text-right text-zinc-500">Allocated</td>
                <td className="py-2 pr-2 text-right font-bold tabular-nums">{format(allocSum)}</td>
                <td className="py-2 hidden md:table-cell"></td>
              </tr>
              <tr>
                <td colSpan={3} className="py-1 pr-2 text-right text-zinc-500">Remaining</td>
                <td className={`py-1 pr-2 text-right font-bold tabular-nums ${
                  Math.abs(remaining) < 0.005 ? 'text-emerald-400' : 'text-amber-400'
                }`}>
                  {format(remaining)}
                </td>
                <td className="hidden md:table-cell"></td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
        <CardHeader>
          <CardTitle className="text-base">Notes &amp; lock</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Anything unusual about this period's split? Hours dispute? Staff out sick?"
            disabled={isLocked}
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-60"
          />
          {feedback && (
            <div className={`flex items-center gap-2 text-sm ${feedback.kind === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
              {feedback.kind === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {feedback.message}
            </div>
          )}
          {isLocked ? (
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
              <Lock className="w-4 h-4" />
              Allocation locked on {new Date(poolQuery.data!.allocation!.locked_at!).toLocaleString('en-GB', { timeZone: settings.timezone })}
            </div>
          ) : (
            <div className="flex justify-end">
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || Math.abs(remaining) > 0.01 || totalTips <= 0}
                className="bg-emerald-600 text-white hover:bg-emerald-500"
              >
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
                Lock allocation
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
