import { z } from 'zod'

// Common validation patterns
export const emailSchema = z.string().email('Invalid email format')
export const passwordSchema = z.string().min(6, 'Password must be at least 6 characters')
export const requiredStringSchema = z.string().min(1, 'This field is required')
export const positiveNumberSchema = z.number().min(0, 'Must be a positive number')
export const priceSchema = z.number().min(0, 'Price must be 0 or greater')

// User/Staff related schemas
export const userRoles = ['admin', 'manager', 'server', 'counter', 'kitchen'] as const
export const userRoleSchema = z.enum(userRoles)

export const pinSchema = z.string().length(4, 'PIN must be exactly 4 digits').regex(/^\d{4}$/, 'PIN must contain only digits').optional().or(z.literal(''))

export const createUserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').optional().or(z.literal('')), // Optional - auto-generated from email
  email: emailSchema,
  email_confirmation: emailSchema,
  password: passwordSchema.optional().or(z.literal('')), // Optional when using Supabase Auth
  first_name: requiredStringSchema,
  last_name: requiredStringSchema,
  role: userRoleSchema,
  pin: pinSchema,
  location_ids: z.array(z.string()).optional(),
}).refine((data) => data.email === data.email_confirmation, {
  message: "Email addresses don't match",
  path: ["email_confirmation"],
})

export const updateUserSchema = z.object({
  id: z.string().or(z.number()),
  username: requiredStringSchema.min(3, 'Username must be at least 3 characters').optional(),
  email: emailSchema.optional(),
  password: passwordSchema.optional().or(z.literal('')),
  first_name: requiredStringSchema.optional(),
  last_name: requiredStringSchema.optional(),
  role: userRoleSchema.optional(),
  pin: pinSchema,
  location_ids: z.array(z.string()).optional(),
})

// Product related schemas
export const productStatusValues = ['active', 'inactive'] as const
export const productStatusSchema = z.enum(productStatusValues)

export const productTypeValues = ['simple', 'configurable', 'combo'] as const
export const productTypeSchema = z.enum(productTypeValues)

// Dietary type options for products
export const dietaryTypeValues = ['veg', 'non-veg', 'egg', 'vegan'] as const
export const dietaryTypeSchema = z.enum(dietaryTypeValues).optional()

// Dietary type display configuration with colors
export const dietaryTypeConfig = {
  'veg': { label: 'Vegetarian', color: '#22C55E', description: 'Pure vegetarian' },
  'non-veg': { label: 'Non-Vegetarian', color: '#EF4444', description: 'Contains meat/fish' },
  'egg': { label: 'Egg', color: '#EAB308', description: 'Contains egg' },
  'vegan': { label: 'Vegan', color: '#16A34A', description: 'No animal products' },
} as const

export const createProductSchema = z.object({
  name: requiredStringSchema.min(2, 'Product name must be at least 2 characters'),
  description: z.string().optional(),
  price: priceSchema,
  category_id: z.string().or(z.number()).transform(val => String(val)),
  image_url: z.string().optional().or(z.literal('')),
  is_available: z.boolean().default(true),
  preparation_time: z.number().min(0).max(120).default(5), // minutes
  dietary_type: dietaryTypeSchema,
  calorie_count: z.number().min(0).optional(),
  food_allergens: z.string().optional(),
  product_type: productTypeSchema.default('simple'),
  location_ids: z.array(z.string()).optional(),
})

// Option group/item schemas for validation
export const optionItemSchema = z.object({
  name: requiredStringSchema.min(1, 'Option name is required'),
  price_adjustment: z.number().default(0),
  is_default: z.boolean().default(false),
  sort_order: z.number().default(0),
})

export const optionGroupSchema = z.object({
  name: requiredStringSchema.min(1, 'Group name is required'),
  selection_type: z.enum(['single', 'multiple']),
  is_required: z.boolean().default(false),
  min_selections: z.number().min(0).default(0),
  max_selections: z.number().min(0).default(0),
  sort_order: z.number().default(0),
  items: z.array(optionItemSchema).min(1, 'At least one option is required'),
})

export const updateProductSchema = createProductSchema.partial().extend({
  id: z.string().or(z.number()),
})

// Category related schemas
export const createCategorySchema = z.object({
  name: requiredStringSchema.min(2, 'Category name must be at least 2 characters'),
  description: z.string().optional(),
  image_url: z.string().optional().or(z.literal('')),
  sort_order: z.number().min(0).default(0),
})

export const updateCategorySchema = createCategorySchema.partial().extend({
  id: z.string().or(z.number()),
})

// Table related schemas
export const tableStatusValues = ['available', 'occupied', 'reserved', 'maintenance'] as const
export const tableStatusSchema = z.enum(tableStatusValues)

export const floorOptions = ['Ground', '1st Floor', '2nd Floor', '3rd Floor', 'Rooftop', 'Basement', 'Mezzanine'] as const
export const floorSchema = z.string().optional()

export const createTableSchema = z.object({
  table_number: requiredStringSchema.min(1, 'Table number is required'),
  seating_capacity: z.number().min(1, 'Table must have at least 1 seat').max(20, 'Maximum 20 seats per table'),
  status: tableStatusSchema.default('available'),
  floor: floorSchema.default('Ground'),
  location: z.string().optional(),
  location_id: z.string().min(1, 'Location is required'),
})

export const updateTableSchema = createTableSchema.partial().extend({
  id: z.string().or(z.number()),
})

// Order related schemas
export const orderTypeValues = ['dine-in', 'take-away', 'delivery'] as const
export const orderTypeSchema = z.enum(orderTypeValues)

export const orderStatusValues = ['pending', 'confirmed', 'preparing', 'ready', 'served', 'cancelled'] as const
export const orderStatusSchema = z.enum(orderStatusValues)

export const orderItemSchema = z.object({
  product_id: z.number(),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  notes: z.string().optional(),
})

export const createOrderSchema = z.object({
  table_id: z.number().optional(),
  customer_name: z.string().optional(),
  order_type: orderTypeSchema,
  notes: z.string().optional(),
  items: z.array(orderItemSchema).min(1, 'Order must have at least one item'),
})

// Settings schemas
export const posSettingsSchema = z.object({
  restaurant_name: requiredStringSchema,
  address: z.string().optional(),
  phone: z.string().optional(),
  email: emailSchema.optional(),
  tax_rate: z.number().min(0).max(1), // 0.08 for 8%
  currency_symbol: requiredStringSchema.default('$'),
  receipt_footer: z.string().optional(),
  auto_print_receipts: z.boolean().default(false),
  order_timeout_minutes: z.number().min(1).max(120).default(30),
})

// Login schema
export const loginSchema = z.object({
  username: requiredStringSchema,
  password: requiredStringSchema,
})

// Export types
export type CreateUserData = z.infer<typeof createUserSchema>
export type UpdateUserData = z.infer<typeof updateUserSchema>
export type CreateProductData = z.infer<typeof createProductSchema>
export type UpdateProductData = z.infer<typeof updateProductSchema>
export type CreateCategoryData = z.infer<typeof createCategorySchema>
export type UpdateCategoryData = z.infer<typeof updateCategorySchema>
export type CreateTableData = z.infer<typeof createTableSchema>
export type UpdateTableData = z.infer<typeof updateTableSchema>
export type CreateOrderData = z.infer<typeof createOrderSchema>
export type LoginData = z.infer<typeof loginSchema>
export type POSSettingsData = z.infer<typeof posSettingsSchema>
export type OptionGroupData = z.infer<typeof optionGroupSchema>
export type OptionItemData = z.infer<typeof optionItemSchema>
