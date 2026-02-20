import { useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table as TableIcon, Clock, Timer, ArrowRight, ShoppingCart, ChefHat, UtensilsCrossed, CircleCheck, CircleDollarSign, ClipboardList } from 'lucide-react'
import { KeyboardRow } from '@/components/ui/on-screen-keyboard/KeyboardRow'
import { QWERTY_LAYOUT, NUMBERS_LAYOUT, SYMBOLS_LAYOUT } from '@/components/ui/on-screen-keyboard/keyboard-layouts'
import type { KeyConfig, KeyboardLayout } from '@/components/ui/on-screen-keyboard/types'
import { useSettingsStore } from '@pos/core'
import type { DiningTable, Order, OrderType } from '../types'
import { formatElapsedTime, formatDuration, getTableOrders, getTableKOTs, calculateTableTotal } from '../utils/orderUtils'

/** Determine the most relevant order status to show on a table card */
function getTableOrderStatus(tableOrders: Order[], tableKOTs: Order[]) {
  // Priority: show the most actionable status across all KOTs and parent orders
  const allStatuses = [...tableKOTs, ...tableOrders].map(o => o.status)

  if (allStatuses.includes('preparing')) return 'preparing'
  if (allStatuses.includes('ready')) return 'ready'
  if (allStatuses.includes('served')) return 'served'
  if (allStatuses.includes('confirmed')) return 'confirmed'
  if (allStatuses.includes('paid')) return 'paid'
  if (allStatuses.includes('pending')) return 'pending'
  return tableOrders[0]?.status || 'pending'
}

const orderStatusConfig: Record<string, { label: string; icon: React.ReactNode; bg: string }> = {
  pending: { label: 'Pending', icon: <ClipboardList className="w-3 h-3" />, bg: 'bg-amber-500' },
  confirmed: { label: 'Confirmed', icon: <CircleCheck className="w-3 h-3" />, bg: 'bg-blue-500' },
  preparing: { label: 'Preparing', icon: <ChefHat className="w-3 h-3" />, bg: 'bg-orange-500' },
  ready: { label: 'Ready', icon: <UtensilsCrossed className="w-3 h-3" />, bg: 'bg-emerald-500' },
  served: { label: 'Served', icon: <UtensilsCrossed className="w-3 h-3" />, bg: 'bg-teal-500' },
  paid: { label: 'Paid', icon: <CircleDollarSign className="w-3 h-3" />, bg: 'bg-green-700' },
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
}

/**
 * Tables grid view showing all dining tables with their status
 */
export function TablesView({
  tables,
  allOrders,
  selectedTable,
  onTableSelect,
  formatCurrency,
  orderType,
  onOrderTypeChange,
  customerName,
  onCustomerNameChange,
  onProceedToProducts,
  hasCartItems,
  detailsExpanded = false,
}: TablesViewProps) {
  const safeTables = Array.isArray(tables) ? tables : []

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
          <div className="flex items-center justify-end">
            <div className="flex items-center gap-4 text-sm text-zinc-400">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-blue-700 border border-blue-700"></span> Available
              </span>
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-green-600"></span> Occupied
              </span>
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center">
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
                <div className={`grid gap-1 ${detailsExpanded ? 'grid-cols-3 md:grid-cols-4 lg:grid-cols-6' : 'grid-cols-4 md:grid-cols-6 lg:grid-cols-8'}`}>
                  {tablesByFloor[floor].map(table => {
                    const tableOrders = getTableOrders(allOrders, table.id)
                    const tableKOTs = getTableKOTs(allOrders, table.id)
                    const hasOrders = tableOrders.length > 0
                    const tableTotal = calculateTableTotal(tableOrders)
                    const tableHasCartItems = hasCartItems?.(table.id) || false
                    const currentStatus = hasOrders ? getTableOrderStatus(tableOrders, tableKOTs) : null
                    const statusConf = currentStatus ? orderStatusConfig[currentStatus] : null

                    return (
                      <Card
                        key={table.id}
                        className={`cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] border-0 relative rounded-none aspect-square ${
                          selectedTable?.id === table.id ? 'ring-2 ring-amber-500' : ''
                        } ${hasOrders
                          ? 'bg-green-600'
                          : 'bg-zinc-900'}`}
                        onClick={() => onTableSelect(table)}
                      >
                        {/* Cart indicator for tables with pending items */}
                        {tableHasCartItems && (
                          <div className="absolute -top-2 -right-2 w-7 h-7 bg-amber-500 rounded-full flex items-center justify-center shadow-lg z-10">
                            <ShoppingCart className="w-4 h-4 text-white" />
                          </div>
                        )}
                        <CardContent className="p-4 h-full flex items-center justify-center">
                          <div className="text-center">
                            <div className={`text-2xl font-bold mb-1 ${hasOrders
                              ? 'text-white'
                              : 'text-blue-400'}`}>
                              {table.table_number}
                            </div>
                            <div className={`text-xs mb-2 ${hasOrders
                              ? 'text-white/80'
                              : 'text-blue-400'}`}>
                              {table.seating_capacity} seats
                            </div>
                            {hasOrders ? (
                              <div className="space-y-1">
                                {/* Order status badge */}
                                {statusConf && (
                                  <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white ${statusConf.bg}`}>
                                    {statusConf.icon}
                                    {statusConf.label}
                                  </div>
                                )}
                                <div className="text-sm font-semibold text-white">
                                  {formatCurrency(tableTotal)}
                                </div>
                                {/* Dual timers: Order time | Served time */}
                                {(() => {
                                  const firstOrder = tableOrders[0]
                                  const servedAt = firstOrder.served_at
                                  return (
                                    <div className="flex items-center justify-center gap-1.5 text-[10px] font-mono text-white/80">
                                      {/* Order timer: stops at served_at if served, otherwise live */}
                                      <div className="flex items-center gap-0.5" title="Order time">
                                        <Clock className="w-2.5 h-2.5" />
                                        {servedAt
                                          ? formatDuration(firstOrder.created_at, servedAt)
                                          : formatElapsedTime(firstOrder.created_at)}
                                      </div>
                                      {/* Served timer: live counter since served */}
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
                              </div>
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
    </div>
  )
}
