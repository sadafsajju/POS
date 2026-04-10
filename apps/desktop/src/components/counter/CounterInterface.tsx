import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import apiClient from '@/api/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { KeyboardRow } from '@/components/ui/on-screen-keyboard/KeyboardRow'
import { QWERTY_LAYOUT } from '@/components/ui/on-screen-keyboard/keyboard-layouts'
import type { KeyConfig } from '@/components/ui/on-screen-keyboard/types'
import { Table as TableIcon, Search, CloudOff, RefreshCw, X, ArrowLeft, Package, Car, UtensilsCrossed} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useSettingsStore, useSyncStore, useOfflineOrder, useCustomerDisplayBroadcast } from '@pos/core'
import type { DisplayCartItem } from '@pos/core'
import { counterApi, adminApi } from '@pos/api-client'

// Types
import type { DiningTable, Order, ActiveTab, OrderType, CreateOrderRequest, KOTItem, BillSummary, Product, ProductOptionGroup, SelectedOption, SelectedComboChoice, ComboSlot, InlineConfigState } from './types'

// --- Helpers to reduce repetition ---

const ORDER_TYPE_CONFIG: Record<OrderType, { icon: typeof TableIcon; label: string; badgeColor: string; hoverColor: string }> = {
  dine_in: { icon: TableIcon, label: 'Dine-In', badgeColor: 'bg-blue-700 hover:bg-blue-700', hoverColor: 'hover:border-amber-500' },
  takeout: { icon: Package, label: 'Takeout', badgeColor: 'bg-orange-500', hoverColor: 'hover:border-orange-500' },
  delivery: { icon: Car, label: 'Delivery', badgeColor: 'bg-green-500', hoverColor: 'hover:border-green-500' },
}

function OrderTypeTitle({ orderType, tableLabel }: { orderType: OrderType; tableLabel?: string }) {
  const config = ORDER_TYPE_CONFIG[orderType]
  const Icon = config.icon
  return (
    <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
      <Icon className="w-6 h-6" />
      {tableLabel || (orderType === 'dine_in' ? 'Select a Table' : `${config.label} Order`)}
    </h1>
  )
}

function OrderTypeBadge({ orderType }: { orderType: OrderType }) {
  const config = ORDER_TYPE_CONFIG[orderType]
  return (
    <Badge className={`${config.badgeColor} text-white px-3 py-1 text-sm`}>
      {config.label}
    </Badge>
  )
}

function cartToKotItems(cartItems: Array<{ product: { name: string }; quantity: number; special_instructions?: string }>): KOTItem[] {
  return cartItems.map(item => ({
    name: item.product.name,
    quantity: item.quantity,
    special_instructions: item.special_instructions,
  }))
}

/** Pick the right API method based on user role */
function roleBasedApi<T>(
  isAdmin: boolean,
  userRole: string,
  apis: { admin: () => T; server: () => T; counter: () => T }
): T {
  if (isAdmin) return apis.admin()
  if (userRole === 'server') return apis.server()
  return apis.counter()
}

// Hooks
import { useCart } from './hooks/useCart'
import { useElapsedTimer } from './hooks/useElapsedTimer'

// Utils
import { isAdminOrManager, getTableOrders, getCurrentUserRole } from './utils/orderUtils'
import { printKOT } from './utils/printUtils'

// Views
import { TablesView } from './views/TablesView'
import { CreateOrderView } from './views/CreateOrderView'
import { VariantSelectionView } from './views/VariantSelectionView'

// Panels
import { TableDetailsPanel } from './panels/TableDetailsPanel'
import { CartPanel } from './panels/CartPanel'

