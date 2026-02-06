import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Receipt,
  CreditCard,
  IndianRupee,
  QrCode,
  Printer,
  Trash2,
  RotateCcw,
  Check,
  CheckSquare,
  AlertCircle
} from 'lucide-react'
import type { Order, PaymentAmounts, PaymentMethodType, PaidPaymentDetails } from '../types'

interface PaymentPanelProps {
  // Single order payment
  selectedOrder: Order | null

  // Multi-select batch actions
  selectedOrderIds: Set<string>
  selectedOrders: Order[]

  // Payment state
  paymentAmounts: PaymentAmounts
  activePaymentMethods: Set<PaymentMethodType>
  referenceNumber: string
  isOrderPaid: boolean
  paidOrderDetails: Order | null
  paidPaymentDetails: PaidPaymentDetails | null

  // Calculations
  getTotalPaidAmount: () => number
  getRemainingAmount: () => number
  getChangeAmount: () => number

  // Handlers
  onTogglePaymentMethod: (method: PaymentMethodType) => void
  onPaymentAmountChange: (method: PaymentMethodType, amount: string) => void
  onReferenceNumberChange: (ref: string) => void
  onProcessPayment: (shouldPrint: boolean) => void
  onPrintBill: () => void
  onDeleteOrder: () => void
  onBatchPrint: () => void
  onBatchDelete: () => void
  onResetPayment: () => void
  onClearSelection: () => void

  // Loading states
  isProcessingPayment: boolean
  isDeleting: boolean

  formatCurrency: (amount: number) => string
}

/**
 * Right sidebar panel for payment processing
 * Supports single order payment, split payments, and batch operations
 */
