import { getSupabase } from '../client'
import type { ApiResponse } from '../helpers'

export interface TrialStatus {
  tenant_id: string
  plan: string
  subscription_status: string
  trial_ends_at: string | null
  is_trial_expired: boolean
  days_remaining: number
}

export async function checkTrialStatus(): Promise<ApiResponse<TrialStatus>> {
  const sb = getSupabase()
  const { data, error } = await sb.rpc('check_trial_status')

  if (error) return { success: false, message: error.message, error: error.code }

  const rpcResult = data as any
  if (rpcResult?.success === false) {
    return { success: false, message: rpcResult.message || 'Failed to check trial' }
  }

  return {
    success: true,
    message: 'Success',
    data: rpcResult?.data || rpcResult,
  }
}
