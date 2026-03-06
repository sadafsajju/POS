import { getSupabase } from './client'
import type { RealtimeChannel } from '@supabase/supabase-js'

type SubscriptionCallback<T> = (payload: {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: T
  old: T
}) => void

/**
 * Subscribe to order changes (kitchen display, counter UI)
 */
export function subscribeToOrders(
  callback: SubscriptionCallback<any>,
  filter?: { status?: string[] }
): RealtimeChannel {
  const sb = getSupabase()
  let channel = sb
    .channel('orders-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'orders',
      },
      (payload) => {
        if (filter?.status) {
          const newStatus = (payload.new as any)?.status
          if (!filter.status.includes(newStatus)) return
        }
        callback(payload as any)
      }
    )

  channel.subscribe()
  return channel
}

/**
 * Subscribe to order item status changes (kitchen display)
 */
export function subscribeToOrderItems(
  callback: SubscriptionCallback<any>
): RealtimeChannel {
  const sb = getSupabase()
  const channel = sb
    .channel('order-items-changes')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'order_items',
      },
      (payload) => callback(payload as any)
    )

  channel.subscribe()
  return channel
}

/**
 * Subscribe to table status changes (table management)
 */
export function subscribeToTables(
  callback: SubscriptionCallback<any>
): RealtimeChannel {
  const sb = getSupabase()
  const channel = sb
    .channel('tables-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'dining_tables',
      },
      (payload) => callback(payload as any)
    )

  channel.subscribe()
  return channel
}

/**
 * Unsubscribe from a channel
 */
export function unsubscribe(channel: RealtimeChannel): void {
  const sb = getSupabase()
  sb.removeChannel(channel)
}
