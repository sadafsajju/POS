import { getApiClient } from './client';
import type {
  User,
  Product,
  Category,
  Order,
  Table,
  Customer,
  CreateCustomerRequest,
  Payment,
  PaginatedResponse,
  PaginationParams,
  LoginRequest,
  LoginResponse,
  CreateOrderRequest,
  ProcessPaymentRequest,
  PaymentSummary,
  DashboardStats,
  SalesReportItem,
  OrdersReportItem,
  IncomeReport,
  KitchenOrder,
  TableStatusSummary,
  OrderFilters,
  ProductFilters,
  TableFilters,
  PlatformConfig,
  CreatePlatformConfigRequest,
  AggregatorOrder,
  Location,
  CreateLocationRequest,
  UpdateLocationRequest,
  LocationProductOverride,
  SetLocationProductOverrideRequest,
} from '@pos/types';

// ============================================
// Setup Endpoints (First-time installation)
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
    getApiClient().get<SetupStatus>('/setup/check'),

  createAdmin: (data: CreateAdminRequest) =>
    getApiClient().post<{ user_id: string; username: string; role: string }>('/setup/admin', data),
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
  login: (credentials: LoginRequest) =>
    getApiClient().post<LoginResponse>('/auth/login', credentials),

  logout: () =>
    getApiClient().post('/auth/logout'),

  me: () =>
    getApiClient().get<User>('/auth/me'),

  /** List active staff who have a PIN set (public, no auth needed) */
  getStaffForPin: () =>
    getApiClient().get<StaffMember[]>('/auth/staff'),

  verifyPin: (pin: string) =>
    getApiClient().post<void>('/auth/verify-pin', { pin }),

  updatePin: (newPin: string) =>
    getApiClient().put<void>('/auth/pin', { new_pin: newPin }),
};

// ============================================
// Products Endpoints
// ============================================
export const productsApi = {
  getAll: (params?: ProductFilters) =>
    getApiClient().get<PaginatedResponse<Product>>('/products', params),

  getById: (id: string) =>
    getApiClient().get<Product>(`/products/${id}`),

  getByCategory: (categoryId: string, availableOnly = true) =>
    getApiClient().get<Product[]>(`/categories/${categoryId}/products`, { available_only: availableOnly }),
};

// ============================================
// Categories Endpoints
// ============================================
export const categoriesApi = {
  getAll: (activeOnly = true) =>
    getApiClient().get<Category[]>('/categories', { active_only: activeOnly }),

  getById: (id: string) =>
    getApiClient().get<Category>(`/categories/${id}`),
};

// ============================================
// Tables Endpoints
// ============================================
export const tablesApi = {
  getAll: (filters?: TableFilters) =>
    getApiClient().get<Table[]>('/tables', filters),

  getById: (id: string) =>
    getApiClient().get<Table>(`/tables/${id}`),

  getByLocation: () =>
    getApiClient().get<Table[]>('/tables/by-location'),

  getStatus: () =>
    getApiClient().get<TableStatusSummary>('/tables/status'),
};

// ============================================
// Orders Endpoints
// ============================================
export const ordersApi = {
  getAll: (params?: OrderFilters) =>
    getApiClient().get<PaginatedResponse<Order>>('/orders', params),

  getById: (id: string) =>
    getApiClient().get<Order>(`/orders/${id}`),

  updateStatus: (id: string, status: string, notes?: string) =>
    getApiClient().patch<Order>(`/orders/${id}/status`, { status, notes }),
};

// ============================================
// Payment Endpoints
// ============================================
export const paymentsApi = {
  getByOrder: (orderId: string) =>
    getApiClient().get<Payment[]>(`/orders/${orderId}/payments`),

  getSummary: (orderId: string) =>
    getApiClient().get<PaymentSummary>(`/orders/${orderId}/payment-summary`),
};

// ============================================
// Server Role Endpoints (Dine-in orders only)
// ============================================
export const serverApi = {
  createOrder: (order: CreateOrderRequest) =>
    getApiClient().post<Order>('/server/orders', order),

  addItems: (orderId: string, items: Array<{ product_id: string; quantity: number; special_instructions?: string }>) =>
    getApiClient().post<Order>(`/server/orders/${orderId}/items`, { items }),
};

