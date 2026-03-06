import { getSupabase } from '../client'
import { wrapMany, wrapOne, type ApiResponse } from '../helpers'
import type { Database } from '../types'

type OptionGroupRow = Database['public']['Tables']['product_option_groups']['Row']
type OptionGroupInsert = Database['public']['Tables']['product_option_groups']['Insert']
type OptionGroupUpdate = Database['public']['Tables']['product_option_groups']['Update']
type OptionItemRow = Database['public']['Tables']['product_option_items']['Row']
type OptionItemInsert = Database['public']['Tables']['product_option_items']['Insert']
type OptionItemUpdate = Database['public']['Tables']['product_option_items']['Update']

// Option Groups
export async function getOptionGroups(productId: string): Promise<ApiResponse<(OptionGroupRow & { items: OptionItemRow[] })[]>> {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('product_option_groups')
    .select('*, product_option_items(*)')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true })
  return wrapMany(data as any, error)
}

export async function createOptionGroup(productId: string, group: Omit<OptionGroupInsert, 'product_id'>): Promise<ApiResponse<OptionGroupRow>> {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('product_option_groups')
    .insert({ ...group, product_id: productId })
    .select()
    .single()
  return wrapOne(data, error, 'Option group')
}

export async function updateOptionGroup(groupId: string, updates: OptionGroupUpdate): Promise<ApiResponse<OptionGroupRow>> {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('product_option_groups')
    .update(updates)
    .eq('id', groupId)
    .select()
    .single()
  return wrapOne(data, error, 'Option group')
}

export async function deleteOptionGroup(groupId: string): Promise<ApiResponse<null>> {
  const sb = getSupabase()
  const { error } = await sb.from('product_option_groups').delete().eq('id', groupId)
  if (error) return { success: false, message: error.message, error: error.code }
  return { success: true, message: 'Option group deleted' }
}

// Option Items
export async function createOptionItem(groupId: string, item: Omit<OptionItemInsert, 'option_group_id'>): Promise<ApiResponse<OptionItemRow>> {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('product_option_items')
    .insert({ ...item, option_group_id: groupId })
    .select()
    .single()
  return wrapOne(data, error, 'Option item')
}

export async function updateOptionItem(itemId: string, updates: OptionItemUpdate): Promise<ApiResponse<OptionItemRow>> {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('product_option_items')
    .update(updates)
    .eq('id', itemId)
    .select()
    .single()
  return wrapOne(data, error, 'Option item')
}

export async function deleteOptionItem(itemId: string): Promise<ApiResponse<null>> {
  const sb = getSupabase()
  const { error } = await sb.from('product_option_items').delete().eq('id', itemId)
  if (error) return { success: false, message: error.message, error: error.code }
  return { success: true, message: 'Option item deleted' }
}
