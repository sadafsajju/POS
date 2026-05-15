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
  address?: string | null;
  phone?: string | null;
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
  location_ids?: string[];
  auth_user_id?: string;
  auth_provider?: 'internal' | 'supabase';
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
  authProvider?: 'internal' | 'supabase';
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
  locations?: Location[];
}

export interface SessionResponse extends LoginResponse {
  needs_setup: boolean;
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
  calorie_count?: number;
  food_allergens?: AllergenCode[];
  may_contain_allergens?: AllergenCode[];
  ingredients?: string;
  is_ppds?: boolean;
  product_type: ProductType;
  has_option_groups?: boolean;
  min_variation_price?: number;
  max_variation_price?: number;
  location_ids?: string[]; // null/undefined = all locations, array = specific locations
  vat_category?: VatCategory;
  is_hot?: boolean;
  created_at: string;
  updated_at: string;
  category?: Category;
  option_groups?: ProductOptionGroup[];
  combo_slots?: ComboSlot[];
}

export type VatCategory = 'standard' | 'reduced' | 'zero' | 'exempt';
export type TaxRegime = 'flat' | 'uk_vat';
export type DiningMode = 'eat_in' | 'takeaway';
export interface VatRates { standard: number; reduced: number; zero: number; }

// 14 statutory UK allergens (FIC Regs / Natasha's Law)
export type AllergenCode =
  | 'celery' | 'crustaceans' | 'eggs' | 'fish' | 'gluten' | 'lupin' | 'milk'
  | 'molluscs' | 'mustard' | 'nuts' | 'peanuts' | 'sesame' | 'soya' | 'sulphites';

export const STATUTORY_UK_ALLERGENS: readonly AllergenCode[] = [
  'celery','crustaceans','eggs','fish','gluten','lupin','milk',
  'molluscs','mustard','nuts','peanuts','sesame','soya','sulphites',
] as const;

export const ALLERGEN_LABELS: Record<AllergenCode, string> = {
  celery: 'Celery',
  crustaceans: 'Crustaceans',
  eggs: 'Eggs',
  fish: 'Fish',
  gluten: 'Gluten',
  lupin: 'Lupin',
  milk: 'Milk',
  molluscs: 'Molluscs',
  mustard: 'Mustard',
  nuts: 'Nuts (tree)',
  peanuts: 'Peanuts',
  sesame: 'Sesame',
  soya: 'Soya',
  sulphites: 'Sulphites',
};

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
// Global Variations
// ============================================

export interface VariationGroup {
  id: string;
  org_id: string;
  name: string;
  selection_type: 'single' | 'multiple';
  is_required: boolean;
  min_selections: number;
  max_selections: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  items: VariationItem[];
  product_count?: number;
}

