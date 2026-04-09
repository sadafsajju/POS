import { getSupabase } from '../client'
import { type ApiResponse } from '../helpers'

export async function getSettings(): Promise<ApiResponse<Record<string, string>>> {
  const sb = getSupabase()

  // Debug: check if user is authenticated
  const { data: sessionData } = await sb.auth.getSession()
  console.log('[getSettings] session:', sessionData?.session ? 'active' : 'none', 'user:', sessionData?.session?.user?.id)

  const { data, error } = await sb.from('settings').select('key, value')

  console.log('[getSettings] result:', { data, error, rowCount: data?.length })

  if (error) return { success: false, message: error.message, error: error.code }

  // Convert array of {key, value} to a Record
  const settings: Record<string, string> = {}
  for (const row of data || []) {
    settings[row.key] = row.value
  }

  return { success: true, message: 'Success', data: settings }
}

export async function getSetting(key: string): Promise<ApiResponse<{ key: string; value: string }>> {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('settings')
    .select('key, value')
    .eq('key', key)
    .single()

  if (error) return { success: false, message: error.message, error: error.code }
  return { success: true, message: 'Success', data: data as { key: string; value: string } }
}

export async function updateSettings(settings: Record<string, string>): Promise<ApiResponse<Record<string, string>>> {
  const sb = getSupabase()

  // Get org_id from existing settings first
  const { data: existing } = await sb.from('settings').select('org_id').limit(1).single()
  const orgId = existing?.org_id

  if (!orgId) {
    return { success: false, message: 'Organization not found', error: 'NO_ORG' }
  }

  for (const [key, value] of Object.entries(settings)) {
    // Try update first, then insert if no row exists
    const { data: updated, error: updateError } = await sb
      .from('settings')
      .update({ value })
      .eq('org_id', orgId)
      .eq('key', key)
      .is('location_id', null)
      .select('id')

    if (updateError) {
      return { success: false, message: updateError.message, error: updateError.code }
    }

    // If no row was updated, insert a new one
    if (!updated || updated.length === 0) {
      const { error: insertError } = await sb
        .from('settings')
        .insert({ key, value, org_id: orgId })

      if (insertError) {
        return { success: false, message: insertError.message, error: insertError.code }
      }
    }
  }

  // Return all settings after update
  return getSettings()
}
