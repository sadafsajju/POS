import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { OnScreenKeyboard } from '@/components/ui/on-screen-keyboard'
import {
  ShoppingCart,
  Minus,
  ChefHat,
  Printer,
  CloudOff,
  Trash2,
  AlertTriangle,
  MessageSquare,
  CreditCard,
  CheckCircle2,
  DoorOpen,
  StickyNote
} from 'lucide-react'
import type { DiningTable, Order, CartItem, OrderType, BillSummary } from '../types'
import type { CartSettings } from '@pos/types'
import { useSettingsStore } from '@pos/core'
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
  cartSettings?: CartSettings
  canProcessPayment?: boolean
  taxRate?: number
  onOpenPayment?: () => void
  onClearTable?: () => void
  onOrderNotesChange: (notes: string) => void
  onAddToCart: (product: AddableProduct) => void
  onRemoveFromCart: (productId: string, cartItemId?: string) => void
  onRemoveItem: (productId: string, cartItemId?: string) => void
  onUpdateQuantity: (productId: string, quantity: number, cartItemId?: string) => void
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
  cartSettings,
  canProcessPayment: _canProcessPayment = true,
  taxRate = 0,
  onOpenPayment,
  onClearTable,
  onOrderNotesChange,
  onAddToCart: _onAddToCart,
  onRemoveFromCart,
  onRemoveItem,
  onUpdateQuantity: _onUpdateQuantity,
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
  const [showNotesExpanded, setShowNotesExpanded] = useState(false)
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null)
  const [longPressItem, setLongPressItem] = useState<{ productId: string; cartItemId?: string } | null>(null)
  const { settings } = useSettingsStore()
  const touchMode = settings.touchMode

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

  const handleLongPressStart = (productId: string, cartItemId?: string) => {
    const timer = setTimeout(() => {
      // Long press triggered - remove the entire item
      onRemoveItem(productId, cartItemId)
      setLongPressItem(null)
    }, 800) // 800ms for long press
    setLongPressTimer(timer)
    setLongPressItem({ productId, cartItemId })
  }

  const handleLongPressEnd = (productId: string, cartItemId?: string) => {
    if (longPressTimer) {
      clearTimeout(longPressTimer)
      setLongPressTimer(null)
    }
    // If it wasn't a long press, do regular decrease
    if (longPressItem?.productId === productId && longPressItem?.cartItemId === cartItemId) {
      onRemoveFromCart(productId, cartItemId)
    }
    setLongPressItem(null)
  }

  const handleLongPressCancel = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer)
      setLongPressTimer(null)
    }
    setLongPressItem(null)
  }

  return (
    <>
    {/* Clear Table Confirmation Dialog */}
    {showClearTableConfirm && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <Card className="w-full max-w-md mx-4 bg-zinc-900 border-zinc-800 text-zinc-100">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center">
                <DoorOpen className="w-6 h-6 text-zinc-300" />
              </div>
              <div>
                <CardTitle className="text-zinc-100">Clear Table</CardTitle>
                <CardDescription className="text-zinc-400">Mark the table as available</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-zinc-400">
              Are you sure the customer has left? This will mark all orders as completed and free up the table.
            </p>
          </CardContent>
          <CardFooter className="flex gap-3">
            <Button
              variant="outline"
              size="lg"
              className="flex-1 h-14 bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
              onClick={() => setShowClearTableConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              size="lg"
              className="flex-1 h-14 bg-emerald-500 hover:bg-emerald-400 text-zinc-800"
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
        <Card className="w-full max-w-md mx-4 bg-zinc-900 border-zinc-800 text-zinc-100">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <CardTitle className="text-zinc-100">Clear Cart</CardTitle>
                <CardDescription className="text-zinc-400">Remove all items from your order</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-zinc-400">
              Are you sure you want to clear all {cart.length} item{cart.length !== 1 ? 's' : ''} from your cart? This action cannot be undone.
            </p>
          </CardContent>
          <CardFooter className="flex gap-3">
            <Button
              variant="outline"
              size="lg"
              className="flex-1 h-14 bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
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
        {isDineIn && hasActiveBill && (() => {
          const paidAmt = activeBill?.paid_amount || 0
          let runningTotal = 0
          const kotPaidMap = new Map<string, boolean>()
          for (const kot of activeKOTs) {
            runningTotal += kot.total_amount
            kotPaidMap.set(kot.id, runningTotal <= paidAmt + 0.01)
          }
          return (
          <div className="space-y-0">
            {activeKOTs.map((kot: Order) => (
              <div
                key={kot.id}
                className="bg-zinc-800 p-3 border-b border-zinc-700"
              >
                {/* KOT Header: badge + trash icon */}
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-orange-500 text-white text-sm px-2 py-0.5">
                      {kot.kot_number || kot.order_number}
                    </Badge>
                    {kot.order_source === 'kiosk' && (
                      <Badge className="bg-cyan-500 text-white text-[10px] font-bold px-1.5 py-0">
                        Kiosk
                      </Badge>
                    )}
                    {kot.customer_name && (
                      <span className="text-sm text-zinc-300">
                        {kot.customer_name}
                      </span>
                    )}
                    <Badge variant="outline" className="text-xs px-2 py-0.5 text-white border-zinc-600">
                      {kot.status}
                    </Badge>
                    {kotPaidMap.get(kot.id) && (
                      <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs px-2 py-0.5">
                        Paid
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      onCancelOrder(kot)
                    }}
                    className="h-10 w-10 p-0 text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
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
                        className="flex justify-between text-sm text-zinc-300 py-1 hover:text-zinc-100 active:bg-zinc-700 rounded px-1"
                      >
                        <span>{item.quantity}x {item.name}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* KOT Subtotal */}
                <div className="flex justify-between items-center pt-2 mt-2 border-t border-zinc-700 text-sm">
                  <span className="text-zinc-400">
                    {consolidateItems(kot.items || []).reduce((sum, item) => sum + item.quantity, 0)} items
                  </span>
                  <span className="font-semibold text-white">
                    {formatCurrency(kot.total_amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
          )
        })()}

        {/* Legacy fallback: non-KOT table orders (dine-in only) */}
        {isDineIn && !hasActiveBill && tableOrders.length > 0 && (
          <div className="space-y-0">
            {tableOrders.map(order => (
              <div
                key={order.id}
                className="bg-zinc-800 p-3 border-b border-zinc-700"
              >
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-base text-white">#{order.order_number}</span>
                    {order.order_source === 'kiosk' && (
                      <Badge className="bg-cyan-500 text-white text-[10px] font-bold px-1.5 py-0">
                        Kiosk
                      </Badge>
                    )}
                    {order.customer_name && (
                      <span className="text-sm text-zinc-300">
                        {order.customer_name}
                      </span>
                    )}
                    <Badge variant="outline" className="text-xs px-2 py-0.5 text-white border-zinc-600">
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
                    className="h-10 w-10 p-0 text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
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
                        className="flex justify-between text-sm text-zinc-300 py-1 hover:text-zinc-100 active:bg-zinc-700 rounded px-1"
                      >
                        <span>{item.quantity}x {item.name}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 mt-2 border-t border-zinc-700 text-sm">
                  <span className="text-zinc-400">
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
        {hasNewItems && hasActiveOrders && isDineIn && (
          <div className="border-t-4 border-amber-500/30" />
        )}
        {hasNewItems && (
          <div className="flex justify-between items-center px-3 py-2 bg-zinc-900 border-b border-zinc-800">
            <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">
              {hasActiveOrders && isDineIn ? 'New Items' : 'Order Items'}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (cartSettings?.confirmBeforeClear === false) {
                  handleClearCart()
                } else {
                  setShowClearConfirm(true)
                }
              }}
              className="h-8 px-2 text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Clear
            </Button>
          </div>
        )}

        {/* New cart items (editable) */}
        {hasNewItems && (
          <div>
            <div>
              {cart.map(item => {
                const itemKey = item.cartItemId || item.product.id
                const unitPrice = getItemUnitPrice(item)
                const hasOptions = item.selectedOptions && item.selectedOptions.length > 0

                return (
                <div key={itemKey} className="border-b border-zinc-800 bg-zinc-900">
                  <div className="flex items-center p-3 gap-3 hover:bg-zinc-800 active:bg-zinc-700 touch-manipulation">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-base truncate text-zinc-100">{item.product.name}</div>
                      {/* Selected options - values only */}
                      {hasOptions && (
                        <div className="text-xs text-zinc-500 mt-0.5">
                          {item.selectedOptions!.map((opt, idx) => (
                            <span key={idx}>
                              {idx > 0 && ', '}
                              {opt.itemName}
                              {opt.priceAdjustment !== 0 && (
                                <span className={item.product.price === 0 && opt.priceAdjustment > 0 ? 'text-amber-400' : opt.priceAdjustment > 0 ? 'text-orange-500' : 'text-green-500'}>
                                  {' '}({item.product.price === 0 && opt.priceAdjustment > 0 ? '' : opt.priceAdjustment > 0 ? '+' : ''}{formatCurrency(opt.priceAdjustment)})
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                      {/* Combo choices - values only */}
                      {item.selectedComboChoices && item.selectedComboChoices.length > 0 && (
                        <div className="text-xs text-zinc-500 mt-0.5">
                          {item.selectedComboChoices.map((choice, idx) => (
                            <span key={idx}>
                              {idx > 0 && ', '}
                              {choice.productName}
                              {choice.priceAdjustment > 0 && (
                                <span className="text-orange-500">
                                  {' '}(+{formatCurrency(choice.priceAdjustment)})
                                </span>
                              )}
                              {/* Nested options for configurable sub-items */}
                              {choice.selectedOptions && choice.selectedOptions.length > 0 && (
                                <span className="text-zinc-600">
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
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="text-sm text-zinc-400">
                        {formatCurrency(unitPrice)} × {item.quantity} = <span className="font-semibold text-zinc-100">{formatCurrency(unitPrice * item.quantity)}</span>
                      </div>
                    </div>
                    {cartSettings?.showSpecialInstructions !== false && (
                    <Button
                      variant="ghost"
                      size="lg"
                      onClick={() => {
                        if (touchMode) {
                          setKeyboardForItem({ productId: item.product.id, cartItemId: item.cartItemId })
                          setKeyboardValue(item.special_instructions || '')
                        } else {
                          // Toggle inline edit via keyboardForItem state (reused for both modes)
                          const isEditing = keyboardForItem?.productId === item.product.id && keyboardForItem?.cartItemId === item.cartItemId
                          if (isEditing) {
                            setKeyboardForItem(null)
                          } else {
                            setKeyboardForItem({ productId: item.product.id, cartItemId: item.cartItemId })
                            setKeyboardValue(item.special_instructions || '')
                          }
                        }
                      }}
                      className={`h-12 w-12 p-0 flex-shrink-0 ${item.special_instructions ? 'text-amber-400' : 'text-zinc-500'}`}
                      title="Add note"
                    >
                      <MessageSquare className="h-5 w-5" />
                    </Button>
                    )}
                    <Button
                      variant="outline"
                      size="lg"
                      onPointerDown={() => handleLongPressStart(item.product.id, item.cartItemId)}
                      onPointerUp={() => handleLongPressEnd(item.product.id, item.cartItemId)}
                      onPointerLeave={handleLongPressCancel}
                      onPointerCancel={handleLongPressCancel}
                      className={`h-12 w-12 p-0 bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800 flex-shrink-0 transition-colors ${
                        longPressItem?.productId === item.product.id && longPressItem?.cartItemId === item.cartItemId
                          ? 'bg-red-500/20 border-red-500 text-red-400'
                          : ''
                      }`}
                    >
                      <Minus className="h-5 w-5" />
                    </Button>
                  </div>
                  {cartSettings?.showSpecialInstructions !== false && (() => {
                    const isEditingThis = !touchMode && keyboardForItem?.productId === item.product.id && keyboardForItem?.cartItemId === item.cartItemId
                    return (
                      <>
                        {isEditingThis && (
                          <div className="px-3 pb-3 pt-1 bg-zinc-900">
                            <input
                              type="text"
                              autoFocus
                              value={keyboardValue}
                              onChange={(e) => setKeyboardValue(e.target.value)}
                              onBlur={() => {
                                onUpdateSpecialInstructions(item.product.id, keyboardValue, item.cartItemId)
                                setKeyboardForItem(null)
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  onUpdateSpecialInstructions(item.product.id, keyboardValue, item.cartItemId)
                                  setKeyboardForItem(null)
                                } else if (e.key === 'Escape') {
                                  setKeyboardForItem(null)
                                }
                              }}
                              placeholder="e.g., no onions, extra spicy..."
                              className="w-full h-10 px-3 bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder:text-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/50"
                            />
                          </div>
                        )}
                        {!isEditingThis && item.special_instructions && (
                          <div
                            className="px-3 pb-3 pt-0 text-sm text-zinc-500 cursor-pointer hover:text-zinc-300 bg-zinc-900"
                            onClick={() => {
                              if (touchMode) {
                                setKeyboardForItem({ productId: item.product.id, cartItemId: item.cartItemId })
                                setKeyboardValue(item.special_instructions || '')
                              } else {
                                setKeyboardForItem({ productId: item.product.id, cartItemId: item.cartItemId })
                                setKeyboardValue(item.special_instructions || '')
                              }
                            }}
                          >
                            <span className="italic">Note: {item.special_instructions}</span>
                          </div>
                        )}
                      </>
                    )
                  })()}
                </div>
                )
              })}
            </div>
            {/* Order Notes — collapsed by default, expands on click */}
            {cartSettings?.showOrderNotes !== false && (
            <div className="border-b border-zinc-800">
              {!orderNotes && !showNotesExpanded ? (
                <button
                  onClick={() => {
                    setShowNotesExpanded(true)
                    if (touchMode) setShowOrderNotesKeyboard(true)
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-3 min-h-[44px] text-sm text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 active:bg-zinc-800 transition-colors"
                >
                  <StickyNote className="h-4 w-4" />
                  Add note
                </button>
              ) : (
                <div className="px-3 py-2 bg-zinc-900">
                  {touchMode ? (
                    <div className="flex items-center gap-2">
                      <div
                        onClick={() => setShowOrderNotesKeyboard(true)}
                        className="flex-1 flex items-center gap-2 min-h-[44px] rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm cursor-pointer hover:bg-zinc-700 active:bg-zinc-600 text-zinc-100"
                      >
                        <StickyNote className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
                        {orderNotes ? (
                          <span className="truncate">{orderNotes}</span>
                        ) : (
                          <span className="text-zinc-500">Special requests...</span>
                        )}
                      </div>
                      {orderNotes && (
                        <button
                          onClick={() => { onOrderNotesChange(''); setShowNotesExpanded(false) }}
                          className="flex-shrink-0 flex items-center justify-center h-11 w-11 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 active:bg-zinc-600 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <StickyNote className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
                      <input
                        type="text"
                        autoFocus
                        value={orderNotes}
                        onChange={(e) => onOrderNotesChange(e.target.value)}
                        onBlur={() => { if (!orderNotes) setShowNotesExpanded(false) }}
                        placeholder="Special requests..."
                        className="flex-1 h-9 px-2 rounded-md border border-zinc-700 bg-zinc-800 text-zinc-100 placeholder:text-zinc-500 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-600"
                      />
                      {orderNotes && (
                        <button
                          onClick={() => { onOrderNotesChange(''); setShowNotesExpanded(false) }}
                          className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 active:bg-zinc-600 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!hasActiveOrders && !hasNewItems && (
          <div className="flex flex-col items-center justify-center text-zinc-500 h-[calc(100vh-300px)] min-h-[200px]">
            <ShoppingCart className="w-12 h-12 mb-3 opacity-20" />
            <p>No items in order</p>
            <p className="text-sm">Add items from the menu to get started</p>
          </div>
        )}
      </div>

      {/* Order Summary and Actions */}
      {(hasActiveOrders || hasNewItems) && (
        <div className="border-t border-zinc-800 bg-zinc-900 flex-shrink-0">
          {/* Summary rows */}
          {(() => {
            const subtotal = getTotalAmount()
            const tax = subtotal * (taxRate / 100)
            const totalWithTax = getTotalAmount() * (1 + taxRate / 100)
            const previousBalance = hasActiveBill
              ? Math.max(0, (activeBill?.aggregated_total || 0) - (activeBill?.paid_amount || 0))
              : tableOrders.filter(o => o.status !== 'paid').reduce((sum, order) => sum + order.total_amount, 0)
            const grandTotal = totalWithTax + previousBalance

            // Show TOTAL when: there are new items OR there's an unpaid balance
            const shouldShowTotal = hasNewItems || previousBalance > 0

            if (!shouldShowTotal) return null

            return (
              <div className="border-b border-zinc-800">
                <div className="border-b border-zinc-800">
                  {hasNewItems && taxRate > 0 && (
                    <div className="flex justify-between text-[10px] text-zinc-600 px-3 pt-2.5 font-mono">
                      <span>incl. Tax ({taxRate}%)</span>
                      <span>{formatCurrency(tax)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-black text-zinc-100 px-3 py-2.5 font-mono">
                    <span>TOTAL</span>
                    <span>{formatCurrency(grandTotal)}</span>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Dynamic Action Buttons — layout adapts to count */}
          {(() => {
            const buttons = orderType === 'dine_in' ? cartSettings?.dineInButtons
              : orderType === 'takeout' ? cartSettings?.takeoutButtons
              : cartSettings?.deliveryButtons
            const showSave = (buttons?.showSave !== false) && hasNewItems
            const showKot = (buttons?.showKot !== false) && hasNewItems
            const unpaidBalance = hasActiveBill
              ? Math.max(0, (activeBill?.aggregated_total || 0) - (activeBill?.paid_amount || 0))
              : tableOrders.filter(o => o.status !== 'paid').reduce((sum, order) => sum + order.total_amount, 0)
            // Show Pay when: there are new items, or there's an unpaid balance
            const showPay = (buttons?.showPay !== false) && (hasNewItems || unpaidBalance > 0)
            const visibleCount = [showSave, showKot, showPay].filter(Boolean).length

            // 1 button = full-width blue primary
            // 2 buttons = side by side, last one blue primary
            // 3 buttons = Save+KOT top row (outline), Pay bottom row (blue)
            const primaryClass = 'flex-1 h-14 text-base rounded-none bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-white font-black tracking-wider'
            const secondaryClass = 'flex-1 h-14 text-base rounded-none border-0 border-r border-zinc-800 bg-zinc-800 text-zinc-100 font-bold tracking-wide hover:bg-zinc-700 hover:text-white active:bg-zinc-600 transition-colors'

            const getSaveClass = () => {
              if (visibleCount === 1) return primaryClass
              if (visibleCount === 2 && !showKot && !showPay) return primaryClass
              return secondaryClass
            }
            const getKotClass = () => {
              if (visibleCount === 1) return primaryClass
              if (visibleCount === 2) return primaryClass
              return secondaryClass
            }

            // Layout: 1 button = full width, 2 buttons = side by side, 3 buttons = Save+KOT top row + Pay bottom
            const twoButtonRow = visibleCount === 2 && !showKot

            const saveBtn = showSave && (
              <Button
                key="save"
                className={twoButtonRow ? secondaryClass : getSaveClass()}
                size="lg"
                variant={twoButtonRow ? 'outline' : getSaveClass() === primaryClass ? 'default' : 'outline'}
                onClick={() => onCreateOrder(false)}
                disabled={isDisabled}
              >
                {isCreating ? (
                  <>
                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
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
            )

            const kotBtn = showKot && (
              <Button
                key="kot"
                className={getKotClass()}
                size="lg"
                variant={getKotClass() === primaryClass ? 'default' : 'outline'}
                onClick={() => onCreateOrder(true)}
                disabled={isDisabled}
              >
                {isCreating ? (
                  <>
                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                    Printing...
                  </>
                ) : (
                  <>
                    <Printer className="w-5 h-5 mr-2" />
                    KOT
                  </>
                )}
              </Button>
            )

            const payBtn = showPay && (
              <Button
                key="pay"
                className={twoButtonRow
                  ? 'flex-1 h-14 text-base rounded-none bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white font-black tracking-wider'
                  : `w-full h-14 text-base rounded-none bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white font-black tracking-wider${(showSave || showKot) ? ' border-t border-zinc-800' : ''}`
                }
                size="lg"
                onClick={onOpenPayment}
              >
                <CreditCard className="w-5 h-5 mr-2" />
                Pay
              </Button>
            )

            return (
              <div>
                {twoButtonRow ? (
                  // 2 buttons without KOT — side by side
                  <div className="flex">
                    {saveBtn}
                    {payBtn}
                  </div>
                ) : (
                  <>
                    {/* Top row: Save + KOT */}
                    {(showSave || showKot) && (
                      <div className="flex">
                        {saveBtn}
                        {kotBtn}
                      </div>
                    )}
                    {/* Bottom row: Pay */}
                    {payBtn}
                  </>
                )}
              </div>
            )
          })()}

            {/* Bill is paid — show status + Clear Table button */}
            {!hasNewItems && hasActiveOrders && isDineIn && (() => {
              const unpaidBalance = hasActiveBill
                ? Math.max(0, (activeBill?.aggregated_total || 0) - (activeBill?.paid_amount || 0))
                : tableOrders.filter(o => o.status !== 'paid').reduce((sum, order) => sum + order.total_amount, 0)
              const isFullyPaid = unpaidBalance === 0

              if (!isFullyPaid) return null

              const allKOTsServed = (activeBill?.kots || []).every(
                (kot: Order) => ['served', 'completed', 'cancelled'].includes(kot.status)
              )
              return (
                <div className="flex">
                  {!allKOTsServed ? (
                    <button
                      className="flex-1 h-14 flex items-center justify-center gap-2 text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 rounded-none cursor-pointer hover:bg-emerald-500/25 transition-colors"
                      onClick={() => window.location.href = '/admin/kitchen'}
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="text-base font-medium">Paid — Awaiting Service</span>
                      <ChefHat className="w-4 h-4 ml-1 opacity-60" />
                    </button>
                  ) : (
                    <div className="flex-1 h-14 flex items-center justify-center gap-2 text-emerald-400 bg-zinc-800 border border-zinc-800 rounded-none">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="text-base font-medium">Paid</span>
                    </div>
                  )}
                  {onClearTable && allKOTsServed && (
                    <Button
                      className="flex-1 h-14 text-base rounded-none bg-emerald-500 border-zinc-700 text-zinc-800 hover:bg-emerald-400"
                      variant="outline"
                      size="lg"
                      onClick={() => setShowClearTableConfirm(true)}
                    >
                      <DoorOpen className="w-5 h-5 mr-2" />
                      Clear Table
                    </Button>
                  )}
                </div>
              )
            })()}
        </div>
      )}
    </div>

    {/* On-Screen Keyboards (touch mode only) */}
    {touchMode && (
      <>
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
    )}
    </>
  )
}
