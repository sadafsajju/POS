import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/api/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { KeyboardRow } from '@/components/ui/on-screen-keyboard/KeyboardRow'
import { QWERTY_LAYOUT } from '@/components/ui/on-screen-keyboard/keyboard-layouts'
import type { KeyConfig } from '@/components/ui/on-screen-keyboard/types'
import {
  Table as TableIcon,
  Search,
  CloudOff,
  RefreshCw,
  X,
  ArrowLeft,
  Package,
  Car
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useSettingsStore, useSyncStore, useOfflineOrder } from '@pos/core'
import { counterApi, adminApi } from '@pos/api-client'

// Types
import type { DiningTable, Order, Category, ActiveTab, OrderType, CreateOrderRequest, KOTItem, BillSummary, Product, ProductOptionGroup, SelectedOption, SelectedComboChoice, ComboSlot } from './types'

// Hooks
import { useCart } from './hooks/useCart'
import { useElapsedTimer } from './hooks/useElapsedTimer'

// Utils
import { isAdminOrManager, getTableOrders, getCurrentUserRole } from './utils/orderUtils'
import { printKOT } from './utils/printUtils'

// Views
import { TablesView } from './views/TablesView'
import { CreateOrderView } from './views/CreateOrderView'

// Panels
import { TableDetailsPanel } from './panels/TableDetailsPanel'
import { CartPanel } from './panels/CartPanel'

// Dialogs
import { CancelOrderDialog } from './dialogs/CancelOrderDialog'
import { EditOrderDialog } from './dialogs/EditOrderDialog'
import { ProductOptionsDialog } from './dialogs/ProductOptionsDialog'
import { ComboConfigDialog } from './dialogs/ComboConfigDialog'

// Overlays
import { PaymentOverlay } from './PaymentOverlay'

// Aggregator orders
import { AggregatorOrders } from './AggregatorOrders'

