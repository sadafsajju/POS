// React Query Configuration for POS API
// Query keys, stale times, and refetch intervals

// ============================================
// Query Keys
// ============================================
export const queryKeys = {
  // Auth
  auth: {
    me: ['auth', 'me'] as const,
  },

  // Products
  products: {
    all: ['products'] as const,
    list: (params?: Record<string, unknown>) => ['products', 'list', params] as const,
    detail: (id: string) => ['products', 'detail', id] as const,
    byCategory: (categoryId: string) => ['products', 'category', categoryId] as const,
  },

  // Categories
  categories: {
    all: ['categories'] as const,
    detail: (id: string) => ['categories', 'detail', id] as const,
  },

  // Tables
  tables: {
    all: ['tables'] as const,
    detail: (id: string) => ['tables', 'detail', id] as const,
    byLocation: ['tables', 'by-location'] as const,
    status: ['tables', 'status'] as const,
  },

  // Orders
  orders: {
    all: ['orders'] as const,
    list: (params?: Record<string, unknown>) => ['orders', 'list', params] as const,
    detail: (id: string) => ['orders', 'detail', id] as const,
    kitchen: ['orders', 'kitchen'] as const,
  },

  // Payments
  payments: {
    byOrder: (orderId: string) => ['payments', 'order', orderId] as const,
    summary: (orderId: string) => ['payments', 'summary', orderId] as const,
  },

  // Kitchen
  kitchen: {
    orders: (status?: string) => ['kitchen', 'orders', status] as const,
  },

  // Admin
  admin: {
    dashboard: ['admin', 'dashboard'] as const,
    salesReport: (period: string) => ['admin', 'reports', 'sales', period] as const,
    ordersReport: ['admin', 'reports', 'orders'] as const,
    incomeReport: (period: string) => ['admin', 'reports', 'income', period] as const,
    settings: ['admin', 'settings'] as const,
    users: (params?: Record<string, unknown>) => ['admin', 'users', params] as const,
    products: (params?: Record<string, unknown>) => ['admin', 'products', params] as const,
    categories: (params?: Record<string, unknown>) => ['admin', 'categories', params] as const,
    tables: (params?: Record<string, unknown>) => ['admin', 'tables', params] as const,
  },

  // Customers
  customers: {
    all: ['customers'] as const,
    list: (params?: Record<string, unknown>) => ['customers', 'list', params] as const,
    detail: (id: string) => ['customers', 'detail', id] as const,
    search: (query: string) => ['customers', 'search', query] as const,
  },
};

// ============================================
// Stale Times (in milliseconds)
// ============================================
export const staleTime = {
  // Static data - rarely changes
  categories: 5 * 60 * 1000, // 5 minutes
  products: 5 * 60 * 1000, // 5 minutes
  tables: 2 * 60 * 1000, // 2 minutes

  // Dynamic data - changes frequently
  orders: 30 * 1000, // 30 seconds
  kitchenOrders: 10 * 1000, // 10 seconds
  payments: 30 * 1000, // 30 seconds

  // User data
  users: 5 * 60 * 1000, // 5 minutes
  currentUser: 10 * 60 * 1000, // 10 minutes

  // Reports - can be cached longer
  dashboardStats: 60 * 1000, // 1 minute
  reports: 2 * 60 * 1000, // 2 minutes

  // Settings - rarely changes
  settings: 10 * 60 * 1000, // 10 minutes

  // Customers
  customers: 5 * 60 * 1000, // 5 minutes
};

// ============================================
// Refetch Intervals (in milliseconds)
// ============================================
export const refetchInterval = {
  // Real-time data
  kitchenOrders: 5 * 1000, // 5 seconds - kitchen needs fresh data
  orders: 10 * 1000, // 10 seconds

  // Dashboard
  dashboardStats: 30 * 1000, // 30 seconds

  // Tables
  tableStatus: 15 * 1000, // 15 seconds

  // Default - no auto-refetch
  none: false as const,
};

// ============================================
// Default Query Options
// ============================================
export const defaultQueryOptions = {
  // Retry failed requests
  retry: 3,
  retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),

  // Refetch behavior
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,

  // Error handling
  throwOnError: false,
};