export interface VariationItem {
  id: string;
  variation_group_id: string;
  name: string;
  price_adjustment: number;
  is_default: boolean;
  is_available: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateVariationGroupRequest {
  name: string;
  selection_type: 'single' | 'multiple';
  is_required: boolean;
  min_selections: number;
  max_selections: number;
  sort_order: number;
  items: CreateVariationItemRequest[];
}

export interface CreateVariationItemRequest {
  name: string;
  price_adjustment?: number;
  is_default: boolean;
  sort_order: number;
}

// Product-Variation Linking (with per-item prices)
export interface LinkVariationItemPrice {
  variation_item_id: string;
  price: number;
}

export interface LinkVariationGroupWithPrices {
  variation_group_id: string;
  sort_order: number;
  item_prices: LinkVariationItemPrice[];
}

export interface LinkVariationsWithPricesRequest {
  variation_groups: LinkVariationGroupWithPrices[];
}

export interface ProductVariationLinkResponse {
  variation_group_id: string;
  group_name: string;
  selection_type: 'single' | 'multiple';
  is_required: boolean;
  min_selections: number;
  max_selections: number;
  sort_order: number;
  items: ProductVariationItemPrice[];
}

export interface ProductVariationItemPrice {
  variation_item_id: string;
  item_name: string;
  price: number;
  is_default: boolean;
  is_available: boolean;
  sort_order: number;
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
  variation_item_id?: string;
  variation_item_name?: string;
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
  variation_item_id?: string;
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
  location_id?: string;
  location_name?: string;
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
  token_number?: number;     // Daily sequential token for customer display (1, 2, 3...)
  // Aggregator order fields
  order_source: OrderSource;
  external_order_id?: string;
  external_data?: string;
  delivery_partner_name?: string;
  delivery_partner_phone?: string;
  aggregator_confirmed_at?: string;
  accept_deadline?: string;
  // Customer app order fields
  session_id?: string;
  // UK VAT
  dining_mode?: DiningMode;
  // UK allergen audit
  allergens_confirmed_at?: string;
  allergens_confirmed_by?: string;
  allergens_flagged_snapshot?: AllergenCode[];
  // UK Tipping Act 2023
  tip_amount?: number;
  tip_method?: TipMethod;
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
export type OrderSource = 'pos' | 'kiosk' | 'customer_app' | 'swiggy' | 'zomato' | 'deliveroo' | 'uber_eats' | 'just_eat';
export type AggregatorPlatform = 'swiggy' | 'zomato' | 'deliveroo' | 'uber_eats' | 'just_eat';

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
  vat_amount?: number;
  vat_rate_applied?: number;
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
  // UK VAT — only used when org tax_regime = 'uk_vat'
  dining_mode?: DiningMode;
  // UK allergen interlock — only enforced when settings.show_allergens = true
  allergens_confirmed?: boolean;
  allergens_acknowledged_codes?: AllergenCode[];
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
  cash_received?: number;
  change_amount?: number;
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
  // GDPR
  marketing_consent?: boolean;
  marketing_consent_at?: string;
  marketing_consent_source?: string;
  anonymised_at?: string;
  anonymisation_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCustomerRequest {
  phone: string;
  name?: string;
  email?: string;
  address?: string;
  notes?: string;
  marketing_consent?: boolean;
  marketing_consent_source?: string;
}

export type DataRequestType = 'access' | 'erasure' | 'rectification' | 'portability' | 'retention_policy';

// =============================================
// UK Tipping Act 2023
// =============================================
export type TipMethod = 'cash' | 'card' | 'other';
export type TipAllocationMethod = 'equal' | 'hours_weighted' | 'manual';

export interface TipPoolByMethod {
  tip_method: TipMethod | null;
  count: number;
  amount: number;
}

export interface TipAllocationLine {
  user_id: string;
  amount: number;
  share_percent?: number;
  hours_worked?: number;
  notes?: string;
  // Joined user fields when returned by get_tip_pool
  first_name?: string;
  last_name?: string;
  username?: string;
  role?: string;
}

export interface TipAllocationRecord {
  id: string;
  org_id: string;
  location_id?: string;
  period_start: string;
  period_end: string;
  total_tips: number;
  allocation_method: TipAllocationMethod;
  allocated_by?: string;
  allocated_at: string;
  locked_at?: string;
  notes?: string;
}

export interface TipPoolData {
  period_start: string;
  period_end: string;
  total_tips: number;
  by_method: TipPoolByMethod[];
  allocation?: TipAllocationRecord;
  lines: TipAllocationLine[];
}

// =============================================
// End-of-day reconciliation
// =============================================
export interface EodPaymentMethodBreakdown {
  payment_method: 'cash' | 'credit_card' | 'debit_card' | 'digital_wallet';
  count: number;
  amount: number;
  cash_received: number;
  change_given: number;
}

export interface EodOrderSourceBreakdown {
  order_source: OrderSource;
  count: number;
  amount: number;
}

export interface EodSummary {
  orders_count: number;
  subtotal: number;
  tax_total: number;
  discount_total: number;
  revenue: number;
}

export interface EodReconciliationRecord {
  id: string;
  org_id: string;
  location_id: string;
  business_date: string;
  recorded_by?: string;
  ped_settlement_total?: number;
  cash_drawer_counted?: number;
  opening_float?: number;
  pos_card_total?: number;
  pos_cash_total?: number;
  card_variance?: number;
  cash_variance?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface EodReconciliationData {
  business_date: string;
  location_id?: string;
  summary: EodSummary;
  payment_methods: EodPaymentMethodBreakdown[];
  order_sources: EodOrderSourceBreakdown[];
  voids: Array<{ id: string; order_number: string; total_amount: number; customer_name?: string; notes?: string; created_at: string }>;
  refunds: Array<{ id: string; order_id: string; order_number: string; payment_method: string; amount: number; processed_at: string }>;
  recorded?: EodReconciliationRecord;
}

export interface CustomerDataRequest {
  id: string;
  customer_id?: string;
  request_type: DataRequestType;
  requested_at: string;
  fulfilled_at?: string;
  fulfilled_by?: string;
  notes?: string;
  customer_phone_snapshot?: string;
  customer_name_snapshot?: string;
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
  token_number?: number;
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

