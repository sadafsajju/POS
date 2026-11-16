import { getSupabase } from '../client'
import { wrapRpc, type ApiResponse } from '../helpers'

export async function getDashboardStats(): Promise<ApiResponse<any>> {
  const sb = getSupabase()
  const { data, error } = await sb.rpc('get_dashboard_stats')
  if (error) return { success: false, message: error.message, error: error.code }
  const inner = (data as any)?.data ?? data
  return { success: true, message: 'Success', data: inner }
}

export async function getSalesReport(period: 'today' | 'week' | 'month' = 'today'): Promise<ApiResponse<any>> {
  const sb = getSupabase()
  const { data, error } = await sb.rpc('get_sales_report', { p_period: period })
  if (error) return { success: false, message: error.message, error: error.code }
  const inner = (data as any)?.data ?? data
  return { success: true, message: 'Success', data: inner }
}

export async function getOrdersReport(): Promise<ApiResponse<any>> {
  const sb = getSupabase()
  const { data, error } = await sb.rpc('get_orders_report')
  if (error) return { success: false, message: error.message, error: error.code }
  const inner = (data as any)?.data ?? data
  return { success: true, message: 'Success', data: inner }
}

export async function getIncomeReport(period: 'today' | 'week' | 'month' | 'year' = 'today'): Promise<ApiResponse<any>> {
  const sb = getSupabase()
  const { data, error } = await sb.rpc('get_income_report', { p_period: period })
  if (error) return { success: false, message: error.message, error: error.code }
  const inner = (data as any)?.data ?? data
  return { success: true, message: 'Success', data: inner }
}

// ---------------------------------------------------------------------------
// Reports overview (get_reports_overview RPC)
// ---------------------------------------------------------------------------

export interface ReportsSummary {
  orders: number
  revenue: number
  subtotal: number
  tax: number
  net: number
  discounts: number
  discounted_orders: number
  tips: number
  tipped_orders: number
  avg_order_value: number
  items_sold: number
  cancelled_orders: number
  cancelled_value: number
  open_orders: number
  open_value: number
  refunds: number
}

export interface ReportsPreviousSummary {
  orders: number
  revenue: number
  net: number
  discounts: number
  tips: number
  avg_order_value: number
  items_sold: number
}

export interface ReportsOverview {
  range: {
    start: string
    end: string
    days: number
    prev_start: string
    prev_end: string
    timezone: string
    business_day_start: string
    /** Range contains the business day in progress; previous period is cut at the same elapsed point. */
    partial: boolean
    /** Instant (ISO) the previous period is counted up to. */
    compare_until: string
  }
  summary: ReportsSummary
  previous: ReportsPreviousSummary
  daily: Array<{ date: string; revenue: number; orders: number }>
  previous_daily: Array<{ date: string; revenue: number; orders: number }>
  hourly: Array<{ hour: number; revenue: number; orders: number; prev_revenue: number; prev_orders: number }>
  /** ISO weekday, 1 = Monday. `days` = occurrences of that weekday in range. */
  weekday: Array<{ dow: number; days: number; revenue: number; orders: number }>
  products: Array<{ product_id: string | null; name: string; category: string; quantity: number; revenue: number }>
  unsold_products: Array<{ product_id: string; name: string; category: string }>
  categories: Array<{ category_id: string | null; name: string; color: string | null; quantity: number; revenue: number }>
  payment_methods: Array<{ method: string; count: number; amount: number }>
  channels: Array<{ channel: string; orders: number; revenue: number }>
  sources: Array<{ source: string; orders: number; revenue: number }>
  discounts: Array<{ name: string; count: number; amount: number }>
}

/**
 * Everything the Reports page shows for an inclusive range of org-local
 * business dates (YYYY-MM-DD), plus the equal-length previous period.
 * Admin/manager only — the RPC returns success:false for other roles.
 */
export async function getReportsOverview(params: {
  start: string
  end: string
  locationId?: string | null
}): Promise<ApiResponse<ReportsOverview>> {
  const sb = getSupabase()
  const { data, error } = await sb.rpc('get_reports_overview', {
    p_start: params.start,
    p_end: params.end,
    p_location_id: params.locationId ?? null,
  })
  if (error) return { success: false, message: error.message, error: error.code }
  const body = data as any
  if (body && body.success === false) {
    return { success: false, message: body.error || 'Failed to load report', error: body.error }
  }
  return { success: true, message: 'Success', data: (body?.data ?? body) as ReportsOverview }
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

