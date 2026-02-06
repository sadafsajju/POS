import { create } from 'zustand';
import type { Product, OrderType, Customer, OrderItemModifier } from '@pos/types';

// Cart item - similar to OrderItem but with tempId instead of id
interface CartItem {
  tempId: string;
  product_id: string;
  product: Product;
  quantity: number;
  unit_price: number;
  special_instructions?: string;
  modifiers?: OrderItemModifier[];
}

interface CartStore {
  items: CartItem[];
  orderType: OrderType;
  tableId: string | null;
  customer: Customer | null;
  notes: string;
  discountPercent: number;
  discountAmount: number;

  // Actions
  addItem: (product: Product, quantity?: number, instructions?: string) => void;
  updateItemQuantity: (tempId: string, quantity: number) => void;
  updateItemInstructions: (tempId: string, instructions: string) => void;
  removeItem: (tempId: string) => void;
  clearCart: () => void;
  setOrderType: (type: OrderType) => void;
  setTable: (tableId: string | null) => void;
  setCustomer: (customer: Customer | null) => void;
  setNotes: (notes: string) => void;
  setDiscount: (percent: number, amount: number) => void;

  // Computed
  getSubtotal: () => number;
  getTax: (taxRate: number) => number;
  getTotal: (taxRate: number) => number;
  getItemCount: () => number;

  // Convert to API format
  toCreateOrderItems: () => Array<{ product_id: string; quantity: number; special_instructions?: string }>;
}

const generateTempId = () => `temp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  orderType: 'dine_in',
  tableId: null,
  customer: null,
  notes: '',
  discountPercent: 0,
  discountAmount: 0,

  addItem: (product, quantity = 1, instructions = '') => {
    set((state) => {
      // Check if product already exists in cart (without special instructions)
      const existingIndex = state.items.findIndex(
        (item) => item.product_id === product.id && !item.special_instructions && !instructions
      );

      if (existingIndex >= 0) {
        // Update quantity
        const newItems = [...state.items];
        newItems[existingIndex] = {
          ...newItems[existingIndex],
          quantity: newItems[existingIndex].quantity + quantity,
        };
        return { items: newItems };
      }

      // Add new item
      const newItem: CartItem = {
        tempId: generateTempId(),
        product_id: product.id,
        product,
        quantity,
        unit_price: product.price,
        special_instructions: instructions || undefined,
        modifiers: [],
      };

      return { items: [...state.items, newItem] };
    });
  },

  updateItemQuantity: (tempId, quantity) => {
    set((state) => {
      if (quantity <= 0) {
        return { items: state.items.filter((item) => item.tempId !== tempId) };
      }

      return {
        items: state.items.map((item) =>
          item.tempId === tempId ? { ...item, quantity } : item
        ),
      };
    });
  },

  updateItemInstructions: (tempId, instructions) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.tempId === tempId ? { ...item, special_instructions: instructions || undefined } : item
      ),
    }));
  },

  removeItem: (tempId) => {
    set((state) => ({
      items: state.items.filter((item) => item.tempId !== tempId),
    }));
  },

  clearCart: () => {
    set({
      items: [],
      tableId: null,
      customer: null,
      notes: '',
      discountPercent: 0,
      discountAmount: 0,
    });
  },

  setOrderType: (orderType) => {
    set({ orderType });
  },

  setTable: (tableId) => {
    set({ tableId });
  },

  setCustomer: (customer) => {
    set({ customer });
  },

  setNotes: (notes) => {
    set({ notes });
  },

  setDiscount: (discountPercent, discountAmount) => {
    set({ discountPercent, discountAmount });
  },

  getSubtotal: () => {
    const { items } = get();
    return items.reduce((sum, item) => {
      const modifiersTotal = item.modifiers?.reduce((m, mod) => m + mod.price, 0) || 0;
      return sum + (item.unit_price + modifiersTotal) * item.quantity;
    }, 0);
  },

  getTax: (taxRate) => {
    const subtotal = get().getSubtotal();
    const { discountAmount } = get();
    return (subtotal - discountAmount) * (taxRate / 100);
  },

  getTotal: (taxRate) => {
    const subtotal = get().getSubtotal();
    const { discountAmount } = get();
    const tax = get().getTax(taxRate);
    return subtotal - discountAmount + tax;
  },

  getItemCount: () => {
    return get().items.reduce((sum, item) => sum + item.quantity, 0);
  },

  toCreateOrderItems: () => {
    return get().items.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
      special_instructions: item.special_instructions,
    }));
  },
}));

// Export the CartItem type for use in components
export type { CartItem };
