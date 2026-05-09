import { getSupabase } from '../client'
import { wrapMany, wrapOne, wrapRpc, paginationRange, type ApiResponse } from '../helpers'
import type { Database, Json } from '../types'

type OrderRow = Database['public']['Tables']['orders']['Row']

export async function getOrders(params?: {
  page?: number
  per_page?: number
  status?: string
  order_type?: string
  table_id?: string
  date_from?: string
  date_to?: string
}): Promise<ApiResponse<OrderRow[]>> {
  const sb = getSupabase()
  let query = sb.from('orders').select('*, table:dining_tables(id, table_number), order_items(*, products(id, name, image_url))', { count: 'exact' })

  if (params?.status) {
    query = query.eq('status', params.status as any)
  }
  if (params?.order_type) {
    query = query.eq('order_type', params.order_type as any)
  }
  if (params?.table_id) {
    query = query.eq('table_id', params.table_id)
  }
  if (params?.date_from) {
    query = query.gte('created_at', params.date_from)
  }
  if (params?.date_to) {
    query = query.lte('created_at', params.date_to)
  }

  query = query.order('created_at', { ascending: false })

  if (params?.page && params?.per_page) {
    const { from, to } = paginationRange(params.page, params.per_page)
    query = query.range(from, to)
  }

  const { data, error, count } = await query
  // Remap PostgREST relation names to match Order type
  if (data) {
    for (const order of data as any[]) {
      if (order.order_items) {
        order.items = order.order_items.map((oi: any) => ({
          ...oi,
          product: oi.products, // Remap nested 'products' → 'product'
        }))
        delete order.order_items
      }
    }
  }
  return wrapMany(data as any, error, count, params?.page, params?.per_page)
}

export async function getOrderById(id: string): Promise<ApiResponse<OrderRow>> {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('orders')
    .select('*, order_items(*, products(id, name, image_url)), payments(*, processed_by_user:users!processed_by(id, username, first_name))')
    .eq('id', id)
    .single()
  // Remap PostgREST relation name 'order_items' → 'items' to match Order type
  if (data && (data as any).order_items) {
    const mapped = data as any
    mapped.items = mapped.order_items.map((oi: any) => ({
      ...oi,
      product: oi.products, // Remap nested 'products' → 'product'
    }))
    delete mapped.order_items
  }
  return wrapOne(data as any, error, 'Order')
}

export async function deleteOrder(id: string): Promise<ApiResponse<null>> {
  const sb = getSupabase()
  const { error } = await sb.from('orders').delete().eq('id', id)
  if (error) return { success: false, message: error.message, error: error.code }
  return { success: true, message: 'Order deleted' }
}

// Complex operations via RPC
export async function recordTip(params: {
  order_id: string
  amount: number
  method: 'cash' | 'card' | 'other'
}): Promise<ApiResponse<any>> {
  const sb = getSupabase()
  const { data, error } = await sb.rpc('record_tip', {
    p_order_id: params.order_id,
    p_amount: params.amount,
    p_method: params.method,
  })
  return wrapRpc(data, error)
}

export async function getTipPool(params: {
  period_start: string
  period_end: string
  location_id?: string | null
}): Promise<ApiResponse<any>> {
  const sb = getSupabase()
  const { data, error } = await sb.rpc('get_tip_pool', {
    p_period_start: params.period_start,
    p_period_end: params.period_end,
    p_location_id: params.location_id ?? null,
  })
  if (error) return { success: false, message: error.message, error: error.code }
  const inner = (data as any)?.data ?? data
  return { success: true, message: 'Success', data: inner }
}

export async function allocateTips(params: {
  period_start: string
  period_end: string
  method: 'equal' | 'hours_weighted' | 'manual'
  allocations: Array<{ user_id: string; amount: number; hours_worked?: number; notes?: string }>
  location_id?: string | null
  notes?: string | null
}): Promise<ApiResponse<any>> {
  const sb = getSupabase()
  const { data, error } = await sb.rpc('allocate_tips', {
    p_period_start: params.period_start,
    p_period_end: params.period_end,
    p_method: params.method,
    p_allocations: params.allocations as any,
    p_location_id: params.location_id ?? null,
    p_notes: params.notes ?? null,
  })
  return wrapRpc(data, error)
}

export async function createOrder(params: {
  table_id?: string | null
  customer_id?: string | null
  customer_name?: string | null
  order_type: string
  items: Json
  notes?: string | null
  parent_order_id?: string | null
  create_as_kot?: boolean
  order_source?: string
  initial_status?: string | null
  dining_mode?: string | null
  allergens_confirmed?: boolean
  allergens_acknowledged_codes?: string[] | null
}): Promise<ApiResponse<any>> {
  const sb = getSupabase()
  const { data, error } = await sb.rpc('create_order', {
    p_table_id: params.table_id ?? null,
    p_customer_id: params.customer_id ?? null,
    p_customer_name: params.customer_name ?? null,
    p_order_type: params.order_type,
    p_items: params.items,
    p_notes: params.notes ?? null,
    p_parent_order_id: params.parent_order_id ?? null,
    p_create_as_kot: params.create_as_kot ?? false,
    p_order_source: params.order_source ?? 'pos',
    p_initial_status: params.initial_status ?? null,
    p_dining_mode: params.dining_mode ?? null,
    p_allergens_confirmed: params.allergens_confirmed ?? false,
    p_allergens_acknowledged_codes: params.allergens_acknowledged_codes ?? null,
  })
  return wrapRpc(data, error)
}

