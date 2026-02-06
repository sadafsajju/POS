// Counter-specific types and interfaces
// Re-export commonly used types for convenience
export type { Product, Category, DiningTable, Order, OrderItem, BillSummary, ProductOptionGroup, ProductOptionItem, ComboSlot, ComboSlotChoice } from '@/types'

// Selected option for cart items (configurable products)
export interface SelectedOption {
  groupId: string
  groupName: string
  itemId: string
  itemName: string
  priceAdjustment: number
}

// Selected combo choice for cart items (combo products)
export interface SelectedComboChoice {
  slotName: string
  productId: string
  productName: string
  priceAdjustment: number
  selectedOptions: SelectedOption[]  // nested options for configurable sub-items
}

// Cart item in the order creation flow
export interface CartItem {
  cartItemId?: string  // Unique ID for configurable/combo product lines
  product: {
    id: string
    name: string
    price: number
    description?: string
    preparation_time?: number
    is_available?: boolean
    product_type?: string
  }
  quantity: number
  special_instructions?: string
  selectedOptions?: SelectedOption[]
  selectedComboChoices?: SelectedComboChoice[]
}

// Payment request to the API
export interface ProcessPaymentRequest {
  payment_method: 'cash' | 'credit_card' | 'debit_card' | 'digital_wallet'
  amount: number
  reference_number?: string
  customer_id?: string
  customer_name?: string
}

// Kitchen Order Ticket item
export interface KOTItem {
  name: string
  quantity: number
  special_instructions?: string
}

// Payment amounts for split payment support
export interface PaymentAmounts {
  cash: string
  card: string
  digital: string
}

// Payment method types for split payments
export type PaymentMethodType = 'cash' | 'card' | 'digital'

// Active tab in the counter interface (deprecated - use WizardStep)
export type ActiveTab = 'tables' | 'create' | 'payment'

// Wizard step for the counter flow
export type WizardStep = 'order-setup' | 'products' | 'complete'

// Order type for new orders
export type OrderType = 'dine_in' | 'takeout' | 'delivery'

// Consolidated item for display (groups duplicate products)
export interface ConsolidatedItem {
  quantity: number
  name: string
  product_id: string
}

// Payment details after successful payment
export interface PaidPaymentDetails {
  cash: number
  card: number
  digital: number
}

// Create order request structure
export interface CreateOrderRequest {
  table_id?: string
  customer_name?: string
  order_type: OrderType
  items: Array<{
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
  }>
  notes?: string
  // KOT support fields (for dine-in orders)
  parent_order_id?: string  // For subsequent KOTs: link to existing bill
  create_as_kot?: boolean   // If true for dine_in, creates bill + KOT structure
}

// Order item from API response
export interface OrderItemResponse {
  product_id?: string
  product?: {
    id?: string
    name?: string
  }
  quantity: number
  unit_price?: number
  special_instructions?: string
}
