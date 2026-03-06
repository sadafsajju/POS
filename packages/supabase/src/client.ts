import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types'

let supabaseInstance: SupabaseClient<Database> | null = null

export function createSupabaseClient(
  url: string,
  anonKey: string
): SupabaseClient<Database> {
  if (supabaseInstance) return supabaseInstance

  supabaseInstance = createClient<Database>(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  })

  return supabaseInstance
}

export function getSupabase(): SupabaseClient<Database> {
  if (!supabaseInstance) {
    throw new Error(
      'Supabase client not initialized. Call createSupabaseClient() first.'
    )
  }
  return supabaseInstance
}

export type { SupabaseClient }