export async function updateOrderStatus(
  orderId: string,
  status: string,
  notes?: string | null
): Promise<ApiResponse<any>> {
  const sb = getSupabase()
  const { data, error } = await sb.rpc('update_order_status', {
    p_order_id: orderId,
    p_new_status: status,
    p_notes: notes ?? null,
  })
  return wrapRpc(data, error)
}

export async function getKitchenOrders(status?: string): Promise<ApiResponse<OrderRow[]>> {
  const sb = getSupabase()
  // !inner join excludes bills that have no direct items (KOT mode attaches items to the KOT, not the bill).
  // Includes 'pending' because KOTs are created with that default status.
  // Aliased `table:dining_tables(...)` so the frontend can read `order.table.table_number`.
  const selectCols = '*, table:dining_tables(id, table_number), created_by_user:users!user_id(id, username, first_name), order_items!inner(*, products(id, name, image_url))'
  let query = sb
    .from('orders')
    .select(selectCols)
    .in('status', ['pending', 'confirmed', 'preparing', 'ready'])

  if (status && status !== 'all') {
    query = sb
      .from('orders')
      .select(selectCols)
      .eq('status', status as any)
  }

  query = query.order('created_at', { ascending: true })
  const { data, error } = await query
  if (error) return wrapMany(null as any, error)

  // KOTs have token_number = NULL; fetch their parent bills' tokens in a second query.
  // (PostgREST self-referential embeds are unreliable; a batch .in() lookup is simpler.)
  const parentIds = Array.from(
    new Set((data || []).map((o: any) => o.parent_order_id).filter(Boolean)),
  ) as string[]
  const parentTokenMap = new Map<string, number | null>()
  if (parentIds.length > 0) {
    const { data: parents } = await sb
      .from('orders')
      .select('id, token_number')
      .in('id', parentIds)
    for (const p of parents || []) {
      parentTokenMap.set((p as any).id, (p as any).token_number)
    }
  }

  // Remap PostgREST relation 'order_items' → 'items' and nested 'products' → 'product'.
  // Attach parent_order.token_number so KOT cards can display the customer-facing token.
  const mapped = data?.map((order: any) => ({
    ...order,
    items: (order.order_items || []).map((oi: any) => ({
      ...oi,
      product: oi.products,
    })),
    parent_order: order.parent_order_id
      ? { token_number: parentTokenMap.get(order.parent_order_id) ?? null }
      : null,
  }))
  return wrapMany(mapped as any, error)
}

export async function updateOrderItemStatus(
  orderId: string,
  itemId: string,
  status: string
): Promise<ApiResponse<null>> {
  const sb = getSupabase()
  const { error } = await sb
    .from('order_items')
    .update({ status: status as any })
    .eq('id', itemId)
    .eq('order_id', orderId)
  if (error) return { success: false, message: error.message, error: error.code }
  return { success: true, message: 'Item status updated' }
}

export async function getAggregatorOrders(params?: {
  status?: string
  platform?: string
}): Promise<ApiResponse<OrderRow[]>> {
  const sb = getSupabase()
  let query = sb
    .from('orders')
    .select('*, order_items(*)')
    .in('order_source', ['swiggy', 'zomato'])

  if (params?.status) {
    query = query.eq('status', params.status as any)
  }
  if (params?.platform) {
    query = query.eq('order_source', params.platform as any)
  }

  query = query.order('created_at', { ascending: false })
  const { data, error } = await query
  return wrapMany(data as any, error)
}

export async function getBillSummary(orderId: string): Promise<ApiResponse<any>> {
  const sb = getSupabase()
  const { data, error } = await sb.rpc('get_bill_summary', { p_order_id: orderId })
  if (error) return { success: false, message: error.message, error: error.code }
  // The RPC returns { success, data: { bill, kots, ... } } — unwrap the inner data so callers
  // can read summary.kots directly (matches the shape used by getActiveBillForTable).
  const inner = (data as any)?.data ?? data
  return { success: true, message: 'Success', data: inner }
}

export async function clearTable(tableId: string): Promise<ApiResponse<any>> {
  const sb = getSupabase()
  const { data, error } = await sb.rpc('clear_table', { p_table_id: tableId })
  return wrapRpc(data, error)
}

export async function transferTable(fromTableId: string, toTableId: string): Promise<ApiResponse<any>> {
  const sb = getSupabase()
  const { data, error } = await sb.rpc('transfer_table', {
    p_from_table_id: fromTableId,
    p_to_table_id: toTableId,
  })
  return wrapRpc(data, error)
}
