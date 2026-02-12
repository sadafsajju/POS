import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  X,
  Plus,
  Minus,
  Trash2,
  Save,
  Receipt
} from 'lucide-react'
import type { Order } from '../types'

interface EditOrderDialogProps {
  order: Order
  isUpdating: boolean
  onUpdateItem: (orderId: string, itemId: string, quantity: number) => void
  onRemoveItem: (orderId: string, itemId: string) => void
  onClose: () => void
  formatCurrency: (amount: number) => string
}

export function EditOrderDialog({
  order,
  isUpdating,
  onUpdateItem,
  onRemoveItem,
  onClose,
  formatCurrency
}: EditOrderDialogProps) {
  // Track local quantity changes before saving
  const [pendingChanges, setPendingChanges] = useState<Record<string, number>>({})

  const getItemQuantity = (itemId: string, originalQuantity: number) => {
    return pendingChanges[itemId] ?? originalQuantity
  }

  const handleQuantityChange = (itemId: string, originalQuantity: number, delta: number) => {
    const currentQty = getItemQuantity(itemId, originalQuantity)
    const newQty = Math.max(1, currentQty + delta)
    setPendingChanges(prev => ({ ...prev, [itemId]: newQty }))
  }

  const handleSaveItem = (itemId: string, originalQuantity: number) => {
    const newQty = pendingChanges[itemId]
    if (newQty !== undefined && newQty !== originalQuantity) {
      onUpdateItem(order.id, itemId, newQty)
      // Clear pending change after save
      setPendingChanges(prev => {
        const next = { ...prev }
        delete next[itemId]
        return next
      })
    }
  }

  const hasChanges = (itemId: string, originalQuantity: number) => {
    return pendingChanges[itemId] !== undefined && pendingChanges[itemId] !== originalQuantity
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[85vh] flex flex-col text-zinc-100">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <Receipt className="w-6 h-6 text-zinc-100" />
            <h3 className="font-black tracking-tight text-xl text-zinc-100">Edit Order #{order.order_number}</h3>
            <Badge variant="outline" className="text-sm px-3 py-1 border-zinc-700 text-zinc-300">{order.status}</Badge>
          </div>
          <Button variant="ghost" size="lg" onClick={onClose} className="h-12 w-12 p-0 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100">
            <X className="w-6 h-6" />
          </Button>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            {order.items?.map(item => {
              const currentQty = getItemQuantity(item.id, item.quantity)
              const itemHasChanges = hasChanges(item.id, item.quantity)
              const itemTotal = (item.unit_price || 0) * currentQty

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-lg border ${
                    itemHasChanges
                      ? 'border-amber-500 bg-amber-500/10'
                      : 'border-zinc-800 bg-zinc-800/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-lg truncate text-zinc-100">
                        {item.product?.name || 'Unknown Product'}
                      </div>
                      <div className="text-base text-zinc-400 mt-1">
                        {formatCurrency(item.unit_price || 0)} each
                      </div>
                      {item.special_instructions && (
                        <div className="text-sm text-zinc-500 mt-2 italic">
                          Note: {item.special_instructions}
                        </div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-semibold text-lg text-zinc-100">{formatCurrency(itemTotal)}</div>
                    </div>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-700">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={() => handleQuantityChange(item.id, item.quantity, -1)}
                        disabled={currentQty <= 1 || isUpdating}
                        className="h-12 w-12 p-0 bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                      >
                        <Minus className="w-5 h-5" />
                      </Button>
                      <span className="w-12 text-center text-lg font-semibold text-zinc-100">{currentQty}</span>
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={() => handleQuantityChange(item.id, item.quantity, 1)}
                        disabled={isUpdating}
                        className="h-12 w-12 p-0 bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                      >
                        <Plus className="w-5 h-5" />
                      </Button>
                    </div>

                    <div className="flex items-center gap-3">
                      {itemHasChanges && (
                        <Button
                          variant="default"
                          size="lg"
                          onClick={() => handleSaveItem(item.id, item.quantity)}
                          disabled={isUpdating}
                          className="h-12 px-4 bg-amber-500 hover:bg-amber-400 text-white font-black tracking-wider"
                        >
                          {isUpdating ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              <Save className="w-5 h-5 mr-2" />
                              Save
                            </>
                          )}
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        size="lg"
                        onClick={() => onRemoveItem(order.id, item.id)}
                        disabled={isUpdating}
                        className="h-12 w-12 p-0"
                        title="Remove item"
                      >
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}

            {(!order.items || order.items.length === 0) && (
              <div className="text-center py-12 text-zinc-500">
                <Receipt className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">No items in this order</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 flex-shrink-0">
          <div className="flex justify-between items-center mb-4">
            <span className="text-lg text-zinc-400">Order Total:</span>
            <span className="text-2xl font-black tracking-tight text-zinc-100">{formatCurrency(order.total_amount)}</span>
          </div>
          <Button variant="outline" size="lg" className="w-full h-14 text-lg bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
