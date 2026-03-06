import { productsDb, ordersDb } from '@pos/supabase';
import type {
  Product,
  Order,
} from '@pos/types';

class CustomerAPI {
  private sessionToken: string | null = null;

  constructor() {
    this.sessionToken = localStorage.getItem('session_token');
  }

  setSessionToken(token: string) {
    this.sessionToken = token;
    localStorage.setItem('session_token', token);
  }

  clearSession() {
    this.sessionToken = null;
    localStorage.removeItem('session_token');
    localStorage.removeItem('session_data');
  }

  // Get menu — public read via Supabase
  async getMenu(): Promise<Product[]> {
    const response = await productsDb.getProducts({ available_only: true } as any);
    if (response.success && Array.isArray(response.data)) {
      return response.data as Product[];
    }
    throw new Error(response.message || 'Failed to fetch menu');
  }

  // Place order via Supabase RPC
  async placeOrder(request: {
    table_id?: string;
    order_type: string;
    items: any[];
    customer_name?: string;
    notes?: string;
  }): Promise<Order> {
    const response = await ordersDb.createOrder(request as any);
    if (response.success && response.data) {
      return response.data as unknown as Order;
    }
    throw new Error(response.message || 'Failed to place order');
  }

  // Get customer's orders
  async getMyOrders(): Promise<Order[]> {
    const response = await ordersDb.getOrders({});
    if (response.success && Array.isArray(response.data)) {
      return response.data as Order[];
    }
    throw new Error(response.message || 'Failed to fetch orders');
  }

  hasActiveSession(): boolean {
    return this.sessionToken !== null;
  }

  getSessionData(): any | null {
    const stored = localStorage.getItem('session_data');
    return stored ? JSON.parse(stored) : null;
  }
}

export const customerAPI = new CustomerAPI();
