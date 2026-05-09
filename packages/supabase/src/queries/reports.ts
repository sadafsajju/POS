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

export async function getEodReconciliation(params?: { date?: string; locationId?: string }): Promise<ApiResponse<any>> {
  const sb = getSupabase()
  const { data, error } = await sb.rpc('get_eod_reconciliation', {
    p_date: params?.date ?? null,
    p_location_id: params?.locationId ?? null,
  })
  if (error) return { success: false, message: error.message, error: error.code }
  // The RPC returns { success, data: {...} } — unwrap the inner data so callers
  // can read fields directly (matches getBillSummary convention).
  const inner = (data as any)?.data ?? data
  return { success: true, message: 'Success', data: inner }
}

export async function recordEodReconciliation(params: {
  businessDate: string
  pedSettlementTotal?: number | null
  cashDrawerCounted?: number | null
  openingFloat?: number | null
  notes?: string | null
  locationId?: string | null
}): Promise<ApiResponse<any>> {
  const sb = getSupabase()
  const { data, error } = await sb.rpc('record_eod_reconciliation', {
    p_business_date: params.businessDate,
    p_ped_settlement_total: params.pedSettlementTotal ?? null,
    p_cash_drawer_counted: params.cashDrawerCounted ?? null,
    p_opening_float: params.openingFloat ?? null,
    p_notes: params.notes ?? null,
    p_location_id: params.locationId ?? null,
  })
  return wrapRpc(data, error)
}

export async function getVatExport(params: {
  period_start: string
  period_end: string
  location_id?: string | null
}): Promise<ApiResponse<any>> {
  const sb = getSupabase()
  const { data, error } = await sb.rpc('get_vat_export', {
    p_period_start: params.period_start,
    p_period_end: params.period_end,
    p_location_id: params.location_id ?? null,
  })
  if (error) return { success: false, message: error.message, error: error.code }
  const inner = (data as any)?.data ?? data
  return { success: true, message: 'Success', data: inner }
}