export function CounterInterface() {
  // Custom hooks
  const cart = useCart()
  useElapsedTimer() // Forces re-render for elapsed times

  // External hooks
  const { settings } = useSettingsStore()
  const { isOnline } = useSyncStore()
  const queryClient = useQueryClient()

  // Tab and navigation state
  const [activeTab, setActiveTab] = useState<ActiveTab>('tables')
  const [orderType, setOrderType] = useState<OrderType>('dine_in')
  const [selectedTable, setSelectedTable] = useState<DiningTable | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [orderNotes, setOrderNotes] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  // UI state
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null)
  const [orderToEdit, setOrderToEdit] = useState<Order | null>(null)
  const [showSearchKeyboard, setShowSearchKeyboard] = useState(false)

  // Payment overlay state
  const [showPaymentOverlay, setShowPaymentOverlay] = useState(false)

  // Product options dialog state (for configurable products)
  const [configProduct, setConfigProduct] = useState<Product | null>(null)
  const [configOptionGroups, setConfigOptionGroups] = useState<ProductOptionGroup[]>([])
  const [isLoadingOptions, setIsLoadingOptions] = useState(false)

  // Combo config dialog state (for combo products)
  const [comboProduct, setComboProduct] = useState<Product | null>(null)
  const [comboSlots, setComboSlots] = useState<ComboSlot[]>([])
  const [isLoadingCombo, setIsLoadingCombo] = useState(false)

  // Print workflow state
  const [pendingPrintCart, setPendingPrintCart] = useState<typeof cart.cart>([])

  // Currency formatter
  const format = (amount: number) => formatCurrency(amount, settings.currency, settings.currencySymbol)

  // Check user role for API routing and UI visibility
  const isAdmin = isAdminOrManager()
  const userRole = getCurrentUserRole()
  const canProcessPayment = userRole !== 'server'

  // Sync cart context with selected table and order type
  useEffect(() => {
    cart.setContext(selectedTable?.id || null, orderType)
  }, [selectedTable?.id, orderType, cart.setContext])

  // Queries
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiClient.getCategories().then(res => res.data)
  })

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => apiClient.getProducts().then(res => res.data)
  })

  const { data: tables = [] } = useQuery({
    queryKey: ['tables'],
    queryFn: () => apiClient.getTables().then(res => res.data)
  })

  const { data: allOrders = [] } = useQuery({
    queryKey: ['allActiveOrders'],
    queryFn: () => apiClient.getOrders().then(res => res.data)
  })

  // Query for active bill on selected table (KOT support)
  const { data: activeBillData } = useQuery({
    queryKey: ['activeBill', selectedTable?.id],
    queryFn: () => selectedTable ? apiClient.getActiveBillForTable(selectedTable.id).then(res => res.data) : null,
    enabled: !!selectedTable && orderType === 'dine_in' && isOnline
  })
  const activeBill = activeBillData || null

  // Safe arrays
  const safeCategories = Array.isArray(categories) ? categories : []
  const safeProducts = Array.isArray(products) ? products : []
  const safeTables = Array.isArray(tables) ? tables : []
  const safeAllOrders = Array.isArray(allOrders) ? allOrders : []

  // Filtered products by search
  const filteredProducts = safeProducts.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
  )

  // Offline order hook
  const {
    createOrder: createOfflineOrder,
    pendingOrders: offlineOrders,
    syncPendingOrders,
    removePendingOrder,
    isCreating: isCreatingOffline,
    isSyncing,
  } = useOfflineOrder({
    createOrderApi: async (order: CreateOrderRequest) => {
      const response = isAdmin
        ? await adminApi.createOrder(order)
        : await counterApi.createOrder(order)
      return response
    },
    onSuccess: (order, isOffline) => {
      if (isOffline) {
        setSuccessMessage('Order saved offline! Will sync when connected.')
      } else {
        setSuccessMessage('Order created successfully!')
      }
      cart.clearCart()
      setCustomerName('')
      setOrderNotes('')
      invalidateQueries()
      setTimeout(() => setSuccessMessage(null), 3000)
    },
    onError: (error) => {
      setErrorMessage(error.message || 'Failed to create order')
    },
  })

  // Helper to invalidate all relevant queries
  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['orders'] })
    queryClient.invalidateQueries({ queryKey: ['tables'] })
    queryClient.invalidateQueries({ queryKey: ['allActiveOrders'] })
    queryClient.invalidateQueries({ queryKey: ['activeBill'] })
  }

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: (orderData: CreateOrderRequest & { shouldPrint?: boolean }) => {
      if (isAdmin) {
        return apiClient.createAdminOrder(orderData)
      } else if (userRole === 'server') {
        return apiClient.createServerOrder(orderData)
      } else {
        return apiClient.createCounterOrder(orderData)
      }
    },
    onSuccess: (response, variables) => {
      const createdOrder = response.data
      if (variables.shouldPrint && createdOrder) {
        const kotItems: KOTItem[] = pendingPrintCart.map(item => ({
          name: item.product.name,
          quantity: item.quantity,
          special_instructions: item.special_instructions
        }))
        printKOT(
          createdOrder.order_number,
          selectedTable?.table_number,
          variables.customer_name,
          variables.order_type,
          kotItems,
          variables.notes,
          false
        )
        setSuccessMessage('Order created! KOT sent to kitchen.')
      } else {
        setSuccessMessage('Order created successfully!')
      }
      cart.clearCart()
      setPendingPrintCart([])
      setCustomerName('')
      setOrderNotes('')
      setErrorMessage(null)
      invalidateQueries()
      setTimeout(() => setSuccessMessage(null), 3000)
    },
    onError: (error: Error) => {
      setErrorMessage(error.message || 'Failed to create order. Please try again.')
      setSuccessMessage(null)
    }
  })

  // Add items mutation
  const addItemsMutation = useMutation({
    mutationFn: ({ orderId, items }: {
      orderId: string,
      items: Array<{ product_id: string; quantity: number; special_instructions?: string }>,
      existingOrder?: Order,
      shouldPrint?: boolean
    }) => {
      if (isAdmin) {
        return apiClient.addItemsToAdminOrder(orderId, items)
      } else if (userRole === 'server') {
        return apiClient.addItemsToServerOrder(orderId, items)
      } else {
        return apiClient.addItemsToCounterOrder(orderId, items)
      }
    },
    onSuccess: (_, variables) => {
      if (variables.shouldPrint && variables.existingOrder) {
        const kotItems: KOTItem[] = pendingPrintCart.map(item => ({
          name: item.product.name,
          quantity: item.quantity,
          special_instructions: item.special_instructions
        }))
        printKOT(
          variables.existingOrder.order_number,
          selectedTable?.table_number,
          variables.existingOrder.customer_name,
          orderType,
          kotItems,
          orderNotes,
          true
        )
        setSuccessMessage('Items added to order! KOT printed.')
      } else {
        setSuccessMessage('Items added to order successfully!')
      }
      cart.clearCart()
      setPendingPrintCart([])
      setOrderNotes('')
      setErrorMessage(null)
      invalidateQueries()
      setTimeout(() => setSuccessMessage(null), 3000)
    },
    onError: (error: Error) => {
      setErrorMessage(error.message || 'Failed to add items. Please try again.')
      setSuccessMessage(null)
    }
  })

  // Delete order mutation (for canceling orders)
  const deleteOrderMutation = useMutation({
    mutationFn: (orderId: string) =>
      isAdmin
        ? apiClient.deleteAdminOrder(orderId)
        : apiClient.deleteOrder(orderId),
    onSuccess: async () => {
      setErrorMessage(null)
      setSuccessMessage('Order cancelled successfully!')
      // Clear cached data immediately for instant UI update
      if (selectedTable) {
        queryClient.setQueryData(['activeBill', selectedTable.id], null)
      }
      queryClient.setQueryData(['allActiveOrders'], (old: Order[] | undefined) =>
        old ? old.filter(o => o.id !== orderToCancel?.id) : []
      )
      // Then refetch to get fresh data from server
      await queryClient.refetchQueries({ queryKey: ['activeBill'] })
      await queryClient.refetchQueries({ queryKey: ['allActiveOrders'] })
      await queryClient.refetchQueries({ queryKey: ['tables'] })
      setTimeout(() => setSuccessMessage(null), 3000)
    },
    onError: (error: Error) => {
      setErrorMessage(error.message || 'Failed to cancel order. Please try again.')
      setSuccessMessage(null)
    }
  })

  // Update order item mutation
  const updateOrderItemMutation = useMutation({
    mutationFn: ({ orderId, itemId, quantity }: { orderId: string; itemId: string; quantity: number }) => {
      if (isAdmin) {
        return apiClient.updateAdminOrderItem(orderId, itemId, { quantity })
      } else if (userRole === 'server') {
        return apiClient.updateServerOrderItem(orderId, itemId, { quantity })
      } else {
        return apiClient.updateCounterOrderItem(orderId, itemId, { quantity })
      }
    },
    onSuccess: (response) => {
      setErrorMessage(null)
      setSuccessMessage('Item updated successfully!')
      // Update the order being edited with new data
      if (response.data && orderToEdit) {
        setOrderToEdit(response.data)
      }
      invalidateQueries()
      setTimeout(() => setSuccessMessage(null), 3000)
    },
    onError: (error: Error) => {
      setErrorMessage(error.message || 'Failed to update item. Please try again.')
      setSuccessMessage(null)
    }
  })

  // Remove order item mutation
  const removeOrderItemMutation = useMutation({
    mutationFn: ({ orderId, itemId }: { orderId: string; itemId: string }) => {
      if (isAdmin) {
        return apiClient.removeAdminOrderItem(orderId, itemId)
      } else if (userRole === 'server') {
        return apiClient.removeServerOrderItem(orderId, itemId)
      } else {
        return apiClient.removeCounterOrderItem(orderId, itemId)
      }
    },
    onSuccess: (response) => {
      setErrorMessage(null)
      setSuccessMessage('Item removed successfully!')
      // Update the order being edited with new data, or close if order was cancelled
      if (response.data) {
        if (response.data.status === 'cancelled') {
          setOrderToEdit(null)
          setSuccessMessage('Item removed and order cancelled (no items remaining)')
        } else {
          setOrderToEdit(response.data)
        }
      }
      invalidateQueries()
      setTimeout(() => setSuccessMessage(null), 3000)
    },
    onError: (error: Error) => {
      setErrorMessage(error.message || 'Failed to remove item. Please try again.')
      setSuccessMessage(null)
    }
  })

  // Handle order creation
  // For dine-in orders: uses KOT mode (creates bill + KOT structure)
  const handleCreateOrder = async (shouldPrint: boolean = false) => {
    if (cart.cart.length === 0) return
    if (orderType === 'dine_in' && !selectedTable) return

    setPendingPrintCart([...cart.cart])
    const items = cart.toOrderItems()

    // For dine-in, fetch fresh active bill data to avoid stale parent_order_id
    let currentActiveBillId: string | undefined = undefined
    if (orderType === 'dine_in' && selectedTable && isOnline) {
      try {
        const freshBillData = await queryClient.fetchQuery({
          queryKey: ['activeBill', selectedTable.id],
          queryFn: () => apiClient.getActiveBillForTable(selectedTable.id).then(res => res.data),
          staleTime: 0, // Always fetch fresh
        })
        currentActiveBillId = freshBillData?.bill?.id
      } catch {
        // No active bill exists, will create a new one
        currentActiveBillId = undefined
      }
    }

    // Build order data with KOT support for dine-in
    const orderData: CreateOrderRequest = {
      table_id: orderType === 'dine_in' ? selectedTable?.id : undefined,
      customer_name: customerName || undefined,
      order_type: orderType,
      items,
      notes: orderNotes || undefined,
      // KOT support: for dine-in orders, always create as KOT
      create_as_kot: orderType === 'dine_in',
      // Use freshly fetched active bill ID
      parent_order_id: currentActiveBillId,
    }

    // Offline handling
    if (!isOnline) {
      try {
        const result = await createOfflineOrder(orderData)
        if (shouldPrint && 'orderNumber' in result) {
          const kotItems: KOTItem[] = pendingPrintCart.map(item => ({
            name: item.product.name,
            quantity: item.quantity,
            special_instructions: item.special_instructions
          }))
          printKOT(result.orderNumber, selectedTable?.table_number, orderData.customer_name, orderData.order_type, kotItems, orderData.notes, false)
        }
      } catch (error) {
        console.error('Failed to create offline order:', error)
      }
      return
    }

    createOrderMutation.mutate({ ...orderData, shouldPrint })
  }

  // Handle cancel order confirmation
  const handleCancelOrderConfirm = async () => {
    if (!orderToCancel) return

    const cancelledId = orderToCancel.id
    const parentBill = activeBill?.bill
    const isKOT = parentBill && activeBill?.kots?.some((k: Order) => k.id === cancelledId)

    setOrderToCancel(null)
    await deleteOrderMutation.mutateAsync(cancelledId)

    // If this was the last KOT, also delete the now-empty parent bill
    if (isKOT && parentBill) {
      const remainingKOTs = (activeBill?.kots || []).filter((k: Order) => k.id !== cancelledId)
      if (remainingKOTs.length === 0) {
        await deleteOrderMutation.mutateAsync(parentBill.id)
      }
    }
  }

  // Handle update order item
  const handleUpdateOrderItem = (orderId: string, itemId: string, quantity: number) => {
    updateOrderItemMutation.mutate({ orderId, itemId, quantity })
  }

  // Handle remove order item
  const handleRemoveOrderItem = (orderId: string, itemId: string) => {
    removeOrderItemMutation.mutate({ orderId, itemId })
  }

  // Payment overlay handlers
  const handleOpenPayment = () => {
    if (activeBill && selectedTable && canProcessPayment) {
      setShowPaymentOverlay(true)
    }
  }

  const handlePaymentComplete = () => {
    setShowPaymentOverlay(false)
    invalidateQueries()
    setSelectedTable(null)
    setActiveTab('tables')
    setSuccessMessage('Payment processed successfully!')
    setTimeout(() => setSuccessMessage(null), 3000)
  }

  const handleClearTable = async () => {
    if (!selectedTable) return
    try {
      if (isAdmin) {
        await apiClient.clearAdminTable(selectedTable.id)
      } else {
        await apiClient.clearCounterTable(selectedTable.id)
      }
      invalidateQueries()
      setSelectedTable(null)
      setActiveTab('tables')
      setSuccessMessage('Table cleared successfully!')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to clear table')
      setTimeout(() => setErrorMessage(null), 3000)
    }
  }

  // Handle configurable/combo product: fetch data, then open appropriate dialog
  const handleConfigureProduct = async (product: Product) => {
    if (product.product_type === 'combo') {
      // Combo product: load combo slots
      setComboProduct(product)
      setIsLoadingCombo(true)
      try {
        const response = await apiClient.getComboSlots(product.id)
        const slots = Array.isArray(response.data) ? response.data : []
        setComboSlots(slots)
      } catch {
        setComboSlots([])
      } finally {
        setIsLoadingCombo(false)
      }
    } else {
      // Configurable product: load option groups
      setConfigProduct(product)
      setIsLoadingOptions(true)
      try {
        const response = await apiClient.getOptionGroups(product.id)
        const groups = Array.isArray(response.data) ? response.data : []
        setConfigOptionGroups(groups)
      } catch {
        setConfigOptionGroups([])
      } finally {
        setIsLoadingOptions(false)
      }
    }
  }

  // Handle adding configured product to cart
  const handleAddConfiguredProduct = (product: Product, selectedOptions: SelectedOption[], quantity: number) => {
    cart.addToCart(product, selectedOptions, quantity)
    setConfigProduct(null)
    setConfigOptionGroups([])
  }

  // Handle adding combo product to cart
  const handleAddComboProduct = (product: Product, _selectedOptions: SelectedOption[], quantity: number, selectedComboChoices: SelectedComboChoice[]) => {
    cart.addToCart(product, [], quantity, selectedComboChoices)
    setComboProduct(null)
    setComboSlots([])
  }

  const isCreating = createOrderMutation.isPending || addItemsMutation.isPending || isCreatingOffline
  const isUpdatingItem = updateOrderItemMutation.isPending || removeOrderItemMutation.isPending

  // Right panel only visible on create tab (product selection)
  const showRightPanel = activeTab === 'create'

  return (
    <div className="flex h-full bg-background">
      {/* Left Panel - Main Content */}
      <div className={`${showRightPanel ? 'w-2/3' : 'w-full'} border-r border-border overflow-hidden flex flex-col transition-all duration-300 relative`}>
        {/* Header - only show when on create tab (product selection) */}
        {activeTab === 'create' && (
          <div className="p-4 bg-card">
            <div className="flex items-center gap-3 flex-1">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setActiveTab('tables')}
                className="h-12 w-12 p-0"
              >
                <ArrowLeft className="w-6 h-6" />
              </Button>
              <div className="flex items-center gap-3 flex-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold flex items-center gap-2">
                    {orderType === 'dine_in' && selectedTable ? (
                      <>
                        <TableIcon className="w-6 h-6" />
                        Table {selectedTable.table_number}
                      </>
                    ) : orderType === 'takeout' ? (
                      <>
                        <Package className="w-6 h-6" />
                        Takeout Order
                      </>
                    ) : (
                      <>
                        <Car className="w-6 h-6" />
                        Delivery Order
                      </>
                    )}
                  </h1>
                  <Badge className={`${
                    orderType === 'dine_in' ? 'bg-blue-700 hover:bg-blue-700' :
                    orderType === 'takeout' ? 'bg-orange-500' : 'bg-green-500'
                  } text-white px-3 py-1 text-sm `}>
                    {orderType === 'dine_in' ? 'Dine-In' :
                     orderType === 'takeout' ? 'Takeout' : 'Delivery'}
                  </Badge>
                </div>
                {/* Search */}
                <div className="flex items-center gap-2 ml-auto flex-1 justify-end">
                  {showSearchKeyboard || searchTerm ? (
                    <div
                      onClick={() => setShowSearchKeyboard(true)}
                      className="flex items-center gap-2 h-12 px-4 rounded-md border-2 border-primary bg-background cursor-pointer flex-1"
                    >
                      <Search className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      <span className="text-lg flex-1">
                        {searchTerm || <span className="text-muted-foreground">Search...</span>}
                      </span>
                      <span className="inline-block w-0.5 h-5 bg-primary animate-pulse flex-shrink-0" />
                    </div>
                  ) : null}
                  {showSearchKeyboard || searchTerm ? (
                    <Button
                      variant="ghost"
                      size="lg"
                      onClick={() => {
                        setSearchTerm('')
                        setShowSearchKeyboard(false)
                      }}
                      className="h-12 w-12 p-0 flex-shrink-0"
                    >
                      <X className="w-6 h-6" />
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => setShowSearchKeyboard(true)}
                      className="h-12 w-12 p-0"
                    >
                      <Search className="w-6 h-6" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto pb-4">
          {/* Aggregator Orders - show on tables view */}
          {activeTab === 'tables' && (
            <div className="px-4 pt-4">
              <AggregatorOrders />
            </div>
          )}
          {activeTab === 'tables' && (
            <TablesView
              tables={safeTables}
              allOrders={safeAllOrders}
              selectedTable={selectedTable}
              onTableSelect={(table) => {
                setSelectedTable(table)
                // Always go directly to product selection
                setActiveTab('create')
              }}
              formatCurrency={format}
              orderType={orderType}
              onOrderTypeChange={(type) => {
                setOrderType(type)
                // Clear table selection when switching away from dine-in
                if (type !== 'dine_in') {
                  setSelectedTable(null)
                }
              }}
              customerName={customerName}
              onCustomerNameChange={setCustomerName}
              onProceedToProducts={() => setActiveTab('create')}
              serverOnly={userRole === 'server'}
              hasCartItems={(tableId) => cart.hasItemsInCart(tableId, 'dine_in')}
            />
          )}
          {activeTab === 'create' && (
            <CreateOrderView
              products={filteredProducts}
              categories={safeCategories}
              cart={cart.cart}
              onAddToCart={cart.addToCart}
              onRemoveFromCart={cart.removeFromCart}
              onConfigureProduct={handleConfigureProduct}
              formatCurrency={format}
            />
          )}
        </div>

              </div>

      {/* Right Panel - Sidebar */}
      <div className={`${showRightPanel ? 'w-1/3 translate-x-0' : 'w-0 translate-x-full'} flex flex-col bg-muted/50 overflow-hidden transition-all duration-300 ease-in-out`}>
        {/* Messages */}
        {errorMessage && (
          <div className="p-3 bg-red-100 border-b border-red-200 text-red-800 text-sm">
            <div className="flex items-center justify-between">
              <span>{errorMessage}</span>
              <button onClick={() => setErrorMessage(null)} className="text-red-600 hover:text-red-800">×</button>
            </div>
          </div>
        )}
        {successMessage && (
          <div className="p-3 bg-green-100 border-b border-green-200 text-green-800 text-sm">
            <div className="flex items-center justify-between">
              <span>{successMessage}</span>
              <button onClick={() => setSuccessMessage(null)} className="text-green-600 hover:text-green-800">×</button>
            </div>
          </div>
        )}

        {/* Offline Orders Banner */}
        {offlineOrders.length > 0 && (
          <div className="p-3 bg-amber-50 border-b border-amber-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-800">
                <CloudOff className="w-4 h-4" />
                <span className="text-sm font-medium">{offlineOrders.length} order{offlineOrders.length > 1 ? 's' : ''} pending sync</span>
              </div>
              {isOnline && (
                <Button variant="outline" size="sm" onClick={syncPendingOrders} disabled={isSyncing} className="text-amber-800 border-amber-300 hover:bg-amber-100">
                  {isSyncing ? <><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Syncing...</> : <><RefreshCw className="w-3 h-3 mr-1" /> Sync Now</>}
                </Button>
              )}
            </div>
            <div className="mt-2 space-y-1">
              {offlineOrders.slice(0, 3).map((order) => (
                <div key={order.localId} className="flex items-center justify-between text-xs text-amber-700 bg-amber-100 rounded px-2 py-1">
                  <span>#{order.orderNumber} • {order.items.length} items{order.customerName && ` • ${order.customerName}`}</span>
                  <div className="flex items-center gap-2">
                    {order.status === 'failed' && <span className="text-red-600">Failed</span>}
                    <button onClick={() => removePendingOrder(order.localId)} className="text-amber-600 hover:text-red-600" title="Remove"><X className="w-3 h-3" /></button>
                  </div>
                </div>
              ))}
              {offlineOrders.length > 3 && <div className="text-xs text-amber-600">+{offlineOrders.length - 3} more...</div>}
            </div>
          </div>
        )}

        {/* Panel Content */}
        {activeTab === 'tables' && (
          <TableDetailsPanel
            selectedTable={selectedTable}
            tableOrders={selectedTable ? getTableOrders(safeAllOrders, selectedTable.id) : []}
            onClose={() => setSelectedTable(null)}
            onCreateOrder={() => { setOrderType('dine_in'); setActiveTab('create') }}
            onEditOrder={setOrderToEdit}
            formatCurrency={format}
            canProcessPayment={canProcessPayment}
          />
        )}
        {activeTab === 'create' && (
          <CartPanel
            cart={cart.cart}
            orderType={orderType}
            selectedTable={selectedTable}
            allOrders={safeAllOrders}
            orderNotes={orderNotes}
            isOnline={isOnline}
            isCreating={isCreating}
            activeBill={activeBill}
            canProcessPayment={canProcessPayment}
            onOpenPayment={handleOpenPayment}
            onClearTable={handleClearTable}
            onOrderNotesChange={setOrderNotes}
            onAddToCart={cart.addToCart}
            onRemoveFromCart={cart.removeFromCart}
            onRemoveItem={(productId, cartItemId) => cart.updateQuantity(productId, 0, cartItemId)}
            onUpdateSpecialInstructions={cart.updateSpecialInstructions}
            onClearCart={cart.clearCart}
            onCreateOrder={handleCreateOrder}
            onCancelOrder={setOrderToCancel}
            onEditOrder={setOrderToEdit}
            formatCurrency={format}
            getTotalAmount={cart.getTotalAmount}
          />
        )}
      </div>

      {/* Product Options Dialog (configurable products) */}
      {configProduct && !isLoadingOptions && (
        <ProductOptionsDialog
          product={configProduct}
          optionGroups={configOptionGroups}
          open={true}
          onClose={() => { setConfigProduct(null); setConfigOptionGroups([]) }}
          onAddToCart={handleAddConfiguredProduct}
          formatCurrency={format}
        />
      )}

      {/* Combo Config Dialog (combo products) */}
      {comboProduct && !isLoadingCombo && (
        <ComboConfigDialog
          product={comboProduct}
          comboSlots={comboSlots}
          open={true}
          onClose={() => { setComboProduct(null); setComboSlots([]) }}
          onAddToCart={handleAddComboProduct}
          formatCurrency={format}
        />
      )}

      {/* Dialogs */}
      <CancelOrderDialog
        order={orderToCancel}
        isDeleting={deleteOrderMutation.isPending}
        onConfirm={handleCancelOrderConfirm}
        onCancel={() => setOrderToCancel(null)}
        formatCurrency={format}
      />

      {orderToEdit && (
        <EditOrderDialog
          order={orderToEdit}
          isUpdating={isUpdatingItem}
          onUpdateItem={handleUpdateOrderItem}
          onRemoveItem={handleRemoveOrderItem}
          onClose={() => setOrderToEdit(null)}
          formatCurrency={format}
        />
      )}

      {/* Inline Keyboard for Product Search - slides in from bottom */}
      {showSearchKeyboard && (
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 animate-in slide-in-from-bottom duration-300 z-50">
          <div className="space-y-2 max-w-4xl mx-auto">
            {QWERTY_LAYOUT.rows.map((row, index) => (
              <KeyboardRow
                key={`search-row-${index}`}
                row={row}
                isShifted={false}
                onKeyPress={(config: KeyConfig) => {
                  switch (config.type) {
                    case 'char':
                      if (searchTerm.length < 100) {
                        setSearchTerm(searchTerm + (config.value || ''))
                      }
                      break
                    case 'backspace':
                      setSearchTerm(searchTerm.slice(0, -1))
                      break
                    case 'space':
                      if (searchTerm.length < 100) {
                        setSearchTerm(searchTerm + ' ')
                      }
                      break
                    case 'clear':
                      setSearchTerm('')
                      break
                    case 'enter':
                      setShowSearchKeyboard(false)
                      break
                  }
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Payment Overlay */}
      {showPaymentOverlay && activeBill && selectedTable && (
        <PaymentOverlay
          activeBill={activeBill}
          selectedTable={selectedTable}
          isAdmin={isAdmin}
          formatCurrency={format}
          onClose={() => setShowPaymentOverlay(false)}
          onPaymentComplete={handlePaymentComplete}
        />
      )}
    </div>
  )
}
