import { getSupabase } from '../client'
import { type ApiResponse, wrapMany, wrapOne } from '../helpers'
import type { Database } from '../types'

type Discount = Database['public']['Tables']['discounts']['Row']
type DiscountInsert = Database['public']['Tables']['discounts']['Insert']
type DiscountUpdate = Database['public']['Tables']['discounts']['Update']

/** All discounts for the current org, ordered for the admin list. */
export async function listDiscounts(): Promise<ApiResponse<Discount[]>> {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('discounts')
    .select('*')
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })
  return wrapMany<Discount>((data as any) ?? null, error)
}

/** Only active discounts — used by the payment-overlay chip row. */
export async function listActiveDiscounts(): Promise<ApiResponse<Discount[]>> {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('discounts')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })
  return wrapMany<Discount>((data as any) ?? null, error)
}

async function getOrgIdFromSession(): Promise<string | null> {
  const sb = getSupabase()
  const { data } = await sb.auth.getSession()
  const claims = data.session?.user?.app_metadata as { org_id?: string } | undefined
  return claims?.org_id ?? null
}

async function nextDisplayOrder(orgId: string): Promise<number> {
  const sb = getSupabase()
  const { data } = await sb
    .from('discounts')
    .select('display_order')
    .eq('org_id', orgId)
    .order('display_order', { ascending: false })
    .limit(1)
    .single()
  return ((data as any)?.display_order ?? -1) + 1
}

export async function createDiscount(input: {
  name: string
  percent: number
}): Promise<ApiResponse<Discount>> {
  const sb = getSupabase()
  const orgId = await getOrgIdFromSession()
  if (!orgId) return { success: false, message: 'Not signed in' }

  const row: DiscountInsert = {
    org_id: orgId,
    name: input.name.trim(),
    percent: clampPercent(input.percent),
    display_order: await nextDisplayOrder(orgId),
    is_active: true,
  }

  const { data, error } = await sb
    .from('discounts')
    .insert(row as any)
    .select('*')
    .single()
  return wrapOne<Discount>(data as any, error, 'Discount')
}

export async function updateDiscount(
  id: string,
  patch: { name?: string; percent?: number; is_active?: boolean },
): Promise<ApiResponse<Discount>> {
  const sb = getSupabase()
  const update: DiscountUpdate = {}
  if (patch.name !== undefined) update.name = patch.name.trim()
  if (patch.percent !== undefined) update.percent = clampPercent(patch.percent)
  if (patch.is_active !== undefined) update.is_active = patch.is_active

  const { data, error } = await sb
    .from('discounts')
    .update(update as any)
    .eq('id', id)
    .select('*')
    .single()
  return wrapOne<Discount>(data as any, error, 'Discount')
}

export async function deleteDiscount(id: string): Promise<ApiResponse<null>> {
  const sb = getSupabase()
  const { error } = await sb.from('discounts').delete().eq('id', id)
  if (error) return { success: false, message: error.message }
  return { success: true, message: 'Deleted', data: null }
}

/** Flip is_active. */
export async function toggleDiscount(id: string): Promise<ApiResponse<Discount>> {
  const sb = getSupabase()
  const { data: current, error: readError } = await sb
    .from('discounts')
    .select('is_active')
    .eq('id', id)
    .single()
  if (readError) return { success: false, message: readError.message }

  const { data, error } = await sb
    .from('discounts')
    .update({ is_active: !(current as any).is_active } as any)
    .eq('id', id)
    .select('*')
    .single()
  return wrapOne<Discount>(data as any, error, 'Discount')
}

/** Bulk reorder (sequential updates for simplicity — list is small). */
export async function reorderDiscounts(
  items: { id: string; display_order: number }[],
): Promise<ApiResponse<null>> {
  const sb = getSupabase()
  const errors: string[] = []
  for (const item of items) {
    const { error } = await sb
      .from('discounts')
      .update({ display_order: item.display_order } as any)
      .eq('id', item.id)
    if (error) errors.push(error.message)
  }
  if (errors.length) return { success: false, message: errors.join('; ') }
  return { success: true, message: 'Reordered', data: null }
}

function clampPercent(p: number): number {
  if (Number.isNaN(p)) return 0
  return Math.max(0, Math.min(100, Number(p.toFixed(2))))
}
