import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  Users,
  Package,
  Car,
  Clock,
  Receipt,
  Loader2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react'
import type { Order, BillsFilters, BillsFilterStatus } from './types'

interface BillsListProps {
  orders: Order[]
  isLoading: boolean
  filters: BillsFilters
  selectedOrderId: string | null
  onSelectOrder: (orderId: string) => void
  onFilterChange: (key: keyof BillsFilters, value: any) => void
  onRefresh: () => void
  formatCurrency: (amount: number) => string
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-yellow-500/20 text-yellow-400' },
  preparing: { label: 'Preparing', color: 'bg-orange-500/20 text-orange-400' },
  ready: { label: 'Ready', color: 'bg-emerald-500/20 text-emerald-400' },
  served: { label: 'Served', color: 'bg-purple-500/20 text-purple-400' },
  paid: { label: 'Paid', color: 'bg-indigo-500/20 text-indigo-400' },
  completed: { label: 'Completed', color: 'bg-emerald-500/20 text-emerald-400' },
  cancelled: { label: 'Cancelled', color: 'bg-red-500/20 text-red-400' },
}

const orderTypeIcons: Record<string, React.ReactNode> = {
  dine_in: <Users className="w-3.5 h-3.5" />,
  takeout: <Package className="w-3.5 h-3.5" />,
  delivery: <Car className="w-3.5 h-3.5" />
}

function formatElapsedTime(startTime: string): string {
  const start = new Date(startTime).getTime()
  const now = Date.now()
  const elapsed = Math.floor((now - start) / 1000 / 60)
  if (elapsed < 60) return `${elapsed}m`
  const hours = Math.floor(elapsed / 60)
  const mins = elapsed % 60
  return `${hours}h ${mins}m`
}

const filterStatuses: { value: BillsFilterStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'ready', label: 'Ready' },
  { value: 'served', label: 'Served' },
  { value: 'paid', label: 'Paid' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export function BillsList({
  orders,
  isLoading,
  filters,
  selectedOrderId,
  onSelectOrder,
  onFilterChange,
  onRefresh,
  formatCurrency
}: BillsListProps) {
  return (
    <>
      {/* Filter Bar */}
      <div className="p-3 border-b border-zinc-800 space-y-3 bg-zinc-900">
        {/* Status Filters + Date Nav */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 flex-wrap flex-1">
            {filterStatuses.map(({ value, label }) => (
              <Button
                key={value}
                size="sm"
                onClick={() => onFilterChange('status', value)}
                className={`h-9 text-sm px-3 ${
                  filters.status === value
                    ? 'bg-zinc-700 text-white border border-zinc-600 hover:bg-zinc-600'
                    : 'bg-zinc-800/50 text-zinc-400 border border-transparent hover:bg-zinc-700 hover:text-zinc-200'
                }`}
              >
                {label}
              </Button>
            ))}
          </div>

          {/* Date Nav */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              size="sm"
              className="h-9 w-9 p-0 bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
              onClick={() => {
                const d = new Date(filters.date)
                d.setDate(d.getDate() - 1)
                onFilterChange('date', d.toISOString().split('T')[0])
              }}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs font-medium text-zinc-300 min-w-[52px] text-center">
              {filters.date === new Date().toISOString().split('T')[0]
                ? 'Today'
                : new Date(filters.date + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </span>
            <Button
              size="sm"
              className="h-9 w-9 p-0 bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 disabled:opacity-30"
              disabled={filters.date >= new Date().toISOString().split('T')[0]}
              onClick={() => {
                const d = new Date(filters.date)
                d.setDate(d.getDate() + 1)
                onFilterChange('date', d.toISOString().split('T')[0])
              }}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              className="h-9 w-9 p-0 bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 ml-0.5"
              onClick={onRefresh}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            placeholder="Search order #, customer, table..."
            value={filters.search}
            onChange={(e) => onFilterChange('search', e.target.value)}
            className="pl-9 h-11 bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-zinc-600"
          />
        </div>
      </div>

      {/* Orders List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-600" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-500">
            <Receipt className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-lg font-medium">No orders found</p>
            <p className="text-sm text-zinc-600">
              {filters.search || filters.status !== 'all'
                ? 'Try adjusting your filters'
                : 'Orders will appear here'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/60">
            {orders.map(order => {
              const isSelected = selectedOrderId === order.id
              const status = statusConfig[order.status] || statusConfig.pending

              return (
                <div
                  key={order.id}
                  className={`px-4 py-4 cursor-pointer transition-colors active:bg-zinc-800 hover:bg-zinc-800/50 ${
                    isSelected ? 'bg-amber-500/10 border-l-4 border-l-amber-500' : 'border-l-4 border-l-transparent'
                  }`}
                  onClick={() => onSelectOrder(order.id)}
                >
                  {/* Top row: token (KDS-style), status, amount */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-sm text-zinc-100 tabular-nums">
                        {order.token_number != null
                          ? `#${String(order.token_number).padStart(4, '0')}`
                          : `#${order.order_number}`}
                      </span>
                      <Badge className={`${status.color} text-[10px] px-1.5 py-0 border-0`}>
                        {status.label}
                      </Badge>
                    </div>
                    <span className="font-bold text-sm flex-shrink-0 text-zinc-100">
                      {formatCurrency(order.total_amount)}
                    </span>
                  </div>

                  {/* Bottom row: type, table, customer, time */}
                  <div className="flex items-center gap-2.5 mt-1 text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                      {orderTypeIcons[order.order_type]}
                      <span className="capitalize">{order.order_type?.replace('_', '-')}</span>
                    </span>

                    {order.table?.table_number && (
                      <span>T{order.table.table_number}</span>
                    )}

                    {order.customer_name && (
                      <span className="truncate max-w-[100px]">{order.customer_name}</span>
                    )}

                    <span className="flex items-center gap-0.5 ml-auto flex-shrink-0">
                      <Clock className="w-3 h-3" />
                      {formatElapsedTime(order.created_at)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
