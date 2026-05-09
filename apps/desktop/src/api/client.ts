import {
  categoriesDb,
  productsDb,
  tablesDb,
  usersDb,
  ordersDb,
  paymentsDb,
  customersDb,
  settingsDb,
  locationsDb,
  reportsDb,
  optionsDb,
  variationsDb,
  combosDb,
} from '@pos/supabase'
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
  Payment,
  CreateOrderRequest,
  ProcessPaymentRequest,
  PaymentSummary,
  DashboardStats,
  SalesReportItem,
  OrdersReportItem,
  TableStatus,
  OrderFilters,
  ProductFilters,
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
} from '@/types'
import type { Json } from '@pos/supabase'

type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'paid' | 'completed' | 'cancelled'

class APIClient {
  // Authentication endpoints - these remain as stubs since auth is now handled by Supabase Auth
  async login(_credentials: LoginRequest): Promise<APIResponse<LoginResponse>> {
    return { success: false, message: 'Use Supabase Auth signInWithPassword() instead' }
  }

  async logout(): Promise<APIResponse> {
    return { success: true, message: 'Use Supabase Auth signOut() instead' }
  }

  async getCurrentUser(): Promise<APIResponse<User>> {
    return { success: false, message: 'Use Supabase Auth getSession() instead' }
  }

  async switchLocation(locationId: string): Promise<APIResponse<{ token: string; location: Location }>> {
    // With Supabase, location switching is client-side only (RLS uses org_id, not location_id)
    const res = await locationsDb.getLocationById(locationId)
    if (res.success && res.data) {
      return { success: true, message: 'Location switched', data: { token: '', location: res.data as any } }
    }
    return { success: false, message: res.message || 'Location not found' }
  }

  // Product endpoints
  async getProducts(filters?: ProductFilters): Promise<PaginatedResponse<Product[]>> {
    const result = await productsDb.getProducts({
      page: filters?.page,
      per_page: filters?.per_page,
      search: filters?.search,
      category_id: filters?.category_id,
    })
    return result as any
  }

  async getProduct(id: string): Promise<APIResponse<Product>> {
    return await productsDb.getProductById(id) as any
  }

  async getCategories(activeOnly = true): Promise<APIResponse<Category[]>> {
    return await categoriesDb.getCategories({ active_only: activeOnly }) as any
  }

  async getProductsByCategory(categoryId: string, _availableOnly = true): Promise<APIResponse<Product[]>> {
    return await productsDb.getProductsByCategory(categoryId) as any
  }

  // Table endpoints
  async getTables(filters?: { status?: string; location_id?: string; search?: string }): Promise<APIResponse<DiningTable[]>> {
    return await tablesDb.getTables(filters) as any
  }

  async getTable(id: string): Promise<APIResponse<DiningTable>> {
    return await tablesDb.getTableById(id) as any
  }

  async getTablesByLocation(): Promise<APIResponse<any[]>> {
    return await tablesDb.getTables() as any
  }

  async getTableStatus(): Promise<APIResponse<TableStatus>> {
    return await tablesDb.getTableStatus() as any
  }

  // Order endpoints
  async getOrders(filters?: OrderFilters & { table_id?: string; date_from?: string; date_to?: string }): Promise<PaginatedResponse<Order[]>> {
    const result = await ordersDb.getOrders({
      page: filters?.page,
      per_page: filters?.per_page,
      status: filters?.status,
      order_type: filters?.order_type,
      table_id: filters?.table_id,
      date_from: filters?.date_from,
      date_to: filters?.date_to,
    })
    return result as any
  }

  async createOrder(order: CreateOrderRequest): Promise<APIResponse<Order>> {
    const o = order as any
    return await ordersDb.createOrder({
      table_id: order.table_id,
      customer_id: o.customer_id,
      customer_name: order.customer_name,
      order_type: order.order_type,
      items: order.items as unknown as Json,
      notes: order.notes,
      parent_order_id: o.parent_order_id,
      create_as_kot: o.create_as_kot,
      order_source: o.order_source,
      initial_status: o.initial_status,
      dining_mode: o.dining_mode,
      allergens_confirmed: o.allergens_confirmed,
      allergens_acknowledged_codes: o.allergens_acknowledged_codes,
    }) as any
  }

