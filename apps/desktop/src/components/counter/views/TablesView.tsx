import { useState, useCallback, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table as TableIcon, Clock, Timer, ArrowRight, ShoppingCart, ChefHat, UtensilsCrossed, CircleCheck, CircleDollarSign, ClipboardList, CreditCard, X, CheckCircle2, ArrowRightLeft } from 'lucide-react'
import { KeyboardRow } from '@/components/ui/on-screen-keyboard/KeyboardRow'
import { QWERTY_LAYOUT, NUMBERS_LAYOUT, SYMBOLS_LAYOUT } from '@/components/ui/on-screen-keyboard/keyboard-layouts'
import type { KeyConfig, KeyboardLayout } from '@/components/ui/on-screen-keyboard/types'
import { useSettingsStore } from '@pos/core'
import type { DiningTable, Order, OrderType } from '../types'
import { formatElapsedTime, formatDuration, getTableOrders, getTableKOTs, calculateTableTotal } from '../utils/orderUtils'

/** Determine the most relevant order status to show on a table card */
function getTableOrderStatus(tableOrders: Order[], tableKOTs: Order[]): { status: string; isPaid: boolean } {
  const parentStatus = tableOrders[0]?.status
  const isPaid = parentStatus === 'paid'

  // For kitchen status, look at KOTs first, then fall back to parent
  const kotStatuses = tableKOTs.map(o => o.status)

  if (kotStatuses.includes('preparing')) return { status: 'preparing', isPaid }
  if (kotStatuses.includes('ready')) return { status: 'ready', isPaid }
  if (kotStatuses.includes('served')) return { status: 'served', isPaid }
  if (kotStatuses.includes('confirmed')) return { status: 'confirmed', isPaid }
  if (kotStatuses.includes('pending')) return { status: 'pending', isPaid }

  // No KOTs — use parent status (but map 'paid' to 'served' for display)
  const displayStatus = isPaid ? 'served' : (parentStatus || 'pending')
  return { status: displayStatus, isPaid }
}

const orderStatusConfig: Record<string, { label: string; icon: React.ReactNode; bg: string; cardBg: string }> = {
  pending: { label: 'Pending', icon: <ClipboardList className="w-3 h-3" />, bg: 'bg-amber-500', cardBg: 'bg-amber-600' },
  confirmed: { label: 'Confirmed', icon: <CircleCheck className="w-3 h-3" />, bg: 'bg-blue-500', cardBg: 'bg-blue-600' },
  preparing: { label: 'Preparing', icon: <ChefHat className="w-3 h-3" />, bg: 'bg-orange-500', cardBg: 'bg-orange-600' },
  ready: { label: 'Ready', icon: <UtensilsCrossed className="w-3 h-3" />, bg: 'bg-emerald-500', cardBg: 'bg-emerald-600' },
  served: { label: 'Served', icon: <UtensilsCrossed className="w-3 h-3" />, bg: 'bg-purple-500', cardBg: 'bg-purple-600' },
  paid: { label: 'Paid', icon: <CircleDollarSign className="w-3 h-3" />, bg: 'bg-zinc-500', cardBg: 'bg-zinc-600' },
}

/**
 * Centered customer name input with integrated on-screen keyboard for takeout/delivery
 */
