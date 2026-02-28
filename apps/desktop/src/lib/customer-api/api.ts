import axios, { AxiosInstance } from 'axios';
import type {
  CustomerSessionResponse,
  CreateCustomerSessionRequest,
  CustomerOrderRequest,
  ApiResponse,
  Product,
  Order,
} from '@pos/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

class CustomerAPI {
  private client: AxiosInstance;
  private sessionToken: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Load session token from localStorage
    this.sessionToken = localStorage.getItem('session_token');

    // Add session token to requests
    this.client.interceptors.request.use((config) => {
      if (this.sessionToken) {
        config.headers['X-Session-Token'] = this.sessionToken;
      }
      return config;
    });

    // Handle session expiration
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Session expired
          this.clearSession();
          window.location.href = '/expired';
        }
        return Promise.reject(error);
      }
    );
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

  // Initialize session from QR code
  async initSession(
    request: CreateCustomerSessionRequest
  ): Promise<CustomerSessionResponse> {
    const response = await this.client.post<ApiResponse<CustomerSessionResponse>>(
      '/customer/session',
      request
    );

    if (response.data.success && response.data.data) {
      const sessionData = response.data.data;
      this.setSessionToken(sessionData.session.session_token);
      localStorage.setItem('session_data', JSON.stringify(sessionData));
      return sessionData;
    }

    throw new Error(response.data.message || 'Failed to initialize session');
  }

  // Get menu
  async getMenu(): Promise<Product[]> {
    const response = await this.client.get<ApiResponse<Product[]>>(
      '/customer/menu'
    );

    if (response.data.success && response.data.data) {
      return response.data.data;
    }

    throw new Error(response.data.message || 'Failed to fetch menu');
  }

  // Place order
  async placeOrder(request: CustomerOrderRequest): Promise<Order> {
    const response = await this.client.post<ApiResponse<Order>>(
      '/customer/order',
      request
    );

    if (response.data.success && response.data.data) {
      return response.data.data;
    }

    throw new Error(response.data.message || 'Failed to place order');
  }

  // Get customer's orders
  async getMyOrders(): Promise<Order[]> {
    const response = await this.client.get<ApiResponse<Order[]>>(
      '/customer/orders'
    );

    if (response.data.success && response.data.data) {
      return response.data.data;
    }

    throw new Error(response.data.message || 'Failed to fetch orders');
  }

  // Check if session is active
  hasActiveSession(): boolean {
    return this.sessionToken !== null;
  }

  // Get stored session data
  getSessionData(): CustomerSessionResponse | null {
    const stored = localStorage.getItem('session_data');
    return stored ? JSON.parse(stored) : null;
  }
}

export const customerAPI = new CustomerAPI();
