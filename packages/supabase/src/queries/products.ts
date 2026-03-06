import { getSupabase } from '../client'
import { wrapMany, wrapOne, paginationRange, type ApiResponse } from '../helpers'
import type { Database } from '../types'

type ProductRow = Database['public']['Tables']['products']['Row']
type ProductInsert = Database['public']['Tables']['products']['Insert']
type ProductUpdate = Database['public']['Tables']['products']['Update']

export async function getProducts(params?: {
  page?: number
  per_page?: number
  search?: string
  category_id?: string
  available_only?: boolean
}): Promise<ApiResponse<ProductRow[]>> {
  const sb = getSupabase()
  let query = sb.from('products').select('*, categories(id, name)', { count: 'exact' })

  if (params?.category_id) {
    query = query.eq('category_id', params.category_id)
  }
  if (params?.available_only) {
    query = query.eq('is_available', true)
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
  return wrapMany(data as any, error, count, params?.page, params?.per_page)
}

export async function getProductById(id: string): Promise<ApiResponse<ProductRow>> {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('products')
    .select('*, categories(id, name)')
    .eq('id', id)
    .single()
  return wrapOne(data as any, error, 'Product')
}

export async function getProductsByCategory(
  categoryId: string,
  availableOnly = true
): Promise<ApiResponse<ProductRow[]>> {
  const sb = getSupabase()
  let query = sb.from('products').select('*').eq('category_id', categoryId)
  if (availableOnly) {
    query = query.eq('is_available', true)
  }
  query = query.order('sort_order', { ascending: true })
  const { data, error } = await query
  return wrapMany(data, error)
}

export async function createProduct(product: ProductInsert): Promise<ApiResponse<ProductRow>> {
  const sb = getSupabase()
  const { data, error } = await sb.from('products').insert(product).select().single()
  return wrapOne(data, error, 'Product')
}

export async function updateProduct(id: string, updates: ProductUpdate): Promise<ApiResponse<ProductRow>> {
  const sb = getSupabase()
  const { data, error } = await sb.from('products').update(updates).eq('id', id).select().single()
  return wrapOne(data, error, 'Product')
}

export async function deleteProduct(id: string): Promise<ApiResponse<null>> {
  const sb = getSupabase()
  const { error } = await sb.from('products').delete().eq('id', id)
  if (error) return { success: false, message: error.message, error: error.code }
  return { success: true, message: 'Product deleted' }
}
