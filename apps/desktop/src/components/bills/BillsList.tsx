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
  Loader2
} from 'lucide-react'
import type { Order, BillsFilters, BillsFilterStatus } from './types'

interface BillsListProps {
  orders: Order[]
  isLoading: boolean
  filters: BillsFilters
  selectedOrderId: string | null
  onSelectOrder: (orderId: string) => void
  onFilterChange: (key: keyof BillsFilters, value: any) => void
  formatCurrency: (amount: number) => string
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  preparing: { label: 'Preparing', color: 'bg-blue-100 text-blue-800' },
  ready: { label: 'Ready', color: 'bg-green-100 text-green-800' },
  served: { label: 'Served', color: 'bg-purple-100 text-purple-800' },
  paid: { label: 'Paid', color: 'bg-indigo-100 text-indigo-800' },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-800' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800' },
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
  formatCurrency
}: BillsListProps) {
  return (
    <>
      {/* Filter Bar */}
      <div className="p-3 border-b border-border space-y-3 bg-muted/30">
        {/* Status Filters */}
        <div className="flex gap-1.5 flex-wrap">
          {filterStatuses.map(({ value, label }) => (
            <Button
              key={value}
              variant={filters.status === value ? 'default' : 'outline'}
              size="sm"
              onClick={() => onFilterChange('status', value)}
              className="h-7 text-xs px-2.5"
            >
              {label}
            </Button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search order #, customer, table..."
            value={filters.search}
            onChange={(e) => onFilterChange('search', e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Orders List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <Receipt className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-lg font-medium">No orders found</p>
            <p className="text-sm">
              {filters.search || filters.status !== 'all'
                ? 'Try adjusting your filters'
                : 'Orders will appear here'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {orders.map(order => {
              const isSelected = selectedOrderId === order.id
              const status = statusConfig[order.status] || statusConfig.pending

              return (
                <div
                  key={order.id}
                  className={`px-4 py-3 cursor-pointer transition-colors hover:bg-muted/50 ${
                    isSelected ? 'bg-primary/10 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'
                  }`}
                  onClick={() => onSelectOrder(order.id)}
                >
                  {/* Top row: order number, status, amount */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-sm">
                        #{order.order_number}
                      </span>
                      <Badge className={`${status.color} text-[10px] px-1.5 py-0`}>
                        {status.label}
                      </Badge>
                    </div>
                    <span className="font-bold text-sm flex-shrink-0">
                      {formatCurrency(order.total_amount)}
                    </span>
                  </div>

                  {/* Bottom row: type, table, customer, time */}
                  <div className="flex items-center gap-2.5 mt-1 text-xs text-muted-foreground">
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
