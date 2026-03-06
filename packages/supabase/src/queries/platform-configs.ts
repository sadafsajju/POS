import { getSupabase } from '../client'
import { wrapMany, wrapOne, type ApiResponse } from '../helpers'
import type { Database } from '../types'

type PlatformConfigRow = Database['public']['Tables']['platform_configs']['Row']
type PlatformConfigInsert = Database['public']['Tables']['platform_configs']['Insert']

export async function getPlatformConfigs(): Promise<ApiResponse<PlatformConfigRow[]>> {
  const sb = getSupabase()
  const { data, error } = await sb.from('platform_configs').select('*')
  return wrapMany(data, error)
}

export async function getPlatformConfig(platform: string): Promise<ApiResponse<PlatformConfigRow>> {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('platform_configs')
    .select('*')
    .eq('platform', platform as any)
    .single()
  return wrapOne(data, error, 'Platform config')
}

export async function upsertPlatformConfig(config: PlatformConfigInsert): Promise<ApiResponse<PlatformConfigRow>> {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('platform_configs')
    .upsert(config, { onConflict: 'org_id,platform' })
    .select()
    .single()
  return wrapOne(data, error, 'Platform config')
}

export async function deletePlatformConfig(platform: string): Promise<ApiResponse<null>> {
  const sb = getSupabase()
  const { error } = await sb.from('platform_configs').delete().eq('platform', platform as any)
  if (error) return { success: false, message: error.message, error: error.code }
  return { success: true, message: 'Platform config deleted' }
}
