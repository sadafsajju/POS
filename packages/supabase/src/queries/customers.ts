import { getSupabase } from '../client'
import { wrapMany, wrapOne, wrapRpc, paginationRange, getMyOrgId, type ApiResponse } from '../helpers'
import type { Database } from '../types'

type CustomerRow = Database['public']['Tables']['customers']['Row']
type CustomerInsert = Database['public']['Tables']['customers']['Insert']
type CustomerUpdate = Database['public']['Tables']['customers']['Update']

export async function getCustomers(params?: {
  page?: number
  per_page?: number
  search?: string
}): Promise<ApiResponse<CustomerRow[]>> {
  const sb = getSupabase()
  let query = sb.from('customers').select('*', { count: 'exact' })

  if (params?.search) {
    query = query.or(`name.ilike.%${params.search}%,phone.ilike.%${params.search}%,email.ilike.%${params.search}%`)
  }

  query = query.order('created_at', { ascending: false })

  if (params?.page && params?.per_page) {
    const { from, to } = paginationRange(params.page, params.per_page)
    query = query.range(from, to)
  }

  const { data, error, count } = await query
  return wrapMany(data, error, count, params?.page, params?.per_page)
}

export async function getCustomerById(id: string): Promise<ApiResponse<CustomerRow>> {
  const sb = getSupabase()
  const { data, error } = await sb.from('customers').select('*').eq('id', id).single()
  return wrapOne(data, error, 'Customer')
}

export async function getCustomerByPhone(phone: string): Promise<ApiResponse<CustomerRow>> {
  const sb = getSupabase()
  const { data, error } = await sb.from('customers').select('*').eq('phone', phone).single()
  return wrapOne(data, error, 'Customer')
}

export async function searchCustomers(query: string, limit = 10): Promise<ApiResponse<CustomerRow[]>> {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('customers')
    .select('*')
    .or(`name.ilike.%${query}%,phone.ilike.%${query}%`)
    .limit(limit)
  return wrapMany(data, error)
}

export async function createCustomer(customer: CustomerInsert): Promise<ApiResponse<CustomerRow>> {
  const sb = getSupabase()
  if (!customer.org_id) {
    const orgId = await getMyOrgId()
    if (!orgId) return { success: false, message: 'Could not determine organization. Please log in again.', error: 'no_org_id' }
    customer = { ...customer, org_id: orgId }
  }
  const { data, error } = await sb.from('customers').insert(customer).select().single()
  return wrapOne(data, error, 'Customer')
}

export async function updateCustomer(id: string, updates: CustomerUpdate): Promise<ApiResponse<CustomerRow>> {
  const sb = getSupabase()
  const { data, error } = await sb.from('customers').update(updates).eq('id', id).select().single()
  return wrapOne(data, error, 'Customer')
}

export async function anonymiseCustomer(customerId: string, reason?: string): Promise<ApiResponse<{ message: string }>> {
  const sb = getSupabase()
  const { data, error } = await sb.rpc('anonymise_customer', {
    p_customer_id: customerId,
    p_reason: reason ?? null,
  })
  return wrapRpc(data, error) as ApiResponse<{ message: string }>
}

export async function exportCustomerData(customerId: string): Promise<ApiResponse<{ export_generated_at: string; customer: CustomerRow; orders: any[]; payments: any[] }>> {
  const sb = getSupabase()
  const { data, error } = await sb.rpc('export_customer_data', {
    p_customer_id: customerId,
  })
  return wrapRpc(data, error) as ApiResponse<{ export_generated_at: string; customer: CustomerRow; orders: any[]; payments: any[] }>
}

export async function applyRetentionPolicy(dryRun: boolean): Promise<ApiResponse<any>> {
  const sb = getSupabase()
  const { data, error } = await sb.rpc('apply_retention_policy', { p_dry_run: dryRun })
  return wrapRpc(data, error)
}
