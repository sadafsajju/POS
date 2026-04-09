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
  platformConfigsDb,
  setupDb,
  tenantsDb,
} from '@pos/supabase';
import type { Json } from '@pos/supabase';
import type {
  User,
  Product,
  Category,
  Table,
  Customer,
  CreateCustomerRequest,
  PaginationParams,
  LoginRequest,
  CreateOrderRequest,
  ProcessPaymentRequest,
  OrderFilters,
  ProductFilters,
  TableFilters,
  CreatePlatformConfigRequest,
  CreateLocationRequest,
  UpdateLocationRequest,
  SetLocationProductOverrideRequest,
} from '@pos/types';

// ============================================
// Tenant Registration Types
// ============================================
export interface RegisterTenantRequest {
  business_name: string;
  subdomain: string;
  admin_email: string;
  admin_name: string;
  password: string;
  phone?: string;
  city: string;
  state?: string;
  country?: string;
}

export interface RegisterTenantResponse {
  tenant_id: string;
  subdomain: string;
  login_url: string;
  username: string;
  trial_ends: string;
  trial_days: number;
  plan: string;
  max_users: number;
  max_products: number;
}

export interface SubdomainCheckResponse {
  available: boolean;
  subdomain?: string;
  preview_url?: string;
  reason?: string;
}

export interface TenantInfo {
  id: string;
  business_name: string;
  subdomain: string;
  plan: string;
  subscription_status: string;
  is_active: boolean;
  onboarding_completed: boolean;
  trial_ends_at?: string;
}

