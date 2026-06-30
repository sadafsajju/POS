import { getSupabase } from '../client'

/**
 * Record/refresh this device's app-version heartbeat via the record_app_client
 * RPC. The DB stamps org/location/user from the JWT; the client only supplies
 * its own device id, version and platform. Fire-and-forget — never throws.
 */
export async function recordAppClient(params: {
  device_id: string
  app_version: string
  platform?: string | null
}): Promise<{ success: boolean; error?: string }> {
  const sb = getSupabase()
  // Cast: record_app_client isn't in the generated Database types until
  // supabase:gen-types is re-run after this migration is applied.
  const { error } = await (sb.rpc as any)('record_app_client', {
    p_device_id: params.device_id,
    p_app_version: params.app_version,
    p_platform: params.platform ?? null,
  })
  if (error) return { success: false, error: error.message }
  return { success: true }
}
