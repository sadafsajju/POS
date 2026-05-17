import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Receipt,
  Users,
  Package,
  Car,
  XCircle,
  Ban,
  Loader2,
  ClipboardList,
  UtensilsCrossed,
  CreditCard,
  Sparkles,
  Printer,
  Coins,
} from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ordersDb } from '@pos/supabase'
import { useSettingsStore } from '@pos/core'
import type { Order } from './types'

interface BillDetailPanelProps {
  selectedOrder: Order | null
  onCancelOrder: () => void
  onPrintBill?: () => void
  isCancelling: boolean
  formatCurrency: (amount: number) => string
}

const orderTypeIcons: Record<string, React.ReactNode> = {
  dine_in: <Users className="w-4 h-4" />,
  takeout: <Package className="w-4 h-4" />,
  delivery: <Car className="w-4 h-4" />
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  preparing: 'bg-orange-500/20 text-orange-400',
  ready: 'bg-emerald-500/20 text-emerald-400',
  served: 'bg-purple-500/20 text-purple-400',
  paid: 'bg-indigo-500/20 text-indigo-400',
  completed: 'bg-emerald-500/20 text-emerald-400',
  cancelled: 'bg-red-500/20 text-red-400',
}

function formatDuration(ms: number): string {
  const totalSecs = Math.floor(ms / 1000)
  if (totalSecs < 60) return `${totalSecs}s`
  const mins = Math.floor(totalSecs / 60)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  const remainMins = mins % 60
  return `${hours}h ${remainMins}m`
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

interface TimelineStep {
  label: string
  icon: React.ReactNode
  time: string | null
  done: boolean
}

function OrderTimeline({ order }: { order: Order }) {
  // Middle steps: Served and Payment — order depends on which happened first
  const servedStep: TimelineStep = {
    label: 'Served',
    icon: <UtensilsCrossed className="w-3.5 h-3.5" />,
    time: order.served_at || null,
    done: !!order.served_at,
  }
  const paymentStep: TimelineStep = {
    label: 'Payment',
    icon: <CreditCard className="w-3.5 h-3.5" />,
    time: order.paid_at || null,
    done: !!order.paid_at,
  }

  // Determine order of middle steps based on actual timestamps
  // If payment happened before served (or served hasn't happened), show payment first
  let middleSteps: TimelineStep[]
  if (order.paid_at && order.served_at) {
    // Both done — show in chronological order
    middleSteps = new Date(order.paid_at).getTime() <= new Date(order.served_at).getTime()
      ? [paymentStep, servedStep]
      : [servedStep, paymentStep]
  } else if (order.paid_at && !order.served_at) {
    // Paid but not served yet — payment first
    middleSteps = [paymentStep, servedStep]
  } else {
    // Default (dine-in flow): served first, then payment
    middleSteps = [servedStep, paymentStep]
  }

  const isDineIn = order.order_type === 'dine_in'

  const steps: TimelineStep[] = [
    {
      label: 'Order',
      icon: <ClipboardList className="w-3.5 h-3.5" />,
      time: order.created_at,
      done: true,
    },
    ...middleSteps,
    // "Cleared" only applies to dine-in (table clearance)
    ...(isDineIn ? [{
      label: 'Cleared',
      icon: <Sparkles className="w-3.5 h-3.5" />,
      time: order.cleared_at || null,
      done: !!order.cleared_at,
    }] : []),
  ]

  // Compute durations between consecutive completed steps
  const durations: (string | null)[] = []
  for (let i = 0; i < steps.length - 1; i++) {
    if (steps[i].time && steps[i + 1].time) {
      const diff = new Date(steps[i + 1].time!).getTime() - new Date(steps[i].time!).getTime()
      durations.push(diff > 0 ? formatDuration(diff) : '—')
    } else {
      durations.push(null)
    }
  }

  return (
    <div className="flex items-center gap-0">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center flex-1 min-w-0 last:flex-none">
          {/* Step node */}
          <div className="flex flex-col items-center gap-1">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
              step.done
                ? 'bg-zinc-900 text-green-900'
                : 'bg-zinc-800 text-zinc-500'
            }`}>
              {step.icon}
            </div>
            <span className={`text-[10px] mt-1 font-medium leading-tight ${
              step.done ? 'text-zinc-200' : 'text-zinc-600'
            }`}>
              {step.label}
            </span>
            {step.time && (
              <span className="text-[10px] text-zinc-500 leading-tight">
                {formatTime(step.time)}
              </span>
            )}
          </div>

          {/* Connector line + duration */}
          {i < steps.length - 1 && (
            <div className="flex-1 flex flex-col items-center -mt-11">
              {durations[i] && (
                <span className="text-[10px] font-medium text-zinc-200/50 mb-0.5">{durations[i]}</span>
              )}
              <div className={`w-full h-[3px] ${
                steps[i + 1].done ? 'bg-zinc-900' : 'bg-zinc-800'
              }`} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export function BillDetailPanel({
  selectedOrder,
  onCancelOrder,
  onPrintBill,
  isCancelling,
  formatCurrency
}: BillDetailPanelProps) {
  const [showPrintConfirm, setShowPrintConfirm] = useState(false)
  const { settings } = useSettingsStore()
  const queryClient = useQueryClient()

  const [tipEditing, setTipEditing] = useState(false)
  const [tipAmount, setTipAmount] = useState('')
  const [tipMethod, setTipMethod] = useState<'cash' | 'card' | 'other'>('card')
  const [tipFeedback, setTipFeedback] = useState<string | null>(null)

  const tipMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOrder) throw new Error('No order selected')
      const amt = parseFloat(tipAmount) || 0
      const res = await ordersDb.recordTip({
        order_id: selectedOrder.id,
        amount: amt,
        method: tipMethod,
      })
      if (!res.success) throw new Error(res.message || 'Failed to record tip')
      return res
    },
    onSuccess: () => {
      setTipEditing(false)
      setTipFeedback('Tip recorded')
      setTimeout(() => setTipFeedback(null), 2500)
      queryClient.invalidateQueries({ queryKey: ['bills'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
    onError: (e: Error) => setTipFeedback(e.message),
  })

  // Reset print confirm + tip editor when order changes
  useEffect(() => {
    setShowPrintConfirm(false)
    setTipEditing(false)
    setTipAmount(selectedOrder?.tip_amount != null ? String(selectedOrder.tip_amount) : '')
    setTipMethod((selectedOrder?.tip_method as 'cash' | 'card' | 'other') || 'card')
    setTipFeedback(null)
  }, [selectedOrder?.id])

  // No selection — empty state
  if (!selectedOrder) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-600">
        <div className="text-center p-8">
          <Receipt className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-semibold text-zinc-500">Select an Order</p>
          <p className="text-sm mt-2 text-zinc-600">Click on an order to view details</p>
        </div>
      </div>
    )
  }

  const isCompleted = selectedOrder.status === 'completed'
  const isCancelled = selectedOrder.status === 'cancelled'
  const canCancel = !isCancelled

  return (
    <div className="flex flex-col h-full">
      {/* Header — tap to print */}
      <div
        className={`p-4 border-b border-zinc-800 cursor-pointer transition-colors active:brightness-125 ${
          isCompleted ? 'bg-emerald-500/10' : isCancelled ? 'bg-red-500/10' : ''
        }`}
        onClick={() => setShowPrintConfirm(prev => !prev)}
      >
        {selectedOrder.token_number && (
          <div className="text-center mb-2">
            <span className="text-2xl font-black tracking-widest text-amber-400 tabular-nums">
              TOKEN: {String(selectedOrder.token_number).padStart(4, '0')}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-semibold flex items-center gap-2 text-zinc-100">
            <Receipt className="w-5 h-5" />
            #{selectedOrder.order_number}
          </h3>
          <Badge className={`${statusColors[selectedOrder.status] || 'bg-zinc-800 text-zinc-400'} border-0`}>
            {selectedOrder.status}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          {selectedOrder.order_type && (
            <span className="flex items-center gap-1">
              {orderTypeIcons[selectedOrder.order_type]}
              <span className="capitalize">{selectedOrder.order_type?.replace('_', '-')}</span>
            </span>
          )}
          {selectedOrder.table?.table_number && (
            <span>Table {selectedOrder.table.table_number}</span>
          )}
          {selectedOrder.customer_name && (
            <span>{selectedOrder.customer_name}</span>
          )}
        </div>

        {/* Print Bill Confirmation */}
        {showPrintConfirm && (
          <div
            className="flex items-center gap-3 mt-3 p-3 bg-zinc-800 border border-zinc-700 rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <Printer className="w-5 h-5 text-zinc-400 flex-shrink-0" />
            <span className="text-sm text-zinc-300 flex-1">Print this bill?</span>
            <Button
              size="sm"
              className="h-9 px-4 bg-zinc-600 text-white hover:bg-zinc-500"
              onClick={() => {
                onPrintBill?.()
                setShowPrintConfirm(false)
              }}
            >
              Print
            </Button>
            <Button
              size="sm"
              className="h-9 px-3 bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
              onClick={() => setShowPrintConfirm(false)}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Cancelled notice */}
        {isCancelled && (
          <div className="flex items-center gap-2 p-3 bg-red-500/15 text-red-400 border border-red-500/20 rounded-lg">
            <XCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">This order has been cancelled</span>
          </div>
        )}

        {/* Order Timeline — shows step progress with durations */}
        {!isCancelled && (
          <div className="px-3 py-3 bg-zinc-800/50 rounded-lg">
            <OrderTimeline order={selectedOrder} />
          </div>
        )}

        {/* Order Items */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-zinc-500">Items</h4>
          {selectedOrder.items?.length ? (
            selectedOrder.items.map((item, index) => (
              <div key={index} className="flex justify-between items-start py-1.5 border-b border-zinc-800/60 last:border-0">
                <div className="flex-1">
                  <div className="text-sm font-medium text-zinc-200">{item.product?.name || 'Unknown'}</div>
                  <div className="text-xs text-zinc-500">
                    {formatCurrency(item.unit_price || 0)} x {item.quantity}
                  </div>
                </div>
                <div className="text-sm font-medium text-zinc-200">
                  {formatCurrency((item.unit_price || 0) * item.quantity)}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-zinc-500">No items</p>
          )}
        </div>

        {/* Order Summary */}
        <div className="pt-3 border-t-2 border-zinc-800 space-y-1">
          {selectedOrder.subtotal > 0 && selectedOrder.subtotal !== selectedOrder.total_amount && (
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Subtotal</span>
              <span className="text-zinc-300">{formatCurrency(selectedOrder.subtotal)}</span>
            </div>
          )}
          {selectedOrder.tax_amount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Tax</span>
              <span className="text-zinc-300">{formatCurrency(selectedOrder.tax_amount)}</span>
            </div>
          )}
          {selectedOrder.discount_amount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">
                Discount
                {(selectedOrder as any).discount_name
                  ? ` (${(selectedOrder as any).discount_name})`
                  : ''}
              </span>
              <span className="text-emerald-400">-{formatCurrency(selectedOrder.discount_amount)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold pt-1">
            <span className="text-zinc-100">Total</span>
            <span className="text-zinc-100">{formatCurrency(selectedOrder.total_amount)}</span>
          </div>
          {settings.tippingEnabled && (
            <div className="pt-2 mt-2 border-t border-zinc-800/60 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-zinc-500">
                  <Coins className="w-3.5 h-3.5" />
                  Tip
                </div>
                {!tipEditing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-zinc-400 hover:text-zinc-100"
                    onClick={() => {
                      setTipAmount(selectedOrder.tip_amount != null ? String(selectedOrder.tip_amount) : '')
                      setTipMethod((selectedOrder.tip_method as 'cash' | 'card' | 'other') || 'card')
                      setTipEditing(true)
                    }}
                  >
                    {selectedOrder.tip_amount && selectedOrder.tip_amount > 0 ? 'Edit' : 'Add tip'}
                  </Button>
                )}
              </div>
              {!tipEditing && (
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400 capitalize">{selectedOrder.tip_method ?? '—'}</span>
                  <span className={selectedOrder.tip_amount && selectedOrder.tip_amount > 0 ? 'text-emerald-400 font-semibold' : 'text-zinc-500'}>
                    {formatCurrency(selectedOrder.tip_amount ?? 0)}
                  </span>
                </div>
              )}
              {tipEditing && (
                <div className="space-y-2 pt-1">
                  <div className="flex gap-2">
                    {(['cash', 'card', 'other'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setTipMethod(m)}
                        className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                          tipMethod === m
                            ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300'
                            : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                        }`}
                      >
                        {m === 'cash' ? 'Cash' : m === 'card' ? 'Card (PED)' : 'Other'}
                      </button>
                    ))}
                  </div>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={tipAmount}
                    onChange={(e) => setTipAmount(e.target.value)}
                    placeholder="0.00"
                    inputMode="decimal"
                    className="h-9 text-sm bg-zinc-900 border-zinc-700 text-zinc-100"
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs bg-zinc-900 border-zinc-700"
                      onClick={() => {
                        setTipEditing(false)
                        setTipAmount(selectedOrder.tip_amount != null ? String(selectedOrder.tip_amount) : '')
                      }}
                      disabled={tipMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => tipMutation.mutate()}
                      disabled={tipMutation.isPending}
                    >
                      {tipMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save tip'}
                    </Button>
                  </div>
                  {settings.tippingPolicyUrl && (
                    <a
                      href={settings.tippingPolicyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-[10px] text-emerald-400/70 hover:text-emerald-300 underline"
                    >
                      How are tips shared?
                    </a>
                  )}
                </div>
              )}
              {tipFeedback && !tipEditing && (
                <div className="text-[11px] text-emerald-400">{tipFeedback}</div>
              )}
            </div>
          )}
        </div>

        {/* Payment Details */}
        {selectedOrder.payments && selectedOrder.payments.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-zinc-500">Payment</h4>
            {selectedOrder.payments.map((payment, idx) => (
              <div key={idx} className="bg-zinc-800/50 rounded-lg p-3 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400 capitalize">{payment.payment_method.replace('_', ' ')}</span>
                  <span className="text-zinc-200 font-medium">{formatCurrency(payment.amount)}</span>
                </div>
                {payment.cash_received && (
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Cash Received</span>
                    <span className="text-zinc-400">{formatCurrency(payment.cash_received)}</span>
                  </div>
                )}
                {payment.change_amount && payment.change_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Change</span>
                    <span className="text-amber-400">{formatCurrency(payment.change_amount)}</span>
                  </div>
                )}
                {payment.processed_by_user && (
                  <div className="text-xs text-zinc-600">
                    by {payment.processed_by_user.first_name || payment.processed_by_user.username}
                    {payment.processed_at && ` · ${formatTime(payment.processed_at)}`}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      </div>

      {/* Cancel Button */}
      {canCancel && (
        <div className="p-4 border-t border-zinc-800">
          <Button
            className="w-full h-12 bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 hover:text-red-300"
            size="lg"
            onClick={onCancelOrder}
            disabled={isCancelling}
          >
            {isCancelling ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <Ban className="w-5 h-5 mr-2" />
            )}
            {isCancelling ? 'Cancelling...' : 'Cancel Order'}
          </Button>
        </div>
      )}
    </div>
  )
}
