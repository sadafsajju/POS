import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { OnScreenKeyboard } from '@/components/ui/on-screen-keyboard'
import {
  ShoppingCart,
  Plus,
  Minus,
  ChefHat,
  Printer,
  CloudOff,
  Trash2,
  AlertTriangle,
  MessageSquare,
  CreditCard,
  CheckCircle2,
  DoorOpen
} from 'lucide-react'
import type { DiningTable, Order, CartItem, OrderType, BillSummary } from '../types'
import { consolidateItems, getTableOrders } from '../utils/orderUtils'

// Minimal product interface that works with both Product and CartItem.product
interface AddableProduct {
  id: string
  name: string
  price: number
  description?: string
  preparation_time?: number
  is_available?: boolean
}

interface CartPanelProps {
  cart: CartItem[]
  orderType: OrderType
  selectedTable: DiningTable | null
  allOrders: Order[]
  orderNotes: string
  isOnline: boolean
  isCreating: boolean
  activeBill: BillSummary | null
  canProcessPayment?: boolean
  onOpenPayment?: () => void
  onClearTable?: () => void
  onOrderNotesChange: (notes: string) => void
  onAddToCart: (product: AddableProduct) => void
  onRemoveFromCart: (productId: string, cartItemId?: string) => void
  onRemoveItem: (productId: string, cartItemId?: string) => void
  onUpdateSpecialInstructions: (productId: string, instructions: string, cartItemId?: string) => void
  onClearCart: () => void
  onCreateOrder: (shouldPrint: boolean) => void
  onCancelOrder: (order: Order) => void
  onEditOrder: (order: Order) => void
  formatCurrency: (amount: number) => string
  getTotalAmount: () => number
}

/**
 * Right sidebar panel for order creation with unified cart view
 */
