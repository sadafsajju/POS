import { getSupabase } from '../client'
import { wrapMany, wrapOne, paginationRange, type ApiResponse } from '../helpers'
import type { Database } from '../types'

type CategoryRow = Database['public']['Tables']['categories']['Row']
type CategoryInsert = Database['public']['Tables']['categories']['Insert']
type CategoryUpdate = Database['public']['Tables']['categories']['Update']

export async function getCategories(params?: {
  active_only?: boolean
  page?: number
  per_page?: number
  search?: string
}): Promise<ApiResponse<CategoryRow[]>> {
  const sb = getSupabase()
  let query = sb.from('categories').select('*', { count: 'exact' })

  if (params?.active_only !== false) {
    query = query.eq('is_active', true)
  }
  if (params?.search) {
    query = query.ilike('name', `%${params.search}%`)
  }

  query = query.order('sort_order', { ascending: true })

  if (params?.page && params?.per_page) {
    const { from, to } = paginationRange(params.page, params.per_page)
    query = query.range(from, to)
  }

  const { data, error, count } = await query
  return wrapMany(data, error, count, params?.page, params?.per_page)
}

export async function getCategoryById(id: string): Promise<ApiResponse<CategoryRow>> {
  const sb = getSupabase()
  const { data, error } = await sb.from('categories').select('*').eq('id', id).single()
  return wrapOne(data, error, 'Category')
}

export async function createCategory(category: CategoryInsert): Promise<ApiResponse<CategoryRow>> {
  const sb = getSupabase()
  const { data, error } = await sb.from('categories').insert(category).select().single()
  return wrapOne(data, error, 'Category')
}

export async function updateCategory(id: string, updates: CategoryUpdate): Promise<ApiResponse<CategoryRow>> {
  const sb = getSupabase()
  const { data, error } = await sb.from('categories').update(updates).eq('id', id).select().single()
  return wrapOne(data, error, 'Category')
}

export async function deleteCategory(id: string): Promise<ApiResponse<null>> {
  const sb = getSupabase()
  const { error } = await sb.from('categories').delete().eq('id', id)
  if (error) return { success: false, message: error.message, error: error.code }
  return { success: true, message: 'Category deleted' }
}
