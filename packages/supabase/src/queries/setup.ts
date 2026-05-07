import { getSupabase } from '../client'
import { type ApiResponse } from '../helpers'

export async function checkSetupStatus(): Promise<ApiResponse<{
  needs_setup: boolean
  has_admin: boolean
  total_users: number
  admin_count: number
}>> {
  const sb = getSupabase()

  // Use the check_setup_status RPC function — it's granted to anon
  // so it works before any user is authenticated
  const { data, error } = await sb.rpc('check_setup_status')

  if (error) return { success: false, message: error.message, error: error.code }

  // The RPC returns { success, data: { needs_setup, has_admin, total_users } }
  const rpcResult = data as any
  const inner = rpcResult?.data || rpcResult

  return {
    success: true,
    message: 'Success',
    data: {
      needs_setup: inner?.needs_setup ?? true,
      has_admin: inner?.has_admin ?? false,
      total_users: inner?.total_users ?? 0,
      admin_count: inner?.total_users ?? 0,
    },
  }
}

export interface InitialSetupParams {
  username: string
  email: string
  password: string
  first_name: string
  last_name: string
  pin?: string
  store_name: string
  location_name: string
  location_code: string
  currency: string
  currency_symbol: string
  tax_rate: string
}

export async function performInitialSetup(params: InitialSetupParams): Promise<ApiResponse<{
  org_id: string
  location_id: string
  user_id: string
}>> {
  const sb = getSupabase()

  // Step 1: Create Supabase Auth user
  const { data: authData, error: authError } = await sb.auth.signUp({
    email: params.email,
    password: params.password,
    options: {
      data: {
        first_name: params.first_name,
        last_name: params.last_name,
      },
    },
  })

  if (authError) return { success: false, message: authError.message, error: authError.code }
  if (!authData.user) return { success: false, message: 'Failed to create auth user' }
  // Supabase returns a user with empty identities[] when the email already
  // exists (anti-enumeration behaviour). Surface that as a structured error
  // so the UI can route the user to /login.
  if ((authData.user.identities?.length ?? 0) === 0) {
    return {
      success: false,
      message: 'A user with this email already exists.',
      error: 'user_already_exists',
    }
  }

  // Step 2: Call the initial_setup RPC to create org, location, user record, settings
  const { data, error } = await sb.rpc('initial_setup', {
    p_auth_user_id: authData.user.id,
    p_username: params.username,
    p_email: params.email,
    p_first_name: params.first_name,
    p_last_name: params.last_name,
    p_pin: params.pin || null,
    p_store_name: params.store_name,
    p_location_name: params.location_name,
    p_location_code: params.location_code,
    p_currency: params.currency,
    p_currency_symbol: params.currency_symbol,
    p_tax_rate: params.tax_rate,
  } as any)

  if (error) return { success: false, message: error.message, error: error.code }

  const rpcResult = data as any
  if (rpcResult?.success === false) {
    return { success: false, message: rpcResult.message || 'Setup failed' }
  }
  const inner = rpcResult?.data || rpcResult

  // Step 3: Sign in so the user has an active session after setup
  await sb.auth.signInWithPassword({
    email: params.email,
    password: params.password,
  })

  return {
    success: true,
    message: 'Setup complete',
    data: {
      org_id: inner?.org_id,
      location_id: inner?.location_id,
      user_id: inner?.user_id,
    },
  }
}
