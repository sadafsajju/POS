import { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertCircle } from 'lucide-react'
import apiClient from '@/api/client'
import { BillsList } from './BillsList'
import { BillDetailPanel } from './BillDetailPanel'
import { useSettingsStore, useRequirePin } from '@pos/core'
import { printThermalReceipt } from '@/components/counter/utils/printUtils'
import type { Order, BillsFilters } from './types'

/**
 * Bills & Orders page — clean split view
 * Left: compact order list with status filters
 * Right: order detail + cancel action
 */
export function BillsInterface() {
  const queryClient = useQueryClient()
  const { settings } = useSettingsStore()

  // Filter state — default to today's date
  const [filters, setFilters] = useState<BillsFilters>({
    status: 'all',
    orderType: 'all',
    tableId: null,
    search: '',
    sortBy: 'created_at',
    sortOrder: 'desc',
    date: new Date().toISOString().split('T')[0],
  })

  // Selection state
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)

  // Messages
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Fetch all orders (including completed and cancelled)
  const isToday = filters.date === new Date().toISOString().split('T')[0]

  const { data: ordersResponse, isLoading, error } = useQuery({
    queryKey: ['bills-orders', filters.status, filters.date],
    queryFn: async () => {
      const params: Record<string, string> = { per_page: '100', date: filters.date }
      if (filters.status !== 'all') {
        params.status = filters.status
      }
      return apiClient.getOrders(params as any)
    },
    refetchInterval: isToday ? 5000 : false,
  })

  // Filter and sort orders
  const filteredOrders = useMemo(() => {
    const orders = ordersResponse?.data
    if (!Array.isArray(orders)) return []

    return orders
      .filter(order => {
        if (order.is_kot) return false
        if (filters.orderType !== 'all' && order.order_type !== filters.orderType) return false
        if (filters.tableId && order.table_id !== filters.tableId) return false

        if (filters.search) {
          const search = filters.search.toLowerCase()
          const matchesOrderNumber = order.order_number?.toLowerCase().includes(search)
          const matchesCustomer = order.customer_name?.toLowerCase().includes(search)
          const matchesTable = order.table?.table_number?.toString().includes(search)
          if (!matchesOrderNumber && !matchesCustomer && !matchesTable) return false
        }

        return true
      })
      .sort((a, b) => {
        const multiplier = filters.sortOrder === 'asc' ? 1 : -1
        switch (filters.sortBy) {
          case 'total_amount':
            return (a.total_amount - b.total_amount) * multiplier
          case 'table_number': {
            const aTable = a.table?.table_number || 0
            const bTable = b.table?.table_number || 0
            return (aTable - bTable) * multiplier
          }
          default:
            return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * multiplier
        }
      })
  }, [ordersResponse?.data, filters])

  // Fetch full order detail (with items) when an order is selected
  const { data: orderDetailResponse } = useQuery({
    queryKey: ['order-detail', selectedOrderId],
    queryFn: () => apiClient.getOrder(selectedOrderId!),
    enabled: !!selectedOrderId,
    refetchInterval: 5000,
  })

  // For parent bills (dine-in KOT orders), items live on child KOTs.
  // Fetch bill summary to get aggregated items when order has no direct items.
  const orderDetail = orderDetailResponse?.data
  const isParentBill = orderDetail && (!orderDetail.items || orderDetail.items.length === 0) && !orderDetail.is_kot

  const { data: billSummaryResponse } = useQuery({
    queryKey: ['bill-summary', selectedOrderId],
    queryFn: () => apiClient.getBillSummary(selectedOrderId!),
    enabled: !!selectedOrderId && !!isParentBill,
    refetchInterval: 5000,
  })

  // Build selected order — merge KOT items for parent bills
  const selectedOrder = useMemo(() => {
    if (!selectedOrderId) return null

    // If parent bill with KOTs, merge items from all KOTs
    if (isParentBill && billSummaryResponse?.data) {
      const summary = billSummaryResponse.data
      const allItems = summary.kots?.flatMap((kot: Order) => kot.items || []) || []
      return { ...orderDetail!, items: allItems } as Order
    }

    // Use detail if available
    if (orderDetail) return orderDetail

    // Fall back to list data
    return filteredOrders.find(o => o.id === selectedOrderId) || null
  }, [selectedOrderId, orderDetail, isParentBill, billSummaryResponse?.data, filteredOrders])

  // Currency formatter
  const formatCurrency = useCallback((amount: number) => {
    const symbol = settings.currencySymbol || '$'
    return `${symbol}${amount.toFixed(2)}`
  }, [settings.currencySymbol])

  // Invalidate queries
  const invalidateQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['bills-orders'] })
    queryClient.invalidateQueries({ queryKey: ['orders'] })
  }, [queryClient])

  // Cancel order mutation
  const cancelOrderMutation = useMutation({
    mutationFn: (orderId: string) =>
      apiClient.updateOrderStatus(orderId, 'cancelled' as any),
    onSuccess: () => {
      invalidateQueries()
      queryClient.invalidateQueries({ queryKey: ['order-detail', selectedOrderId] })
      setSuccessMessage('Order cancelled successfully')
      setTimeout(() => setSuccessMessage(null), 3000)
    },
    onError: (error: any) => {
      setErrorMessage(error.message || 'Failed to cancel order')
      setTimeout(() => setErrorMessage(null), 5000)
    }
  })

  // Handlers
  const handleSelectOrder = useCallback((orderId: string) => {
    setSelectedOrderId(orderId)
  }, [])

  const requirePin = useRequirePin()

  const handleCancelOrder = useCallback(async () => {
    if (!selectedOrder) return
    const verified = await requirePin('Cancel Order', 'Enter PIN to cancel this order')
    if (verified) {
      cancelOrderMutation.mutate(selectedOrder.id)
    }
  }, [selectedOrder, cancelOrderMutation, requirePin])

  const handleFilterChange = useCallback((key: keyof BillsFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }, [])

  const handlePrintBill = useCallback(() => {
    if (!selectedOrder) return
    printThermalReceipt(
      selectedOrder as any,
      null,
      formatCurrency,
      () => {
        setSuccessMessage('Bill sent to printer')
        setTimeout(() => setSuccessMessage(null), 3000)
      },
      (err) => {
        setErrorMessage(err.message || 'Failed to print bill')
        setTimeout(() => setErrorMessage(null), 5000)
      }
    )
  }, [selectedOrder, formatCurrency])

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-zinc-950">
        <div className="text-center text-red-400">
          <AlertCircle className="w-12 h-12 mx-auto mb-4" />
          <p>Failed to load orders</p>
          <p className="text-sm text-zinc-500 mt-2">{(error as Error).message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-zinc-100 select-none">
      {/* Messages */}
      {(errorMessage || successMessage) && (
        <div className="flex-shrink-0 px-4 pt-3">
          {errorMessage && (
            <div className="p-3 bg-red-500/15 text-red-400 border border-red-500/20 rounded-lg flex items-center gap-2 text-sm">
              <AlertCircle className="w-4 h-4" />
              {errorMessage}
            </div>
          )}
          {successMessage && (
            <div className="p-3 bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 rounded-lg text-sm">
              {successMessage}
            </div>
          )}
        </div>
      )}

      {/* Main Content — Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Orders List — Left Panel */}
        <div className="flex-1 overflow-hidden flex flex-col border-r border-zinc-800">
          <BillsList
            orders={filteredOrders}
            isLoading={isLoading}
            filters={filters}
            selectedOrderId={selectedOrderId}
            onSelectOrder={handleSelectOrder}
            onFilterChange={handleFilterChange}
            onRefresh={invalidateQueries}
            formatCurrency={formatCurrency}
          />
        </div>

        {/* Order Detail — Right Panel */}
        <div className="w-[480px] flex-shrink-0 flex flex-col bg-zinc-900 overflow-hidden">
          <BillDetailPanel
            selectedOrder={selectedOrder}
            onCancelOrder={handleCancelOrder}
            onPrintBill={handlePrintBill}
            isCancelling={cancelOrderMutation.isPending}
            formatCurrency={formatCurrency}
          />
        </div>
      </div>
    </div>
  )
}
