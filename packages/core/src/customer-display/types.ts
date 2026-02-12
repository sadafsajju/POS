// Types for customer-facing display communication via BroadcastChannel

export interface DisplayCartItem {
  name: string
  quantity: number
  unitPrice: number
  /** Total for this line: unitPrice * quantity */
  lineTotal: number
}

export type CustomerDisplayMessage =
  | { type: 'idle' }
  | { type: 'cart-update'; items: DisplayCartItem[]; subtotal: number; tax: number; total: number }
  | { type: 'payment-start'; total: number; method?: string }
  | { type: 'payment-complete'; total: number; changeAmount?: number }

export type CustomerDisplayMode = 'idle' | 'cart' | 'payment-processing' | 'payment-complete'

export interface CustomerDisplayState {
  mode: CustomerDisplayMode
  items: DisplayCartItem[]
  subtotal: number
  tax: number
  total: number
  paymentMethod?: string
  changeAmount?: number
}

export const CUSTOMER_DISPLAY_CHANNEL = 'pos-customer-display'
