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

  // Promos
  promos: {
    all: ['promos'] as const,
    public: ['promos', 'public'] as const,
    admin: ['promos', 'admin'] as const,
  },

  // Media
  media: {
    all: ['media'] as const,
    admin: ['media', 'admin'] as const,
  },

  // Discount presets
  discounts: {
    all: ['discounts'] as const,
    admin: ['discounts', 'admin'] as const,
    active: ['discounts', 'active'] as const,
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
  categories: 10 * 60 * 1000, // 10 minutes
  products: 10 * 60 * 1000, // 10 minutes
  tables: 30 * 1000, // 30 seconds – realtime handles instant updates

  // Dynamic data - realtime subscriptions handle freshness
  orders: 2 * 60 * 1000, // 2 minutes – realtime pushes updates
  kitchenOrders: 60 * 1000, // 1 minute – realtime pushes updates
  payments: 2 * 60 * 1000, // 2 minutes

  // User data
  users: 10 * 60 * 1000, // 10 minutes
  currentUser: 10 * 60 * 1000, // 10 minutes

  // Reports - can be cached longer
  dashboardStats: 5 * 60 * 1000, // 5 minutes
  reports: 5 * 60 * 1000, // 5 minutes

  // Settings - rarely changes
  settings: 10 * 60 * 1000, // 10 minutes

  // Promos
  promos: 10 * 60 * 1000, // 10 minutes

  // Media
  media: 10 * 60 * 1000, // 10 minutes

  // Discount presets
  discounts: 10 * 60 * 1000, // 10 minutes — rarely change between sales

  // Customers
  customers: 10 * 60 * 1000, // 10 minutes
};

// ============================================
// Refetch Intervals (in milliseconds)
// ============================================
export const refetchInterval = {
  // Polling is a fallback — realtime subscriptions are the primary update mechanism.
  // These intervals only exist as a safety net in case a realtime event is missed.
  kitchenOrders: 30 * 1000, // 30 seconds – realtime handles instant updates
  orders: 30 * 1000, // 30 seconds

  // Dashboard
  dashboardStats: 2 * 60 * 1000, // 2 minutes

  // Tables
  tableStatus: 30 * 1000, // 30 seconds

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

  // Refetch behavior — disabled to reduce egress; realtime + manual invalidation handle freshness
  refetchOnWindowFocus: false,
  refetchOnReconnect: true,

  // Error handling
  throwOnError: false,
};
