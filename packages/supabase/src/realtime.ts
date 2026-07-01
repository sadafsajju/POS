import { getSupabase } from './client'
import type { RealtimeChannel } from '@supabase/supabase-js'

type SubscriptionCallback<T> = (payload: {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: T
  old: T
}) => void

/**
 * Build a unique channel topic. Multiple components subscribe to the same table
 * (e.g. the counter mounts CounterInterface + AggregatorOrders + ReadyOrdersNotification,
 * all watching `orders`). Supabase/Phoenix permits only one join per topic per socket, so
 * reusing a static name makes the extra channels error-and-retry instead of receiving events.
 * A unique suffix gives each subscriber its own topic.
 */
function uniqueChannelName(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2)}`
}

/**
 * Subscribe to order changes (kitchen display, counter UI)
 */
export function subscribeToOrders(
  callback: SubscriptionCallback<any>,
  filter?: { status?: string[] }
): RealtimeChannel {
  const sb = getSupabase()
  let channel = sb
    .channel(uniqueChannelName('orders-changes'))
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
    .channel(uniqueChannelName('order-items-changes'))
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
    .channel(uniqueChannelName('tables-changes'))
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
