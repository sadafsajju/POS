import { getSupabase } from './client'
import type { Session, AuthChangeEvent } from '@supabase/supabase-js'

export async function signInWithPassword(email: string, password: string) {
  const supabase = getSupabase()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { success: false as const, error: error.message }
  return { success: true as const, session: data.session, user: data.user }
}

export async function signUp(email: string, password: string, metadata?: Record<string, unknown>) {
  const supabase = getSupabase()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: metadata },
  })
  if (error) return { success: false as const, error: error.message }
  return { success: true as const, session: data.session, user: data.user }
}

export async function signOut() {
  const supabase = getSupabase()
  const { error } = await supabase.auth.signOut()
  if (error) return { success: false as const, error: error.message }
  return { success: true as const }
}

export async function getSession() {
  const supabase = getSupabase()
  const { data, error } = await supabase.auth.getSession()
  if (error) return { success: false as const, error: error.message }
  return { success: true as const, session: data.session }
}

export async function getAccessToken(): Promise<string | null> {
  const supabase = getSupabase()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

export function onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
  const supabase = getSupabase()
  return supabase.auth.onAuthStateChange(callback)
}

/**
 * Extract POS user claims from a Supabase JWT session.
 * These are injected by the custom_access_token_hook database function.
 */
export function extractUserClaims(session: Session | null) {
  if (!session?.user) return null
  const meta = session.user.app_metadata || {}
  return {
    org_id: meta.org_id as string | undefined,
    role: meta.role as string | undefined,
    location_id: meta.location_id as string | undefined,
    user_id: meta.user_id as string | undefined,
    tenant_id: meta.tenant_id as string | undefined,
  }
}

export type { Session, AuthChangeEvent }
