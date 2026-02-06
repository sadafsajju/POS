import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Receipt,
  Check,
  Users,
  Package,
  Car,
  XCircle,
  Ban,
  Loader2,
  ClipboardList,
  UtensilsCrossed,
  CreditCard,
  Sparkles
} from 'lucide-react'
import type { Order } from './types'

interface BillDetailPanelProps {
  selectedOrder: Order | null
  onCancelOrder: () => void
  isCancelling: boolean
  formatCurrency: (amount: number) => string
}

const orderTypeIcons: Record<string, React.ReactNode> = {
  dine_in: <Users className="w-4 h-4" />,
  takeout: <Package className="w-4 h-4" />,
  delivery: <Car className="w-4 h-4" />
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  preparing: 'bg-blue-100 text-blue-800',
  ready: 'bg-green-100 text-green-800',
  served: 'bg-purple-100 text-purple-800',
  paid: 'bg-indigo-100 text-indigo-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-800',
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

  const steps: TimelineStep[] = [
    {
      label: 'Order',
      icon: <ClipboardList className="w-3.5 h-3.5" />,
      time: order.created_at,
      done: true,
    },
    ...middleSteps,
    {
      label: 'Cleared',
      icon: <Sparkles className="w-3.5 h-3.5" />,
      time: order.cleared_at || null,
      done: !!order.cleared_at,
    },
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
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
              step.done
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}>
              {step.icon}
            </div>
            <span className={`text-[10px] font-medium leading-tight ${
              step.done ? 'text-foreground' : 'text-muted-foreground'
            }`}>
              {step.label}
            </span>
            {step.time && (
              <span className="text-[10px] text-muted-foreground leading-tight">
                {formatTime(step.time)}
              </span>
            )}
          </div>

          {/* Connector line + duration */}
          {i < steps.length - 1 && (
            <div className="flex-1 flex flex-col items-center mx-1 -mt-3">
              {durations[i] && (
                <span className="text-[10px] font-medium text-primary mb-0.5">{durations[i]}</span>
              )}
              <div className={`w-full h-[2px] ${
                steps[i + 1].done ? 'bg-primary' : 'bg-muted'
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
  isCancelling,
  formatCurrency
}: BillDetailPanelProps) {
  // No selection — empty state
  if (!selectedOrder) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center p-8">
          <Receipt className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">Select an Order</p>
          <p className="text-sm mt-2">Click on an order to view details</p>
        </div>
      </div>
    )
  }

  const isCompleted = selectedOrder.status === 'completed'
  const isCancelled = selectedOrder.status === 'cancelled'
  const canCancel = !isCancelled

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={`p-4 border-b border-border ${
        isCompleted ? 'bg-emerald-50' : isCancelled ? 'bg-red-50' : ''
      }`}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            #{selectedOrder.order_number}
          </h3>
          <Badge className={statusColors[selectedOrder.status] || 'bg-muted text-muted-foreground'}>
            {selectedOrder.status}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
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
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Cancelled notice */}
        {isCancelled && (
          <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg">
            <XCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">This order has been cancelled</span>
          </div>
        )}

        {/* Order Timeline — shows step progress with durations */}
        {!isCancelled && (
          <div className="px-3 py-3 bg-muted/30 rounded-lg">
            <OrderTimeline order={selectedOrder} />
          </div>
        )}

        {/* Order Items */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Items</h4>
          {selectedOrder.items?.length ? (
            selectedOrder.items.map((item, index) => (
              <div key={index} className="flex justify-between items-start py-1.5 border-b border-border last:border-0">
                <div className="flex-1">
                  <div className="text-sm font-medium">{item.product?.name || 'Unknown'}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatCurrency(item.unit_price || 0)} x {item.quantity}
                  </div>
                </div>
                <div className="text-sm font-medium">
                  {formatCurrency((item.unit_price || 0) * item.quantity)}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No items</p>
          )}
        </div>

        {/* Order Summary */}
        <div className="pt-3 border-t-2 border-border space-y-1">
          {selectedOrder.subtotal > 0 && selectedOrder.subtotal !== selectedOrder.total_amount && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(selectedOrder.subtotal)}</span>
            </div>
          )}
          {selectedOrder.tax_amount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax</span>
              <span>{formatCurrency(selectedOrder.tax_amount)}</span>
            </div>
          )}
          {selectedOrder.discount_amount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Discount</span>
              <span className="text-green-600">-{formatCurrency(selectedOrder.discount_amount)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold pt-1">
            <span>Total</span>
            <span>{formatCurrency(selectedOrder.total_amount)}</span>
          </div>
        </div>
      </div>

      {/* Cancel Button */}
      {canCancel && (
        <div className="p-4 border-t border-border">
          <Button
            className="w-full h-12"
            size="lg"
            variant="destructive"
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
