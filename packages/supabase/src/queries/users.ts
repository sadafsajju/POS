import { getSupabase } from '../client'
import { wrapMany, wrapOne, paginationRange, type ApiResponse } from '../helpers'
import type { Database } from '../types'

type UserRow = Database['public']['Tables']['users']['Row']
type UserInsert = Database['public']['Tables']['users']['Insert']
type UserUpdate = Database['public']['Tables']['users']['Update']

export async function getUsers(params?: {
  page?: number
  per_page?: number
  search?: string
  role?: string
  active?: string
}): Promise<ApiResponse<UserRow[]>> {
  const sb = getSupabase()
  let query = sb.from('users').select('*', { count: 'exact' })

  if (params?.role) {
    query = query.eq('role', params.role as any)
  }
  if (params?.active === 'true') {
    query = query.eq('is_active', true)
  } else if (params?.active === 'false') {
    query = query.eq('is_active', false)
  }
  if (params?.search) {
    query = query.or(`first_name.ilike.%${params.search}%,last_name.ilike.%${params.search}%,email.ilike.%${params.search}%,username.ilike.%${params.search}%`)
  }

  query = query.order('created_at', { ascending: false })

  if (params?.page && params?.per_page) {
    const { from, to } = paginationRange(params.page, params.per_page)
    query = query.range(from, to)
  }

  const { data, error, count } = await query
  return wrapMany(data, error, count, params?.page, params?.per_page)
}

export async function getUserById(id: string): Promise<ApiResponse<UserRow>> {
  const sb = getSupabase()
  const { data, error } = await sb.from('users').select('*').eq('id', id).single()
  return wrapOne(data, error, 'User')
}

export async function createUser(user: UserInsert): Promise<ApiResponse<UserRow>> {
  const sb = getSupabase()
  const { data, error } = await sb.from('users').insert(user).select().single()
  return wrapOne(data, error, 'User')
}

export async function updateUser(id: string, updates: UserUpdate): Promise<ApiResponse<UserRow>> {
  const sb = getSupabase()
  const { data, error } = await sb.from('users').update(updates).eq('id', id).select().single()
  return wrapOne(data, error, 'User')
}

export async function deleteUser(id: string): Promise<ApiResponse<null>> {
  const sb = getSupabase()
  const { error } = await sb.from('users').delete().eq('id', id)
  if (error) return { success: false, message: error.message, error: error.code }
  return { success: true, message: 'User deleted' }
}

export async function getStaffForPin(): Promise<ApiResponse<Pick<UserRow, 'id' | 'first_name' | 'last_name' | 'role'>[]>> {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('users')
    .select('id, first_name, last_name, role')
    .eq('is_active', true)
    .not('pin_hash', 'is', null)
    .order('first_name', { ascending: true })
  return wrapMany(data, error)
}
