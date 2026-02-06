import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Clock,
  Check,
  X,
  Truck,
  Phone,
  User,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react'
import { counterApi, adminApi } from '@pos/api-client'
import { formatCurrency } from '@/lib/utils'
import { useSettingsStore } from '@pos/core'
import type { AggregatorOrder, OrderSource } from '@pos/types'

// Check if user is admin/manager
function isAdminRole(): boolean {
  try {
    const token = localStorage.getItem('pos_token')
    if (!token) return false
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.role === 'admin' || payload.role === 'manager'
  } catch {
    return false
  }
}

export function AggregatorOrders() {
  const queryClient = useQueryClient()
  const { settings } = useSettingsStore()
  const [rejectingOrderId, setRejectingOrderId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const format = (amount: number) =>
    formatCurrency(amount, settings.currency, settings.currencySymbol)

  const isAdmin = isAdminRole()
  const api = isAdmin ? adminApi : counterApi

  // Fetch pending aggregator orders
  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ['aggregator-orders', 'pending'],
    queryFn: async () => {
      const res = await api.getAggregatorOrders({ status: 'pending' })
      return (Array.isArray(res?.data) ? res.data : []) as AggregatorOrder[]
    },
    refetchInterval: 10000, // Poll every 10 seconds
  })

  // Accept mutation
  const acceptMutation = useMutation({
    mutationFn: (orderId: string) => api.acceptAggregatorOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aggregator-orders'] })
      queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason: string }) =>
      api.rejectAggregatorOrder(orderId, reason),
    onSuccess: () => {
      setRejectingOrderId(null)
      setRejectReason('')
      queryClient.invalidateQueries({ queryKey: ['aggregator-orders'] })
    },
  })

  // Play alert sound for new orders
  useEffect(() => {
    if (orders.length > 0) {
      // Use a distinct notification tone
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()
        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)
        oscillator.frequency.value = 880 // A5 - higher pitch for urgency
        oscillator.type = 'sine'
        gainNode.gain.value = 0.3
        oscillator.start()
        // Two short beeps
        setTimeout(() => { gainNode.gain.value = 0 }, 150)
        setTimeout(() => { gainNode.gain.value = 0.3 }, 250)
        setTimeout(() => {
          oscillator.stop()
          audioContext.close()
        }, 400)
      } catch {
        // Audio not available
      }
    }
  }, [orders.length])

  if (isLoading) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Loading aggregator orders...
      </div>
    )
  }

  if (orders.length === 0) {
    return null // Don't show anything if no pending orders
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-500 animate-pulse" />
          <h3 className="font-semibold text-sm">
            Incoming Orders ({orders.length})
          </h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          className="h-7 w-7 p-0"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Order Cards */}
      {orders.map((order) => (
        <AggregatorOrderCard
          key={order.id}
          order={order}
          format={format}
          onAccept={() => acceptMutation.mutate(order.id)}
          onReject={() => setRejectingOrderId(order.id)}
          isAccepting={acceptMutation.isPending && acceptMutation.variables === order.id}
          rejectingOrderId={rejectingOrderId}
          rejectReason={rejectReason}
          setRejectReason={setRejectReason}
          onConfirmReject={() =>
            rejectMutation.mutate({ orderId: order.id, reason: rejectReason })
          }
          onCancelReject={() => {
            setRejectingOrderId(null)
            setRejectReason('')
          }}
          isRejecting={rejectMutation.isPending}
        />
      ))}
    </div>
  )
}

