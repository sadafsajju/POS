import { getSupabase } from '../client'
import { wrapMany, wrapOne, type ApiResponse } from '../helpers'
import type { Database } from '../types'

type ComboSlotRow = Database['public']['Tables']['combo_slots']['Row']
type ComboSlotInsert = Database['public']['Tables']['combo_slots']['Insert']
type ComboSlotUpdate = Database['public']['Tables']['combo_slots']['Update']
type ComboSlotChoiceRow = Database['public']['Tables']['combo_slot_choices']['Row']
type ComboSlotChoiceInsert = Database['public']['Tables']['combo_slot_choices']['Insert']

export async function getComboSlots(productId: string): Promise<ApiResponse<(ComboSlotRow & { choices: ComboSlotChoiceRow[] })[]>> {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('combo_slots')
    .select('*, combo_slot_choices(*, products(id, name, price, image_url))')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true })
  return wrapMany(data as any, error)
}

export async function createComboSlot(productId: string, slot: Omit<ComboSlotInsert, 'product_id'>): Promise<ApiResponse<ComboSlotRow>> {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('combo_slots')
    .insert({ ...slot, product_id: productId })
    .select()
    .single()
  return wrapOne(data, error, 'Combo slot')
}

export async function updateComboSlot(slotId: string, updates: ComboSlotUpdate): Promise<ApiResponse<ComboSlotRow>> {
  const sb = getSupabase()
  const { data, error } = await sb.from('combo_slots').update(updates).eq('id', slotId).select().single()
  return wrapOne(data, error, 'Combo slot')
}

export async function deleteComboSlot(slotId: string): Promise<ApiResponse<null>> {
  const sb = getSupabase()
  const { error } = await sb.from('combo_slots').delete().eq('id', slotId)
  if (error) return { success: false, message: error.message, error: error.code }
  return { success: true, message: 'Combo slot deleted' }
}

export async function createComboSlotChoice(slotId: string, choice: Omit<ComboSlotChoiceInsert, 'combo_slot_id'>): Promise<ApiResponse<ComboSlotChoiceRow>> {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('combo_slot_choices')
    .insert({ ...choice, combo_slot_id: slotId })
    .select()
    .single()
  return wrapOne(data, error, 'Combo slot choice')
}

export async function deleteComboSlotChoice(choiceId: string): Promise<ApiResponse<null>> {
  const sb = getSupabase()
  const { error } = await sb.from('combo_slot_choices').delete().eq('id', choiceId)
  if (error) return { success: false, message: error.message, error: error.code }
  return { success: true, message: 'Combo slot choice deleted' }
}