  async getOrder(id: string): Promise<APIResponse<Order>> {
    return await ordersDb.getOrderById(id) as any
  }

  async updateOrderStatus(id: string, status: OrderStatus, notes?: string): Promise<APIResponse<Order>> {
    return await ordersDb.updateOrderStatus(id, status, notes) as any
  }

  // Payment endpoints
  async processPayment(orderId: string, payment: ProcessPaymentRequest): Promise<APIResponse<Payment>> {
    return await paymentsDb.processPayment({
      order_id: orderId,
      payment_method: payment.payment_method,
      amount: payment.amount,
      reference_number: payment.reference_number,
      cash_received: (payment as any).cash_received,
    }) as any
  }

  async getPayments(orderId: string): Promise<APIResponse<Payment[]>> {
    return await paymentsDb.getPaymentsByOrder(orderId) as any
  }

  async getPaymentSummary(orderId: string): Promise<APIResponse<PaymentSummary>> {
    return await paymentsDb.getPaymentSummary(orderId) as any
  }

  // Bill Summary endpoints (KOT support)
  async getBillSummary(billId: string): Promise<APIResponse<any>> {
    return await ordersDb.getBillSummary(billId) as any
  }

  async getActiveBillForTable(tableId: string): Promise<APIResponse<any>> {
    // Find the active parent bill for this table (not a KOT, not paid/completed/cancelled)
    const { getSupabase } = await import('@pos/supabase')
    const sb = getSupabase()
    const { data: bill, error } = await sb
      .from('orders')
      .select('id')
      .eq('table_id', tableId)
      .is('parent_order_id', null)
      .eq('is_kot', false)
      .not('status', 'in', '("paid","completed","cancelled")')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !bill) {
      return { success: true, message: 'No active bill', data: null }
    }

    // Fetch the full bill summary via RPC
    const summaryResponse = await ordersDb.getBillSummary(bill.id)
    if (!summaryResponse.success) {
      return summaryResponse
    }

