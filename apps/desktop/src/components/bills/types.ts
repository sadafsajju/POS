// Re-export shared types
export type {
  Order,
  OrderItem,
  DiningTable,
  Payment,
  BillSummary
} from '@/types'

// Bills-specific types
export type BillsFilterStatus = 'all' | 'pending' | 'preparing' | 'ready' | 'served' | 'paid' | 'completed' | 'cancelled'
export type BillsOrderType = 'all' | 'dine_in' | 'takeout' | 'delivery'
export type BillsSortBy = 'created_at' | 'total_amount' | 'table_number'

export interface BillsFilters {
  status: BillsFilterStatus
  orderType: BillsOrderType
  tableId: string | null
  search: string
  sortBy: BillsSortBy
  sortOrder: 'asc' | 'desc'
  date: string // YYYY-MM-DD
}