function TakeoutCustomerInput({
  customerName,
  onCustomerNameChange,
  onProceedToProducts,
  orderType
}: {
  customerName: string
  onCustomerNameChange: (name: string) => void
  onProceedToProducts: () => void
  orderType: OrderType
}) {
  const [isShifted, setIsShifted] = useState(false)
  const [currentLayout, setCurrentLayout] = useState<KeyboardLayout>(QWERTY_LAYOUT)
  const { settings } = useSettingsStore()
  const touchMode = settings.touchMode
  const maxLength = 100

  const handleKeyPress = useCallback(
    (config: KeyConfig) => {
      switch (config.type) {
        case 'char':
          if (customerName.length < maxLength) {
            const char = isShifted
              ? (config.value || '').toUpperCase()
              : config.value || ''
            onCustomerNameChange(customerName + char)
            if (isShifted) setIsShifted(false)
          }
          break

        case 'backspace':
          onCustomerNameChange(customerName.slice(0, -1))
          break

        case 'space':
          if (customerName.length < maxLength) {
            onCustomerNameChange(customerName + ' ')
          }
          break

        case 'shift':
          setIsShifted((prev) => !prev)
          break

        case 'symbols':
          if (config.id === 'numbers' || config.id === '123') {
            setCurrentLayout(NUMBERS_LAYOUT)
          } else if (config.id === 'abc' || config.id === 'ABC') {
            setCurrentLayout(QWERTY_LAYOUT)
          } else if (config.id === 'symbols') {
            setCurrentLayout(SYMBOLS_LAYOUT)
          }
          break

        case 'clear':
          onCustomerNameChange('')
          break

        case 'enter':
          onProceedToProducts()
          break
      }
    },
    [customerName, isShifted, maxLength, onCustomerNameChange, onProceedToProducts]
  )

  return (
    <>
      {/* Centered input area */}
      <div className={`flex flex-col items-center justify-center px-8 min-h-[calc(100vh-200px)] ${touchMode ? 'pb-80' : 'pb-8'}`}>
        <div className="w-full max-w-2xl text-center">
          <h2 className="text-2xl font-black tracking-tight text-zinc-100 mb-2">
            {orderType === 'takeout' ? 'Takeout Order' : 'Delivery Order'}
          </h2>
          <p className="text-zinc-400 mb-6">Enter customer name (optional)</p>

          {/* Input */}
          <div className="relative mb-6">
            {touchMode ? (
              <div className="w-full min-h-16 px-6 py-4 rounded-lg border-2 border-zinc-700 bg-zinc-900 text-2xl flex items-center justify-center text-zinc-100">
                {customerName || (
                  <span className="text-zinc-500">Customer name...</span>
                )}
                <span className="inline-block w-0.5 h-7 bg-amber-500 ml-1 animate-pulse" />
              </div>
            ) : (
              <input
                type="text"
                autoFocus
                value={customerName}
                onChange={(e) => onCustomerNameChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onProceedToProducts()
                }}
                placeholder="Customer name..."
                maxLength={maxLength}
                className="w-full min-h-16 px-6 py-4 rounded-lg border-2 border-zinc-700 bg-zinc-900 text-2xl text-center text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
              />
            )}
          </div>

          {/* Skip button */}
          <Button
            onClick={onProceedToProducts}
            variant="outline"
            size="lg"
            className="h-14 px-8 text-lg bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
          >
            Skip <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </div>

      {/* Keyboard - Fixed at bottom, touch mode only */}
      {touchMode && (
        <div className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 p-4 animate-in slide-in-from-bottom duration-300 z-50">
          <div className="space-y-2 max-w-4xl mx-auto">
            {currentLayout.rows.map((row, index) => (
              <KeyboardRow
                key={`row-${index}`}
                row={row}
                isShifted={isShifted}
                onKeyPress={handleKeyPress}
              />
            ))}
          </div>
        </div>
      )}
    </>
  )
}

interface TablesViewProps {
  tables: DiningTable[]
  allOrders: Order[]
  selectedTable: DiningTable | null
  onTableSelect: (table: DiningTable) => void
  formatCurrency: (amount: number) => string
  orderType: OrderType
  onOrderTypeChange: (type: OrderType) => void
  customerName: string
  onCustomerNameChange: (name: string) => void
  onProceedToProducts: () => void
  /** Function to check if a table has items in its cart */
  hasCartItems?: (tableId: string) => boolean
  /** If true, details panel is expanded (show fewer columns) */
  detailsExpanded?: boolean
  /** Long-press actions */
  onTablePay?: (table: DiningTable) => void
  onTableCancel?: (table: DiningTable) => void
  onTableClear?: (table: DiningTable) => void
  onTableMove?: (sourceTable: DiningTable, targetTable: DiningTable) => void
}

/**
 * Tables grid view showing all dining tables with their status
 */
