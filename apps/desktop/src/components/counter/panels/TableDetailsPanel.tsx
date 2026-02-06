import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table as TableIcon, X, Receipt, CreditCard, Plus, Clock, ArrowRight } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import type { DiningTable, Order } from '../types'
import { formatElapsedTime } from '../utils/orderUtils'

interface TableDetailsPanelProps {
  selectedTable: DiningTable | null
  tableOrders: Order[]
  onClose: () => void
  onCreateOrder: () => void
  onEditOrder: (order: Order) => void
  formatCurrency: (amount: number) => string
  /** If true, hides the Process Payment button (for server role) */
  canProcessPayment?: boolean
}

/**
 * Right sidebar panel showing details of the selected table
 */
export function TableDetailsPanel({
  selectedTable,
  tableOrders,
  onClose,
  onCreateOrder,
  onEditOrder,
  formatCurrency,
  canProcessPayment = true
}: TableDetailsPanelProps) {
  if (!selectedTable) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <TableIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Select a table to view details</p>
        </div>
      </div>
    )
  }

  const totalAmount = tableOrders.reduce((sum, order) => sum + order.total_amount, 0)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Table Header */}
      <div className="p-4 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold flex items-center">
            <TableIcon className="w-4 h-4 mr-2" />
            Table {selectedTable.table_number}
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="text-sm text-muted-foreground">
          {selectedTable.seating_capacity} seats
          {tableOrders.length > 0 && (
            <span className="ml-2">
              • <Clock className="w-3 h-3 inline" /> {formatElapsedTime(tableOrders[0].created_at)}
            </span>
          )}
        </div>
      </div>

      {/* Order Items */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {tableOrders.length > 0 ? (
          <div className="p-4 space-y-4">
            {tableOrders.map(order => (
              <div
                key={order.id}
                className="space-y-2 p-2 -mx-2 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => onEditOrder(order)}
              >
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Order #{order.order_number}</span>
                  <Badge variant="outline" className="text-xs">{order.status}</Badge>
                </div>
                {order.items?.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start py-1 text-sm">
                    <div className="flex-1">
                      <span>{item.quantity}x {item.product?.name || 'Unknown'}</span>
                    </div>
                    <span className="text-muted-foreground">
                      {formatCurrency((item.unit_price || 0) * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
            ))}

            {/* Total */}
            <div className="pt-3 border-t border-border">
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-primary">
                  {formatCurrency(totalAmount)}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8 text-muted-foreground">
            <div className="text-center">
              <Receipt className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No orders for this table</p>
              <p className="text-sm">Table is available</p>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="p-4 border-t border-border space-y-3 flex-shrink-0">
        <Button
          className="w-full h-14 text-base"
          size="lg"
          onClick={onCreateOrder}
        >
          {tableOrders.length > 0 ? (
            <>
              <Plus className="w-5 h-5 mr-2" />
              Add More Items
            </>
          ) : (
            <>
              Select Products
              <ArrowRight className="w-5 h-5 ml-2" />
            </>
          )}
        </Button>
        {tableOrders.length > 0 && canProcessPayment && (
          <Link to="/admin/bills" className="block">
            <Button
              className="w-full h-14 text-base"
              size="lg"
              variant="outline"
            >
              <CreditCard className="w-5 h-5 mr-2" />
              Process Payment
            </Button>
          </Link>
        )}
      </div>
    </div>
  )
}