// ============================================
// Counter Role Endpoints (All order types + payments)
// ============================================
export const counterApi = {
  createOrder: (order: CreateOrderRequest) =>
    getApiClient().post<Order>('/counter/orders', order),

  addItems: (orderId: string, items: Array<{ product_id: string; quantity: number; special_instructions?: string }>) =>
    getApiClient().post<Order>(`/counter/orders/${orderId}/items`, { items }),

  processPayment: (orderId: string, payment: ProcessPaymentRequest) =>
    getApiClient().post<Payment>(`/counter/orders/${orderId}/payments`, payment),

  // Aggregator order management
  getAggregatorOrders: (params?: { status?: string; platform?: string }) =>
    getApiClient().get<AggregatorOrder[]>('/counter/aggregator-orders', params),

  acceptAggregatorOrder: (orderId: string) =>
    getApiClient().post<Order>(`/counter/orders/${orderId}/accept-aggregator`),

  rejectAggregatorOrder: (orderId: string, reason: string) =>
    getApiClient().post(`/counter/orders/${orderId}/reject-aggregator`, { reason }),
};

// ============================================
// Kitchen Endpoints
// ============================================
export const kitchenApi = {
  getOrders: (status?: string) =>
    getApiClient().get<KitchenOrder[]>('/kitchen/orders', status && status !== 'all' ? { status } : {}),

  updateItemStatus: (orderId: string, itemId: string, status: string) =>
    getApiClient().patch(`/kitchen/orders/${orderId}/items/${itemId}/status`, { status }),
};

