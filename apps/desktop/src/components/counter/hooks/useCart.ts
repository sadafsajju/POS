import { useState, useCallback, useMemo } from 'react'
import type { CartItem, OrderType, SelectedOption, SelectedComboChoice } from '../types'

// Minimal product interface for adding to cart
interface AddableProduct {
  id: string
  name: string
  price: number
  description?: string
  preparation_time?: number
  is_available?: boolean
  product_type?: string
}

export interface UseCartReturn {
  cart: CartItem[]
  addToCart: (product: AddableProduct, selectedOptions?: SelectedOption[], quantity?: number, selectedComboChoices?: SelectedComboChoice[]) => void
  removeFromCart: (productId: string, cartItemId?: string) => void
  updateQuantity: (productId: string, quantity: number, cartItemId?: string) => void
  updateSpecialInstructions: (productId: string, instructions: string, cartItemId?: string) => void
  clearCart: () => void
  clearAllCarts: () => void
  getTotalAmount: () => number
  getItemCount: () => number
  getCartItem: (productId: string) => CartItem | undefined
  toOrderItems: () => Array<{
    product_id: string
    quantity: number
    special_instructions?: string
    selected_options?: Array<{
      option_group_name: string
      option_item_name: string
      price_adjustment: number
    }>
  }>
  setContext: (tableId: string | null, orderType: OrderType) => void
  getCartKey: () => string
  hasItemsInCart: (tableId: string | null, orderType: OrderType) => boolean
}

// Generate a unique key for each cart context (table or order type)
function getCartKeyForContext(tableId: string | null, orderType: OrderType): string {
  if (orderType === 'dine_in' && tableId) {
    return `table_${tableId}`
  }
  return orderType // 'takeout' or 'delivery'
}

// Helper to find a cart item by cartItemId or productId
function findItem(cart: CartItem[], productId: string, cartItemId?: string): CartItem | undefined {
  if (cartItemId) {
    return cart.find(item => item.cartItemId === cartItemId)
  }
  // For simple products, find by product ID (only items without cartItemId)
  return cart.find(item => item.product.id === productId && !item.cartItemId)
}

// Helper to match a cart item for update operations
function matchItem(item: CartItem, productId: string, cartItemId?: string): boolean {
  if (cartItemId) {
    return item.cartItemId === cartItemId
  }
  return item.product.id === productId && !item.cartItemId
}

/**
 * Calculate unit price for a cart item (base price + option adjustments)
 */
function getItemUnitPrice(item: CartItem): number {
  const optionsAdjustment = (item.selectedOptions || []).reduce(
    (sum, opt) => sum + opt.priceAdjustment, 0
  )
  const comboAdjustment = (item.selectedComboChoices || []).reduce(
    (sum, choice) => sum + choice.priceAdjustment, 0
  )
  return item.product.price + optionsAdjustment + comboAdjustment
}

/**
 * Hook for managing shopping cart state and operations
 * Supports per-table cart persistence for dine-in orders
 * Supports configurable products with option selections
 */
