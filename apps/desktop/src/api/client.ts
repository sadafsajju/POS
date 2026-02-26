import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import type {
  APIResponse,
  PaginatedResponse,
  LoginRequest,
  LoginResponse,
  User,
  Location,
  Product,
  Category,
  DiningTable,
  Order,
  OrderItem,
  Payment,
  CreateOrderRequest,
  UpdateOrderStatusRequest,
  ProcessPaymentRequest,
  PaymentSummary,
  BillSummary,
  DashboardStats,
  SalesReportItem,
  OrdersReportItem,
  KitchenOrder,
  TableStatus,
  OrderFilters,
  ProductFilters,
  TableFilters,
  ProductOptionGroup,
  ProductOptionItem,
  CreateOptionGroupRequest,
  CreateOptionItemRequest,
  CreateVariationGroupRequest,
  CreateVariationItemRequest,
  LinkVariationGroupWithPrices,
  ProductVariationLinkResponse,
  ComboSlot,
  CreateComboSlotRequest,
  CreateComboSlotChoiceRequest,
} from '@/types';

class APIClient {
  private client: AxiosInstance;

  constructor() {
    const apiUrl = import.meta.env?.VITE_API_URL || 'http://localhost:8080/api/v1';
    console.log('🔧 API Client baseURL:', apiUrl);
    console.log('🔧 Environment VITE_API_URL:', import.meta.env?.VITE_API_URL);
    
    this.client = axios.create({
      baseURL: apiUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        // Get token from zustand persist store
        let token = null;
        try {
          const storedAuth = localStorage.getItem('pos-auth');
          if (storedAuth) {
            const parsed = JSON.parse(storedAuth);
            token = parsed.state?.token;
          }
        } catch (e) {
          console.error('Failed to parse auth store:', e);
        }

        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle auth errors
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Clear the zustand persist store
          localStorage.removeItem('pos-auth');
          // Only redirect if not already on login page to avoid loop
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Helper method to handle API responses
  private async request<T>(config: AxiosRequestConfig): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.client.request(config);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.message || error.message);
      }
      throw error;
    }
  }

  // Authentication endpoints
  async login(credentials: LoginRequest): Promise<APIResponse<LoginResponse>> {
    return this.request({
      method: 'POST',
      url: '/auth/login',
      data: credentials,
    });
  }

  async logout(): Promise<APIResponse> {
    return this.request({
      method: 'POST',
      url: '/auth/logout',
    });
  }

  async getCurrentUser(): Promise<APIResponse<User>> {
    return this.request({
      method: 'GET',
      url: '/auth/me',
    });
  }

  async switchLocation(locationId: string): Promise<APIResponse<{ token: string; location: Location }>> {
    return this.request({
      method: 'POST',
      url: '/auth/switch-location',
      data: { location_id: locationId },
    });
  }

  // Product endpoints
  async getProducts(filters?: ProductFilters): Promise<PaginatedResponse<Product[]>> {
    return this.request({
      method: 'GET',
      url: '/products',
      params: filters,
    });
  }

  async getProduct(id: string): Promise<APIResponse<Product>> {
    return this.request({
      method: 'GET',
      url: `/products/${id}`,
    });
  }

  async getCategories(activeOnly = true): Promise<APIResponse<Category[]>> {
    return this.request({
      method: 'GET',
      url: '/categories',
      params: { active_only: activeOnly },
    });
  }

  async getProductsByCategory(categoryId: string, availableOnly = true): Promise<APIResponse<Product[]>> {
    return this.request({
      method: 'GET',
      url: `/categories/${categoryId}/products`,
      params: { available_only: availableOnly },
    });
  }

  // Table endpoints
  async getTables(filters?: TableFilters): Promise<APIResponse<DiningTable[]>> {
    return this.request({
      method: 'GET',
      url: '/tables',
      params: filters,
    });
  }

  async getTable(id: string): Promise<APIResponse<DiningTable>> {
    return this.request({
      method: 'GET',
      url: `/tables/${id}`,
    });
  }

  async getTablesByLocation(): Promise<APIResponse<any[]>> {
    return this.request({
      method: 'GET',
      url: '/tables/by-location',
    });
  }

  async getTableStatus(): Promise<APIResponse<TableStatus>> {
    return this.request({
      method: 'GET',
      url: '/tables/status',
    });
  }

  // Order endpoints
  async getOrders(filters?: OrderFilters): Promise<PaginatedResponse<Order[]>> {
    return this.request({
      method: 'GET',
      url: '/orders',
      params: filters,
    });
  }

  async createOrder(order: CreateOrderRequest): Promise<APIResponse<Order>> {
    return this.request({
      method: 'POST',
      url: '/orders',
      data: order,
    });
  }

  async getOrder(id: string): Promise<APIResponse<Order>> {
    return this.request({
      method: 'GET',
      url: `/orders/${id}`,
    });
  }

  async updateOrderStatus(id: string, status: OrderStatus, notes?: string): Promise<APIResponse<Order>> {
    const statusUpdate: UpdateOrderStatusRequest = { status, notes };
    return this.request({
      method: 'PATCH',
      url: `/orders/${id}/status`,
      data: statusUpdate,
    });
  }

  // Payment endpoints
  async processPayment(orderId: string, payment: ProcessPaymentRequest): Promise<APIResponse<Payment>> {
    return this.request({
      method: 'POST',
      url: `/orders/${orderId}/payments`,
      data: payment,
    });
  }

  async getPayments(orderId: string): Promise<APIResponse<Payment[]>> {
    return this.request({
      method: 'GET',
      url: `/orders/${orderId}/payments`,
    });
  }

  async getPaymentSummary(orderId: string): Promise<APIResponse<PaymentSummary>> {
    return this.request({
      method: 'GET',
      url: `/orders/${orderId}/payment-summary`,
    });
  }

  // Bill Summary endpoints (KOT support)
  async getBillSummary(billId: string): Promise<APIResponse<BillSummary>> {
    return this.request({
      method: 'GET',
      url: `/orders/${billId}/bill-summary`,
    });
  }

  async getActiveBillForTable(tableId: string): Promise<APIResponse<BillSummary | null>> {
    return this.request({
      method: 'GET',
      url: `/tables/${tableId}/active-bill`,
    });
  }

  // Dashboard endpoints
  async getDashboardStats(): Promise<APIResponse<DashboardStats>> {
    return this.request({
      method: 'GET',
      url: '/admin/dashboard/stats',
    });
  }

  async getSalesReport(period: 'today' | 'week' | 'month' = 'today'): Promise<APIResponse<SalesReportItem[]>> {
    return this.request({
      method: 'GET',
      url: '/admin/reports/sales',
      params: { period },
    });
  }

  async getOrdersReport(): Promise<APIResponse<OrdersReportItem[]>> {
    return this.request({
      method: 'GET',
      url: '/admin/reports/orders',
    });
  }

  async getIncomeReport(period: 'today' | 'week' | 'month' | 'year' = 'today'): Promise<APIResponse<any>> {
    return this.request({
      method: 'GET',
      url: '/admin/reports/income',
      params: { period },
    });
  }

  // Kitchen endpoints
  async getKitchenOrders(status?: string): Promise<APIResponse<Order[]>> {
    return this.request({
      method: 'GET',
      url: '/kitchen/orders',
      params: status && status !== 'all' ? { status } : {},
    });
  }

  async updateOrderItemStatus(orderId: string, itemId: string, status: string): Promise<APIResponse> {
    return this.request({
      method: 'PATCH',
      url: `/kitchen/orders/${orderId}/items/${itemId}/status`,
      data: { status },
    });
  }

  // Role-specific order creation
  async createServerOrder(order: CreateOrderRequest): Promise<APIResponse<Order>> {
    return this.request({
      method: 'POST',
      url: '/server/orders',
      data: order,
    });
  }

  async createCounterOrder(order: CreateOrderRequest): Promise<APIResponse<Order>> {
    return this.request({
      method: 'POST',
      url: '/counter/orders',
      data: order,
    });
  }

  // Add items to existing order (server role)
  async addItemsToServerOrder(orderId: string, items: Array<{ product_id: string; quantity: number; special_instructions?: string; selected_options?: Array<{ option_group_name: string; option_item_name: string; price_adjustment: number }> }>): Promise<APIResponse<Order>> {
    return this.request({
      method: 'POST',
      url: `/server/orders/${orderId}/items`,
      data: { items },
    });
  }

  // Counter payment processing
  async processCounterPayment(orderId: string, payment: ProcessPaymentRequest): Promise<APIResponse<Payment>> {
    return this.request({
      method: 'POST',
      url: `/counter/orders/${orderId}/payments`,
      data: payment,
    });
  }

  // Clear table (counter role) - marks all orders completed and frees table
  async clearCounterTable(tableId: string): Promise<APIResponse<void>> {
    return this.request({
      method: 'POST',
      url: `/counter/tables/${tableId}/clear`,
    });
  }

  // Clear table (admin role) - marks all orders completed and frees table
  async clearAdminTable(tableId: string): Promise<APIResponse<void>> {
    return this.request({
      method: 'POST',
      url: `/admin/tables/${tableId}/clear`,
    });
  }

  // Transfer table (counter role) - move orders from one table to another
  async transferCounterTable(sourceTableId: string, targetTableId: string): Promise<APIResponse<void>> {
    return this.request({
      method: 'POST',
      url: `/counter/tables/${sourceTableId}/transfer`,
      data: { target_table_id: targetTableId },
    });
  }

  // Transfer table (admin role) - move orders from one table to another
  async transferAdminTable(sourceTableId: string, targetTableId: string): Promise<APIResponse<void>> {
    return this.request({
      method: 'POST',
      url: `/admin/tables/${sourceTableId}/transfer`,
      data: { target_table_id: targetTableId },
    });
  }

  // Add items to existing order (counter role)
  async addItemsToCounterOrder(orderId: string, items: Array<{ product_id: string; quantity: number; special_instructions?: string; selected_options?: Array<{ option_group_name: string; option_item_name: string; price_adjustment: number }> }>): Promise<APIResponse<Order>> {
    return this.request({
      method: 'POST',
      url: `/counter/orders/${orderId}/items`,
      data: { items },
    });
  }

  // Add items to existing order (admin role)
  async addItemsToAdminOrder(orderId: string, items: Array<{ product_id: string; quantity: number; special_instructions?: string; selected_options?: Array<{ option_group_name: string; option_item_name: string; price_adjustment: number }> }>): Promise<APIResponse<Order>> {
    return this.request({
      method: 'POST',
      url: `/admin/orders/${orderId}/items`,
      data: { items },
    });
  }

  // Update order item (server role)
  async updateServerOrderItem(orderId: string, itemId: string, data: { quantity?: number; special_instructions?: string }): Promise<APIResponse<Order>> {
    return this.request({
      method: 'PUT',
      url: `/server/orders/${orderId}/items/${itemId}`,
      data,
    });
  }

  // Remove order item (server role)
  async removeServerOrderItem(orderId: string, itemId: string): Promise<APIResponse<Order>> {
    return this.request({
      method: 'DELETE',
      url: `/server/orders/${orderId}/items/${itemId}`,
    });
  }

  // Update order item (counter role)
  async updateCounterOrderItem(orderId: string, itemId: string, data: { quantity?: number; special_instructions?: string }): Promise<APIResponse<Order>> {
    return this.request({
      method: 'PUT',
      url: `/counter/orders/${orderId}/items/${itemId}`,
      data,
    });
  }

  // Remove order item (counter role)
  async removeCounterOrderItem(orderId: string, itemId: string): Promise<APIResponse<Order>> {
    return this.request({
      method: 'DELETE',
      url: `/counter/orders/${orderId}/items/${itemId}`,
    });
  }

  // Update order item (admin role)
  async updateAdminOrderItem(orderId: string, itemId: string, data: { quantity?: number; special_instructions?: string }): Promise<APIResponse<Order>> {
    return this.request({
      method: 'PUT',
      url: `/admin/orders/${orderId}/items/${itemId}`,
      data,
    });
  }

  // Remove order item (admin role)
  async removeAdminOrderItem(orderId: string, itemId: string): Promise<APIResponse<Order>> {
    return this.request({
      method: 'DELETE',
      url: `/admin/orders/${orderId}/items/${itemId}`,
    });
  }

  // User management endpoints (Admin only)
  async getUsers(params?: { page?: number, per_page?: number, limit?: number, search?: string, role?: string, active?: string }): Promise<APIResponse<User[]>> {
    const normalizedParams = {
      page: params?.page,
      per_page: params?.per_page || params?.limit,
      search: params?.search,
      role: params?.role,
      active: params?.active
    }
    return this.request({
      method: 'GET',
      url: '/admin/users',
      params: normalizedParams,
    });
  }

  async createUser(userData: any): Promise<APIResponse<User>> {
    return this.request({
      method: 'POST',
      url: '/admin/users',
      data: userData,
    });
  }

  async updateUser(id: string, userData: any): Promise<APIResponse<User>> {
    return this.request({
      method: 'PUT',
      url: `/admin/users/${id}`,
      data: userData,
    });
  }

  async deleteUser(id: string): Promise<APIResponse> {
    return this.request({
      method: 'DELETE',
      url: `/admin/users/${id}`,
    });
  }

  // Admin-specific product management
  async createProduct(productData: any): Promise<APIResponse<Product>> {
    return this.request({ method: 'POST', url: '/admin/products', data: productData });
  }

  async updateProduct(id: string, productData: any): Promise<APIResponse<Product>> {
    return this.request({ method: 'PUT', url: `/admin/products/${id}`, data: productData });
  }

  async deleteProduct(id: string): Promise<APIResponse> {
    return this.request({ method: 'DELETE', url: `/admin/products/${id}` });
  }

  // Product option group endpoints
  async getOptionGroups(productId: string): Promise<APIResponse<ProductOptionGroup[]>> {
    return this.request({
      method: 'GET',
      url: `/products/${productId}/option-groups`,
    });
  }

  async createOptionGroup(productId: string, data: CreateOptionGroupRequest): Promise<APIResponse<ProductOptionGroup>> {
    return this.request({
      method: 'POST',
      url: `/admin/products/${productId}/option-groups`,
      data,
    });
  }

  async updateOptionGroup(productId: string, groupId: string, data: Partial<CreateOptionGroupRequest>): Promise<APIResponse<ProductOptionGroup>> {
    return this.request({
      method: 'PUT',
      url: `/admin/products/${productId}/option-groups/${groupId}`,
      data,
    });
  }

  async deleteOptionGroup(productId: string, groupId: string): Promise<APIResponse> {
    return this.request({
      method: 'DELETE',
      url: `/admin/products/${productId}/option-groups/${groupId}`,
    });
  }

  async createOptionItem(groupId: string, data: CreateOptionItemRequest): Promise<APIResponse<ProductOptionItem>> {
    return this.request({
      method: 'POST',
      url: `/admin/option-groups/${groupId}/items`,
      data,
    });
  }

  async updateOptionItem(itemId: string, data: Partial<CreateOptionItemRequest>): Promise<APIResponse<ProductOptionItem>> {
    return this.request({
      method: 'PUT',
      url: `/admin/option-items/${itemId}`,
      data,
    });
  }

  async deleteOptionItem(itemId: string): Promise<APIResponse> {
    return this.request({
      method: 'DELETE',
      url: `/admin/option-items/${itemId}`,
    });
  }

  // Global variation group endpoints
  async getVariationGroups(params?: { page?: number; per_page?: number; search?: string }): Promise<any> {
    return this.request({
      method: 'GET',
      url: '/admin/variations',
      params,
    });
  }

  async getVariationGroup(id: string): Promise<any> {
    return this.request({
      method: 'GET',
      url: `/admin/variations/${id}`,
    });
  }

  async createVariationGroup(data: CreateVariationGroupRequest): Promise<any> {
    return this.request({
      method: 'POST',
      url: '/admin/variations',
      data,
    });
  }

  async updateVariationGroup(id: string, data: Partial<CreateVariationGroupRequest>): Promise<any> {
    return this.request({
      method: 'PUT',
      url: `/admin/variations/${id}`,
      data,
    });
  }

  async deleteVariationGroup(id: string): Promise<APIResponse> {
    return this.request({
      method: 'DELETE',
      url: `/admin/variations/${id}`,
    });
  }

  async createVariationItem(groupId: string, data: CreateVariationItemRequest): Promise<any> {
    return this.request({
      method: 'POST',
      url: `/admin/variation-groups/${groupId}/items`,
      data,
    });
  }

  async deleteVariationItem(itemId: string): Promise<APIResponse> {
    return this.request({
      method: 'DELETE',
      url: `/admin/variation-items/${itemId}`,
    });
  }

  async getProductVariationLinks(productId: string): Promise<APIResponse<ProductVariationLinkResponse[]>> {
    return this.request({
      method: 'GET',
      url: `/products/${productId}/variation-links`,
    });
  }

  async linkVariationsToProduct(productId: string, variationGroups: LinkVariationGroupWithPrices[]): Promise<APIResponse> {
    return this.request({
      method: 'PUT',
      url: `/admin/products/${productId}/variation-links`,
      data: { variation_groups: variationGroups },
    });
  }

  // Combo slot management
  async getComboSlots(productId: string): Promise<APIResponse<ComboSlot[]>> {
    return this.request({
      method: 'GET',
      url: `/products/${productId}/combo-slots`,
    });
  }

  async createComboSlot(productId: string, data: CreateComboSlotRequest): Promise<APIResponse<ComboSlot[]>> {
    return this.request({
      method: 'POST',
      url: `/admin/products/${productId}/combo-slots`,
      data,
    });
  }

  async updateComboSlot(productId: string, slotId: string, data: Partial<CreateComboSlotRequest>): Promise<APIResponse> {
    return this.request({
      method: 'PUT',
      url: `/admin/products/${productId}/combo-slots/${slotId}`,
      data,
    });
  }

  async deleteComboSlot(productId: string, slotId: string): Promise<APIResponse> {
    return this.request({
      method: 'DELETE',
      url: `/admin/products/${productId}/combo-slots/${slotId}`,
    });
  }

  async createComboSlotChoice(slotId: string, data: CreateComboSlotChoiceRequest): Promise<APIResponse> {
    return this.request({
      method: 'POST',
      url: `/admin/combo-slots/${slotId}/choices`,
      data,
    });
  }

  async deleteComboSlotChoice(choiceId: string): Promise<APIResponse> {
    return this.request({
      method: 'DELETE',
      url: `/admin/combo-choices/${choiceId}`,
    });
  }

  // Admin-specific category management
  async createCategory(categoryData: any): Promise<APIResponse<Category>> {
    return this.request({ method: 'POST', url: '/admin/categories', data: categoryData });
  }

  async updateCategory(id: string, categoryData: any): Promise<APIResponse<Category>> {
    return this.request({ method: 'PUT', url: `/admin/categories/${id}`, data: categoryData });
  }

  async deleteCategory(id: string): Promise<APIResponse> {
    return this.request({ method: 'DELETE', url: `/admin/categories/${id}` });
  }

  // Admin products endpoint with pagination
  async getAdminProducts(params?: { page?: number, per_page?: number, limit?: number, search?: string, category_id?: string }): Promise<APIResponse<Product[]>> {
    // Normalize params (handle both per_page and limit)
    const normalizedParams = {
      page: params?.page,
      per_page: params?.per_page || params?.limit,
      search: params?.search,
      category_id: params?.category_id
    }
    
    return this.request({ 
      method: 'GET', 
      url: '/admin/products',
      params: normalizedParams
    });
  }

  // Admin categories endpoint with pagination
  async getAdminCategories(params?: { page?: number, per_page?: number, limit?: number, search?: string, active_only?: boolean }): Promise<APIResponse<Category[]>> {
    // Normalize params (handle both per_page and limit)
    const normalizedParams = {
      page: params?.page,
      per_page: params?.per_page || params?.limit,
      search: params?.search,
      active_only: params?.active_only
    }
    
    return this.request({ 
      method: 'GET', 
      url: '/admin/categories',
      params: normalizedParams
    });
  }

  // Admin tables endpoint with pagination
  async getAdminTables(params?: { page?: number, per_page?: number, search?: string, status?: string, location_id?: string }): Promise<APIResponse<DiningTable[]>> {
    return this.request({
      method: 'GET',
      url: '/admin/tables',
      params
    });
  }

  // Admin-specific order management
  async createAdminOrder(order: CreateOrderRequest): Promise<APIResponse<Order>> {
    return this.request({
      method: 'POST',
      url: '/admin/orders',
      data: order,
    });
  }

  async processAdminPayment(orderId: string, payment: ProcessPaymentRequest): Promise<APIResponse<Payment>> {
    return this.request({
      method: 'POST',
      url: `/admin/orders/${orderId}/payments`,
      data: payment,
    });
  }

  async deleteAdminOrder(orderId: string): Promise<APIResponse> {
    return this.request({
      method: 'DELETE',
      url: `/admin/orders/${orderId}`,
    });
  }

  // Generic order delete (for counter/server roles)
  async deleteOrder(orderId: string): Promise<APIResponse> {
    return this.request({
      method: 'DELETE',
      url: `/orders/${orderId}`,
    });
  }

  // Admin-specific table management
  async createTable(tableData: any): Promise<APIResponse<DiningTable>> {
    return this.request({ method: 'POST', url: '/admin/tables', data: tableData });
  }

  async updateTable(id: string, tableData: any): Promise<APIResponse<DiningTable>> {
    return this.request({ method: 'PUT', url: `/admin/tables/${id}`, data: tableData });
  }

  async deleteTable(id: string): Promise<APIResponse> {
    return this.request({ method: 'DELETE', url: `/admin/tables/${id}` });
  }

  // Customer endpoints
  async getCustomers(params?: { page?: number; per_page?: number; search?: string }): Promise<PaginatedResponse<any[]>> {
    return this.request({
      method: 'GET',
      url: '/customers',
      params,
    });
  }

  async getCustomerById(id: string): Promise<APIResponse<any>> {
    return this.request({
      method: 'GET',
      url: `/customers/${id}`,
    });
  }

  async getCustomerByPhone(phone: string): Promise<APIResponse<any>> {
    return this.request({
      method: 'GET',
      url: `/customers/phone/${encodeURIComponent(phone)}`,
    });
  }

  async createCustomer(data: { phone: string; name?: string; email?: string; address?: string }): Promise<APIResponse<any>> {
    return this.request({
      method: 'POST',
      url: '/customers',
      data,
    });
  }

  async updateCustomer(id: string, data: { phone?: string; name?: string; email?: string; address?: string }): Promise<APIResponse<any>> {
    return this.request({
      method: 'PUT',
      url: `/customers/${id}`,
      data,
    });
  }

  async searchCustomers(query: string, limit = 10): Promise<APIResponse<any[]>> {
    return this.request({
      method: 'GET',
      url: '/customers/search',
      params: { query, limit },
    });
  }

  async getCustomerOrders(customerId: string, params?: { page?: number; per_page?: number }): Promise<PaginatedResponse<any[]>> {
    return this.request({
      method: 'GET',
      url: `/customers/${customerId}/orders`,
      params,
    });
  }

  // Location management (Admin only)
  async getLocations(): Promise<APIResponse<any[]>> {
    return this.request({ method: 'GET', url: '/admin/locations' });
  }

  async createLocation(data: { name: string; code: string; address?: string; phone?: string }): Promise<APIResponse<{ id: string }>> {
    return this.request({ method: 'POST', url: '/admin/locations', data });
  }

  async updateLocation(id: string, data: { name?: string; code?: string; address?: string; phone?: string; is_active?: boolean }): Promise<APIResponse<void>> {
    return this.request({ method: 'PUT', url: `/admin/locations/${id}`, data });
  }

  async deleteLocation(id: string): Promise<APIResponse<void>> {
    return this.request({ method: 'DELETE', url: `/admin/locations/${id}` });
  }

  async reassignUserLocation(userId: string, locationId: string): Promise<APIResponse<void>> {
    return this.request({ method: 'PUT', url: `/admin/users/${userId}/location`, data: { location_id: locationId } });
  }

  // Media library
  async getMedia(): Promise<APIResponse<any[]>> {
    return this.request({ method: 'GET', url: '/admin/media' });
  }

  async uploadMedia(formData: FormData): Promise<APIResponse<any>> {
    try {
      const response = await this.client.post('/admin/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.message || error.message);
      }
      throw error;
    }
  }

  async deleteMedia(id: string): Promise<APIResponse> {
    return this.request({ method: 'DELETE', url: `/admin/media/${id}` });
  }

  // Settings management
  async getSettings(): Promise<APIResponse<Record<string, string>>> {
    return this.request({ method: 'GET', url: '/admin/settings' });
  }

  async updateSettings(settings: Record<string, string>): Promise<APIResponse<Record<string, string>>> {
    return this.request({ method: 'PUT', url: '/admin/settings', data: settings });
  }

  async getSetting(key: string): Promise<APIResponse<{ key: string; value: string }>> {
    return this.request({ method: 'GET', url: `/admin/settings/${key}` });
  }

  // Utility methods
  setAuthToken(token: string): void {
    // Token is now managed by zustand persist store
    // This method is kept for backwards compatibility but should not be used
    console.warn('setAuthToken is deprecated, use auth store instead');
  }

  clearAuth(): void {
    // Clear the zustand persist store
    localStorage.removeItem('pos-auth');
  }

  getAuthToken(): string | null {
    try {
      const storedAuth = localStorage.getItem('pos-auth');
      if (storedAuth) {
        const parsed = JSON.parse(storedAuth);
        return parsed.state?.token || null;
      }
    } catch (e) {
      console.error('Failed to parse auth store:', e);
    }
    return null;
  }

  isAuthenticated(): boolean {
    return !!this.getAuthToken();
  }
}

// Create and export a singleton instance
export const apiClient = new APIClient();
export default apiClient;

