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
  let query = sb.from('orders').select('*, order_items(*)', { count: 'exact' })

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
  return wrapMany(data as any, error, count, params?.page, params?.per_page)
}

export async function getOrderById(id: string): Promise<ApiResponse<OrderRow>> {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('orders')
    .select('*, order_items(*, products(id, name, image_url))')
    .eq('id', id)
    .single()
  return wrapOne(data as any, error, 'Order')
}

export async function deleteOrder(id: string): Promise<ApiResponse<null>> {
  const sb = getSupabase()
  const { error } = await sb.from('orders').delete().eq('id', id)
  if (error) return { success: false, message: error.message, error: error.code }
  return { success: true, message: 'Order deleted' }
}

// Complex operations via RPC
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
  let query = sb
    .from('orders')
    .select('*, order_items(*, products(id, name, image_url))')
    .in('status', ['confirmed', 'preparing', 'ready'])
    .eq('is_kot', false)

  if (status && status !== 'all') {
    query = sb
      .from('orders')
      .select('*, order_items(*, products(id, name, image_url))')
      .eq('status', status as any)
      .eq('is_kot', false)
  }

  query = query.order('created_at', { ascending: true })
  const { data, error } = await query
  return wrapMany(data as any, error)
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
  return wrapRpc(data, error)
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
