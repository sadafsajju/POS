import { getSupabase } from '../client'
import { wrapMany, wrapOne, paginationRange, type ApiResponse } from '../helpers'
import type { Database } from '../types'

type VariationGroupRow = Database['public']['Tables']['variation_groups']['Row']
type VariationGroupInsert = Database['public']['Tables']['variation_groups']['Insert']
type VariationGroupUpdate = Database['public']['Tables']['variation_groups']['Update']
type VariationItemRow = Database['public']['Tables']['variation_items']['Row']
type VariationItemInsert = Database['public']['Tables']['variation_items']['Insert']

export async function getVariationGroups(params?: {
  page?: number
  per_page?: number
  search?: string
}): Promise<ApiResponse<(VariationGroupRow & { items: VariationItemRow[] })[]>> {
  const sb = getSupabase()
  let query = sb.from('variation_groups').select('*, variation_items(*)', { count: 'exact' })

  if (params?.search) {
    query = query.ilike('name', `%${params.search}%`)
  }

  query = query.order('sort_order', { ascending: true })

  if (params?.page && params?.per_page) {
    const { from, to } = paginationRange(params.page, params.per_page)
    query = query.range(from, to)
  }

  const { data, error, count } = await query
  return wrapMany(data as any, error, count, params?.page, params?.per_page)
}

export async function getVariationGroupById(id: string): Promise<ApiResponse<VariationGroupRow & { items: VariationItemRow[] }>> {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('variation_groups')
    .select('*, variation_items(*)')
    .eq('id', id)
    .single()
  return wrapOne(data as any, error, 'Variation group')
}

export async function createVariationGroup(group: VariationGroupInsert): Promise<ApiResponse<VariationGroupRow>> {
  const sb = getSupabase()
  const { data, error } = await sb.from('variation_groups').insert(group).select().single()
  return wrapOne(data, error, 'Variation group')
}

export async function updateVariationGroup(id: string, updates: VariationGroupUpdate): Promise<ApiResponse<VariationGroupRow>> {
  const sb = getSupabase()
  const { data, error } = await sb.from('variation_groups').update(updates).eq('id', id).select().single()
  return wrapOne(data, error, 'Variation group')
}

export async function deleteVariationGroup(id: string): Promise<ApiResponse<null>> {
  const sb = getSupabase()
  const { error } = await sb.from('variation_groups').delete().eq('id', id)
  if (error) return { success: false, message: error.message, error: error.code }
  return { success: true, message: 'Variation group deleted' }
}

export async function createVariationItem(groupId: string, item: Omit<VariationItemInsert, 'variation_group_id'>): Promise<ApiResponse<VariationItemRow>> {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('variation_items')
    .insert({ ...item, variation_group_id: groupId })
    .select()
    .single()
  return wrapOne(data, error, 'Variation item')
}

export async function deleteVariationItem(itemId: string): Promise<ApiResponse<null>> {
  const sb = getSupabase()
  const { error } = await sb.from('variation_items').delete().eq('id', itemId)
  if (error) return { success: false, message: error.message, error: error.code }
  return { success: true, message: 'Variation item deleted' }
}
