// ========================================
// POS System Shared Types
// Matches backend API response formats
// ========================================

// ============================================
// API Response Types
// ============================================
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T[];
  meta: PaginationMeta;
}

export interface PaginationMeta {
  current_page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface PaginationParams {
  page?: number;
  per_page?: number;
  search?: string;
}

// ============================================
// Organizations & Locations (Multi-Location)
// ============================================
export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Location {
  id: string;
  org_id: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Enrichment fields (returned by admin endpoints)
  staff_count?: number;
  active_orders?: number;
}

export interface LocationProduct {
  id: string;
  location_id: string;
  product_id: string;
  price_override?: number;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateLocationRequest {
  name: string;
  code: string;
  address?: string;
  phone?: string;
}

export interface UpdateLocationRequest {
  name?: string;
  code?: string;
  address?: string;
  phone?: string;
  is_active?: boolean;
}

export interface LocationProductOverride {
  product_id: string;
  product_name: string;
  base_price: number;
  base_available: boolean;
  has_override: boolean;
  price_override?: number;
  is_available?: boolean;
}

export interface SetLocationProductOverrideRequest {
  price_override?: number;
  is_available?: boolean;
}

// ============================================
// User & Authentication
// ============================================
export interface User {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  is_active: boolean;
  org_id: string;
  location_id?: string;
  created_at: string;
  updated_at?: string;
}

export type UserRole = 'admin' | 'manager' | 'server' | 'counter' | 'kitchen';

export interface AuthState {
  user: User | null;
  token: string | null;
  organization: Organization | null;
  location: Location | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginRequest {
  username?: string;
  password?: string;
  pin?: string;
}

export interface LoginResponse {
  token: string;
  user: User;
  organization?: Organization;
  location?: Location;
}

// ============================================
// Categories
// ============================================
export interface Category {
  id: string;
  name: string;
  description?: string;
  color?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================
// Products
// ============================================
// Dietary type for products (especially useful for restaurant menus)
export type DietaryType = 'veg' | 'non-veg' | 'egg' | 'vegan';

export type ProductType = 'simple' | 'configurable' | 'combo';

export interface Product {
  id: string;
  category_id?: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  barcode?: string;
  sku?: string;
  is_available: boolean;
  preparation_time: number;
  sort_order: number;
  dietary_type?: DietaryType;
  product_type: ProductType;
  has_option_groups?: boolean;
  created_at: string;
  updated_at: string;
  category?: Category;
  option_groups?: ProductOptionGroup[];
  combo_slots?: ComboSlot[];
}

export interface ProductOptionGroup {
  id: string;
  product_id: string;
  name: string;
  selection_type: 'single' | 'multiple';
  is_required: boolean;
  min_selections: number;
  max_selections: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
  items: ProductOptionItem[];
}

export interface ProductOptionItem {
  id: string;
  option_group_id: string;
  name: string;
  price_adjustment: number;
  is_default: boolean;
  is_available: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface OrderItemOption {
  id: string;
  order_item_id: string;
  option_group_name: string;
  option_item_name: string;
  price_adjustment: number;
}

export interface CreateOptionGroupRequest {
  name: string;
  selection_type: 'single' | 'multiple';
  is_required: boolean;
  min_selections: number;
  max_selections: number;
  sort_order: number;
  items: CreateOptionItemRequest[];
}

export interface CreateOptionItemRequest {
  name: string;
  price_adjustment: number;
  is_default: boolean;
  sort_order: number;
}

export interface SelectedOptionRequest {
  option_group_name: string;
  option_item_name: string;
  price_adjustment: number;
}

// ============================================
// Combo Products
// ============================================
export interface ComboSlot {
  id: string;
  product_id: string;
  name: string;
  is_required: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  choices: ComboSlotChoice[];
}

export interface ComboSlotChoice {
  id: string;
  combo_slot_id: string;
  product_id: string;
  price_override?: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  product?: Product;
}

export interface OrderItemComboChoice {
  id: string;
  order_item_id: string;
  slot_name: string;
  product_id: string;
  product_name: string;
  price_adjustment: number;
  selected_options: string; // JSON string of nested options
}

export interface CreateComboSlotRequest {
  name: string;
  is_required: boolean;
  sort_order: number;
  choices: CreateComboSlotChoiceRequest[];
}

export interface CreateComboSlotChoiceRequest {
  product_id: string;
  price_override?: number | null;
  sort_order: number;
}

export interface CreateOrderItemComboChoice {
  slot_name: string;
  product_id: string;
  product_name: string;
  price_adjustment: number;
  selected_options: SelectedOptionRequest[];
}

// ============================================
// Tables (Restaurant Mode)
// ============================================
export interface Table {
  id: string;
  table_number: string;
  seating_capacity: number;
  location?: string;
  is_occupied: boolean;
  created_at: string;
  updated_at: string;
  current_order?: Order | null;
}

// For backwards compatibility
export type DiningTable = Table;

export interface TableStatusSummary {
  total_tables: number;
  occupied_tables: number;
  available_tables: number;
  occupancy_rate: number;
  by_location?: LocationStats[];
}

export interface LocationStats {
  location: string;
  total_tables: number;
  occupied_tables: number;
  available_tables: number;
  occupancy_rate: number;
}

// ============================================
// Orders
// ============================================
export interface Order {
  id: string;
  order_number: string;
  table_id?: string;
  user_id?: string;
  customer_id?: string;
  customer_name?: string;
  order_type: OrderType;
  status: OrderStatus;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  served_at?: string;
  completed_at?: string;
  confirmed_at?: string;
  preparing_at?: string;
  ready_at?: string;
  paid_at?: string;
  cleared_at?: string;
  // KOT support fields
  parent_order_id?: string;  // For KOTs: references the parent bill
  is_kot: boolean;           // True if this is a Kitchen Order Ticket
  kot_number?: string;       // Sequential KOT number (KOT001, KOT002)
  // Aggregator order fields
  order_source: OrderSource;
  external_order_id?: string;
  external_data?: string;
  delivery_partner_name?: string;
  delivery_partner_phone?: string;
  aggregator_confirmed_at?: string;
  accept_deadline?: string;
  // Relations
  table?: Table;
  user?: User;
  customer?: Customer;
  items?: OrderItem[];
  payments?: Payment[];
  kots?: Order[];            // Child KOTs (for parent bill orders)
  parent_order?: Order;      // Parent bill (for KOT orders)
}

export type OrderType = 'dine_in' | 'takeout' | 'delivery';
export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'paid' | 'completed' | 'cancelled';
export type OrderSource = 'pos' | 'swiggy' | 'zomato';

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  special_instructions?: string;
  notes?: string;
  status: OrderItemStatus;
  created_at: string;
  updated_at: string;
  product?: Product;
  options?: OrderItemOption[];
  combo_choices?: OrderItemComboChoice[];
}

export type OrderItemStatus = 'pending' | 'preparing' | 'ready' | 'served';

export interface OrderItemModifier {
  modifier_id: string;
  name: string;
  price: number;
}

export interface CreateOrderRequest {
  table_id?: string;
  customer_id?: string;
  customer_name?: string;
  order_type: OrderType;
  status?: OrderStatus;  // Optional: allows setting initial status (for quick POS instant sales)
  items: CreateOrderItem[];
  notes?: string;
  // KOT support fields (for dine-in orders)
  parent_order_id?: string;  // For subsequent KOTs: link to existing bill
  create_as_kot?: boolean;   // If true for dine_in, creates bill + KOT structure
}

export interface CreateOrderItem {
  product_id: string;
  quantity: number;
  special_instructions?: string;
  selected_options?: SelectedOptionRequest[];
  combo_choices?: CreateOrderItemComboChoice[];
}

export interface UpdateOrderStatusRequest {
  status: OrderStatus;
  notes?: string;
}

// ============================================
// Payments
// ============================================
export interface Payment {
  id: string;
  order_id: string;
  payment_method: PaymentMethod;
  amount: number;
  reference_number?: string;
  status: PaymentStatus;
  processed_by?: string;
  processed_at?: string;
  created_at: string;
  processed_by_user?: User;
}

export type PaymentMethod = 'cash' | 'credit_card' | 'debit_card' | 'digital_wallet';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface ProcessPaymentRequest {
  payment_method: PaymentMethod;
  amount: number;
  reference_number?: string;
  customer_id?: string;
  customer_name?: string;
}

export interface PaymentSummary {
  order_id: string;
  total_amount: number;
  total_paid: number;
  pending_amount: number;
  remaining_amount: number;
  is_fully_paid: boolean;
  payment_count: number;
}

// ============================================
// Customers
// ============================================
export interface Customer {
  id: string;
  phone: string;  // Required - unique identifier for customer lookup
  name?: string;
  email?: string;
  address?: string;
  notes?: string;
  total_orders: number;
  total_spent: number;
  last_order_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCustomerRequest {
  phone: string;
  name?: string;
  email?: string;
  address?: string;
  notes?: string;
}

export interface UpdateCustomerRequest {
  phone?: string;
  name?: string;
  email?: string;
  address?: string;
  notes?: string;
}

// ============================================
// Kitchen Display
// ============================================
export interface KitchenOrder {
  id: string;
  order_number: string;
  table_id?: string;
  table_number?: string;
  order_type: string;
  status: string;
  customer_name?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
  // KOT support fields
  is_kot: boolean;
  kot_number?: string;
  parent_order_id?: string;
  parent_order_number?: string;
  // Aggregator fields
  order_source?: OrderSource;
  external_order_id?: string;
  delivery_partner_name?: string;
  delivery_partner_phone?: string;
  accept_deadline?: string;
  // Relations
  items?: KitchenOrderItem[];
  table?: {
    table_number: string;
  };
}

export interface KitchenOrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  special_instructions?: string;
  status: OrderItemStatus;
  created_at: string;
  updated_at: string;
  product?: {
    id: string;
    name: string;
    description?: string;
  };
  options?: OrderItemOption[];
  combo_choices?: OrderItemComboChoice[];
}

// ============================================
// Dashboard & Reports
// ============================================
export interface DashboardStats {
  today_orders: number;
  today_revenue: number;
  active_orders: number;
  occupied_tables: number;
}

export interface SalesReportItem {
  date: string;
  order_count: number;
  revenue: number;
}

export interface OrdersReportItem {
  status: string;
  count: number;
  avg_amount: number;
}

export interface IncomeReport {
  summary: {
    total_orders: number;
    gross_income: number;
    tax_collected: number;
    net_income: number;
  };
  breakdown: IncomeBreakdownItem[];
  period: string;
}

export interface IncomeBreakdownItem {
  period: string;
  orders: number;
  gross: number;
  tax: number;
  net: number;
}

// ============================================
// Cart (Frontend State)
// ============================================
export interface CartItem {
  product: Product;
  quantity: number;
  special_instructions?: string;
}

export interface Cart {
  items: CartItem[];
  subtotal: number;
  tax_amount: number;
  total_amount: number;
}

// ============================================
// Sync & Offline
// ============================================
export interface SyncStatus {
  isOnline: boolean;
  lastSyncAt: Date | null;
  pendingChanges: number;
  isSyncing: boolean;
}

export interface OfflineQueueItem {
  id: string;
  action: 'create' | 'update' | 'delete';
  entity: string;
  data: unknown;
  timestamp: Date;
  retries: number;
}

// Offline order - stored locally before syncing
export interface OfflineOrder {
  localId: string;
  orderNumber: string;
  tableId?: string;
  customerName?: string;
  orderType: OrderType;
  items: CreateOrderItem[];
  notes?: string;
  status: 'pending_sync' | 'syncing' | 'synced' | 'failed';
  createdAt: Date;
  syncError?: string;
}

// ============================================
// Settings
// ============================================
// Product display settings - control what's shown in product cards
export interface ProductDisplaySettings {
  showImage: boolean;
  showDescription: boolean;
  showPrice: boolean;
  showSku: boolean;
  showBarcode: boolean;
  showDietaryType: boolean;
  showPreparationTime: boolean;
  showCategory: boolean;
  showAvailability: boolean;
}

// Per-order-type action button visibility
export interface OrderTypeButtons {
  showSave: boolean;
  showKot: boolean;
  showPay: boolean;
}

// Cart settings - control cart behavior and limits
export interface CartSettings {
  defaultOrderType: 'dine_in' | 'takeout' | 'delivery';
  showDineIn: boolean;
  showTakeout: boolean;
  showDelivery: boolean;
  showSpecialInstructions: boolean;
  showOrderNotes: boolean;
  confirmBeforeClear: boolean;
  autoClearAfterOrder: boolean;
  dineInButtons: OrderTypeButtons;
  takeoutButtons: OrderTypeButtons;
  deliveryButtons: OrderTypeButtons;
}

// Internal store settings (camelCase for TypeScript)
export interface StoreSettings {
  // Restaurant info
  restaurantName: string;
  storeAddress?: string;
  storePhone?: string;
  storeLogo?: string;

