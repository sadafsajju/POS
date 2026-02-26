import { create } from 'zustand'
import type { Product, Order } from '@/types'

// Reuse selection types from counter
export interface SelectedOption {
  groupId: string
  groupName: string
  itemId: string
  itemName: string
  priceAdjustment: number
}

export interface SelectedComboChoice {
  slotName: string
  productId: string
  productName: string
  priceAdjustment: number
  selectedOptions: SelectedOption[]
}

export interface KioskCartItem {
  id: string // unique cart line ID
  product: Product
  quantity: number
  special_instructions?: string
  selectedOptions?: SelectedOption[]
  selectedComboChoices?: SelectedComboChoice[]
}

export type KioskStep = 'welcome' | 'order-type' | 'menu' | 'cart' | 'payment' | 'confirmation'
export type KioskOrderType = 'dine_in' | 'takeout'

interface KioskState {
  step: KioskStep
  orderType: KioskOrderType | null
  cart: KioskCartItem[]
  createdOrder: Order | null
  lastInteraction: number

  // Actions
  setStep: (step: KioskStep) => void
  setOrderType: (type: KioskOrderType) => void
  addToCart: (product: Product, quantity: number, selectedOptions?: SelectedOption[], selectedComboChoices?: SelectedComboChoice[]) => void
  removeFromCart: (cartItemId: string) => void
  updateQuantity: (cartItemId: string, quantity: number) => void
  updateSpecialInstructions: (cartItemId: string, instructions: string) => void
  clearCart: () => void
  setCreatedOrder: (order: Order) => void
  resetSession: () => void
  touchInteraction: () => void

  // Computed helpers
  getItemCount: () => number
  getSubtotal: () => number
  getItemPrice: (item: KioskCartItem) => number
}

let nextId = 0
const generateId = () => `kiosk-item-${++nextId}-${Date.now()}`

export const useKioskStore = create<KioskState>((set, get) => ({
  step: 'welcome',
  orderType: null,
  cart: [],
  createdOrder: null,
  lastInteraction: Date.now(),

  setStep: (step) => set({ step }),

  setOrderType: (type) => set({ orderType: type }),

  addToCart: (product, quantity, selectedOptions, selectedComboChoices) => {
    const isConfigurable = (selectedOptions && selectedOptions.length > 0) || (selectedComboChoices && selectedComboChoices.length > 0)

    set((state) => {
      // For simple products, merge if same product already in cart
      if (!isConfigurable) {
        const existing = state.cart.find(
          (item) => item.product.id === product.id && !item.selectedOptions?.length && !item.selectedComboChoices?.length
        )
        if (existing) {
          return {
            cart: state.cart.map((item) =>
              item.id === existing.id ? { ...item, quantity: item.quantity + quantity } : item
            ),
            lastInteraction: Date.now(),
          }
        }
      }

      const newItem: KioskCartItem = {
        id: generateId(),
        product,
        quantity,
        selectedOptions,
        selectedComboChoices,
      }

      return { cart: [...state.cart, newItem], lastInteraction: Date.now() }
    })
  },

  removeFromCart: (cartItemId) =>
    set((state) => ({
      cart: state.cart.filter((item) => item.id !== cartItemId),
      lastInteraction: Date.now(),
    })),

  updateQuantity: (cartItemId, quantity) =>
    set((state) => ({
      cart: quantity <= 0
        ? state.cart.filter((item) => item.id !== cartItemId)
        : state.cart.map((item) => (item.id === cartItemId ? { ...item, quantity } : item)),
      lastInteraction: Date.now(),
    })),

  updateSpecialInstructions: (cartItemId, instructions) =>
    set((state) => ({
      cart: state.cart.map((item) =>
        item.id === cartItemId ? { ...item, special_instructions: instructions } : item
      ),
      lastInteraction: Date.now(),
    })),

  clearCart: () => set({ cart: [], lastInteraction: Date.now() }),

  setCreatedOrder: (order) => set({ createdOrder: order }),

  resetSession: () =>
    set({
      step: 'welcome',
      orderType: null,
      cart: [],
      createdOrder: null,
      lastInteraction: Date.now(),
    }),

  touchInteraction: () => set({ lastInteraction: Date.now() }),

  getItemCount: () => get().cart.reduce((sum, item) => sum + item.quantity, 0),

  getSubtotal: () => {
    const { cart } = get()
    return cart.reduce((sum, item) => sum + get().getItemPrice(item) * item.quantity, 0)
  },

  getItemPrice: (item) => {
    let price = item.product.price
    if (item.selectedOptions) {
      for (const opt of item.selectedOptions) {
        price += opt.priceAdjustment
      }
    }
    if (item.selectedComboChoices) {
      for (const choice of item.selectedComboChoices) {
        price += choice.priceAdjustment
        for (const opt of choice.selectedOptions) {
          price += opt.priceAdjustment
        }
      }
    }
    return price
  },
}))
