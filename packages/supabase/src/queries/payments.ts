import { getSupabase } from '../client'
import { wrapMany, wrapRpc, type ApiResponse } from '../helpers'
import type { Database } from '../types'

type PaymentRow = Database['public']['Tables']['payments']['Row']

export async function getPaymentsByOrder(orderId: string): Promise<ApiResponse<PaymentRow[]>> {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('payments')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })
  return wrapMany(data, error)
}

export async function getPaymentSummary(orderId: string): Promise<ApiResponse<{
  total_paid: number
  total_due: number
  remaining: number
  is_fully_paid: boolean
  payments: PaymentRow[]
}>> {
  const sb = getSupabase()
  // Get order total
  const { data: order, error: orderError } = await sb
    .from('orders')
    .select('total_amount')
    .eq('id', orderId)
    .single()

  if (orderError) return { success: false, message: orderError.message, error: orderError.code }

  // Get payments
  const { data: payments, error: paymentsError } = await sb
    .from('payments')
    .select('*')
    .eq('order_id', orderId)
    .eq('status', 'completed')

  if (paymentsError) return { success: false, message: paymentsError.message, error: paymentsError.code }

  const totalPaid = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0)
  const totalDue = Number(order?.total_amount || 0)

  return {
    success: true,
    message: 'Success',
    data: {
      total_paid: totalPaid,
      total_due: totalDue,
      remaining: Math.max(0, totalDue - totalPaid),
      is_fully_paid: totalPaid >= totalDue,
      payments: payments || [],
    },
  }
}

export async function processPayment(params: {
  order_id: string
  payment_method: string
  amount: number
  reference_number?: string | null
  cash_received?: number | null
}): Promise<ApiResponse<any>> {
  const sb = getSupabase()
  const { data, error } = await sb.rpc('process_payment', {
    p_order_id: params.order_id,
    p_payment_method: params.payment_method,
    p_amount: params.amount,
    p_reference_number: params.reference_number ?? null,
    p_cash_received: params.cash_received ?? null,
  })
  return wrapRpc(data, error)
}