  // Financial
  currency: string;
  currencySymbol: string;
  taxRate: number;
  serviceCharge: number;

  // Receipt
  receiptHeader?: string;
  receiptFooter?: string;

  // System
  theme: 'light' | 'dark' | 'system';
  language: string;
  backupFrequency: 'hourly' | 'daily' | 'weekly' | 'manual';
  notificationEmail?: string;

  // Mode
  industryMode: 'restaurant' | 'retail';

  // Product display
  productDisplay: ProductDisplaySettings;

  // Cart behavior
  cartSettings: CartSettings;
}

// API settings format (snake_case to match backend)
export interface ApiSettings {
  restaurant_name?: string;
  store_address?: string;
  store_phone?: string;
  store_logo?: string;
  currency?: string;
  currency_symbol?: string;
  tax_rate?: string;
  service_charge?: string;
  receipt_header?: string;
  receipt_footer?: string;
  theme?: string;
  language?: string;
  backup_frequency?: string;
  notification_email?: string;
  industry_mode?: string;
}

// ============================================
// Filters
// ============================================
export interface OrderFilters {
  status?: string;
  order_type?: string;
  page?: number;
  per_page?: number;
}

export interface ProductFilters {
  category_id?: string;
  available?: boolean;
  search?: string;
  page?: number;
  per_page?: number;
}

export interface TableFilters {
  location?: string;
  status?: 'occupied' | 'available';
  search?: string;
}

// ============================================
// Bill Summary (KOT Support)
// ============================================
export interface BillSummary {
  bill: Order;
  kots: Order[];
  total_items: number;
  aggregated_subtotal: number;
  aggregated_tax: number;
  aggregated_discount: number;
  aggregated_total: number;
  is_bill_closed: boolean;
}

// ============================================
// Platform Integration (Swiggy/Zomato)
// ============================================
export interface PlatformConfig {
  id: string;
  platform: 'swiggy' | 'zomato';
  is_enabled: boolean;
  api_key?: string;
  api_secret?: string;
  webhook_secret?: string;
  restaurant_id?: string;
  config_data?: string;
  created_at: string;
  updated_at: string;
}

export interface CreatePlatformConfigRequest {
  platform: 'swiggy' | 'zomato';
  is_enabled: boolean;
  api_key?: string;
  api_secret?: string;
  webhook_secret?: string;
  restaurant_id?: string;
  config_data?: string;
}

export interface AggregatorOrder {
  id: string;
  order_number: string;
  order_type: string;
  status: OrderStatus;
  customer_name?: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  order_source: OrderSource;
  external_order_id?: string;
  delivery_partner_name?: string;
  delivery_partner_phone?: string;
  accept_deadline?: string;
  aggregator_confirmed_at?: string;
  items?: OrderItem[];
}

// ============================================
// Plugin System (Planned)
// ============================================
export interface Plugin {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  dependencies?: string[];
  isActive: boolean;
  config?: Record<string, unknown>;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  dependencies?: string[];
  permissions?: string[];
  routes?: PluginRoute[];
  menuItems?: PluginMenuItem[];
}

export interface PluginRoute {
  path: string;
  component: string;
}

export interface PluginMenuItem {
  id: string;
  label: string;
  icon?: string;
  path: string;
  parent?: string;
}