  // Tax regime — 'flat' uses taxRate, 'uk_vat' uses vatRates + per-product VAT
  taxRegime: TaxRegime;
  vatRates: VatRates;
  vatNumber?: string;

  // Allergen surfacing + interlock (UK Natasha's Law / FIC Regs)
  showAllergens: boolean;

  // Calorie labelling (UK Calorie Labelling Regs 2021 — mandatory for businesses
  // with 250+ employees in England). Off by default; smaller venues and Indian
  // customers leave it off.
  showCalories: boolean;

  // GDPR / UK DPA
  privacyPolicyUrl?: string;
  customerRetentionMonths?: number; // null/undefined = no auto-policy

  // UK Tipping Act 2023
  tippingEnabled: boolean;
  tippingPolicyUrl?: string;
  tipDefaultAllocationMethod?: TipAllocationMethod;

  // Receipt
  receiptHeader?: string;
  receiptFooter?: string;
  // When true, the receipt fires as soon as the payment completes — the
  // operator never has to tap Print on the completion screen.
  autoPrintReceipt?: boolean;
  // How many copies to print per sale (1 = single, 2 = customer + merchant,
  // capped at 5 to avoid runaway typos).
  receiptCopies?: number;

  // System
  theme: 'light' | 'dark' | 'system';
  language: string;
  // IANA timezone (e.g. 'Europe/London', 'Asia/Kolkata') — drives every business-day boundary
  timezone: string;
  backupFrequency: 'hourly' | 'daily' | 'weekly' | 'manual';
  notificationEmail?: string;

  // Device
  touchMode: boolean;

  // Kitchen Display System
  enableKds: boolean;

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
  paid_amount: number;
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
// Media Library
// ============================================
export interface MediaItem {
  id: string;
  org_id?: string;
  filename: string;
  original_name?: string;
  file_url: string;
  file_size?: number;
  mime_type?: string;
  created_at: string;
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

// ============================================
// Customer Ordering (QR Code / PWA)
// ============================================
export interface CustomerSession {
  id: string;
  table_id: string;
  session_token: string;
  started_at: string;
  expires_at: string;
  last_activity_at: string;
  is_active: boolean;
  customer_name?: string;
  customer_phone?: string;
  created_at: string;
  updated_at: string;
  // Relations
  table?: Table;
}

export interface TableQRCode {
  id: string;
  table_id: string;
  qr_token: string;
  qr_data: string;
  is_active: boolean;
  generated_at: string;
  last_scanned_at?: string;
  scan_count: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Relations
  table?: Table;
}

export interface CustomerSessionResponse {
  session: CustomerSession;
  table: Table;
  restaurant_info: {
    name: string;
    logo_url?: string;
  };
}

export interface CreateCustomerSessionRequest {
  qr_token: string;
  customer_name?: string;
  customer_phone?: string;
}

export interface CustomerOrderRequest {
  items: CreateOrderItem[];
  notes?: string;
  customer_name?: string;
  customer_phone?: string;
}

export interface GenerateQRCodeRequest {
  table_id: string;
  wifi_ssid?: string;
  wifi_password?: string;
  pos_hostname?: string;
  pos_port?: string;
}

export interface QRCodeData {
  qr_token: string;
  table_id: string;
  table_name: string;
  qr_data: string; // Full QR code content (Wi-Fi config)
  url: string; // Direct URL for web browsers
  wifi_config?: {
    ssid: string;
    password: string;
    security: 'WPA' | 'WEP' | 'nopass';
  };
}

export interface CustomerOrderingSettings {
  enabled: boolean;
  session_timeout_minutes: number;
  wifi_ssid: string;
  wifi_password: string;
  pos_hostname: string;
  pos_port: string;
  allow_modifications: boolean;
  require_phone: boolean;
}