export function useCart(): UseCartReturn {
  // Store all carts keyed by table ID or order type
  const [allCarts, setAllCarts] = useState<Record<string, CartItem[]>>({})
  // Current context
  const [currentTableId, setCurrentTableId] = useState<string | null>(null)
  const [currentOrderType, setCurrentOrderType] = useState<OrderType>('dine_in')

  // Get the current cart key
  const cartKey = useMemo(() =>
    getCartKeyForContext(currentTableId, currentOrderType),
    [currentTableId, currentOrderType]
  )

  // Get the current cart
  const cart = useMemo(() => allCarts[cartKey] || [], [allCarts, cartKey])

  // Set the current context (table and order type)
  const setContext = useCallback((tableId: string | null, orderType: OrderType) => {
    setCurrentTableId(tableId)
    setCurrentOrderType(orderType)
  }, [])

  // Check if a specific context has items in its cart
  const hasItemsInCart = useCallback((tableId: string | null, orderType: OrderType): boolean => {
    const key = getCartKeyForContext(tableId, orderType)
    return (allCarts[key]?.length || 0) > 0
  }, [allCarts])

  // Get the current cart key (for external use)
  const getCartKey = useCallback(() => cartKey, [cartKey])

  const addToCart = useCallback((product: AddableProduct, selectedOptions?: SelectedOption[], quantity?: number, selectedComboChoices?: SelectedComboChoice[]) => {
    setAllCarts(prevCarts => {
      const currentCart = prevCarts[cartKey] || []

      // Configurable/combo products with options or combo choices always get a new cart line
      const hasOptions = selectedOptions && selectedOptions.length > 0
      const hasComboChoices = selectedComboChoices && selectedComboChoices.length > 0

      if (hasOptions || hasComboChoices) {
        const newItem: CartItem = {
          cartItemId: crypto.randomUUID(),
          product: {
            id: product.id,
            name: product.name,
            price: product.price,
            description: product.description,
            preparation_time: product.preparation_time,
            is_available: product.is_available,
            product_type: product.product_type,
          },
          quantity: quantity || 1,
          selectedOptions: hasOptions ? selectedOptions : undefined,
          selectedComboChoices: hasComboChoices ? selectedComboChoices : undefined,
        }
        return { ...prevCarts, [cartKey]: [...currentCart, newItem] }
      }

      // Simple products: merge by product ID (existing behavior)
      const existingItem = currentCart.find(item => item.product.id === product.id && !item.cartItemId)

      let newCart: CartItem[]
      if (existingItem) {
        newCart = currentCart.map(item =>
          item.product.id === product.id && !item.cartItemId
            ? { ...item, quantity: item.quantity + (quantity || 1) }
            : item
        )
      } else {
        newCart = [...currentCart, {
          product: {
            id: product.id,
            name: product.name,
            price: product.price,
            description: product.description,
            preparation_time: product.preparation_time,
            is_available: product.is_available,
            product_type: product.product_type,
          },
          quantity: quantity || 1
        }]
      }

      return { ...prevCarts, [cartKey]: newCart }
    })
  }, [cartKey])

  const removeFromCart = useCallback((productId: string, cartItemId?: string) => {
    setAllCarts(prevCarts => {
      const currentCart = prevCarts[cartKey] || []
      const existingItem = findItem(currentCart, productId, cartItemId)

      let newCart: CartItem[]
      if (existingItem && existingItem.quantity > 1) {
        newCart = currentCart.map(item =>
          matchItem(item, productId, cartItemId)
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
      } else {
        newCart = currentCart.filter(item => !matchItem(item, productId, cartItemId))
      }

      return { ...prevCarts, [cartKey]: newCart }
    })
  }, [cartKey])

  const updateQuantity = useCallback((productId: string, quantity: number, cartItemId?: string) => {
    setAllCarts(prevCarts => {
      const currentCart = prevCarts[cartKey] || []

      let newCart: CartItem[]
      if (quantity <= 0) {
        newCart = currentCart.filter(item => !matchItem(item, productId, cartItemId))
      } else {
        newCart = currentCart.map(item =>
          matchItem(item, productId, cartItemId)
            ? { ...item, quantity }
            : item
        )
      }

      return { ...prevCarts, [cartKey]: newCart }
    })
  }, [cartKey])

  const updateSpecialInstructions = useCallback((productId: string, instructions: string, cartItemId?: string) => {
    setAllCarts(prevCarts => {
      const currentCart = prevCarts[cartKey] || []
      const newCart = currentCart.map(item =>
        matchItem(item, productId, cartItemId)
          ? { ...item, special_instructions: instructions || undefined }
          : item
      )
      return { ...prevCarts, [cartKey]: newCart }
    })
  }, [cartKey])

  const clearCart = useCallback(() => {
    setAllCarts(prevCarts => {
      const newCarts = { ...prevCarts }
      delete newCarts[cartKey]
      return newCarts
    })
  }, [cartKey])

  const clearAllCarts = useCallback(() => {
    setAllCarts({})
  }, [])

  const getTotalAmount = useCallback(() => {
    return cart.reduce((total, item) => total + getItemUnitPrice(item) * item.quantity, 0)
  }, [cart])

  const getItemCount = useCallback(() => {
    return cart.reduce((count, item) => count + item.quantity, 0)
  }, [cart])

  const getCartItem = useCallback((productId: string) => {
    return cart.find(item => item.product.id === productId && !item.cartItemId)
  }, [cart])

  const toOrderItems = useCallback(() => {
    return cart.map(item => {
      const orderItem: {
        product_id: string
        quantity: number
        special_instructions?: string
        selected_options?: Array<{
          option_group_name: string
          option_item_name: string
          price_adjustment: number
        }>
        combo_choices?: Array<{
          slot_name: string
          product_id: string
          product_name: string
          price_adjustment: number
          selected_options: Array<{
            option_group_name: string
            option_item_name: string
            price_adjustment: number
          }>
        }>
      } = {
        product_id: item.product.id,
        quantity: item.quantity,
        special_instructions: item.special_instructions,
      }

      if (item.selectedOptions && item.selectedOptions.length > 0) {
        orderItem.selected_options = item.selectedOptions.map(opt => ({
          option_group_name: opt.groupName,
          option_item_name: opt.itemName,
          price_adjustment: opt.priceAdjustment,
        }))
      }

      if (item.selectedComboChoices && item.selectedComboChoices.length > 0) {
        orderItem.combo_choices = item.selectedComboChoices.map(choice => ({
          slot_name: choice.slotName,
          product_id: choice.productId,
          product_name: choice.productName,
          price_adjustment: choice.priceAdjustment,
          selected_options: (choice.selectedOptions || []).map(opt => ({
            option_group_name: opt.groupName,
            option_item_name: opt.itemName,
            price_adjustment: opt.priceAdjustment,
          })),
        }))
      }

      return orderItem
    })
  }, [cart])

  return {
    cart,
    addToCart,
    removeFromCart,
    updateQuantity,
    updateSpecialInstructions,
    clearCart,
    clearAllCarts,
    getTotalAmount,
    getItemCount,
    getCartItem,
    toOrderItems,
    setContext,
    getCartKey,
    hasItemsInCart
  }
}