    // Unwrap the double-nested RPC response
    const rpcResult = summaryResponse.data as any
    const summaryData = rpcResult?.data ?? rpcResult
    return { success: true, message: 'Success', data: summaryData }
  }

  // Dashboard endpoints
  async getDashboardStats(): Promise<APIResponse<DashboardStats>> {
    return await reportsDb.getDashboardStats() as any
  }

  async getSalesReport(period: 'today' | 'week' | 'month' = 'today'): Promise<APIResponse<SalesReportItem[]>> {
    return await reportsDb.getSalesReport(period) as any
  }

  async getOrdersReport(): Promise<APIResponse<OrdersReportItem[]>> {
    return await reportsDb.getOrdersReport() as any
  }

  async getIncomeReport(period: 'today' | 'week' | 'month' | 'year' = 'today'): Promise<APIResponse<any>> {
    return await reportsDb.getIncomeReport(period) as any
  }

  // Kitchen endpoints
  async getKitchenOrders(status?: string): Promise<APIResponse<Order[]>> {
    return await ordersDb.getKitchenOrders(status) as any
  }

  async updateOrderItemStatus(orderId: string, itemId: string, status: string): Promise<APIResponse> {
    return await ordersDb.updateOrderItemStatus(orderId, itemId, status) as any
  }

  // Role-specific order creation — all use the same Supabase RPC
  async createServerOrder(order: CreateOrderRequest): Promise<APIResponse<Order>> {
    return this.createOrder(order)
  }

  async createCounterOrder(order: CreateOrderRequest): Promise<APIResponse<Order>> {
    return this.createOrder(order)
  }

  async createAdminOrder(order: CreateOrderRequest): Promise<APIResponse<Order>> {
    return this.createOrder(order)
  }

  // Add items to existing order — all roles use the same Supabase RPC
  async addItemsToServerOrder(orderId: string, items: Array<{ product_id: string; quantity: number; special_instructions?: string; selected_options?: any[] }>): Promise<APIResponse<Order>> {
    return await ordersDb.createOrder({
      order_type: 'dine_in',
      items: items as unknown as Json,
      parent_order_id: orderId,
      create_as_kot: true,
    }) as any
  }

  async addItemsToCounterOrder(orderId: string, items: Array<{ product_id: string; quantity: number; special_instructions?: string; selected_options?: any[] }>): Promise<APIResponse<Order>> {
    return this.addItemsToServerOrder(orderId, items)
  }

  async addItemsToAdminOrder(orderId: string, items: Array<{ product_id: string; quantity: number; special_instructions?: string; selected_options?: any[] }>): Promise<APIResponse<Order>> {
    return this.addItemsToServerOrder(orderId, items)
  }

  // Counter payment processing
  async processCounterPayment(orderId: string, payment: ProcessPaymentRequest): Promise<APIResponse<Payment>> {
    return this.processPayment(orderId, payment)
  }

  async processAdminPayment(orderId: string, payment: ProcessPaymentRequest): Promise<APIResponse<Payment>> {
    return this.processPayment(orderId, payment)
  }

  // Clear table — uses RPC
  async clearCounterTable(tableId: string): Promise<APIResponse<void>> {
    const result = await ordersDb.clearTable(tableId)
    return result as any
  }

  async clearAdminTable(tableId: string): Promise<APIResponse<void>> {
    return this.clearCounterTable(tableId)
  }

  // Transfer table — uses RPC
  async transferCounterTable(sourceTableId: string, targetTableId: string): Promise<APIResponse<void>> {
    const result = await ordersDb.transferTable(sourceTableId, targetTableId)
    return result as any
  }

  async transferAdminTable(sourceTableId: string, targetTableId: string): Promise<APIResponse<void>> {
    return this.transferCounterTable(sourceTableId, targetTableId)
  }

  // Update order item
  async updateServerOrderItem(_orderId: string, _itemId: string, _data: { quantity?: number; special_instructions?: string }): Promise<APIResponse<Order>> {
    // TODO: Implement as direct PostgREST update on order_items
    return { success: false, message: 'Not yet implemented for Supabase' }
  }

  async removeServerOrderItem(_orderId: string, _itemId: string): Promise<APIResponse<Order>> {
    // TODO: Implement as direct PostgREST delete on order_items
    return { success: false, message: 'Not yet implemented for Supabase' }
  }

  async updateCounterOrderItem(orderId: string, itemId: string, data: { quantity?: number; special_instructions?: string }): Promise<APIResponse<Order>> {
    return this.updateServerOrderItem(orderId, itemId, data)
  }

  async removeCounterOrderItem(orderId: string, itemId: string): Promise<APIResponse<Order>> {
    return this.removeServerOrderItem(orderId, itemId)
  }

  async updateAdminOrderItem(orderId: string, itemId: string, data: { quantity?: number; special_instructions?: string }): Promise<APIResponse<Order>> {
    return this.updateServerOrderItem(orderId, itemId, data)
  }

  async removeAdminOrderItem(orderId: string, itemId: string): Promise<APIResponse<Order>> {
    return this.removeServerOrderItem(orderId, itemId)
  }

  // User management endpoints (Admin only)
  async getUsers(params?: { page?: number; per_page?: number; limit?: number; search?: string; role?: string; active?: string }): Promise<APIResponse<User[]>> {
    return await usersDb.getUsers({
      page: params?.page,
      per_page: params?.per_page || params?.limit,
      search: params?.search,
      role: params?.role,
      active: params?.active,
    }) as any
  }

  async createUser(userData: any): Promise<APIResponse<User>> {
    return await usersDb.createUser(userData) as any
  }

  async inviteStaff(params: { email: string; role: string; location_ids?: string[] }): Promise<APIResponse<User>> {
    const { getSupabase } = await import('@pos/supabase')
    const sb = getSupabase()
    const { data, error } = await sb.functions.invoke('invite-staff', {
      body: params,
    })
    if (error) {
      // FunctionsHttpError contains the response body with our error message
      let message = error.message
      if (error.context && typeof error.context === 'object' && 'json' in error.context) {
        try {
          const body = await (error.context as Response).json()
          message = body.message || message
        } catch {}
      }
      return { success: false, message } as any
    }
    return data as any
  }

  async parseMenuImage(params: { image_base64: string; content_type: string }): Promise<any> {
    const { getSupabase } = await import('@pos/supabase')
    const sb = getSupabase()
    const { data, error } = await sb.functions.invoke('parse-menu-image', {
      body: params,
    })
    if (error) {
      let message = error.message
      const ctx = (error as any).context
      try {
        if (ctx && typeof ctx === 'object' && typeof ctx.json === 'function') {
          // Context is a Response object
          const body = await ctx.json()
          message = body.message || message
        } else if (ctx && typeof ctx === 'object' && ctx.message) {
          // Context is already parsed JSON
          message = ctx.message
        } else if (typeof ctx === 'string') {
          // Context is raw text — try parsing as JSON
          const parsed = JSON.parse(ctx)
          message = parsed.message || message
        }
      } catch {}
      return { success: false, message }
    }
    return data
  }

  async updateUser(id: string, userData: any): Promise<APIResponse<User>> {
    return await usersDb.updateUser(id, userData) as any
  }

  async deleteUser(id: string): Promise<APIResponse> {
    return await usersDb.deleteUser(id) as any
  }

  // Admin-specific product management
  async createProduct(productData: any): Promise<APIResponse<Product>> {
    return await productsDb.createProduct(productData) as any
  }

  async updateProduct(id: string, productData: any): Promise<APIResponse<Product>> {
    return await productsDb.updateProduct(id, productData) as any
  }

  async deleteProduct(id: string): Promise<APIResponse> {
    return await productsDb.deleteProduct(id) as any
  }

  // Product option group endpoints
  async getOptionGroups(productId: string): Promise<APIResponse<ProductOptionGroup[]>> {
    return await optionsDb.getOptionGroups(productId) as any
  }

  async createOptionGroup(productId: string, data: CreateOptionGroupRequest): Promise<APIResponse<ProductOptionGroup>> {
    return await optionsDb.createOptionGroup(productId, data as any) as any
  }

  async updateOptionGroup(_productId: string, groupId: string, data: Partial<CreateOptionGroupRequest>): Promise<APIResponse<ProductOptionGroup>> {
    return await optionsDb.updateOptionGroup(groupId, data as any) as any
  }

  async deleteOptionGroup(_productId: string, groupId: string): Promise<APIResponse> {
    return await optionsDb.deleteOptionGroup(groupId) as any
  }

  async createOptionItem(groupId: string, data: CreateOptionItemRequest): Promise<APIResponse<ProductOptionItem>> {
    return await optionsDb.createOptionItem(groupId, data as any) as any
  }

  async updateOptionItem(itemId: string, data: Partial<CreateOptionItemRequest>): Promise<APIResponse<ProductOptionItem>> {
    return await optionsDb.updateOptionItem(itemId, data as any) as any
  }

  async deleteOptionItem(itemId: string): Promise<APIResponse> {
    return await optionsDb.deleteOptionItem(itemId) as any
  }

  // Global variation group endpoints
  async getVariationGroups(params?: { page?: number; per_page?: number; search?: string }): Promise<any> {
    return await variationsDb.getVariationGroups(params) as any
  }

  async getVariationGroup(id: string): Promise<any> {
    return await variationsDb.getVariationGroupById(id) as any
  }

  async createVariationGroup(data: CreateVariationGroupRequest): Promise<any> {
    return await variationsDb.createVariationGroup(data as any) as any
  }

  async updateVariationGroup(id: string, data: Partial<CreateVariationGroupRequest>): Promise<any> {
    return await variationsDb.updateVariationGroup(id, data as any) as any
  }

  async deleteVariationGroup(id: string): Promise<APIResponse> {
    return await variationsDb.deleteVariationGroup(id) as any
  }

  async createVariationItem(groupId: string, data: CreateVariationItemRequest): Promise<any> {
    return await variationsDb.createVariationItem(groupId, data as any) as any
  }

  async deleteVariationItem(itemId: string): Promise<APIResponse> {
    return await variationsDb.deleteVariationItem(itemId) as any
  }

  async getProductVariationLinks(_productId: string): Promise<APIResponse<ProductVariationLinkResponse[]>> {
    // TODO: Implement product-variation link query
    return { success: true, message: 'Success', data: [] }
  }

  async linkVariationsToProduct(_productId: string, _variationGroups: LinkVariationGroupWithPrices[]): Promise<APIResponse> {
    // TODO: Implement via RPC
    return { success: false, message: 'Not yet implemented for Supabase' }
  }

  // Combo slot management
  async getComboSlots(productId: string): Promise<APIResponse<ComboSlot[]>> {
    return await combosDb.getComboSlots(productId) as any
  }

  async createComboSlot(productId: string, data: CreateComboSlotRequest): Promise<APIResponse<ComboSlot[]>> {
    const result = await combosDb.createComboSlot(productId, data as any)
    if (result.success) {
      return await combosDb.getComboSlots(productId) as any
    }
    return result as any
  }

  async updateComboSlot(_productId: string, slotId: string, data: Partial<CreateComboSlotRequest>): Promise<APIResponse> {
    return await combosDb.updateComboSlot(slotId, data as any) as any
  }

  async deleteComboSlot(_productId: string, slotId: string): Promise<APIResponse> {
    return await combosDb.deleteComboSlot(slotId) as any
  }

  async createComboSlotChoice(slotId: string, data: CreateComboSlotChoiceRequest): Promise<APIResponse> {
    return await combosDb.createComboSlotChoice(slotId, data as any) as any
  }

  async deleteComboSlotChoice(choiceId: string): Promise<APIResponse> {
    return await combosDb.deleteComboSlotChoice(choiceId) as any
  }

  // Admin-specific category management
  async createCategory(categoryData: any): Promise<APIResponse<Category>> {
    const { image_url, id, ...data } = categoryData
    return await categoriesDb.createCategory(data) as any
  }

  async updateCategory(id: string, categoryData: any): Promise<APIResponse<Category>> {
    const { image_url, id: _id, ...data } = categoryData
    return await categoriesDb.updateCategory(id, data) as any
  }

  async deleteCategory(id: string): Promise<APIResponse> {
    return await categoriesDb.deleteCategory(id) as any
  }

  // Admin products endpoint with pagination
  async getAdminProducts(params?: { page?: number; per_page?: number; limit?: number; search?: string; category_id?: string }): Promise<APIResponse<Product[]>> {
    return await productsDb.getProducts({
      page: params?.page,
      per_page: params?.per_page || params?.limit,
      search: params?.search,
      category_id: params?.category_id,
    }) as any
  }

  // Admin categories endpoint with pagination
  async getAdminCategories(params?: { page?: number; per_page?: number; limit?: number; search?: string; active_only?: boolean }): Promise<APIResponse<Category[]>> {
    return await categoriesDb.getCategories({
      page: params?.page,
      per_page: params?.per_page || params?.limit,
      search: params?.search,
      active_only: params?.active_only,
    }) as any
  }

  // Admin tables endpoint with pagination
  async getAdminTables(params?: { page?: number; per_page?: number; search?: string; status?: string; location_id?: string }): Promise<APIResponse<DiningTable[]>> {
    return await tablesDb.getTables(params) as any
  }

  async deleteAdminOrder(orderId: string): Promise<APIResponse> {
    return await ordersDb.deleteOrder(orderId) as any
  }

  async deleteOrder(orderId: string): Promise<APIResponse> {
    return await ordersDb.deleteOrder(orderId) as any
  }

  // Admin-specific table management
  async createTable(tableData: any): Promise<APIResponse<DiningTable>> {
    return await tablesDb.createTable(tableData) as any
  }

  async updateTable(id: string, tableData: any): Promise<APIResponse<DiningTable>> {
    return await tablesDb.updateTable(id, tableData) as any
  }

  async deleteTable(id: string): Promise<APIResponse> {
    return await tablesDb.deleteTable(id) as any
  }

  // Customer endpoints
  async getCustomers(params?: { page?: number; per_page?: number; search?: string }): Promise<PaginatedResponse<any[]>> {
    return await customersDb.getCustomers(params) as any
  }

  async getCustomerById(id: string): Promise<APIResponse<any>> {
    return await customersDb.getCustomerById(id) as any
  }

  async getCustomerByPhone(phone: string): Promise<APIResponse<any>> {
    return await customersDb.getCustomerByPhone(phone) as any
  }

  async createCustomer(data: { phone: string; name?: string; email?: string; address?: string }): Promise<APIResponse<any>> {
    return await customersDb.createCustomer(data as any) as any
  }

  async updateCustomer(id: string, data: { phone?: string; name?: string; email?: string; address?: string }): Promise<APIResponse<any>> {
    return await customersDb.updateCustomer(id, data as any) as any
  }

  async searchCustomers(query: string, limit = 10): Promise<APIResponse<any[]>> {
    return await customersDb.searchCustomers(query, limit) as any
  }

  async getCustomerOrders(_customerId: string, _params?: { page?: number; per_page?: number }): Promise<PaginatedResponse<any[]>> {
    // TODO: Implement with order query filtered by customer_id
    return { success: true, message: 'Success', data: [], meta: { current_page: 1, per_page: 20, total: 0, total_pages: 0 } } as any
  }

  // Location management (Admin only)
  async getLocations(): Promise<APIResponse<any[]>> {
    return await locationsDb.getLocations() as any
  }

  async createLocation(data: { name: string; code: string; address?: string; phone?: string }): Promise<APIResponse<{ id: string }>> {
    return await locationsDb.createLocation(data as any) as any
  }

  async updateLocation(id: string, data: { name?: string; code?: string; address?: string; phone?: string; is_active?: boolean }): Promise<APIResponse<void>> {
    return await locationsDb.updateLocation(id, data as any) as any
  }

  async deleteLocation(id: string): Promise<APIResponse<void>> {
    return await locationsDb.deleteLocation(id) as any
  }

  async reassignUserLocation(userId: string, locationId: string): Promise<APIResponse<void>> {
    return await usersDb.updateUser(userId, { location_id: locationId }) as any
  }

  // Media library — TODO: Move to Supabase Storage in Phase 5
  async getMedia(): Promise<APIResponse<any[]>> {
    return { success: true, message: 'Success', data: [] }
  }

  async uploadMedia(_formData: FormData): Promise<APIResponse<any>> {
    return { success: false, message: 'File uploads not yet migrated to Supabase Storage' }
  }

  async deleteMedia(_id: string): Promise<APIResponse> {
    return { success: false, message: 'File uploads not yet migrated to Supabase Storage' }
  }

  // Settings management
  async getSettings(): Promise<APIResponse<Record<string, string>>> {
    return await settingsDb.getSettings() as any
  }

  async updateSettings(settings: Record<string, string>): Promise<APIResponse<Record<string, string>>> {
    return await settingsDb.updateSettings(settings) as any
  }

  async getSetting(key: string): Promise<APIResponse<{ key: string; value: string }>> {
    return await settingsDb.getSetting(key) as any
  }

  // Utility methods
  setAuthToken(_token: string): void {
    console.warn('setAuthToken is deprecated, Supabase manages auth sessions')
  }

  clearAuth(): void {
    localStorage.removeItem('pos-auth')
  }

  getAuthToken(): string | null {
    try {
      const storedAuth = localStorage.getItem('pos-auth')
      if (storedAuth) {
        const parsed = JSON.parse(storedAuth)
        return parsed.state?.token || null
      }
    } catch (e) {
      console.error('Failed to parse auth store:', e)
    }
    return null
  }

  isAuthenticated(): boolean {
    try {
      const storedAuth = localStorage.getItem('pos-auth')
      if (storedAuth) {
        const parsed = JSON.parse(storedAuth)
        if (parsed.state?.authProvider === 'supabase' && parsed.state?.isAuthenticated) return true
        if (parsed.state?.token) return true
      }
    } catch {}
    return false
  }
}

// Create and export a singleton instance
export const apiClient = new APIClient()
export default apiClient
