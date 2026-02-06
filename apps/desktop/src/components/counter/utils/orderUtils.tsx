import { Badge } from '@/components/ui/badge'
import { Users, Package, Car, ShoppingCart } from 'lucide-react'
import type { Order, OrderItemResponse, ConsolidatedItem } from '../types'

/**
 * Consolidate order items by product for display
 * Kitchen keeps items separate, but counter shows consolidated view
 */
export function consolidateItems(items: OrderItemResponse[]): ConsolidatedItem[] {
  if (!items || items.length === 0) return []

  const consolidated: Record<string, ConsolidatedItem> = {}

  items.forEach(item => {
    const productId = item.product_id || item.product?.id || ''
    const productName = item.product?.name || 'Unknown'

    if (consolidated[productId]) {
      consolidated[productId].quantity += item.quantity
    } else {
      consolidated[productId] = {
        quantity: item.quantity,
        name: productName,
        product_id: productId
      }
    }
  })

  return Object.values(consolidated)
}

/**
 * Format elapsed time as MM:SS from a start timestamp
 */
export function formatElapsedTime(startTime: string): string {
  const start = new Date(startTime).getTime()
  const now = Date.now()
  const elapsed = Math.floor((now - start) / 1000)
  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

/**
 * Format a fixed duration between two timestamps as MM:SS
 */
export function formatDuration(startTime: string, endTime: string): string {
  const start = new Date(startTime).getTime()
  const end = new Date(endTime).getTime()
  const elapsed = Math.max(0, Math.floor((end - start) / 1000))
  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

/**
 * Get icon component for order type
 */
export function getOrderTypeIcon(type: string) {
  switch (type) {
    case 'dine_in':
      return <Users className="w-4 h-4" />
    case 'takeout':
      return <Package className="w-4 h-4" />
    case 'delivery':
      return <Car className="w-4 h-4" />
    default:
      return <ShoppingCart className="w-4 h-4" />
  }
}

/**
 * Get styled badge for order type
 */
export function getOrderTypeBadge(type: string) {
  const configs = {
    dine_in: { label: 'Dine-In', color: 'bg-blue-100 text-blue-800' },
    takeout: { label: 'Takeout', color: 'bg-green-100 text-green-800' },
    delivery: { label: 'Delivery', color: 'bg-purple-100 text-purple-800' }
  }
  const config = configs[type as keyof typeof configs] || configs.dine_in
  return <Badge className={config.color}>{config.label}</Badge>
}

/**
 * Get unpaid orders for a specific table
 * Excludes KOT child orders (they're aggregated in the parent bill)
 */
export function getTableOrders(allOrders: Order[], tableId: string): Order[] {
  const safeOrders = Array.isArray(allOrders) ? allOrders : []
  return safeOrders.filter(order =>
    order.table_id === tableId &&
    !['completed', 'cancelled'].includes(order.status) &&
    !order.is_kot // Exclude KOTs - they're aggregated under parent bill
  )
}

/**
 * Get all KOTs for a specific table (for display purposes)
 */
export function getTableKOTs(allOrders: Order[], tableId: string): Order[] {
  const safeOrders = Array.isArray(allOrders) ? allOrders : []
  return safeOrders.filter(order =>
    order.table_id === tableId &&
    !['completed', 'cancelled'].includes(order.status) &&
    order.is_kot === true
  )
}

/**
 * Calculate total amount for a list of orders
 */
export function calculateTableTotal(orders: Order[]): number {
  return orders.reduce((sum, order) => sum + order.total_amount, 0)
}

/**
 * Get user role from localStorage
 */
export function getCurrentUserRole(): string {
  try {
    const storedAuth = localStorage.getItem('pos-auth')
    if (storedAuth) {
      const parsed = JSON.parse(storedAuth)
      return parsed.state?.user?.role || ''
    }
  } catch (e) {
    console.error('Failed to parse user from localStorage', e)
  }
  return ''
}

/**
 * Check if user is admin or manager
 */
export function isAdminOrManager(): boolean {
  const role = getCurrentUserRole()
  return role === 'admin' || role === 'manager'
}