// Countdown timer component
function CountdownTimer({ deadline }: { deadline: string }) {
  const [timeLeft, setTimeLeft] = useState('')
  const [isUrgent, setIsUrgent] = useState(false)

  useEffect(() => {
    const update = () => {
      const now = new Date().getTime()
      const end = new Date(deadline).getTime()
      const diff = end - now

      if (diff <= 0) {
        setTimeLeft('Expired')
        setIsUrgent(true)
        return
      }

      const minutes = Math.floor(diff / 60000)
      const seconds = Math.floor((diff % 60000) / 1000)
      setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`)
      setIsUrgent(minutes < 1)
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [deadline])

  return (
    <span
      className={`flex items-center gap-1 text-xs font-mono font-bold ${
        isUrgent ? 'text-red-600 animate-pulse' : 'text-orange-600'
      }`}
    >
      <Clock className="h-3 w-3" />
      {timeLeft}
    </span>
  )
}

// Platform badge
function PlatformBadge({ source }: { source: OrderSource }) {
  if (source === 'pos') return null

  const config = {
    swiggy: { label: 'Swiggy', bg: 'bg-orange-500', text: 'text-white' },
    zomato: { label: 'Zomato', bg: 'bg-red-500', text: 'text-white' },
  }
  const c = config[source] || { label: source, bg: 'bg-gray-500', text: 'text-white' }

  return (
    <Badge variant="outline" className={`${c.bg} ${c.text} border-0 text-xs font-bold`}>
      {c.label}
    </Badge>
  )
}

// Individual order card
interface AggregatorOrderCardProps {
  order: AggregatorOrder
  format: (amount: number) => string
  onAccept: () => void
  onReject: () => void
  isAccepting: boolean
  rejectingOrderId: string | null
  rejectReason: string
  setRejectReason: (reason: string) => void
  onConfirmReject: () => void
  onCancelReject: () => void
  isRejecting: boolean
}

function AggregatorOrderCard({
  order,
  format,
  onAccept,
  onReject,
  isAccepting,
  rejectingOrderId,
  rejectReason,
  setRejectReason,
  onConfirmReject,
  onCancelReject,
  isRejecting,
}: AggregatorOrderCardProps) {
  const isRejectMode = rejectingOrderId === order.id

  return (
    <Card className="border-l-4 border-l-orange-500 bg-orange-50/50">
      <CardContent className="p-3 space-y-3">
        {/* Header Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PlatformBadge source={order.order_source} />
            <span className="font-semibold text-sm">
              #{order.order_number}
            </span>
            {order.external_order_id && (
              <span className="text-xs text-muted-foreground">
                ({order.external_order_id})
              </span>
            )}
          </div>
          {order.accept_deadline && (
            <CountdownTimer deadline={order.accept_deadline} />
          )}
        </div>

        {/* Customer & Delivery Info */}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {order.customer_name && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {order.customer_name}
            </span>
          )}
          {order.delivery_partner_name && (
            <span className="flex items-center gap-1">
              <Truck className="h-3 w-3" />
              {order.delivery_partner_name}
            </span>
          )}
          {order.delivery_partner_phone && (
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {order.delivery_partner_phone}
            </span>
          )}
        </div>

        {/* Items */}
        <div className="space-y-1">
          {(order.items || []).map((item, idx) => (
            <div key={item.id || idx} className="flex justify-between text-sm">
              <span>
                <span className="font-medium">{item.quantity}×</span>{' '}
                {item.product?.name || 'Unknown Item'}
                {item.special_instructions && (
                  <span className="text-xs italic text-muted-foreground ml-1">
                    ({item.special_instructions})
                  </span>
                )}
              </span>
              <span className="text-muted-foreground">
                {format(item.total_price)}
              </span>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="flex justify-between items-center pt-2 border-t text-sm font-semibold">
          <span>Total</span>
          <span>{format(order.total_amount)}</span>
        </div>

        {/* Notes */}
        {order.notes && (
          <p className="text-xs text-muted-foreground italic bg-white/70 p-2 rounded">
            {order.notes}
          </p>
        )}

        {/* Reject Reason Input */}
        {isRejectMode && (
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Reason for rejection..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                className="flex-1"
                onClick={onConfirmReject}
                disabled={!rejectReason.trim() || isRejecting}
              >
                {isRejecting ? 'Rejecting...' : 'Confirm Reject'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onCancelReject}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {!isRejectMode && (
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={onAccept}
              disabled={isAccepting}
            >
              <Check className="h-4 w-4 mr-1" />
              {isAccepting ? 'Accepting...' : 'Accept'}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="flex-1"
              onClick={onReject}
            >
              <X className="h-4 w-4 mr-1" />
              Reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
