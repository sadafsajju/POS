export { createSupabaseClient, getSupabase } from './client'
export type { SupabaseClient } from './client'
export type { Database, Json } from './types'
export {
  signInWithPassword,
  signUp,
  signOut,
  getSession,
  getAccessToken,
  onAuthStateChange,
  extractUserClaims,
} from './auth'
export type { Session, AuthChangeEvent } from './auth'
export type { ApiResponse } from './helpers'
export { wrapOne, wrapMany, wrapRpc, paginationRange } from './helpers'

// Query modules — direct Supabase PostgREST access
export {
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
  optionsDb,
  variationsDb,
  combosDb,
  setupDb,
  tenantsDb,
  mediaDb,
} from './queries'

// Realtime subscriptions
export {
  subscribeToOrders,
  subscribeToOrderItems,
  subscribeToTables,
  unsubscribe,
} from './realtime'

// Storage helpers
export {
  getStorageUrl,
  resolveImageUrl,
  uploadFile,
  deleteFile,
} from './storage'
