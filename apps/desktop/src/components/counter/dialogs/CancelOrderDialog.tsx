import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { AlertTriangle, X } from 'lucide-react'
import type { Order } from '../types'

interface CancelOrderDialogProps {
  order: Order | null
  isDeleting: boolean
  onConfirm: () => void
  onCancel: () => void
  formatCurrency: (amount: number) => string
}

/**
 * Confirmation dialog for canceling/deleting an order
 */
export function CancelOrderDialog({
  order,
  isDeleting,
  onConfirm,
  onCancel,
  formatCurrency
}: CancelOrderDialogProps) {
  if (!order) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-lg mx-4">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-red-600" />
              </div>
              <div>
                <CardTitle className="text-xl">Cancel Order</CardTitle>
                <CardDescription className="text-base">This action cannot be undone</CardDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="lg"
              className="h-12 w-12 p-0"
              onClick={onCancel}
            >
              <X className="w-6 h-6" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex justify-between mb-2">
                <span className="font-semibold text-lg">Order #{order.order_number}</span>
                <span className="text-base text-muted-foreground">{order.status}</span>
              </div>
              {order.customer_name && (
                <div className="text-base text-muted-foreground">
                  Customer: {order.customer_name}
                </div>
              )}
              {order.table?.table_number && (
                <div className="text-base text-muted-foreground">
                  Table: {order.table.table_number}
                </div>
              )}
              <div className="text-base text-muted-foreground mt-2 pt-2 border-t border-border">
                {order.items?.length || 0} items • <span className="font-semibold text-foreground">{formatCurrency(order.total_amount)}</span>
              </div>
            </div>
            <p className="text-base text-muted-foreground">
              Are you sure you want to cancel this order? The order will be removed from the system and cannot be recovered.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex gap-3 pt-2">
          <Button
            variant="outline"
            size="lg"
            className="flex-1 h-14 text-base"
            onClick={onCancel}
            disabled={isDeleting}
          >
            Keep Order
          </Button>
          <Button
            variant="destructive"
            size="lg"
            className="flex-1 h-14 text-base"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Canceling...
              </>
            ) : (
              'Cancel Order'
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
