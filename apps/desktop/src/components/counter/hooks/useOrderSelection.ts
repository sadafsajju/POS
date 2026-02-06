import { useState, useCallback } from 'react'
import type { Order } from '../types'

export interface UseOrderSelectionReturn {
  // State
  selectedOrderIds: Set<string>
  selectedOrder: Order | null

  // Single order selection
  setSelectedOrder: (order: Order | null) => void

  // Multi-select operations
  toggleOrderSelection: (orderId: string, e?: React.MouseEvent) => void
  selectAllOrders: (orders: Order[]) => void
  clearSelection: () => void

  // Getters
  getSelectedOrders: (orders: Order[]) => Order[]
  getSelectedOrdersTotal: (orders: Order[]) => number
  isAllSelected: (orders: Order[]) => boolean
  isOrderSelected: (orderId: string) => boolean
}

/**
 * Hook for managing order selection state
 * Supports both single selection and multi-select for batch operations
 */
export function useOrderSelection(): UseOrderSelectionReturn {
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set())
  const [selectedOrder, setSelectedOrderState] = useState<Order | null>(null)

  // Set single order selection (clears multi-select)
  const setSelectedOrder = useCallback((order: Order | null) => {
    setSelectedOrderState(order)
    if (order) {
      // Clear multi-select when selecting single order
      setSelectedOrderIds(new Set())
    }
  }, [])

  // Toggle order in multi-select
  const toggleOrderSelection = useCallback((orderId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()

    setSelectedOrderIds(prev => {
      const newSelected = new Set(prev)
      if (newSelected.has(orderId)) {
        newSelected.delete(orderId)
      } else {
        newSelected.add(orderId)
      }
      return newSelected
    })

    // Clear single selection when using multi-select
    setSelectedOrderState(null)
  }, [])

  // Select or deselect all orders
  const selectAllOrders = useCallback((orders: Order[]) => {
    setSelectedOrderIds(prev => {
      if (prev.size === orders.length) {
        // Deselect all
        return new Set()
      } else {
        // Select all
        return new Set(orders.map(o => o.id))
      }
    })
    setSelectedOrderState(null)
  }, [])

  // Clear all selections
  const clearSelection = useCallback(() => {
    setSelectedOrderIds(new Set())
    setSelectedOrderState(null)
  }, [])

  // Get selected orders from a list
  const getSelectedOrders = useCallback((orders: Order[]) => {
    return orders.filter(o => selectedOrderIds.has(o.id))
  }, [selectedOrderIds])

  // Calculate total for selected orders
  const getSelectedOrdersTotal = useCallback((orders: Order[]) => {
    return getSelectedOrders(orders).reduce((sum, order) => sum + order.total_amount, 0)
  }, [getSelectedOrders])

  // Check if all orders are selected
  const isAllSelected = useCallback((orders: Order[]) => {
    return orders.length > 0 && selectedOrderIds.size === orders.length
  }, [selectedOrderIds])

  // Check if a specific order is selected
  const isOrderSelected = useCallback((orderId: string) => {
    return selectedOrderIds.has(orderId)
  }, [selectedOrderIds])

  return {
    // State
    selectedOrderIds,
    selectedOrder,

    // Single order selection
    setSelectedOrder,

    // Multi-select operations
    toggleOrderSelection,
    selectAllOrders,
    clearSelection,

    // Getters
    getSelectedOrders,
    getSelectedOrdersTotal,
    isAllSelected,
    isOrderSelected
  }
}
