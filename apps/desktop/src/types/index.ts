// API Response Types
export interface APIResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T = any> {
  success: boolean;
  message: string;
  data: T;
  meta: MetaData;
}

export interface MetaData {
  current_page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

// User Types
export interface User {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'manager' | 'cashier' | 'kitchen';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

// Category Types
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

// Dietary type for products
export type DietaryType = 'veg' | 'non-veg' | 'egg' | 'vegan';

export type ProductType = 'simple' | 'configurable' | 'combo';

// Product Types
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

// Combo Types
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
  selected_options: string;
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

// Table Types
export interface DiningTable {
  id: string;
  table_number: string;
  seating_capacity: number;
  location?: string;
  floor?: string;
  is_occupied: boolean;
  created_at: string;
  updated_at: string;
}

// Order Types
export interface Order {
  id: string;
  order_number: string;
  table_id?: string;
  user_id?: string;
  customer_name?: string;
  order_type: 'dine_in' | 'takeout' | 'delivery';
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'completed' | 'cancelled';
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  served_at?: string;
  completed_at?: string;
  // KOT support fields
  parent_order_id?: string;  // For KOTs: references the parent bill
  is_kot?: boolean;          // True if this is a Kitchen Order Ticket
  kot_number?: string;       // Sequential KOT number (KOT001, KOT002)
  // Relations
  table?: DiningTable;
  user?: User;
  items?: OrderItem[];
  payments?: Payment[];
  kots?: Order[];            // Child KOTs (for parent bill orders)
  parent_order?: Order;      // Parent bill (for KOT orders)
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  special_instructions?: string;
  status: 'pending' | 'preparing' | 'ready' | 'served';
  created_at: string;
  updated_at: string;
  product?: Product;
  notes?: string; // Alternative field name for special instructions
  options?: OrderItemOption[];
  combo_choices?: OrderItemComboChoice[];
}

export interface CreateOrderRequest {
  table_id?: string;
  customer_name?: string;
  order_type: 'dine_in' | 'takeout' | 'delivery';
  items: CreateOrderItem[];
  notes?: string;
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

export interface CreateOrderItem {
  product_id: string;
  quantity: number;
  special_instructions?: string;
  selected_options?: SelectedOptionRequest[];
  combo_choices?: CreateOrderItemComboChoice[];
}

export interface UpdateOrderStatusRequest {
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'completed' | 'cancelled';
  notes?: string;
}

// Payment Types
export interface Payment {
  id: string;
  order_id: string;
  payment_method: 'cash' | 'credit_card' | 'debit_card' | 'digital_wallet';
  amount: number;
  reference_number?: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  processed_by?: string;
  processed_at?: string;
  created_at: string;
  processed_by_user?: User;
}

export interface ProcessPaymentRequest {
  payment_method: 'cash' | 'credit_card' | 'debit_card' | 'digital_wallet';
  amount: number;
  reference_number?: string;
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

// Cart Types (Frontend Only)
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

// Dashboard Types
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

// Kitchen Types
export interface KitchenOrder {
  id: string;
  order_number: string;
  table_id?: string;
  table_number?: string;
  order_type: string;
  status: string;
  customer_name?: string;
  created_at: string;
  items?: OrderItem[];
}

// Table Status Types
export interface TableStatus {
  total_tables: number;
  occupied_tables: number;
  available_tables: number;
  occupancy_rate: number;
  by_location: LocationStats[];
}

export interface LocationStats {
  location: string;
  total_tables: number;
  occupied_tables: number;
  available_tables: number;
  occupancy_rate: number;
}

// Filter and Query Types
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
  occupied_only?: boolean;
  available_only?: boolean;
}

