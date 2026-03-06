import { getSupabase } from '../client'
import { wrapMany, wrapOne, type ApiResponse } from '../helpers'
import type { Database } from '../types'

type LocationRow = Database['public']['Tables']['locations']['Row']
type LocationInsert = Database['public']['Tables']['locations']['Insert']
type LocationUpdate = Database['public']['Tables']['locations']['Update']

export async function getLocations(): Promise<ApiResponse<LocationRow[]>> {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('locations')
    .select('*')
    .order('name', { ascending: true })
  return wrapMany(data, error)
}

export async function getLocationById(id: string): Promise<ApiResponse<LocationRow>> {
  const sb = getSupabase()
  const { data, error } = await sb.from('locations').select('*').eq('id', id).single()
  return wrapOne(data, error, 'Location')
}

export async function createLocation(location: LocationInsert): Promise<ApiResponse<LocationRow>> {
  const sb = getSupabase()
  const { data, error } = await sb.from('locations').insert(location).select().single()
  return wrapOne(data, error, 'Location')
}

export async function updateLocation(id: string, updates: LocationUpdate): Promise<ApiResponse<LocationRow>> {
  const sb = getSupabase()
  const { data, error } = await sb.from('locations').update(updates).eq('id', id).select().single()
  return wrapOne(data, error, 'Location')
}

export async function deleteLocation(id: string): Promise<ApiResponse<null>> {
  const sb = getSupabase()
  const { error } = await sb.from('locations').delete().eq('id', id)
  if (error) return { success: false, message: error.message, error: error.code }
  return { success: true, message: 'Location deleted' }
}
