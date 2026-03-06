import { getSupabase } from '../client'
import { wrapRpc, type ApiResponse } from '../helpers'

export async function getDashboardStats(): Promise<ApiResponse<any>> {
  const sb = getSupabase()
  const { data, error } = await sb.rpc('get_dashboard_stats')
  return wrapRpc(data, error)
}

export async function getSalesReport(period: 'today' | 'week' | 'month' = 'today'): Promise<ApiResponse<any>> {
  const sb = getSupabase()
  const { data, error } = await sb.rpc('get_sales_report', { p_period: period })
  return wrapRpc(data, error)
}

export async function getOrdersReport(): Promise<ApiResponse<any>> {
  const sb = getSupabase()
  const { data, error } = await sb.rpc('get_orders_report')
  return wrapRpc(data, error)
}

export async function getIncomeReport(period: 'today' | 'week' | 'month' | 'year' = 'today'): Promise<ApiResponse<any>> {
  const sb = getSupabase()
  const { data, error } = await sb.rpc('get_income_report', { p_period: period })
  return wrapRpc(data, error)
}