export function PaymentPanel({
  selectedOrder,
  selectedOrderIds,
  selectedOrders,
  paymentAmounts,
  activePaymentMethods,
  referenceNumber,
  isOrderPaid,
  paidOrderDetails,
  paidPaymentDetails,
  getTotalPaidAmount,
  getRemainingAmount,
  getChangeAmount,
  onTogglePaymentMethod,
  onPaymentAmountChange,
  onReferenceNumberChange,
  onProcessPayment,
  onPrintBill,
  onDeleteOrder,
  onBatchPrint,
  onBatchDelete,
  onResetPayment,
  onClearSelection,
  isProcessingPayment,
  isDeleting,
  formatCurrency
}: PaymentPanelProps) {
  // Multi-select batch mode
  if (selectedOrderIds.size > 0) {
    const total = selectedOrders.reduce((sum, o) => sum + o.total_amount, 0)

    return (
      <>
        {/* Batch Selection Header */}
        <div className="p-4 border-b border-border bg-blue-50">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold flex items-center text-blue-700">
              <CheckSquare className="w-4 h-4 mr-2" />
              {selectedOrderIds.size} Order{selectedOrderIds.size > 1 ? 's' : ''} Selected
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              className="text-blue-700 hover:text-blue-900"
            >
              Clear
            </Button>
          </div>
        </div>

        {/* Selected Orders List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Selected Orders</h4>
            {selectedOrders.map(order => (
              <div key={order.id} className="flex justify-between items-start py-2 border-b border-border last:border-0">
                <div className="flex-1">
                  <div className="font-medium text-sm">#{order.order_number}</div>
                  <div className="text-xs text-muted-foreground">
                    {order.customer_name && `${order.customer_name} • `}
                    {order.table?.table_number && `Table ${order.table.table_number} • `}
                    {order.items?.length || 0} items
                  </div>
                </div>
                <div className="text-sm font-medium">
                  {formatCurrency(order.total_amount)}
                </div>
              </div>
            ))}

            {/* Total */}
            <div className="pt-3 mt-3 border-t border-border space-y-2">
              <div className="flex justify-between text-lg font-bold">
                <span>Combined Total</span>
                <span className="text-blue-700">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Batch Action Buttons */}
        <div className="p-4 border-t border-border space-y-3">
          <Button
            className="w-full"
            size="lg"
            onClick={onBatchPrint}
          >
            <Printer className="w-4 h-4 mr-2" />
            Print All Bills ({selectedOrderIds.size})
          </Button>
          <Button
            className="w-full"
            size="lg"
            variant="destructive"
            onClick={onBatchDelete}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete All ({selectedOrderIds.size})
          </Button>
          <Button
            className="w-full"
            size="lg"
            variant="outline"
            onClick={onClearSelection}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Cancel Selection
          </Button>
        </div>
      </>
    )
  }

  // Order paid - show bill with print/delete options
  if (isOrderPaid && paidOrderDetails) {
    return (
      <>
        {/* Bill Details Header - Paid */}
        <div className="p-4 border-b border-border bg-green-50">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold flex items-center text-green-700">
              <Check className="w-4 h-4 mr-2" />
              Payment Complete
            </h3>
            <Badge className="bg-green-100 text-green-800">Paid</Badge>
          </div>
          <div className="text-sm text-green-700">
            Order #{paidOrderDetails.order_number}
            {paidOrderDetails.customer_name && ` • ${paidOrderDetails.customer_name}`}
            {paidOrderDetails.table?.table_number && ` • Table ${paidOrderDetails.table.table_number}`}
          </div>
        </div>

        {/* Order Items */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Items</h4>
            {paidOrderDetails.items?.map((item, index) => (
              <div key={index} className="flex justify-between items-start py-2 border-b border-border last:border-0">
                <div className="flex-1">
                  <div className="font-medium text-sm">{item.product?.name || 'Unknown'}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatCurrency(item.unit_price || 0)} × {item.quantity}
                  </div>
                </div>
                <div className="text-sm font-medium">
                  {formatCurrency((item.unit_price || 0) * item.quantity)}
                </div>
              </div>
            ))}

            {/* Total */}
            <div className="pt-3 mt-3 border-t border-border space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal ({paidOrderDetails.items?.length || 0} items)</span>
                <span>{formatCurrency(paidOrderDetails.total_amount)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Total Paid</span>
                <span className="text-green-700">{formatCurrency(paidOrderDetails.total_amount)}</span>
              </div>
              {paidPaymentDetails && (
                <div className="text-sm text-muted-foreground space-y-1">
                  <span className="block">Payment Breakdown:</span>
                  {paidPaymentDetails.cash > 0 && (
                    <div className="flex justify-between pl-2">
                      <span>Cash</span>
                      <span>{formatCurrency(paidPaymentDetails.cash)}</span>
                    </div>
                  )}
                  {paidPaymentDetails.card > 0 && (
                    <div className="flex justify-between pl-2">
                      <span>Card</span>
                      <span>{formatCurrency(paidPaymentDetails.card)}</span>
                    </div>
                  )}
                  {paidPaymentDetails.digital > 0 && (
                    <div className="flex justify-between pl-2">
                      <span>Digital</span>
                      <span>{formatCurrency(paidPaymentDetails.digital)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Print/Delete Buttons */}
        <div className="p-4 border-t border-border space-y-3">
          <div className="flex gap-2">
            <Button
              className="flex-1"
              size="lg"
              onClick={onPrintBill}
            >
              <Printer className="w-4 h-4 mr-2" />
              Print Bill
            </Button>
            <Button
              className="flex-1"
              size="lg"
              variant="destructive"
              onClick={onDeleteOrder}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          </div>
          <Button
            className="w-full"
            size="lg"
            variant="outline"
            onClick={onResetPayment}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            New Transaction
          </Button>
        </div>
      </>
    )
  }

  // Completed order selected - show bill (read-only)
  if (selectedOrder && selectedOrder.status === 'completed') {
    return (
      <>
        {/* Bill Details Header - Completed */}
        <div className="p-4 border-b border-border bg-green-50">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold flex items-center text-green-700">
              <Check className="w-4 h-4 mr-2" />
              Order Completed
            </h3>
            <Badge className="bg-green-100 text-green-800">Paid</Badge>
          </div>
          <div className="text-sm text-green-700">
            Order #{selectedOrder.order_number}
            {selectedOrder.customer_name && ` • ${selectedOrder.customer_name}`}
            {selectedOrder.table?.table_number && ` • Table ${selectedOrder.table.table_number}`}
          </div>
        </div>

        {/* Order Items */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-2">
            {selectedOrder.items?.map((item, index) => (
              <div key={index} className="flex justify-between items-start py-2 border-b border-border last:border-0">
                <div className="flex-1">
                  <div className="font-medium text-sm">{item.product?.name || 'Unknown'}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatCurrency(item.unit_price || 0)} × {item.quantity}
                  </div>
                </div>
                <div className="text-sm font-medium">
                  {formatCurrency((item.unit_price || 0) * item.quantity)}
                </div>
              </div>
            ))}

            <div className="pt-3 mt-3 border-t border-border">
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-green-700">{formatCurrency(selectedOrder.total_amount)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Print/Delete Buttons */}
        <div className="p-4 border-t border-border space-y-3">
          <div className="flex gap-2">
            <Button
              className="flex-1"
              size="lg"
              onClick={onPrintBill}
            >
              <Printer className="w-4 h-4 mr-2" />
              Print Bill
            </Button>
            <Button
              className="flex-1"
              size="lg"
              variant="destructive"
              onClick={onDeleteOrder}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          </div>
          <Button
            className="w-full"
            size="lg"
            variant="outline"
            onClick={onResetPayment}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            New Transaction
          </Button>
        </div>
      </>
    )
  }

  // Active payment form
  if (selectedOrder) {
    const isOrderServed = ['ready', 'served'].includes(selectedOrder.status)
    const remaining = getRemainingAmount()
    const change = getChangeAmount()

    return (
      <>
        {/* Bill Details Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold flex items-center">
              <Receipt className="w-4 h-4 mr-2" />
              Bill Details
            </h3>
            <Badge variant="outline">{selectedOrder.status}</Badge>
          </div>
          <div className="text-sm text-muted-foreground">
            Order #{selectedOrder.order_number}
            {selectedOrder.customer_name && ` • ${selectedOrder.customer_name}`}
            {selectedOrder.table?.table_number && ` • Table ${selectedOrder.table.table_number}`}
          </div>
        </div>

        {/* Order Items and Payment Form */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Order Items */}
            <div className="space-y-2">
              {selectedOrder.items?.map((item, index) => (
                <div key={index} className="flex justify-between items-start py-2 border-b border-border last:border-0">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{item.product?.name || 'Unknown'}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatCurrency(item.unit_price || 0)} × {item.quantity}
                    </div>
                  </div>
                  <div className="text-sm font-medium">
                    {formatCurrency((item.unit_price || 0) * item.quantity)}
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="pt-3 border-t border-border">
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>{formatCurrency(selectedOrder.total_amount)}</span>
              </div>
            </div>

            {/* Payment Method Toggles */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Payment Method(s)</h4>
              <div className="flex gap-2">
                <Button
                  variant={activePaymentMethods.has('cash') ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onTogglePaymentMethod('cash')}
                  className="flex-1"
                >
                  <IndianRupee className="w-4 h-4 mr-1" />
                  Cash
                </Button>
                <Button
                  variant={activePaymentMethods.has('card') ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onTogglePaymentMethod('card')}
                  className="flex-1"
                >
                  <CreditCard className="w-4 h-4 mr-1" />
                  Card
                </Button>
                <Button
                  variant={activePaymentMethods.has('digital') ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onTogglePaymentMethod('digital')}
                  className="flex-1"
                >
                  <QrCode className="w-4 h-4 mr-1" />
                  Digital
                </Button>
              </div>

              {/* Amount inputs for active methods */}
              <div className="space-y-2">
                {activePaymentMethods.has('cash') && (
                  <div>
                    <label className="text-xs text-muted-foreground">Cash Amount</label>
                    <Input
                      type="number"
                      placeholder={formatCurrency(selectedOrder.total_amount)}
                      value={paymentAmounts.cash}
                      onChange={(e) => onPaymentAmountChange('cash', e.target.value)}
                    />
                  </div>
                )}
                {activePaymentMethods.has('card') && (
                  <div>
                    <label className="text-xs text-muted-foreground">Card Amount</label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={paymentAmounts.card}
                      onChange={(e) => onPaymentAmountChange('card', e.target.value)}
                    />
                  </div>
                )}
                {activePaymentMethods.has('digital') && (
                  <div>
                    <label className="text-xs text-muted-foreground">Digital Amount</label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={paymentAmounts.digital}
                      onChange={(e) => onPaymentAmountChange('digital', e.target.value)}
                    />
                  </div>
                )}
              </div>

              {/* Reference number for card/digital */}
              {(activePaymentMethods.has('card') || activePaymentMethods.has('digital')) && (
                <div>
                  <label className="text-xs text-muted-foreground">Reference Number (optional)</label>
                  <Input
                    placeholder="Transaction ID"
                    value={referenceNumber}
                    onChange={(e) => onReferenceNumberChange(e.target.value)}
                  />
                </div>
              )}

              {/* Payment summary */}
              <div className="p-3 bg-muted/50 rounded-lg space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Total Entered:</span>
                  <span>{formatCurrency(getTotalPaidAmount())}</span>
                </div>
                {remaining > 0 && (
                  <div className="flex justify-between text-sm text-amber-600">
                    <span>Remaining:</span>
                    <span>{formatCurrency(remaining)}</span>
                  </div>
                )}
                {change > 0 && (
                  <div className="flex justify-between text-sm text-green-600 font-medium">
                    <span>Change to Return:</span>
                    <span>{formatCurrency(change)}</span>
                  </div>
                )}
              </div>

              {/* Status warning */}
              {!isOrderServed && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 text-amber-800 rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>Order must be 'ready' or 'served' before payment</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Payment Buttons */}
        <div className="p-4 border-t border-border space-y-3">
          <div className="flex gap-2">
            <Button
              className="flex-1"
              size="lg"
              variant="outline"
              onClick={() => onProcessPayment(false)}
              disabled={!isOrderServed || isProcessingPayment}
            >
              {isProcessingPayment ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Save
                </>
              )}
            </Button>
            <Button
              className="flex-1"
              size="lg"
              onClick={() => onProcessPayment(true)}
              disabled={!isOrderServed || isProcessingPayment}
            >
              {isProcessingPayment ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <Printer className="w-4 h-4 mr-2" />
                  Save & Print
                </>
              )}
            </Button>
          </div>
          <Button
            className="w-full"
            size="lg"
            variant="outline"
            onClick={onResetPayment}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        </div>
      </>
    )
  }

  // No selection - empty state
  return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground">
      <div className="text-center">
        <Receipt className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>Select an order to process payment</p>
      </div>
    </div>
  )
}
