import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Receipt, CheckSquare, Square } from 'lucide-react'
import type { Order } from '../types'
import { getOrderTypeIcon, getOrderTypeBadge } from '../utils/orderUtils'

interface PaymentViewProps {
  orders: Order[]
  selectedOrder: Order | null
  selectedOrderIds: Set<string>
  onOrderSelect: (order: Order) => void
  onToggleOrderSelection: (orderId: string, e: React.MouseEvent) => void
  onSelectAllOrders: () => void
  formatCurrency: (amount: number) => string
}

/**
 * Orders list view for payment processing
 */
export function PaymentView({
  orders,
  selectedOrder,
  selectedOrderIds,
  onOrderSelect,
  onToggleOrderSelection,
  onSelectAllOrders,
  formatCurrency
}: PaymentViewProps) {
  const safeOrders = Array.isArray(orders) ? orders : []

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black tracking-tight text-zinc-100">Orders Ready for Payment</h3>
        {safeOrders.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={onSelectAllOrders}
            className="gap-2 bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            {selectedOrderIds.size === safeOrders.length ? (
              <>
                <CheckSquare className="w-4 h-4" />
                Deselect All
              </>
            ) : (
              <>
                <Square className="w-4 h-4" />
                Select All ({safeOrders.length})
              </>
            )}
          </Button>
        )}
      </div>

      {/* Empty state */}
      {safeOrders.length === 0 ? (
        <div className="text-center py-8 text-zinc-500">
          <Receipt className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>No orders ready for payment</p>
        </div>
      ) : (
        /* Orders list */
        safeOrders.map(order => (
          <Card
            key={order.id}
            className={`cursor-pointer transition-all bg-zinc-900 border-zinc-800 ${
              selectedOrder?.id === order.id ? 'ring-2 ring-amber-500' :
              selectedOrderIds.has(order.id) ? 'ring-2 ring-amber-500 bg-amber-500/10' : 'hover:bg-zinc-800'
            }`}
            onClick={() => {
              if (selectedOrderIds.size === 0) {
                onOrderSelect(order)
              }
            }}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Checkbox for multi-select */}
                  <button
                    onClick={(e) => onToggleOrderSelection(order.id, e)}
                    className="p-1 hover:bg-zinc-800 rounded transition-colors"
                  >
                    {selectedOrderIds.has(order.id) ? (
                      <CheckSquare className="w-5 h-5 text-amber-500" />
                    ) : (
                      <Square className="w-5 h-5 text-zinc-500" />
                    )}
                  </button>
                  {getOrderTypeIcon(order.order_type)}
                  <div>
                    <div className="font-semibold text-zinc-100">Order #{order.order_number}</div>
                    <div className="text-sm text-zinc-500">
                      {order.customer_name && `${order.customer_name} • `}
                      {order.table?.table_number && `Table ${order.table.table_number} • `}
                      {order.items?.length || 0} items
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-zinc-100">{formatCurrency(order.total_amount)}</div>
                  <div className="flex items-center gap-2">
                    {getOrderTypeBadge(order.order_type)}
                    <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-400">
                      {order.status}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
