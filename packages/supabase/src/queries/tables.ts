import { getSupabase } from '../client'
import { wrapMany, wrapOne, paginationRange, type ApiResponse } from '../helpers'
import type { Database } from '../types'

type TableRow = Database['public']['Tables']['dining_tables']['Row']
type TableInsert = Database['public']['Tables']['dining_tables']['Insert']
type TableUpdate = Database['public']['Tables']['dining_tables']['Update']

export async function getTables(params?: {
  page?: number
  per_page?: number
  search?: string
  status?: string
  location_id?: string
}): Promise<ApiResponse<TableRow[]>> {
  const sb = getSupabase()
  let query = sb.from('dining_tables').select('*', { count: 'exact' })

  if (params?.status) {
    query = query.eq('status', params.status as any)
  }
  if (params?.location_id) {
    query = query.eq('location_id', params.location_id)
  }
  if (params?.search) {
    query = query.ilike('table_number', `%${params.search}%`)
  }

  query = query.order('table_number', { ascending: true })

  if (params?.page && params?.per_page) {
    const { from, to } = paginationRange(params.page, params.per_page)
    query = query.range(from, to)
  }

  const { data, error, count } = await query
  return wrapMany(data, error, count, params?.page, params?.per_page)
}

export async function getTableById(id: string): Promise<ApiResponse<TableRow>> {
  const sb = getSupabase()
  const { data, error } = await sb.from('dining_tables').select('*').eq('id', id).single()
  return wrapOne(data, error, 'Table')
}

export async function getTableStatus(): Promise<ApiResponse<{
  total: number
  available: number
  occupied: number
  reserved: number
}>> {
  const sb = getSupabase()
  const { data, error } = await sb.from('dining_tables').select('status')
  if (error) return { success: false, message: error.message, error: error.code }

  const tables = data || []
  return {
    success: true,
    message: 'Success',
    data: {
      total: tables.length,
      available: tables.filter(t => t.status === 'available').length,
      occupied: tables.filter(t => t.status === 'occupied').length,
      reserved: tables.filter(t => t.status === 'reserved').length,
    },
  }
}

export async function createTable(table: TableInsert): Promise<ApiResponse<TableRow>> {
  const sb = getSupabase()
  const { data, error } = await sb.from('dining_tables').insert(table).select().single()
  return wrapOne(data, error, 'Table')
}

export async function updateTable(id: string, updates: TableUpdate): Promise<ApiResponse<TableRow>> {
  const sb = getSupabase()
  const { data, error } = await sb.from('dining_tables').update(updates).eq('id', id).select().single()
  return wrapOne(data, error, 'Table')
}

export async function deleteTable(id: string): Promise<ApiResponse<null>> {
  const sb = getSupabase()
  const { error } = await sb.from('dining_tables').delete().eq('id', id)
  if (error) return { success: false, message: error.message, error: error.code }
  return { success: true, message: 'Table deleted' }
}