export function TablesView({
  tables,
  allOrders,
  selectedTable: _selectedTable,
  onTableSelect,
  formatCurrency,
  orderType,
  onOrderTypeChange: _onOrderTypeChange,
  customerName,
  onCustomerNameChange,
  onProceedToProducts,
  hasCartItems,
  detailsExpanded = false,
  onTablePay,
  onTableCancel,
  onTableClear,
  onTableMove,
}: TablesViewProps) {
  const safeTables = Array.isArray(tables) ? tables : []

  // Long-press context menu state
  const [contextMenu, setContextMenu] = useState<{
    table: DiningTable
    x: number
    y: number
    hasOrders: boolean
    isPaid: boolean
  } | null>(null)
  // Move table picker state
  const [moveSource, setMoveSource] = useState<DiningTable | null>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPress = useRef(false)

  const handlePointerDown = useCallback((e: React.PointerEvent, table: DiningTable, hasOrders: boolean, isPaid: boolean) => {
    if (!hasOrders) return
    didLongPress.current = false
    const x = e.clientX
    const y = e.clientY
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true
      setContextMenu({ table, x, y, hasOrders, isPaid })
    }, 600)
  }, [])

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const handlePointerCancel = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    didLongPress.current = false
  }, [])

  const handleCardClick = useCallback((table: DiningTable) => {
    if (didLongPress.current) {
      didLongPress.current = false
      return
    }
    onTableSelect(table)
  }, [onTableSelect])

  // Group tables by floor
  const tablesByFloor = safeTables.reduce<Record<string, DiningTable[]>>((acc, table) => {
    const floor = table.floor || 'Ground'
    if (!acc[floor]) {
      acc[floor] = []
    }
    acc[floor].push(table)
    return acc
  }, {})

  // Custom sort to put Ground first, then sort rest logically
  const floorOrder = ['Ground', 'Mezzanine', 'Basement', '1st Floor', '2nd Floor', '3rd Floor', 'Rooftop']
  const floors = Object.keys(tablesByFloor).sort((a, b) => {
    const indexA = floorOrder.indexOf(a)
    const indexB = floorOrder.indexOf(b)
    if (indexA === -1 && indexB === -1) return a.localeCompare(b)
    if (indexA === -1) return 1
    if (indexB === -1) return -1
    return indexA - indexB
  })

  return (
    <div className="space-y-4 p-6">
      {/* Show centered customer name input with keyboard for takeout/delivery */}
      {orderType !== 'dine_in' ? (
        <TakeoutCustomerInput
          customerName={customerName}
          onCustomerNameChange={onCustomerNameChange}
          onProceedToProducts={onProceedToProducts}
          orderType={orderType}
        />
      ) : (
        <>
          {/* Legend */}
          <div className="flex items-center justify-end flex-wrap">
            <div className="flex items-center gap-3 text-xs text-zinc-400 flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-zinc-900"></span> Available
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-amber-600"></span> Pending
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-blue-600"></span> Confirmed
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-orange-600"></span> Preparing
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-600"></span> Ready
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-purple-600"></span> Served
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center">
                  <ShoppingCart className="w-2.5 h-2.5 text-white" />
                </span> Cart
              </span>
            </div>
          </div>

          {/* Tables Grid by Floor */}
          <div className="space-y-6">
            {floors.map(floor => (
              <div key={floor}>
                <h4 className="text-md font-bold mb-3 text-zinc-400">{floor}</h4>
                <div className={`grid gap-2 ${detailsExpanded ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8'}`}>
                  {tablesByFloor[floor].map(table => {
                    const tableOrders = getTableOrders(allOrders, table.id)
                    const tableKOTs = getTableKOTs(allOrders, table.id)
                    const hasOrders = tableOrders.length > 0
                    const tableTotal = calculateTableTotal(tableOrders)
                    const tableHasCartItems = hasCartItems?.(table.id) || false
                    const orderStatus = hasOrders ? getTableOrderStatus(tableOrders, tableKOTs) : null
                    const currentStatus = orderStatus?.status || null
                    const isPaid = orderStatus?.isPaid || false
                    const statusConf = currentStatus ? orderStatusConfig[currentStatus] : null

                    return (
                      <Card
                        key={table.id}
                        className={`cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] border-0 relative rounded-2xl aspect-square overflow-hidden select-none ${
                          ''
                        } ${hasOrders
                          ? (statusConf?.cardBg || 'bg-green-600')
                          : 'bg-zinc-900'}`}
                        onClick={() => handleCardClick(table)}
                        onPointerDown={(e) => handlePointerDown(e, table, hasOrders, isPaid)}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerCancel}
                        onPointerCancel={handlePointerCancel}
                      >
                        {/* Paid stamp seal - top right inside card */}
                        {isPaid && (
                          <div className="absolute -top-2 -right-2 z-10 pointer-events-none">
                            <svg width="56" height="56" viewBox="0 0 56 56" className="rotate-[-20deg]">
                              <circle cx="28" cy="28" r="25" fill="none" stroke="white" strokeWidth="2.5" strokeDasharray="4 2" />
                              <circle cx="28" cy="28" r="20" fill="none" stroke="white" strokeWidth="2" />
                              <text x="28" y="32" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" fontFamily="sans-serif" letterSpacing="1.5">PAID</text>
                            </svg>
                          </div>
                        )}
                        {/* Cart indicator for tables with pending items */}
                        {tableHasCartItems && !isPaid && (
                          <div className="absolute -top-2 -right-2 w-7 h-7 bg-amber-500 rounded-full flex items-center justify-center shadow-lg z-10">
                            <ShoppingCart className="w-4 h-4 text-white" />
                          </div>
                        )}
                        <CardContent className="p-4 h-full flex flex-col items-center justify-between">
                          <div className="flex-1 flex flex-col items-center justify-center text-center">
                            <div className={`text-2xl font-bold mb-1 ${hasOrders
                              ? 'text-white'
                              : 'text-blue-400'}`}>
                              {table.table_number}
                            </div>
                            <div className={`text-xs ${hasOrders
                              ? 'text-white/80'
                              : 'text-blue-400'}`}>
                              {table.seating_capacity} seats
                            </div>
                            {hasOrders && (
                              <>
                                <div className="text-sm font-semibold text-white mt-1">
                                  {formatCurrency(tableTotal)}
                                </div>
                                {/* Dual timers: Order time | Served time */}
                                {(() => {
                                  const firstOrder = tableOrders[0]
                                  const servedAt = firstOrder.served_at
                                  return (
                                    <div className="flex items-center justify-center gap-1.5 text-[10px] font-mono text-white/80">
                                      <div className="flex items-center gap-0.5" title="Order time">
                                        <Clock className="w-2.5 h-2.5" />
                                        {servedAt
                                          ? formatDuration(firstOrder.created_at, servedAt)
                                          : formatElapsedTime(firstOrder.created_at)}
                                      </div>
                                      {servedAt && (
                                        <>
                                          <span className="text-white/50">|</span>
                                          <div className="flex items-center gap-0.5" title="Since served">
                                            <Timer className="w-2.5 h-2.5" />
                                            {formatElapsedTime(servedAt)}
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  )
                                })()}
                              </>
                            )}
                          </div>
                          {/* Status badge pinned to bottom */}
                          <div className="mt-auto pt-1">
                            {hasOrders ? (
                              statusConf && (
                                <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white ${statusConf.bg}`}>
                                  {statusConf.icon}
                                  {statusConf.label}
                                </div>
                              )
                            ) : (
                              <Badge className="bg-zinc-950 text-white text-xs">
                                Available
                              </Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Empty state */}
          {safeTables.length === 0 && (
            <div className="text-center py-12 text-zinc-500">
              <TableIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No tables configured</p>
              <p className="text-sm">Add tables in the admin settings</p>
            </div>
          )}
        </>
      )}

      {/* Move table picker overlay */}
      {moveSource && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center" onClick={() => setMoveSource(null)}>
          <div
            className="bg-zinc-900 rounded-2xl border border-zinc-700 shadow-2xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-zinc-100 mb-1">Move Table {moveSource.table_number}</h3>
            <p className="text-sm text-zinc-400 mb-4">Select a table to move the order to</p>
            <div className="grid grid-cols-4 gap-2">
              {safeTables
                .filter(t => {
                  if (t.id === moveSource.id) return false
                  const orders = getTableOrders(allOrders, t.id)
                  return orders.length === 0 // only show available tables
                })
                .map(t => (
                  <button
                    key={t.id}
                    className="flex flex-col items-center justify-center p-3 rounded-xl bg-zinc-800 hover:bg-blue-600 transition-colors text-zinc-100 border border-zinc-700 hover:border-blue-500"
                    onClick={() => {
                      onTableMove?.(moveSource, t)
                      setMoveSource(null)
                    }}
                  >
                    <span className="text-lg font-bold">{t.table_number}</span>
                    <span className="text-[10px] text-zinc-400">{t.seating_capacity} seats</span>
                  </button>
                ))}
            </div>
            {safeTables.filter(t => t.id !== moveSource.id && getTableOrders(allOrders, t.id).length === 0).length === 0 && (
              <p className="text-center text-zinc-500 py-4">No available tables to move to</p>
            )}
            <button
              className="mt-4 w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors"
              onClick={() => setMoveSource(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Long-press context menu */}
      {contextMenu && (
        <div className="fixed inset-0 z-50" onClick={() => setContextMenu(null)}>
          <div
            className="absolute bg-zinc-800 rounded-xl shadow-2xl border border-zinc-700 py-2 min-w-[160px] animate-in fade-in zoom-in-95 duration-150"
            style={{
              left: Math.min(contextMenu.x, window.innerWidth - 180),
              top: Math.min(contextMenu.y, window.innerHeight - 120),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {contextMenu.isPaid ? (
              <>
                <button
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-zinc-700/50 transition-colors"
                  onClick={() => {
                    onTableCancel?.(contextMenu.table)
                    setContextMenu(null)
                  }}
                >
                  <X className="w-4 h-4" />
                  Cancel Order
                </button>
                <button
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-emerald-400 hover:bg-zinc-700/50 transition-colors"
                  onClick={() => {
                    onTableClear?.(contextMenu.table)
                    setContextMenu(null)
                  }}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Clear Table
                </button>
              </>
            ) : (
              <button
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-amber-400 hover:bg-zinc-700/50 transition-colors"
                onClick={() => {
                  onTablePay?.(contextMenu.table)
                  setContextMenu(null)
                }}
              >
                <CreditCard className="w-4 h-4" />
                Pay
              </button>
            )}
            {/* Move table - always available for occupied tables */}
            <button
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-blue-400 hover:bg-zinc-700/50 transition-colors"
              onClick={() => {
                setMoveSource(contextMenu.table)
                setContextMenu(null)
              }}
            >
              <ArrowRightLeft className="w-4 h-4" />
              Move Table
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