// ============================================
// Promo Types
// ============================================
export interface PromoItem {
  id: string;
  org_id?: string;
  title: string | null;
  media_type: 'image' | 'video';
  file_url: string;
  display_order: number;
  duration_seconds: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// ============================================
// Public Promos Endpoint — TODO: Move to Supabase query
// ============================================
export const promosApi = {
  getPublicPromos: async () =>
    ({ success: true, message: 'Success', data: [] }) as any,
};

// ============================================
// Setup Endpoints
// ============================================
export interface SetupStatus {
  needs_setup: boolean;
  has_admin: boolean;
  total_users: number;
  admin_count: number;
}

export interface CreateAdminRequest {
  username: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  pin?: string;
  store_name?: string;
  location_name?: string;
  location_code?: string;
  currency?: string;
  currency_symbol?: string;
  tax_rate?: string;
}

export const setupApi = {
  checkStatus: () =>
    setupDb.checkSetupStatus() as any,

  createAdmin: (data: CreateAdminRequest) =>
    setupDb.performInitialSetup({
      username: data.username,
      email: data.email,
      password: data.password,
      first_name: data.first_name,
      last_name: data.last_name,
      pin: data.pin,
      store_name: data.store_name || 'My Store',
      location_name: data.location_name || 'Main Branch',
      location_code: data.location_code || 'MAIN',
      currency: data.currency || 'INR',
      currency_symbol: data.currency_symbol || '₹',
      tax_rate: data.tax_rate ?? '0',
    }) as any,
};

export const trialApi = {
  checkStatus: () => tenantsDb.checkTrialStatus(),
};

// ============================================
// Authentication Endpoints
// ============================================
export interface StaffMember {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
}

export const authApi = {
  login: (_credentials: LoginRequest) =>
    Promise.resolve({ success: false, message: 'Use Supabase Auth signInWithPassword()' }) as any,

  logout: () =>
    Promise.resolve({ success: true, message: 'Use Supabase Auth signOut()' }) as any,

  me: () =>
    Promise.resolve({ success: false, message: 'Use Supabase Auth getSession()' }) as any,

  getStaffForPin: () =>
    usersDb.getStaffForPin() as any,

  pinStatus: () =>
    Promise.resolve({ success: false, message: 'PIN status not yet implemented' }) as any,

  verifyPin: (pin: string) =>
    usersDb.verifyPin(pin) as any,

  updatePin: (currentPin: string, newPin: string) =>
    usersDb.updatePin(currentPin, newPin) as any,

  switchLocation: (_locationId: string) =>
    Promise.resolve({ success: false, message: 'Location switching not yet implemented' }) as any,

  supabaseSession: () =>
    Promise.resolve({ success: false, message: 'Use Supabase Auth getSession()' }) as any,

  completeSetup: (_data: any) =>
    Promise.resolve({ success: false, message: 'Use Supabase Edge Function for setup' }) as any,
};

// ============================================
// Products Endpoints
// ============================================
export const productsApi = {
  getAll: (params?: ProductFilters) =>
    productsDb.getProducts({
      page: params?.page,
      per_page: params?.per_page,
      search: params?.search,
      category_id: params?.category_id,
    }) as any,

  getById: (id: string) =>
    productsDb.getProductById(id) as any,

  getByCategory: (categoryId: string, _availableOnly = true) =>
    productsDb.getProductsByCategory(categoryId) as any,
};

// ============================================
// Categories Endpoints
// ============================================
export const categoriesApi = {
  getAll: (activeOnly = true) =>
    categoriesDb.getCategories({ active_only: activeOnly }) as any,

  getById: (id: string) =>
    categoriesDb.getCategoryById(id) as any,
};

// ============================================
// Tables Endpoints
// ============================================
export const tablesApi = {
  getAll: (filters?: TableFilters) =>
    tablesDb.getTables(filters) as any,

  getById: (id: string) =>
    tablesDb.getTableById(id) as any,

  getByLocation: () =>
    tablesDb.getTables() as any,

  getStatus: () =>
    tablesDb.getTableStatus() as any,
};

// ============================================
// Orders Endpoints
// ============================================
export const ordersApi = {
  getAll: (params?: OrderFilters & { table_id?: string; date_from?: string; date_to?: string }) =>
    ordersDb.getOrders({
      page: params?.page,
      per_page: params?.per_page,
      status: params?.status,
      order_type: params?.order_type,
      table_id: params?.table_id,
      date_from: params?.date_from,
      date_to: params?.date_to,
    }) as any,

  getById: (id: string) =>
    ordersDb.getOrderById(id) as any,

  updateStatus: (id: string, status: string, notes?: string) =>
    ordersDb.updateOrderStatus(id, status, notes) as any,
};

// ============================================
// Payment Endpoints
// ============================================
export const paymentsApi = {
  getByOrder: (orderId: string) =>
    paymentsDb.getPaymentsByOrder(orderId) as any,

  getSummary: (orderId: string) =>
    paymentsDb.getPaymentSummary(orderId) as any,
};

// ============================================
// Server Role Endpoints
// ============================================
export const serverApi = {
  createOrder: (order: CreateOrderRequest) =>
    ordersDb.createOrder({
      table_id: order.table_id,
      customer_id: order.customer_id,
      customer_name: order.customer_name,
      order_type: order.order_type,
      items: order.items as unknown as Json,
      notes: order.notes,
      parent_order_id: order.parent_order_id,
      create_as_kot: order.create_as_kot,
      order_source: (order as any).order_source,
      initial_status: (order as any).initial_status,
    }) as any,

  addItems: (orderId: string, items: Array<{ product_id: string; quantity: number; special_instructions?: string }>) =>
    ordersDb.createOrder({
      order_type: 'dine_in',
      items: items as unknown as Json,
      parent_order_id: orderId,
      create_as_kot: true,
    }) as any,
};

// ============================================
// Counter Role Endpoints
// ============================================
export const counterApi = {
  createOrder: (order: CreateOrderRequest) =>
    serverApi.createOrder(order),

  addItems: (orderId: string, items: Array<{ product_id: string; quantity: number; special_instructions?: string }>) =>
    serverApi.addItems(orderId, items),

  processPayment: (orderId: string, payment: ProcessPaymentRequest) =>
    paymentsDb.processPayment({
      order_id: orderId,
      payment_method: payment.payment_method,
      amount: payment.amount,
      reference_number: payment.reference_number,
      cash_received: (payment as any).cash_received,
    }) as any,

  getAggregatorOrders: (params?: { status?: string; platform?: string }) =>
    ordersDb.getAggregatorOrders(params) as any,

  acceptAggregatorOrder: (_orderId: string) =>
    Promise.resolve({ success: false, message: 'Aggregator accept not yet implemented' }) as any,

  rejectAggregatorOrder: (_orderId: string, _reason: string) =>
    Promise.resolve({ success: false, message: 'Aggregator reject not yet implemented' }) as any,
};

// ============================================
// Kitchen Endpoints
// ============================================
export const kitchenApi = {
  getOrders: (status?: string) =>
    ordersDb.getKitchenOrders(status) as any,

  updateItemStatus: (orderId: string, itemId: string, status: string) =>
    ordersDb.updateOrderItemStatus(orderId, itemId, status) as any,
};

// ============================================
// Admin Endpoints
// ============================================
export const adminApi = {
  // Dashboard & Reports
  getDashboardStats: () =>
    reportsDb.getDashboardStats() as any,

  getSalesReport: (period: 'today' | 'week' | 'month' = 'today') =>
    reportsDb.getSalesReport(period) as any,

  getOrdersReport: () =>
    reportsDb.getOrdersReport() as any,

  getIncomeReport: (period: 'today' | 'week' | 'month' | 'year' = 'today') =>
    reportsDb.getIncomeReport(period) as any,

  // Settings
  getSettings: () =>
    settingsDb.getSettings() as any,

  updateSettings: (settings: Record<string, string>) =>
    settingsDb.updateSettings(settings) as any,

  getSetting: (key: string) =>
    settingsDb.getSetting(key) as any,

  // User Management
  getUsers: (params?: PaginationParams & { role?: string; active?: string }) =>
    usersDb.getUsers({
      page: params?.page,
      per_page: params?.per_page,
      search: params?.search,
      role: params?.role,
      active: params?.active,
    }) as any,

  createUser: (userData: Partial<User> & { password?: string }) =>
    usersDb.createUser(userData as any) as any,

  inviteStaff: async (params: { email: string; role: string; location_ids?: string[] }) => {
    const { getSupabase } = await import('@pos/supabase')
    const sb = getSupabase()
    const { data, error } = await sb.functions.invoke('invite-staff', { body: params })
    if (error) return { success: false, message: error.message }
    return data
  },

  updateUser: (id: string, userData: Partial<User> & { password?: string }) =>
    usersDb.updateUser(id, userData as any) as any,

  deleteUser: (id: string) =>
    usersDb.deleteUser(id) as any,

  // Product Management
  getProducts: (params?: ProductFilters) =>
    productsDb.getProducts({
      page: params?.page,
      per_page: params?.per_page,
      search: params?.search,
      category_id: params?.category_id,
    }) as any,

  createProduct: (productData: Partial<Product>) =>
    productsDb.createProduct(productData as any) as any,

  updateProduct: (id: string, productData: Partial<Product>) =>
    productsDb.updateProduct(id, productData as any) as any,

  deleteProduct: (id: string) =>
    productsDb.deleteProduct(id) as any,

  // Category Management
  getCategories: (params?: PaginationParams & { active_only?: boolean }) =>
    categoriesDb.getCategories({
      page: params?.page,
      per_page: params?.per_page,
      search: params?.search,
      active_only: params?.active_only,
    }) as any,

  createCategory: (categoryData: Partial<Category>) =>
    categoriesDb.createCategory(categoryData as any) as any,

  updateCategory: (id: string, categoryData: Partial<Category>) =>
    categoriesDb.updateCategory(id, categoryData as any) as any,

  deleteCategory: (id: string) =>
    categoriesDb.deleteCategory(id) as any,

  // Table Management
  getTables: (params?: TableFilters & PaginationParams) =>
    tablesDb.getTables(params) as any,

  createTable: (tableData: Partial<Table>) =>
    tablesDb.createTable(tableData as any) as any,

  updateTable: (id: string, tableData: Partial<Table>) =>
    tablesDb.updateTable(id, tableData as any) as any,

  deleteTable: (id: string) =>
    tablesDb.deleteTable(id) as any,

  // Order Management
  createOrder: (order: CreateOrderRequest) =>
    serverApi.createOrder(order),

  addItemsToOrder: (orderId: string, items: Array<{ product_id: string; quantity: number; special_instructions?: string }>) =>
    serverApi.addItems(orderId, items),

  processPayment: (orderId: string, payment: ProcessPaymentRequest) =>
    counterApi.processPayment(orderId, payment),

  deleteOrder: (orderId: string) =>
    ordersDb.deleteOrder(orderId) as any,

  // Aggregator order management
  getAggregatorOrders: (params?: { status?: string; platform?: string }) =>
    ordersDb.getAggregatorOrders(params) as any,

  acceptAggregatorOrder: (_orderId: string) =>
    Promise.resolve({ success: false, message: 'Aggregator accept not yet implemented' }) as any,

  rejectAggregatorOrder: (_orderId: string, _reason: string) =>
    Promise.resolve({ success: false, message: 'Aggregator reject not yet implemented' }) as any,

  // Platform configuration (Swiggy/Zomato)
  getPlatformConfigs: () =>
    platformConfigsDb.getPlatformConfigs() as any,

  getPlatformConfig: (platform: string) =>
    platformConfigsDb.getPlatformConfig(platform) as any,

  upsertPlatformConfig: (config: CreatePlatformConfigRequest) =>
    platformConfigsDb.upsertPlatformConfig(config as any) as any,

  deletePlatformConfig: (platform: string) =>
    platformConfigsDb.deletePlatformConfig(platform) as any,

  // Location Management
  getLocations: () =>
    locationsDb.getLocations() as any,

  createLocation: (data: CreateLocationRequest) =>
    locationsDb.createLocation(data as any) as any,

  updateLocation: (id: string, data: UpdateLocationRequest) =>
    locationsDb.updateLocation(id, data as any) as any,

  deleteLocation: (id: string) =>
    locationsDb.deleteLocation(id) as any,

  getLocationProducts: (_locationId: string) =>
    Promise.resolve({ success: true, message: 'Success', data: [] }) as any,

  setLocationProductOverride: (_locationId: string, _productId: string, _data: SetLocationProductOverrideRequest) =>
    Promise.resolve({ success: false, message: 'Not yet implemented' }) as any,

  removeLocationProductOverride: (_locationId: string, _productId: string) =>
    Promise.resolve({ success: false, message: 'Not yet implemented' }) as any,

  reassignUserLocation: (userId: string, locationId: string) =>
    usersDb.updateUser(userId, { location_id: locationId }) as any,

  // Promo Management — TODO: Move to Supabase Storage in Phase 5
  getPromos: () =>
    Promise.resolve({ success: true, message: 'Success', data: [] }) as any,

  uploadPromo: (_formData: FormData) =>
    Promise.resolve({ success: false, message: 'File uploads not yet migrated' }) as any,

  createPromoFromMedia: (_file_url: string, _title?: string) =>
    Promise.resolve({ success: false, message: 'Not yet implemented' }) as any,

  deletePromo: (_id: string) =>
    Promise.resolve({ success: false, message: 'Not yet implemented' }) as any,

  reorderPromos: (_items: { id: string; display_order: number }[]) =>
    Promise.resolve({ success: false, message: 'Not yet implemented' }) as any,

  togglePromo: (_id: string) =>
    Promise.resolve({ success: false, message: 'Not yet implemented' }) as any,

  updatePromoDuration: (_id: string, _duration_seconds: number) =>
    Promise.resolve({ success: false, message: 'Not yet implemented' }) as any,

  // Media Library — TODO: Move to Supabase Storage in Phase 5
  getMedia: () =>
    Promise.resolve({ success: true, message: 'Success', data: [] }) as any,

  uploadMedia: (_formData: FormData) =>
    Promise.resolve({ success: false, message: 'File uploads not yet migrated' }) as any,

  deleteMedia: (_id: string) =>
    Promise.resolve({ success: false, message: 'Not yet implemented' }) as any,

  // QR Code Management — TODO: Implement as Supabase query
  generateQRCode: (_data: { table_id: string; wifi_ssid?: string; wifi_password?: string; pos_hostname?: string; pos_port?: string }) =>
    Promise.resolve({ success: false, message: 'Not yet implemented' }) as any,

  getQRCodes: (_tableId?: string) =>
    Promise.resolve({ success: true, message: 'Success', data: [] }) as any,
};

// ============================================
// Customers Endpoints
// ============================================
export const customersApi = {
  getAll: (params?: PaginationParams) =>
    customersDb.getCustomers(params) as any,

  getById: (id: string) =>
    customersDb.getCustomerById(id) as any,

  getByPhone: (phone: string) =>
    customersDb.getCustomerByPhone(phone) as any,

  create: (data: CreateCustomerRequest) =>
    customersDb.createCustomer(data as any) as any,

  update: (id: string, data: Partial<Customer>) =>
    customersDb.updateCustomer(id, data as any) as any,

  search: (query: string, limit = 10) =>
    customersDb.searchCustomers(query, limit) as any,
};

// ============================================
// Customer Ordering Endpoints — TODO: Implement as Edge Function
// ============================================
export const customerOrderingApi = {
  initSession: (_data: { qr_token: string; customer_name?: string; customer_phone?: string }) =>
    Promise.resolve({ success: false, message: 'Not yet implemented for Supabase' }) as any,

  getMenu: () =>
    Promise.resolve({ success: true, message: 'Success', data: [] }) as any,

  placeOrder: (_data: { items: Array<{ product_id: string; quantity: number; special_instructions?: string }> }) =>
    Promise.resolve({ success: false, message: 'Not yet implemented for Supabase' }) as any,

  getMyOrders: () =>
    Promise.resolve({ success: true, message: 'Success', data: [] }) as any,
};

// ============================================
// Tenant Registration Endpoints — TODO: Implement as Edge Function
// ============================================
export const tenantApi = {
  register: (_data: RegisterTenantRequest) =>
    Promise.resolve({ success: false, message: 'Use Supabase Edge Function for registration' }) as any,

  checkSubdomain: (_subdomain: string) =>
    Promise.resolve({ success: true, message: 'Success', data: { available: true } }) as any,

  getTenantBySubdomain: (_subdomain: string) =>
    Promise.resolve({ success: false, message: 'Not yet implemented' }) as any,
};