export function CartPanel({
  cart,
  orderType,
  selectedTable,
  allOrders,
  orderNotes,
  isOnline,
  isCreating,
  activeBill,
  canProcessPayment = true,
  onOpenPayment,
  onClearTable,
  onOrderNotesChange,
  onAddToCart,
  onRemoveFromCart,
  onRemoveItem,
  onUpdateSpecialInstructions,
  onClearCart,
  onCreateOrder,
  onCancelOrder,
  onEditOrder,
  formatCurrency,
  getTotalAmount
}: CartPanelProps) {
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [showClearTableConfirm, setShowClearTableConfirm] = useState(false)
  // Store both productId and optional cartItemId for keyboard target
  const [keyboardForItem, setKeyboardForItem] = useState<{ productId: string; cartItemId?: string } | null>(null)
  const [keyboardValue, setKeyboardValue] = useState('')
  const [showOrderNotesKeyboard, setShowOrderNotesKeyboard] = useState(false)

  // Helper: get unit price including option + combo adjustments
  const getItemUnitPrice = (item: CartItem) => {
    const optAdj = (item.selectedOptions || []).reduce((s, o) => s + o.priceAdjustment, 0)
    const comboAdj = (item.selectedComboChoices || []).reduce((s, c) => s + c.priceAdjustment, 0)
    return item.product.price + optAdj + comboAdj
  }

  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when cart items change
  useEffect(() => {
    if (scrollContainerRef.current && cart.length > 0) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth'
      })
    }
  }, [cart.length])

  const tableOrders = selectedTable ? getTableOrders(allOrders, selectedTable.id) : []
  const isDisabled = cart.length === 0 || (orderType === 'dine_in' && !selectedTable) || isCreating

  // KOT support: use activeBill KOTs if available, otherwise fall back to tableOrders
  const activeKOTs = activeBill?.kots || []
  const hasActiveBill = activeBill && activeKOTs.length > 0

  // Dynamic button state
  const hasNewItems = cart.length > 0
  const hasActiveOrders = hasActiveBill || tableOrders.length > 0
  const isDineIn = orderType === 'dine_in'

  const handleClearCart = () => {
    onClearCart()
    setShowClearConfirm(false)
  }

  return (
    <>
    {/* Clear Table Confirmation Dialog */}
    {showClearTableConfirm && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <Card className="w-full max-w-md mx-4">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                <DoorOpen className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <CardTitle>Clear Table</CardTitle>
                <CardDescription>Mark the table as available</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Are you sure the customer has left? This will mark all orders as completed and free up the table.
            </p>
          </CardContent>
          <CardFooter className="flex gap-3">
            <Button
              variant="outline"
              size="lg"
              className="flex-1 h-14"
              onClick={() => setShowClearTableConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              size="lg"
              className="flex-1 h-14 bg-orange-600 hover:bg-orange-700 text-white"
              onClick={() => {
                setShowClearTableConfirm(false)
                onClearTable?.()
              }}
            >
              <DoorOpen className="w-5 h-5 mr-2" />
              Clear Table
            </Button>
          </CardFooter>
        </Card>
      </div>
    )}

    {/* Clear Cart Confirmation Dialog */}
    {showClearConfirm && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <Card className="w-full max-w-md mx-4">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <CardTitle>Clear Cart</CardTitle>
                <CardDescription>Remove all items from your order</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Are you sure you want to clear all {cart.length} item{cart.length !== 1 ? 's' : ''} from your cart? This action cannot be undone.
            </p>
          </CardContent>
          <CardFooter className="flex gap-3">
            <Button
              variant="outline"
              size="lg"
              className="flex-1 h-14"
              onClick={() => setShowClearConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="lg"
              className="flex-1 h-14"
              onClick={handleClearCart}
            >
              <Trash2 className="w-5 h-5 mr-2" />
              Clear All
            </Button>
          </CardFooter>
        </Card>
      </div>
    )}

    <div className="flex flex-col h-full overflow-hidden">
      {/* Unified scrollable area */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto min-h-0">

        {/* Previous KOTs - read-only (dine-in only) */}
        {isDineIn && hasActiveBill && (
          <div className="p-4 space-y-3">
            {activeKOTs.map((kot: Order) => (
              <div
                key={kot.id}
                className="bg-slate-800 p-3 rounded-lg border border-slate-600"
              >
                {/* KOT Header: badge + trash icon */}
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-orange-500 text-white text-sm px-2 py-0.5">
                      {kot.kot_number || kot.order_number}
                    </Badge>
                    {kot.customer_name && (
                      <span className="text-sm text-slate-300">
                        {kot.customer_name}
                      </span>
                    )}
                    <Badge variant="outline" className="text-xs px-2 py-0.5 text-white border-slate-500">
                      {kot.status}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      onCancelOrder(kot)
                    }}
                    className="h-10 w-10 p-0 text-slate-400 hover:text-red-500 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-5 h-5" />
                  </Button>
                </div>

                {/* KOT Items - tappable to edit */}
                {kot.items && kot.items.length > 0 && (
                  <div
                    className="space-y-1 cursor-pointer"
                    onClick={() => onEditOrder(kot)}
                  >
                    {consolidateItems(kot.items).map((item, idx) => (
                      <div
                        key={item.product_id || idx}
                        className="flex justify-between text-sm text-slate-300 py-1 hover:text-white active:bg-slate-700 rounded px-1"
                      >
                        <span>{item.quantity}x {item.name}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* KOT Subtotal */}
                <div className="flex justify-between items-center pt-2 mt-2 border-t border-slate-600 text-sm">
                  <span className="text-slate-400">
                    {consolidateItems(kot.items || []).reduce((sum, item) => sum + item.quantity, 0)} items
                  </span>
                  <span className="font-semibold text-white">
                    {formatCurrency(kot.total_amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Legacy fallback: non-KOT table orders (dine-in only) */}
        {isDineIn && !hasActiveBill && tableOrders.length > 0 && (
          <div className="p-4 space-y-3">
            {tableOrders.map(order => (
              <div
                key={order.id}
                className="bg-slate-800 p-3 rounded-lg border border-slate-600"
              >
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-base text-white">#{order.order_number}</span>
                    {order.customer_name && (
                      <span className="text-sm text-slate-300">
                        {order.customer_name}
                      </span>
                    )}
                    <Badge variant="outline" className="text-xs px-2 py-0.5 text-white border-slate-500">
                      {order.status}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      onCancelOrder(order)
                    }}
                    className="h-10 w-10 p-0 text-slate-400 hover:text-red-500 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-5 h-5" />
                  </Button>
                </div>
                {order.items && order.items.length > 0 && (
                  <div
                    className="space-y-1 cursor-pointer"
                    onClick={() => onEditOrder(order)}
                  >
                    {consolidateItems(order.items).map((item, idx) => (
                      <div
                        key={item.product_id || idx}
                        className="flex justify-between text-sm text-slate-300 py-1 hover:text-white active:bg-slate-700 rounded px-1"
                      >
                        <span>{item.quantity}x {item.name}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 mt-2 border-t border-slate-600 text-sm">
                  <span className="text-slate-400">
                    {consolidateItems(order.items || []).reduce((sum, item) => sum + item.quantity, 0)} items
                  </span>
                  <span className="font-semibold text-white">
                    {formatCurrency(order.total_amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* New Items header + Clear button */}
        {hasNewItems && (
          <div className="flex justify-between items-center px-4 pt-3 pb-1">
            {hasActiveOrders && isDineIn && (
              <div className="w-full mb-2 border-t-4 border-primary/30" />
            )}
          </div>
        )}
        {hasNewItems && (
          <div className="flex justify-between items-center px-4 pb-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              {hasActiveOrders && isDineIn ? 'New Items' : 'Order Items'}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowClearConfirm(true)}
              className="h-8 px-2 text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Clear
            </Button>
          </div>
        )}

        {/* New cart items (editable) */}
        {hasNewItems && (
          <div className="px-4 pb-4">
            <div className="border-l border-t border-border">
              {cart.map(item => {
                const itemKey = item.cartItemId || item.product.id
                const unitPrice = getItemUnitPrice(item)
                const hasOptions = item.selectedOptions && item.selectedOptions.length > 0

                return (
                <div key={itemKey} className="border-r border-b border-border bg-card">
                  <div className="flex items-center p-4 gap-4 hover:bg-muted/50 active:bg-muted touch-manipulation">
                    <Button
                      variant="ghost"
                      size="lg"
                      onClick={() => onRemoveItem(item.product.id, item.cartItemId)}
                      className="h-12 w-12 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 active:bg-destructive/20 flex-shrink-0 rounded-none"
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-base truncate">{item.product.name}</div>
                      {/* Selected options display */}
                      {hasOptions && (
                        <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
                          {/* Group options by group name */}
                          {Object.entries(
                            item.selectedOptions!.reduce<Record<string, Array<{ name: string; adj: number }>>>((acc, opt) => {
                              if (!acc[opt.groupName]) acc[opt.groupName] = []
                              acc[opt.groupName].push({ name: opt.itemName, adj: opt.priceAdjustment })
                              return acc
                            }, {})
                          ).map(([groupName, items]) => (
                            <div key={groupName}>
                              <span className="font-medium">{groupName}:</span>{' '}
                              {items.map((i, idx) => (
                                <span key={idx}>
                                  {idx > 0 && ', '}
                                  {i.name}
                                  {i.adj !== 0 && (
                                    <span className={i.adj > 0 ? 'text-orange-500' : 'text-green-500'}>
                                      {' '}({i.adj > 0 ? '+' : ''}{formatCurrency(i.adj)})
                                    </span>
                                  )}
                                </span>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Combo choices display */}
                      {item.selectedComboChoices && item.selectedComboChoices.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
                          {item.selectedComboChoices.map((choice, idx) => (
                            <div key={idx}>
                              <span className="font-medium">{choice.slotName}:</span>{' '}
                              {choice.productName}
                              {choice.priceAdjustment > 0 && (
                                <span className="text-orange-500">
                                  {' '}(+{formatCurrency(choice.priceAdjustment)})
                                </span>
                              )}
                              {/* Nested options for configurable sub-items */}
                              {choice.selectedOptions && choice.selectedOptions.length > 0 && (
                                <span className="text-muted-foreground/70">
                                  {' — '}
                                  {choice.selectedOptions.map((opt, oi) => (
                                    <span key={oi}>
                                      {oi > 0 && ', '}
                                      {opt.itemName}
                                      {opt.priceAdjustment !== 0 && (
                                        <span className={opt.priceAdjustment > 0 ? 'text-orange-500' : 'text-green-500'}>
                                          {' '}({opt.priceAdjustment > 0 ? '+' : ''}{formatCurrency(opt.priceAdjustment)})
                                        </span>
                                      )}
                                    </span>
                                  ))}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="text-sm text-muted-foreground">
                        {formatCurrency(unitPrice)} × {item.quantity} = <span className="font-semibold text-foreground">{formatCurrency(unitPrice * item.quantity)}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="lg"
                      onClick={() => {
                        setKeyboardForItem({ productId: item.product.id, cartItemId: item.cartItemId })
                        setKeyboardValue(item.special_instructions || '')
                      }}
                      className={`h-12 w-12 p-0 flex-shrink-0 ${item.special_instructions ? 'text-primary' : 'text-muted-foreground'}`}
                      title="Add note"
                    >
                      <MessageSquare className="h-5 w-5" />
                    </Button>
                    <div className="flex items-center">
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={() => onRemoveFromCart(item.product.id, item.cartItemId)}
                        className="h-12 w-12 p-0 rounded-none border-r-0"
                      >
                        <Minus className="h-5 w-5" />
                      </Button>
                      <span className="h-12 w-12 flex items-center justify-center text-lg font-semibold border border-border">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={() => onAddToCart(item.product)}
                        className="h-12 w-12 p-0 rounded-none border-l-0"
                      >
                        <Plus className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                  {item.special_instructions && (
                    <div
                      className="px-4 pb-3 pt-0 text-sm text-muted-foreground cursor-pointer hover:text-foreground"
                      onClick={() => {
                        setKeyboardForItem({ productId: item.product.id, cartItemId: item.cartItemId })
                        setKeyboardValue(item.special_instructions || '')
                      }}
                    >
                      <span className="italic">Note: {item.special_instructions}</span>
                    </div>
                  )}
                </div>
                )
              })}
            </div>
            {/* Order Notes */}
            <div className="mt-4">
              <label className="text-sm font-medium">Order Notes</label>
              <div
                onClick={() => setShowOrderNotesKeyboard(true)}
                className="mt-1 flex min-h-[44px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm cursor-pointer hover:bg-muted/50 active:bg-muted"
              >
                {orderNotes ? (
                  <span>{orderNotes}</span>
                ) : (
                  <span className="text-muted-foreground">Special requests or notes...</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!hasActiveOrders && !hasNewItems && (
          <div className="flex flex-col items-center justify-center text-muted-foreground h-[calc(100vh-300px)] min-h-[200px]">
            <ShoppingCart className="w-12 h-12 mb-3 opacity-50" />
            <p>No items in order</p>
            <p className="text-sm">Add items from the menu to get started</p>
          </div>
        )}
      </div>

      {/* Order Summary and Actions */}
      {(hasActiveOrders || hasNewItems) && (
        <div className="border-t border-border bg-card flex-shrink-0">
          {/* Summary rows */}
          <div className="border-b border-border">
            {hasActiveBill && (
              <div className="flex justify-between text-sm text-muted-foreground px-4 py-2 border-b border-border">
                <span>Session ({activeKOTs.length} KOT{activeKOTs.length !== 1 ? 's' : ''}):</span>
                <span>{formatCurrency(activeBill?.aggregated_total || 0)}</span>
              </div>
            )}
            {hasNewItems && (
              <div className="flex justify-between text-sm text-muted-foreground px-4 py-2 border-b border-border">
                <span>New Items:</span>
                <span>{formatCurrency(getTotalAmount())}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-semibold px-4 py-3">
              <span>Total:</span>
              <span>{formatCurrency(
                getTotalAmount() +
                (hasActiveBill ? (activeBill?.aggregated_total || 0) : tableOrders.reduce((sum, order) => sum + order.total_amount, 0))
              )}</span>
            </div>
          </div>

          {/* Dynamic Action Buttons */}
          <div className="flex">
            {/* New items in cart → Save + KOT buttons */}
            {hasNewItems && (
              <>
                <Button
                  className="flex-1 h-14 text-base rounded-none border-0 border-r border-border"
                  size="lg"
                  variant="outline"
                  onClick={() => onCreateOrder(false)}
                  disabled={isDisabled}
                >
                  {isCreating ? (
                    <>
                      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
                      Saving...
                    </>
                  ) : !isOnline ? (
                    <>
                      <CloudOff className="w-5 h-5 mr-2" />
                      Save Offline
                    </>
                  ) : (
                    <>
                      <ChefHat className="w-5 h-5 mr-2" />
                      Save
                    </>
                  )}
                </Button>
                <Button
                  className="flex-1 h-14 text-base rounded-none"
                  size="lg"
                  onClick={() => onCreateOrder(true)}
                  disabled={isDisabled}
                >
                  {isCreating ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Printing...
                    </>
                  ) : (
                    <>
                      <Printer className="w-5 h-5 mr-2" />
                      KOT
                    </>
                  )}
                </Button>
              </>
            )}

            {/* No new items + active orders + can pay → Pay button (hidden if already paid) */}
            {!hasNewItems && hasActiveOrders && isDineIn && canProcessPayment && onOpenPayment && activeBill?.bill?.status !== 'paid' && (
              <Button
                className="flex-1 w-full h-14 text-base rounded-none bg-blue-600 hover:bg-blue-700 text-white"
                size="lg"
                onClick={onOpenPayment}
              >
                <CreditCard className="w-5 h-5 mr-2" />
                Pay
              </Button>
            )}

            {/* Bill is paid — show status + Clear Table button */}
            {!hasNewItems && hasActiveOrders && isDineIn && activeBill?.bill?.status === 'paid' && (() => {
              const allKOTsServed = (activeBill?.kots || []).every(
                (kot: Order) => ['served', 'completed', 'cancelled'].includes(kot.status)
              )
              return (
                <>
                  <div className="flex-1 h-14 flex items-center justify-center gap-2 text-white bg-green-600 rounded-none">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-base font-medium">Paid{!allKOTsServed ? ' — Awaiting Service' : ''}</span>
                  </div>
                  {onClearTable && (
                    <Button
                      className="flex-1 h-14 text-base rounded-none"
                      variant="outline"
                      size="lg"
                      onClick={() => setShowClearTableConfirm(true)}
                      disabled={!allKOTsServed}
                    >
                      <DoorOpen className="w-5 h-5 mr-2" />
                      Clear Table
                    </Button>
                  )}
                </>
              )
            })()}
          </div>
        </div>
      )}
    </div>

    {/* On-Screen Keyboard for Item Notes */}
    <OnScreenKeyboard
      open={keyboardForItem !== null}
      onOpenChange={(open) => {
        if (!open) setKeyboardForItem(null)
      }}
      value={keyboardValue}
      onValueChange={setKeyboardValue}
      onSubmit={(value) => {
        if (keyboardForItem) {
          onUpdateSpecialInstructions(keyboardForItem.productId, value, keyboardForItem.cartItemId)
        }
        setKeyboardForItem(null)
      }}
      title="Add Item Note"
      placeholder="e.g., no onions, extra spicy..."
      maxLength={200}
    />

    {/* On-Screen Keyboard for Order Notes */}
    <OnScreenKeyboard
      open={showOrderNotesKeyboard}
      onOpenChange={setShowOrderNotesKeyboard}
      value={orderNotes}
      onValueChange={onOrderNotesChange}
      onSubmit={(value) => {
        onOrderNotesChange(value)
        setShowOrderNotesKeyboard(false)
      }}
      title="Order Notes"
      placeholder="Special requests or notes for the entire order..."
      maxLength={500}
    />
    </>
  )
}
