import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouterState } from '@tanstack/react-router'
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
  Car,
  UtensilsCrossed
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useSettingsStore, useSyncStore, useOfflineOrder, useCustomerDisplayBroadcast } from '@pos/core'
import type { DisplayCartItem } from '@pos/core'
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
  const { broadcastCartUpdate, broadcastIdle } = useCustomerDisplayBroadcast()

  // URL-based navigation state (works on both /admin/pos and / routes)
  const routerState = useRouterState()
  const search = (routerState.location.search as Record<string, string | undefined>) || {}
  const navigate = useNavigate()

  const isServer = getCurrentUserRole() === 'server'
  const defaultOrderType = (settings.cartSettings?.defaultOrderType as OrderType) || 'dine_in'

  const activeTab: ActiveTab = (search.view as ActiveTab) || (isServer ? 'tables' : 'order-type')
  const orderType: OrderType = (search.type as OrderType) || defaultOrderType

  // Determine which order types are enabled
  const enabledOrderTypes = useMemo(() => {
    const types: { type: OrderType; view: ActiveTab }[] = []
    if (settings.cartSettings?.showDineIn !== false) types.push({ type: 'dine_in', view: 'tables' })
    if (settings.cartSettings?.showTakeout !== false) types.push({ type: 'takeout', view: 'create' })
    if (settings.cartSettings?.showDelivery !== false) types.push({ type: 'delivery', view: 'tables' })
    return types
  }, [settings.cartSettings?.showDineIn, settings.cartSettings?.showTakeout, settings.cartSettings?.showDelivery])

  // Navigate by updating URL search params
  const navigateTo = useCallback((view: ActiveTab, type?: OrderType) => {
    navigate({
      to: routerState.location.pathname,
      search: {
        view: view === 'order-type' ? undefined : view,
        type: type ?? (view === 'order-type' ? undefined : orderType),
      },
      replace: true,
    })
  }, [navigate, orderType, routerState.location.pathname])

  // Auto-skip order type selection when only one option is enabled
  useEffect(() => {
    if (activeTab === 'order-type' && enabledOrderTypes.length === 1) {
      const only = enabledOrderTypes[0]
      if (only.type === 'takeout') {
        setSelectedTable(null)
      }
      navigateTo(only.view, only.type)
    }
  }, [activeTab, enabledOrderTypes, navigateTo])

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
  const pendingPayment = useRef(false)
  const [takeawayBill, setTakeawayBill] = useState<BillSummary | null>(null)

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

  // Redirect to table selection if on create view with dine_in but no table selected (e.g. after page refresh)
  useEffect(() => {
    if (activeTab === 'create' && orderType === 'dine_in' && !selectedTable) {
      navigateTo('tables', 'dine_in')
    }
  }, [activeTab, orderType, selectedTable, navigateTo])

  // Sync cart context with selected table and order type
  useEffect(() => {
    cart.setContext(selectedTable?.id || null, orderType)
  }, [selectedTable?.id, orderType, cart.setContext])

  // Broadcast cart state to customer-facing display
  useEffect(() => {
    if (cart.cart.length === 0) {
      broadcastIdle()
      return
    }

    const taxRate = settings.taxRate || 0
    const items: DisplayCartItem[] = cart.cart.map(item => {
      const optionsAdj = (item.selectedOptions || []).reduce((s, o) => s + o.priceAdjustment, 0)
      const comboAdj = (item.selectedComboChoices || []).reduce((s, c) => s + c.priceAdjustment, 0)
      const unitPrice = item.product.price + optionsAdj + comboAdj
      return {
        name: item.product.name,
        quantity: item.quantity,
        unitPrice,
        lineTotal: unitPrice * item.quantity,
      }
    })
    const subtotal = items.reduce((s, i) => s + i.lineTotal, 0)
    const tax = subtotal * (taxRate / 100)
    const total = subtotal + tax

    broadcastCartUpdate(items, subtotal, tax, total)
  }, [cart.cart, settings.taxRate, broadcastCartUpdate, broadcastIdle])

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
    queryFn: () => apiClient.getTables().then(res => res.data),
    refetchInterval: 5 * 1000, // 5 seconds – table status must stay fresh
  })

  const { data: allOrders = [] } = useQuery({
    queryKey: ['allActiveOrders'],
    queryFn: () => apiClient.getOrders().then(res => res.data),
    refetchInterval: 5 * 1000, // 5 seconds – keep orders in sync across counter & kitchen
  })

  // Query for active bill on selected table (KOT support)
  const { data: activeBillData } = useQuery({
    queryKey: ['activeBill', selectedTable?.id],
    queryFn: () => selectedTable ? apiClient.getActiveBillForTable(selectedTable.id).then(res => res.data) : null,
    enabled: !!selectedTable && orderType === 'dine_in' && isOnline,
    refetchInterval: 5000, // Keep KOT statuses fresh so cart reflects served state
  })
  const activeBill = activeBillData || null

  // Safe arrays
  const safeCategories = Array.isArray(categories) ? categories : []
  const safeProducts = Array.isArray(products) ? products : []
  const safeTables = Array.isArray(tables) ? tables : []
  const safeAllOrders = Array.isArray(allOrders) ? allOrders : []

  // Active tables count (tables that have non-completed, non-cancelled orders)
  const activeTablesCount = useMemo(() => {
    return safeTables.filter(table => getTableOrders(safeAllOrders, table.id).length > 0).length
  }, [safeTables, safeAllOrders])

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
      if (settings.cartSettings?.autoClearAfterOrder !== false) {
        cart.clearCart()
        setCustomerName('')
        setOrderNotes('')
      }
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

      // Takeout/Delivery pending payment: construct BillSummary and open payment overlay
      if (pendingPayment.current && createdOrder && variables.order_type !== 'dine_in') {
        pendingPayment.current = false
        const bill: BillSummary = {
          bill: createdOrder,
          kots: [],
          total_items: createdOrder.items?.length || 0,
          aggregated_subtotal: createdOrder.total_amount || 0,
          aggregated_tax: 0,
          aggregated_discount: 0,
          aggregated_total: createdOrder.total_amount || 0,
          is_bill_closed: false,
        }
        setTakeawayBill(bill)
        cart.clearCart()
        setCustomerName('')
        setOrderNotes('')
        setPendingPrintCart([])
        setErrorMessage(null)
        invalidateQueries()
        setShowPaymentOverlay(true)
        return
      }

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
      if (settings.cartSettings?.autoClearAfterOrder !== false) {
        cart.clearCart()
        setCustomerName('')
        setOrderNotes('')
      }
      setPendingPrintCart([])
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
      if (settings.cartSettings?.autoClearAfterOrder !== false) {
        cart.clearCart()
        setOrderNotes('')
      }
      setPendingPrintCart([])
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
    if (!canProcessPayment) return

    // Dine-in: requires a selected table
    if (orderType === 'dine_in') {
      if (!selectedTable) return

      // If there's an active bill ready for payment, open directly
      if (activeBill && activeBill.bill?.status !== 'paid') {
        setShowPaymentOverlay(true)
        return
      }

      // If there are items in cart but no active bill, create order first then open payment
      if (cart.cart.length > 0) {
        pendingPayment.current = true
        handleCreateOrder(false)
      }
      return
    }

    // Takeout/Delivery: create order then open payment
    if (cart.cart.length > 0) {
      pendingPayment.current = true
      handleCreateOrder(false)
    }
  }

  // Open payment overlay after dine-in order creation completes (activeBill updates)
  useEffect(() => {
    if (pendingPayment.current && orderType === 'dine_in' && activeBill && activeBill.bill?.status !== 'paid') {
      pendingPayment.current = false
      setShowPaymentOverlay(true)
    }
  }, [activeBill])

  const handlePaymentComplete = () => {
    setShowPaymentOverlay(false)
    setTakeawayBill(null)
    invalidateQueries()
    if (orderType === 'dine_in') {
      setSelectedTable(null)
    }
    navigateTo('order-type')
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
      navigateTo('order-type')
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
      // Configurable product: load option groups (includes variation groups from backend)
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
    <div className="flex h-full bg-zinc-950 text-zinc-100">
      {/* Left Panel - Main Content */}
      <div className={`${showRightPanel ? 'w-2/3' : 'w-full'} border-r border-zinc-800 overflow-hidden flex flex-col transition-all duration-300 relative`}>
        {/* Header - tables view */}
        {activeTab === 'tables' && (
          <div className="p-4 bg-zinc-900 border-b border-zinc-800">
            <div className="flex items-center gap-3">
              {enabledOrderTypes.length > 1 && (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => navigateTo('order-type')}
                  className="h-12 w-12 p-0 bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                >
                  <ArrowLeft className="w-6 h-6" />
                </Button>
              )}
              <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                {orderType === 'dine_in' ? (
                  <>
                    <TableIcon className="w-6 h-6" />
                    Select a Table
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
              } text-white px-3 py-1 text-sm`}>
                {orderType === 'dine_in' ? 'Dine-In' :
                 orderType === 'takeout' ? 'Takeout' : 'Delivery'}
              </Badge>
            </div>
          </div>
        )}
        {/* Header - product selection */}
        {activeTab === 'create' && (
          <div className="p-4 bg-zinc-900 border-b border-zinc-800">
            <div className="flex items-center gap-3 flex-1">
              {(orderType === 'dine_in' || enabledOrderTypes.length > 1) && (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    if (orderType === 'dine_in') {
                      navigateTo('tables')
                    } else {
                      navigateTo('order-type')
                      setSelectedTable(null)
                    }
                  }}
                  className="h-12 w-12 p-0 bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                >
                  <ArrowLeft className="w-6 h-6" />
                </Button>
              )}
              <div className="flex items-center gap-3 flex-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
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
                      className="flex items-center gap-2 h-12 px-4 rounded-md border-2 border-amber-500 bg-zinc-900 cursor-pointer flex-1"
                    >
                      <Search className="w-5 h-5 text-zinc-500 flex-shrink-0" />
                      <span className="text-lg flex-1">
                        {searchTerm || <span className="text-zinc-500">Search...</span>}
                      </span>
                      <span className="inline-block w-0.5 h-5 bg-amber-500 animate-pulse flex-shrink-0" />
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
                      className="h-12 w-12 p-0 flex-shrink-0 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                    >
                      <X className="w-6 h-6" />
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => setShowSearchKeyboard(true)}
                      className="h-12 w-12 p-0 bg-zinc-900 border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
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
          {/* Order Type Selection - first step */}
          {activeTab === 'order-type' && (
            <div className="flex flex-col h-full">
              <div className="px-4 pt-4">
                <AggregatorOrders />
              </div>
              <div className="flex-1 flex flex-col items-center justify-center p-6">
                <h1 className="text-3xl font-black tracking-tight text-zinc-100 mb-8">Are you dining in or taking away?</h1>
                <div className="flex gap-6 w-full max-w-4xl">
                  {(settings.cartSettings?.showDineIn !== false) && (
                    <button
                      onClick={() => navigateTo('tables', 'dine_in')}
                      className="flex-1 relative overflow-hidden rounded-2xl h-80 group cursor-pointer border-4 border-transparent hover:border-amber-500 active:scale-[0.97] transition-all duration-200 select-none touch-manipulation"
                    >
                      <span className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110" style={{ backgroundImage: 'url(/images/dine-in.png)' }} />
                      <span className="absolute inset-0 bg-black/50 group-hover:bg-black/40 transition-colors" />
                      <span className="relative z-10 flex flex-col items-center justify-center h-full gap-3 text-white">
                        <UtensilsCrossed className="w-10 h-10" />
                        <span className="text-3xl font-bold">Dine-In</span>
                        {activeTablesCount > 0 && (
                          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur text-sm font-semibold">
                            <TableIcon className="w-3.5 h-3.5" />
                            {activeTablesCount} active {activeTablesCount === 1 ? 'table' : 'tables'}
                          </span>
                        )}
                      </span>
                    </button>
                  )}
                  {(settings.cartSettings?.showTakeout !== false) && (
                    <button
                      onClick={() => {
                        setSelectedTable(null)
                        navigateTo('create', 'takeout')
                      }}
                      className="flex-1 relative overflow-hidden rounded-2xl h-80 group cursor-pointer border-4 border-transparent hover:border-orange-500 active:scale-[0.97] transition-all duration-200 select-none touch-manipulation"
                    >
                      <span className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110" style={{ backgroundImage: 'url(/images/takeout.png)' }} />
                      <span className="absolute inset-0 bg-black/50 group-hover:bg-black/40 transition-colors" />
                      <span className="relative z-10 flex flex-col items-center justify-center h-full gap-3 text-white">
                        <Package className="w-10 h-10" />
                        <span className="text-3xl font-bold">Takeout</span>
                      </span>
                    </button>
                  )}
                  {(settings.cartSettings?.showDelivery !== false) && (
                    <button
                      onClick={() => {
                        setSelectedTable(null)
                        navigateTo('tables', 'delivery')
                      }}
                      className="flex-1 relative overflow-hidden rounded-2xl h-80 group cursor-pointer border-4 border-transparent hover:border-green-500 active:scale-[0.97] transition-all duration-200 select-none touch-manipulation"
                    >
                      <span className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110" style={{ backgroundImage: 'url(/images/delivery.png)' }} />
                      <span className="absolute inset-0 bg-black/50 group-hover:bg-black/40 transition-colors" />
                      <span className="relative z-10 flex flex-col items-center justify-center h-full gap-3 text-white">
                        <Car className="w-10 h-10" />
                        <span className="text-3xl font-bold">Delivery</span>
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
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
                navigateTo('create')
              }}
              formatCurrency={format}
              orderType={orderType}
              onOrderTypeChange={(type) => {
                if (type !== 'dine_in') {
                  setSelectedTable(null)
                }
                if (type === 'takeout') {
                  navigateTo('create', type)
                } else {
                  navigateTo('tables', type)
                }
              }}
              customerName={customerName}
              onCustomerNameChange={setCustomerName}
              onProceedToProducts={() => navigateTo('create')}
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
      <div className={`${showRightPanel ? 'w-1/3 translate-x-0' : 'w-0 translate-x-full'} flex flex-col bg-zinc-900 overflow-hidden transition-all duration-300 ease-in-out`}>
        {/* Messages */}
        {errorMessage && (
          <div className="p-3 bg-red-500/15 border-b border-red-500/20 text-red-400 text-sm">
            <div className="flex items-center justify-between">
              <span>{errorMessage}</span>
              <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-red-300">×</button>
            </div>
          </div>
        )}
        {successMessage && (
          <div className="p-3 bg-emerald-500/15 border-b border-emerald-500/20 text-emerald-400 text-sm">
            <div className="flex items-center justify-between">
              <span>{successMessage}</span>
              <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-300">×</button>
            </div>
          </div>
        )}

        {/* Offline Orders Banner */}
        {offlineOrders.length > 0 && (
          <div className="p-3 bg-amber-500/15 border-b border-amber-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400">
                <CloudOff className="w-4 h-4" />
                <span className="text-sm font-medium">{offlineOrders.length} order{offlineOrders.length > 1 ? 's' : ''} pending sync</span>
              </div>
              {isOnline && (
                <Button variant="outline" size="sm" onClick={syncPendingOrders} disabled={isSyncing} className="text-amber-400 border-amber-500/30 hover:bg-amber-500/20">
                  {isSyncing ? <><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Syncing...</> : <><RefreshCw className="w-3 h-3 mr-1" /> Sync Now</>}
                </Button>
              )}
            </div>
            <div className="mt-2 space-y-1">
              {offlineOrders.slice(0, 3).map((order) => (
                <div key={order.localId} className="flex items-center justify-between text-xs text-amber-400 bg-amber-500/10 rounded px-2 py-1">
                  <span>#{order.orderNumber} • {order.items.length} items{order.customerName && ` • ${order.customerName}`}</span>
                  <div className="flex items-center gap-2">
                    {order.status === 'failed' && <span className="text-red-400">Failed</span>}
                    <button onClick={() => removePendingOrder(order.localId)} className="text-amber-500 hover:text-red-400" title="Remove"><X className="w-3 h-3" /></button>
                  </div>
                </div>
              ))}
              {offlineOrders.length > 3 && <div className="text-xs text-amber-500">+{offlineOrders.length - 3} more...</div>}
            </div>
          </div>
        )}

        {/* Panel Content */}
        {activeTab === 'tables' && (
          <TableDetailsPanel
            selectedTable={selectedTable}
            tableOrders={selectedTable ? getTableOrders(safeAllOrders, selectedTable.id) : []}
            onClose={() => setSelectedTable(null)}
            onCreateOrder={() => navigateTo('create', 'dine_in')}
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
            cartSettings={settings.cartSettings}
            canProcessPayment={canProcessPayment}
            onOpenPayment={handleOpenPayment}
            onClearTable={handleClearTable}
            onOrderNotesChange={setOrderNotes}
            onAddToCart={cart.addToCart}
            onRemoveFromCart={cart.removeFromCart}
            onRemoveItem={(productId, cartItemId) => cart.updateQuantity(productId, 0, cartItemId)}
            onUpdateQuantity={cart.updateQuantity}
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
        <div className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 p-4 animate-in slide-in-from-bottom duration-300 z-50">
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
      {showPaymentOverlay && (activeBill || takeawayBill) && (
        <PaymentOverlay
          activeBill={(activeBill || takeawayBill)!}
          selectedTable={orderType === 'dine_in' ? selectedTable : null}
          isAdmin={isAdmin}
          formatCurrency={format}
          onClose={() => { setShowPaymentOverlay(false); setTakeawayBill(null) }}
          onPaymentComplete={handlePaymentComplete}
        />
      )}
    </div>
  )
}