// Dialogs
import { CancelOrderDialog } from './dialogs/CancelOrderDialog'
import { EditOrderDialog } from './dialogs/EditOrderDialog'
import { ProductOptionsDialog } from './dialogs/ProductOptionsDialog'

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
    if (settings.cartSettings?.showDelivery !== false) types.push({ type: 'delivery', view: 'create' })
    return types
  }, [settings.cartSettings?.showDineIn, settings.cartSettings?.showTakeout, settings.cartSettings?.showDelivery])

  // Navigate by updating URL search params
  const navigateTo = useCallback((view: ActiveTab, type?: OrderType) => {
    navigate({
      to: routerState.location.pathname,
      search: {
        view: view === 'order-type' ? undefined : view as any,
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

  // Inline config state (replaces product grid for variation/combo products)
  const [inlineConfig, setInlineConfig] = useState<InlineConfigState | null>(null)

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
    queryFn: () => apiClient.getActiveBillForTable(selectedTable!.id).then(res => res.data ?? null),
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
    onSuccess: (_order, isOffline) => {
      clearAfterOrder()
      showSuccess(isOffline ? 'Order saved offline! Will sync when connected.' : 'Order created successfully!')
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

  // Common mutation handlers
  const handleMutationError = (error: Error, fallback: string) => {
    setErrorMessage(error.message || fallback)
    setSuccessMessage(null)
  }

  const showSuccess = (msg: string) => {
    setErrorMessage(null)
    setSuccessMessage(msg)
    invalidateQueries()
    setTimeout(() => setSuccessMessage(null), 3000)
  }

  const clearAfterOrder = () => {
    if (settings.cartSettings?.autoClearAfterOrder !== false) {
      cart.clearCart()
      setCustomerName('')
      setOrderNotes('')
    }
    setPendingPrintCart([])
  }

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: (orderData: CreateOrderRequest & { shouldPrint?: boolean }) =>
      roleBasedApi(isAdmin, userRole, {
        admin: () => apiClient.createAdminOrder(orderData),
        server: () => apiClient.createServerOrder(orderData),
        counter: () => apiClient.createCounterOrder(orderData),
      }),
    onSuccess: (response, variables) => {
      // The create_order RPC returns { success, data: { ...order } } wrapped by wrapRpc,
      // so response.data is { success, data: { ...order }, bill_id } — unwrap the inner data
      const rpcResult = response.data as any
      const createdOrder = rpcResult?.data ?? rpcResult

      // Takeout/Delivery pending payment: construct BillSummary and open payment overlay
      if (pendingPayment.current && createdOrder && variables.order_type !== 'dine_in') {
        pendingPayment.current = false
        // Enrich order items with product names from the cart (RPC doesn't return product.name)
        if (Array.isArray(createdOrder.items)) {
          const cartItems = cart.cart
          createdOrder.items = createdOrder.items.map((item: any) => {
            const cartItem = cartItems.find(ci => ci.product.id === item.product_id)
            return cartItem ? { ...item, product: { id: item.product_id, name: cartItem.product.name } } : item
          })
        }
        const bill: BillSummary = {
          bill: createdOrder,
          kots: [],
          aggregated_total: createdOrder.total_amount || 0,
          paid_amount: 0,
          balance_due: createdOrder.total_amount || 0,
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
        printKOT(
          createdOrder.order_number,
          selectedTable?.table_number,
          variables.customer_name,
          variables.order_type,
          cartToKotItems(pendingPrintCart),
          variables.notes,
          false,
          undefined,
          undefined,
          createdOrder.token_number
        )
      }
      clearAfterOrder()
      showSuccess(variables.shouldPrint ? 'Order created! KOT sent to kitchen.' : 'Order created successfully!')
    },
    onError: (error: Error) => handleMutationError(error, 'Failed to create order. Please try again.')
  })

  // Add items mutation
  const addItemsMutation = useMutation({
    mutationFn: ({ orderId, items }: {
      orderId: string,
      items: Array<{ product_id: string; quantity: number; special_instructions?: string }>,
      existingOrder?: Order,
      shouldPrint?: boolean
    }) => roleBasedApi(isAdmin, userRole, {
      admin: () => apiClient.addItemsToAdminOrder(orderId, items),
      server: () => apiClient.addItemsToServerOrder(orderId, items),
      counter: () => apiClient.addItemsToCounterOrder(orderId, items),
    }),
    onSuccess: (_, variables) => {
      if (variables.shouldPrint && variables.existingOrder) {
        printKOT(
          variables.existingOrder.order_number,
          selectedTable?.table_number,
          variables.existingOrder.customer_name,
          orderType,
          cartToKotItems(pendingPrintCart),
          orderNotes,
          true,
          undefined,
          undefined,
          variables.existingOrder.token_number
        )
      }
      clearAfterOrder()
      showSuccess(variables.shouldPrint ? 'Items added to order! KOT printed.' : 'Items added to order successfully!')
    },
    onError: (error: Error) => handleMutationError(error, 'Failed to add items. Please try again.')
  })

  // Delete order mutation (for canceling orders)
  const deleteOrderMutation = useMutation({
    mutationFn: (orderId: string) =>
      isAdmin
        ? apiClient.deleteAdminOrder(orderId)
        : apiClient.deleteOrder(orderId),
    onSuccess: async () => {
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
      showSuccess('Order cancelled successfully!')
    },
    onError: (error: Error) => handleMutationError(error, 'Failed to cancel order. Please try again.')
  })

  // Update order item mutation
  const updateOrderItemMutation = useMutation({
    mutationFn: ({ orderId, itemId, quantity }: { orderId: string; itemId: string; quantity: number }) =>
      roleBasedApi(isAdmin, userRole, {
        admin: () => apiClient.updateAdminOrderItem(orderId, itemId, { quantity }),
        server: () => apiClient.updateServerOrderItem(orderId, itemId, { quantity }),
        counter: () => apiClient.updateCounterOrderItem(orderId, itemId, { quantity }),
      }),
    onSuccess: (response) => {
      if (response.data && orderToEdit) setOrderToEdit(response.data)
      showSuccess('Item updated successfully!')
    },
    onError: (error: Error) => handleMutationError(error, 'Failed to update item. Please try again.')
  })

  // Remove order item mutation
  const removeOrderItemMutation = useMutation({
    mutationFn: ({ orderId, itemId }: { orderId: string; itemId: string }) =>
      roleBasedApi(isAdmin, userRole, {
        admin: () => apiClient.removeAdminOrderItem(orderId, itemId),
        server: () => apiClient.removeServerOrderItem(orderId, itemId),
        counter: () => apiClient.removeCounterOrderItem(orderId, itemId),
      }),
    onSuccess: (response) => {
      if (response.data?.status === 'cancelled') {
        setOrderToEdit(null)
        showSuccess('Item removed and order cancelled (no items remaining)')
      } else {
        if (response.data) setOrderToEdit(response.data)
        showSuccess('Item removed successfully!')
      }
    },
    onError: (error: Error) => handleMutationError(error, 'Failed to remove item. Please try again.')
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
          printKOT(result.orderNumber, selectedTable?.table_number, orderData.customer_name, orderData.order_type, cartToKotItems(pendingPrintCart), orderData.notes, false)
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

  // Payment overlay handlers
  const handleOpenPayment = () => {
    if (!canProcessPayment) return
    if (orderType === 'dine_in' && !selectedTable) return

    // Dine-in with existing active bill: open payment directly
    if (orderType === 'dine_in' && activeBill && activeBill.bill?.status !== 'paid') {
      setShowPaymentOverlay(true)
      return
    }

    // Otherwise: create order first, then open payment on success
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
    if (orderType === 'dine_in') {
      setSelectedTable(null)
      navigateTo('tables')
    } else {
      navigateTo('order-type')
    }
    showSuccess('Payment processed successfully!')
  }

  const handleClearTable = async () => {
    if (!selectedTable) return
    try {
      await (isAdmin ? apiClient.clearAdminTable(selectedTable.id) : apiClient.clearCounterTable(selectedTable.id))
      setSelectedTable(null)
      navigateTo('tables')
      showSuccess('Table cleared successfully!')
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to clear table')
      setTimeout(() => setErrorMessage(null), 3000)
    }
  }

  // Handle configurable/combo product: inline grid for variations & combos, dialog for regular options
  const handleConfigureProduct = async (product: Product) => {
    const isCombo = product.product_type === 'combo'
    const isVariation = product.min_variation_price != null

    // Variations & combos → inline step-by-step grid
    if (isVariation || isCombo) {
      setInlineConfig({ product, mode: isCombo ? 'combo' : 'variation', currentStep: 0, totalSteps: 0, selections: {}, comboNestedOptions: {}, isLoading: true })
      try {
        const response = await (isCombo ? apiClient.getComboSlots(product.id) : apiClient.getOptionGroups(product.id))
        const data = Array.isArray(response.data) ? response.data : []
        if (isCombo) {
          setInlineConfig(prev => prev ? { ...prev, comboSlots: data as ComboSlot[], totalSteps: data.length, isLoading: false } : null)
        } else {
          setInlineConfig(prev => prev ? { ...prev, optionGroups: data as ProductOptionGroup[], totalSteps: data.length, isLoading: false } : null)
        }
      } catch {
        setInlineConfig(null)
      }
      return
    }

    // Regular configurable (toppings, extras) → existing dialog
    setConfigProduct(product)
    setIsLoadingOptions(true)
    try {
      const response = await apiClient.getOptionGroups(product.id)
      setConfigOptionGroups(Array.isArray(response.data) ? response.data : [])
    } catch {
      setConfigOptionGroups([])
    } finally {
      setIsLoadingOptions(false)
    }
  }

  // Handle adding configured product to cart
  const handleAddConfiguredProduct = (product: Product, selectedOptions: SelectedOption[], quantity: number) => {
    cart.addToCart(product, selectedOptions, quantity)
    setConfigProduct(null)
    setConfigOptionGroups([])
  }

  // ── Inline config handlers ──────────────────────────────────────────────

  const handleInlineSelect = (stepIndex: number, itemId: string) => {
    if (!inlineConfig) return
    const stepKey = inlineConfig.mode === 'variation'
      ? inlineConfig.optionGroups?.[stepIndex]?.id
      : inlineConfig.comboSlots?.[stepIndex]?.id
    if (!stepKey) return

    const group = inlineConfig.mode === 'variation' ? inlineConfig.optionGroups?.[stepIndex] : null
    const isMulti = group?.selection_type === 'multiple'

    const current = inlineConfig.selections[stepKey] || []
    let updated: string[]

    if (isMulti) {
      updated = current.includes(itemId) ? current.filter(id => id !== itemId) : [...current, itemId]
    } else {
      updated = [itemId]
    }

    const next = { ...inlineConfig, selections: { ...inlineConfig.selections, [stepKey]: updated } }

    // Combo: single screen, no auto-advance — just update selection
    if (inlineConfig.mode === 'combo') {
      setInlineConfig(next)
      return
    }

    // Variation single-select: auto-advance or auto-complete
    if (!isMulti) {
      if (next.currentStep < next.totalSteps - 1) {
        setInlineConfig({ ...next, currentStep: next.currentStep + 1 })
      } else {
        handleInlineComplete(next)
      }
      return
    }

    setInlineConfig(next)
  }

  const handleInlineContinue = () => {
    if (!inlineConfig) return
    if (inlineConfig.currentStep < inlineConfig.totalSteps - 1) {
      setInlineConfig(prev => prev ? { ...prev, currentStep: prev.currentStep + 1 } : null)
    } else {
      handleInlineComplete(inlineConfig)
    }
  }

  const handleInlineBack = () => {
    if (!inlineConfig) return
    // Combo is single-screen — back always exits
    if (inlineConfig.mode === 'combo') {
      setInlineConfig(null)
      return
    }
    if (inlineConfig.currentStep > 0) {
      setInlineConfig(prev => prev ? { ...prev, currentStep: prev.currentStep - 1 } : null)
    } else {
      setInlineConfig(null)
    }
  }

  const handleInlineComplete = (config: InlineConfigState) => {
    if (config.mode === 'variation') {
      // Build SelectedOption[] from variation selections
      const selectedOptions: SelectedOption[] = []
      const groups = config.optionGroups || []
      for (const group of groups) {
        const selectedIds = config.selections[group.id] || []
        for (const itemId of selectedIds) {
          const item = group.items.find((i: { id: string }) => i.id === itemId)
          if (item) {
            selectedOptions.push({
              groupId: group.id,
              groupName: group.name,
              itemId: item.id,
              itemName: item.name,
              priceAdjustment: item.price_adjustment,
            })
          }
        }
      }
      cart.addToCart(config.product, selectedOptions, 1)
    } else {
      // Build SelectedComboChoice[] from combo selections
      const selectedComboChoices: SelectedComboChoice[] = []
      const slots = config.comboSlots || []
      for (const slot of slots) {
        const selectedIds = config.selections[slot.id] || []
        const choiceId = selectedIds[0]
        if (choiceId) {
          const choice = (slot.choices || []).find((c: { id: string }) => c.id === choiceId)
          if (choice?.product) {
            selectedComboChoices.push({
              slotName: slot.name,
              productId: choice.product.id,
              productName: choice.product.name,
              priceAdjustment: choice.price_override ?? 0,
              selectedOptions: config.comboNestedOptions[slot.id] || [],
            })
          }
        }
      }
      cart.addToCart(config.product, [], 1, selectedComboChoices)
    }
    setInlineConfig(null)
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
              {enabledOrderTypes.length > 1 && !isServer && (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => navigateTo('order-type')}
                  className="h-12 w-12 p-0 bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                >
                  <ArrowLeft className="w-6 h-6" />
                </Button>
              )}
              <OrderTypeTitle orderType={orderType} />
              <OrderTypeBadge orderType={orderType} />
              <Button
                variant="outline"
                size="lg"
                onClick={invalidateQueries}
                className="h-12 w-12 p-0 ml-auto bg-zinc-900 border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              >
                <RefreshCw className="w-5 h-5" />
              </Button>
            </div>
          </div>
        )}
        {/* Header - product selection / inline config */}
        {activeTab === 'create' && (
          <div className="p-4 bg-zinc-900 border-b border-zinc-800">
            <div className="flex items-center gap-3 flex-1">
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  if (inlineConfig) {
                    handleInlineBack()
                  } else if (orderType === 'dine_in') {
                    navigateTo('tables')
                  } else if (enabledOrderTypes.length > 1) {
                    navigateTo('order-type')
                    setSelectedTable(null)
                  }
                }}
                className="h-12 w-12 p-0 bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
              >
                <ArrowLeft className="w-6 h-6" />
              </Button>
              <div className="flex items-center gap-3 flex-1">
                {inlineConfig ? (
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-black tracking-tight">{inlineConfig.product.name}</h1>
                    {inlineConfig.mode === 'variation' && (
                      <Badge className="bg-zinc-800 text-zinc-400 border-zinc-700 px-3 py-1 text-sm">
                        Step {inlineConfig.currentStep + 1} of {inlineConfig.totalSteps}
                      </Badge>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <OrderTypeTitle orderType={orderType} tableLabel={orderType === 'dine_in' && selectedTable ? `Table ${selectedTable.table_number}` : undefined} />
                    <OrderTypeBadge orderType={orderType} />
                  </div>
                )}
                {/* Search - hidden during inline config */}
                {!inlineConfig && (
                  <div className="flex items-center gap-2 ml-auto flex-1 justify-end">
                    {settings.touchMode ? (
                      <>
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
                      </>
                    ) : (
                      <>
                        {showSearchKeyboard || searchTerm ? (
                          <div className="flex items-center gap-2 flex-1">
                            <div className="relative flex-1">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                              <input
                                type="text"
                                autoFocus
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Escape') {
                                    setSearchTerm('')
                                    setShowSearchKeyboard(false)
                                  }
                                }}
                                placeholder="Search products..."
                                className="w-full h-12 pl-10 pr-4 rounded-md border-2 border-amber-500 bg-zinc-900 text-lg text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
                              />
                            </div>
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
                          </div>
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
                      </>
                    )}
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={invalidateQueries}
                      className="h-12 w-12 p-0 bg-zinc-900 border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                    >
                      <RefreshCw className="w-5 h-5" />
                    </Button>
                  </div>
                )}
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
                  {([
                    { type: 'dine_in' as OrderType, show: settings.cartSettings?.showDineIn !== false, icon: UtensilsCrossed, label: 'Dine-In', image: 'dine-in.png', hoverBorder: 'hover:border-amber-500', onClick: () => navigateTo('tables', 'dine_in'), extra: activeTablesCount > 0 && (
                      <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur text-sm font-semibold">
                        <TableIcon className="w-3.5 h-3.5" />
                        {activeTablesCount} active {activeTablesCount === 1 ? 'table' : 'tables'}
                      </span>
                    )},
                    { type: 'takeout' as OrderType, show: settings.cartSettings?.showTakeout !== false, icon: Package, label: 'Takeout', image: 'takeout.png', hoverBorder: 'hover:border-orange-500', onClick: () => { setSelectedTable(null); navigateTo('create', 'takeout') } },
                    { type: 'delivery' as OrderType, show: settings.cartSettings?.showDelivery !== false, icon: Car, label: 'Delivery', image: 'delivery.png', hoverBorder: 'hover:border-green-500', onClick: () => { setSelectedTable(null); navigateTo('create', 'delivery') } },
                  ]).filter(c => c.show).map(card => {
                    const Icon = card.icon
                    return (
                      <button key={card.type} onClick={card.onClick} className={`flex-1 relative overflow-hidden rounded-2xl h-80 group cursor-pointer border-4 border-transparent ${card.hoverBorder} active:scale-[0.97] transition-all duration-200 select-none touch-manipulation`}>
                        <span className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110" style={{ backgroundImage: `url(/images/${card.image})` }} />
                        <span className="absolute inset-0 bg-black/50 group-hover:bg-black/40 transition-colors" />
                        <span className="relative z-10 flex flex-col items-center justify-center h-full gap-3 text-white">
                          <Icon className="w-10 h-10" />
                          <span className="text-3xl font-bold">{card.label}</span>
                          {card.extra}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
          {activeTab === 'tables' && (<>
            <div className="px-4 pt-4">
              <AggregatorOrders />
            </div>
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
              onTablePay={(table) => {
                setSelectedTable(table)
                // Trigger payment after activeBill query loads for this table
                setTimeout(() => setShowPaymentOverlay(true), 300)
              }}
              onTableCancel={(table) => {
                const tableOrders = getTableOrders(safeAllOrders, table.id)
                if (tableOrders.length > 0) {
                  setSelectedTable(table)
                  setOrderToCancel(tableOrders[0])
                }
              }}
              onTableClear={(table) => {
                setSelectedTable(table)
                // Small delay so selectedTable is set before handleClearTable reads it
                setTimeout(async () => {
                  try {
                    await (isAdmin ? apiClient.clearAdminTable(table.id) : apiClient.clearCounterTable(table.id))
                    setSelectedTable(null)
                    showSuccess('Table cleared successfully!')
                  } catch (error: any) {
                    setErrorMessage(error.message || 'Failed to clear table')
                    setTimeout(() => setErrorMessage(null), 3000)
                  }
                }, 0)
              }}
              onTableMove={async (sourceTable, targetTable) => {
                try {
                  await (isAdmin
                    ? apiClient.transferAdminTable(sourceTable.id, targetTable.id)
                    : apiClient.transferCounterTable(sourceTable.id, targetTable.id))
                  showSuccess(`Moved table ${sourceTable.table_number} → ${targetTable.table_number}`)
                } catch (error: any) {
                  setErrorMessage(error.message || 'Failed to move table')
                  setTimeout(() => setErrorMessage(null), 3000)
                }
              }}
            />
          </>)}
          {activeTab === 'create' && (
            inlineConfig && !inlineConfig.isLoading ? (
              <VariantSelectionView
                config={inlineConfig}
                formatCurrency={format}
                onSelect={handleInlineSelect}
                onContinue={handleInlineContinue}
                onComplete={() => inlineConfig && handleInlineComplete(inlineConfig)}
              />
            ) : (
              <CreateOrderView
                products={filteredProducts}
                categories={safeCategories}
                cart={cart.cart}
                onAddToCart={cart.addToCart}
                onRemoveFromCart={cart.removeFromCart}
                onRemoveItem={cart.removeItem}
                onConfigureProduct={handleConfigureProduct}
                formatCurrency={format}
              />
            )
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
            taxRate={settings.taxRate || 0}
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
          onUpdateItem={(orderId, itemId, quantity) => updateOrderItemMutation.mutate({ orderId, itemId, quantity })}
          onRemoveItem={(orderId, itemId) => removeOrderItemMutation.mutate({ orderId, itemId })}
          onClose={() => setOrderToEdit(null)}
          formatCurrency={format}
        />
      )}

      {/* Inline Keyboard for Product Search - touch mode only */}
      {settings.touchMode && showSearchKeyboard && (
        <div className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 p-4 animate-in slide-in-from-bottom duration-300 z-50">
          <div className="space-y-2 max-w-4xl mx-auto">
            {QWERTY_LAYOUT.rows.map((row, index) => (
              <KeyboardRow
                key={`search-row-${index}`}
                row={row}
                isShifted={false}
                onKeyPress={(config: KeyConfig) => {
                  if (config.type === 'char' || config.type === 'space') {
                    if (searchTerm.length < 100) setSearchTerm(searchTerm + (config.type === 'space' ? ' ' : config.value || ''))
                  } else if (config.type === 'backspace') setSearchTerm(searchTerm.slice(0, -1))
                  else if (config.type === 'clear') setSearchTerm('')
                  else if (config.type === 'enter') setShowSearchKeyboard(false)
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