// ============================================
// Admin Endpoints
// ============================================
export const adminApi = {
  // Dashboard & Reports
  getDashboardStats: () =>
    getApiClient().get<DashboardStats>('/admin/dashboard/stats'),

  getSalesReport: (period: 'today' | 'week' | 'month' = 'today') =>
    getApiClient().get<SalesReportItem[]>('/admin/reports/sales', { period }),

  getOrdersReport: () =>
    getApiClient().get<OrdersReportItem[]>('/admin/reports/orders'),

  getIncomeReport: (period: 'today' | 'week' | 'month' | 'year' = 'today') =>
    getApiClient().get<IncomeReport>('/admin/reports/income', { period }),

  // Settings
  getSettings: () =>
    getApiClient().get<Record<string, string>>('/admin/settings'),

  updateSettings: (settings: Record<string, string>) =>
    getApiClient().put<Record<string, string>>('/admin/settings', settings),

  getSetting: (key: string) =>
    getApiClient().get<{ key: string; value: string }>(`/admin/settings/${key}`),

  // User Management
  getUsers: (params?: PaginationParams & { role?: string; active?: string }) =>
    getApiClient().get<PaginatedResponse<User>>('/admin/users', params),

  createUser: (userData: Partial<User> & { password: string }) =>
    getApiClient().post<User>('/admin/users', userData),

  updateUser: (id: string, userData: Partial<User> & { password?: string }) =>
    getApiClient().put<User>(`/admin/users/${id}`, userData),

  deleteUser: (id: string) =>
    getApiClient().delete(`/admin/users/${id}`),

  // Product Management
  getProducts: (params?: ProductFilters) =>
    getApiClient().get<PaginatedResponse<Product>>('/admin/products', params),

  createProduct: (productData: Partial<Product>) =>
    getApiClient().post<Product>('/admin/products', productData),

  updateProduct: (id: string, productData: Partial<Product>) =>
    getApiClient().put<Product>(`/admin/products/${id}`, productData),

  deleteProduct: (id: string) =>
    getApiClient().delete(`/admin/products/${id}`),

  // Category Management
  getCategories: (params?: PaginationParams & { active_only?: boolean }) =>
    getApiClient().get<PaginatedResponse<Category>>('/admin/categories', params),

  createCategory: (categoryData: Partial<Category>) =>
    getApiClient().post<Category>('/admin/categories', categoryData),

  updateCategory: (id: string, categoryData: Partial<Category>) =>
    getApiClient().put<Category>(`/admin/categories/${id}`, categoryData),

  deleteCategory: (id: string) =>
    getApiClient().delete(`/admin/categories/${id}`),

  // Table Management
  getTables: (params?: TableFilters & PaginationParams) =>
    getApiClient().get<PaginatedResponse<Table>>('/admin/tables', params),

  createTable: (tableData: Partial<Table>) =>
    getApiClient().post<Table>('/admin/tables', tableData),

  updateTable: (id: string, tableData: Partial<Table>) =>
    getApiClient().put<Table>(`/admin/tables/${id}`, tableData),

  deleteTable: (id: string) =>
    getApiClient().delete(`/admin/tables/${id}`),

  // Order Management
  createOrder: (order: CreateOrderRequest) =>
    getApiClient().post<Order>('/admin/orders', order),

  addItemsToOrder: (orderId: string, items: Array<{ product_id: string; quantity: number; special_instructions?: string }>) =>
    getApiClient().post<Order>(`/admin/orders/${orderId}/items`, { items }),

  processPayment: (orderId: string, payment: ProcessPaymentRequest) =>
    getApiClient().post<Payment>(`/admin/orders/${orderId}/payments`, payment),

  deleteOrder: (orderId: string) =>
    getApiClient().delete(`/admin/orders/${orderId}`),

  // Aggregator order management
  getAggregatorOrders: (params?: { status?: string; platform?: string }) =>
    getApiClient().get<AggregatorOrder[]>('/admin/aggregator-orders', params),

  acceptAggregatorOrder: (orderId: string) =>
    getApiClient().post<Order>(`/admin/orders/${orderId}/accept-aggregator`),

  rejectAggregatorOrder: (orderId: string, reason: string) =>
    getApiClient().post(`/admin/orders/${orderId}/reject-aggregator`, { reason }),

  // Platform configuration (Swiggy/Zomato)
  getPlatformConfigs: () =>
    getApiClient().get<PlatformConfig[]>('/admin/platform-configs'),

  getPlatformConfig: (platform: string) =>
    getApiClient().get<PlatformConfig>(`/admin/platform-configs/${platform}`),

  upsertPlatformConfig: (config: CreatePlatformConfigRequest) =>
    getApiClient().put<PlatformConfig>('/admin/platform-configs', config),

  deletePlatformConfig: (platform: string) =>
    getApiClient().delete(`/admin/platform-configs/${platform}`),

  // Location Management
  getLocations: () =>
    getApiClient().get<Location[]>('/admin/locations'),

  createLocation: (data: CreateLocationRequest) =>
    getApiClient().post<{ id: string }>('/admin/locations', data),

  updateLocation: (id: string, data: UpdateLocationRequest) =>
    getApiClient().put('/admin/locations/' + id, data),

  deleteLocation: (id: string) =>
    getApiClient().delete('/admin/locations/' + id),

  getLocationProducts: (locationId: string) =>
    getApiClient().get<LocationProductOverride[]>(`/admin/locations/${locationId}/products`),

  setLocationProductOverride: (locationId: string, productId: string, data: SetLocationProductOverrideRequest) =>
    getApiClient().put(`/admin/locations/${locationId}/products/${productId}`, data),

  removeLocationProductOverride: (locationId: string, productId: string) =>
    getApiClient().delete(`/admin/locations/${locationId}/products/${productId}`),

  reassignUserLocation: (userId: string, locationId: string) =>
    getApiClient().put(`/admin/users/${userId}/location`, { location_id: locationId }),
};

// ============================================
// Customers Endpoints
// ============================================
export const customersApi = {
  getAll: (params?: PaginationParams) =>
    getApiClient().get<PaginatedResponse<Customer>>('/customers', params),

  getById: (id: string) =>
    getApiClient().get<Customer>(`/customers/${id}`),

  getByPhone: (phone: string) =>
    getApiClient().get<Customer>(`/customers/phone/${encodeURIComponent(phone)}`),

  create: (data: CreateCustomerRequest) =>
    getApiClient().post<Customer>('/customers', data),

  update: (id: string, data: Partial<Customer>) =>
    getApiClient().put<Customer>(`/customers/${id}`, data),

  search: (query: string, limit = 10) =>
    getApiClient().get<Customer[]>('/customers/search', { query, limit }),
};
