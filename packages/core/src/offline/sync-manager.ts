// Offline sync manager: drains the persistent write queue against Supabase
// when the connection returns. Handles local→server id remapping so writes
// that reference offline-created orders (payments, discounts, tips) land on
// the right server records.

import { ordersDb, paymentsDb } from '@pos/supabase';
import type { Json } from '@pos/supabase';
import { useSyncStore } from '../stores/sync-store';
import {
  getQueue,
  removeQueueItem,
  updateQueueItem,
  moveToFailed,
  mapLocalId,
  resolveId,
  isLocalId,
  clearOfflineOrderRecord,
  updateOfflineOrder,
  hydrate,
  enqueue,
  SYNC_COMPLETE_EVENT,
} from './offline-queue';

const MAX_RETRIES = 5;

type HandlerResult = { success: boolean; message?: string };
type Handler = (data: any) => Promise<HandlerResult>;

/** The create_order RPC returns { success, data: {...order}, bill_id } via wrapRpc. */
const unwrapRpcOrder = (res: any): { ok: boolean; message?: string; orderId?: string } => {
  if (!res?.success) return { ok: false, message: res?.message || 'Request failed' };
  const rpc = res.data as any;
  if (rpc?.success === false) return { ok: false, message: rpc?.error || 'Order creation failed' };
  const inner = rpc?.data ?? rpc;
  return { ok: true, orderId: rpc?.bill_id ?? inner?.id };
};

const handlers: Record<string, Handler> = {
  'order:create': async (data: { local_id?: string; request: any }) => {
    const req = data.request || {};
    const parentId = req.parent_order_id
      ? await resolveId(req.parent_order_id)
      : undefined;
    if (parentId && isLocalId(parentId)) {
      return { success: false, message: 'Parent bill not yet synced' };
    }
    const res = await ordersDb.createOrder({
      table_id: req.table_id ?? null,
      customer_id: req.customer_id ?? null,
      customer_name: req.customer_name ?? null,
      order_type: req.order_type,
      items: req.items as Json,
      notes: req.notes ?? null,
      parent_order_id: parentId ?? null,
      create_as_kot: req.create_as_kot ?? false,
      order_source: req.order_source ?? 'pos',
      initial_status: req.initial_status ?? null,
      dining_mode: req.dining_mode ?? null,
      allergens_confirmed: req.allergens_confirmed ?? false,
      allergens_acknowledged_codes: req.allergens_acknowledged_codes ?? null,
    });
    const { ok, message, orderId } = unwrapRpcOrder(res);
    if (!ok) return { success: false, message };
    if (data.local_id) {
      // A success without an order id would silently strand every queued
      // payment/discount/tip for this order (they'd never resolve their
      // local id). The create_order RPC always returns the order — treat a
      // missing id as a failure so it surfaces instead of losing payments.
      if (!orderId) {
        return { success: false, message: 'create_order returned no order id' };
      }
      await mapLocalId(data.local_id, orderId);
      // Remove only the display record — queued payments/discounts for this
      // order stay in the queue and resolve via the id map next iteration.
      await clearOfflineOrderRecord(data.local_id);
    }
    return { success: true };
  },

  'order:apply_discount': async (data: {
    order_id: string;
    discount: { id: string; name: string; percent: number } | null;
  }) => {
    const orderId = await resolveId(data.order_id);
    if (isLocalId(orderId)) return { success: false, message: 'Order not yet synced' };
    return ordersDb.applyDiscountToOrder(orderId, data.discount);
  },

  'payment:process': async (data: { order_id: string; payment: any }) => {
    const orderId = await resolveId(data.order_id);
    if (isLocalId(orderId)) return { success: false, message: 'Order not yet synced' };
    const res = await paymentsDb.processPayment({
      order_id: orderId,
      payment_method: data.payment.payment_method,
      amount: data.payment.amount,
      reference_number: data.payment.reference_number ?? null,
      cash_received: data.payment.cash_received ?? null,
    });
    if (!res.success) return { success: false, message: res.message };
    const rpc = res.data as any;
    if (rpc?.success === false) return { success: false, message: rpc?.error || 'Payment failed' };
    return { success: true };
  },

  'order:record_tip': async (data: {
    order_id: string;
    amount: number;
    method: 'cash' | 'card' | 'other';
  }) => {
    const orderId = await resolveId(data.order_id);
    if (isLocalId(orderId)) return { success: false, message: 'Order not yet synced' };
    return ordersDb.recordTip({ order_id: orderId, amount: data.amount, method: data.method });
  },

  'order:update_status': async (data: { order_id: string; status: string; notes?: string }) => {
    const orderId = await resolveId(data.order_id);
    if (isLocalId(orderId)) return { success: false, message: 'Order not yet synced' };
    return ordersDb.updateOrderStatus(orderId, data.status, data.notes ?? null);
  },

  'table:clear': async (data: { table_id: string }) => {
    return ordersDb.clearTable(data.table_id);
  },

  'table:transfer': async (data: { from_table_id: string; to_table_id: string }) => {
    return ordersDb.transferTable(data.from_table_id, data.to_table_id);
  },
};

let draining = false;
let initialized = false;

/**
 * Process the queue in FIFO order. Stops at the first failing item (later
 * items may depend on it — e.g. a payment against an unsynced order) and
 * retries on the next run. Items that keep failing are parked in the failed
 * list after MAX_RETRIES so they can't block the queue forever.
 */
export async function syncNow(): Promise<{ synced: number; failed: number }> {
  const result = { synced: 0, failed: 0 };
  const store = useSyncStore.getState();
  if (draining || !store.isOnline) return result;
  // Set the guard synchronously BEFORE any await — otherwise two syncNow()
  // calls racing past the check would drain the same queue twice and post
  // duplicate orders/payments to the server.
  draining = true;

  const queue = await getQueue();
  if (queue.length === 0) {
    draining = false;
    return result;
  }

  store.startSync();

  try {
    for (const item of queue) {
      const handler = handlers[`${item.entity}:${item.action}`];
      if (!handler) {
        console.warn(`[offline] No sync handler for ${item.entity}:${item.action}, dropping`);
        await removeQueueItem(item.id);
        continue;
      }

      let outcome: HandlerResult;
      try {
        outcome = await handler(item.data);
      } catch (e: any) {
        outcome = { success: false, message: e?.message || 'Unknown error' };
      }

      if (outcome.success) {
        await removeQueueItem(item.id);
        result.synced += 1;
      } else {
        const retries = (item.retries ?? 0) + 1;
        result.failed += 1;
        if (retries >= MAX_RETRIES) {
          console.error(
            `[offline] Dropping ${item.entity}:${item.action} after ${retries} attempts: ${outcome.message}`
          );
          await moveToFailed({ ...item, retries }, outcome.message || 'Unknown error');
          const data = item.data as { local_id?: string };
          if (item.entity === 'order' && item.action === 'create' && data?.local_id) {
            await updateOfflineOrder(data.local_id, {
              status: 'failed',
              syncError: outcome.message,
            });
          }
          continue;
        }
        await updateQueueItem(item.id, { retries });
        // Preserve FIFO ordering — later items may depend on this one.
        break;
      }
    }
  } finally {
    draining = false;
    const remaining = await getQueue();
    if (remaining.length === 0) {
      useSyncStore.getState().completeSync();
    } else {
      useSyncStore.getState().failSync();
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(SYNC_COMPLETE_EVENT, { detail: result }));
    }
  }

  return result;
}

// ── Convenience enqueue helpers used by the app ──────────────────────────

// If we're actually online when something gets queued (e.g. paying an
// offline-created order right after reconnecting), kick a drain immediately
// instead of waiting for the periodic retry.
const maybeSyncSoon = (): void => {
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    setTimeout(() => void syncNow(), 500);
  }
};

export async function queueOfflinePayment(params: {
  order_id: string;
  payment_method: string;
  amount: number;
  cash_received?: number;
  reference_number?: string;
}): Promise<void> {
  await enqueue({
    entity: 'payment',
    action: 'process',
    data: {
      order_id: params.order_id,
      payment: {
        payment_method: params.payment_method,
        amount: params.amount,
        cash_received: params.cash_received,
        reference_number: params.reference_number,
      },
    },
  });
  if (isLocalId(params.order_id)) {
    await updateOfflineOrder(params.order_id, {
      paid: true,
      payment_method: params.payment_method,
    });
  }
  maybeSyncSoon();
}

export async function queueOfflineDiscount(
  orderId: string,
  discount: { id: string; name: string; percent: number } | null
): Promise<void> {
  await enqueue({
    entity: 'order',
    action: 'apply_discount',
    data: { order_id: orderId, discount },
  });
  maybeSyncSoon();
}

export async function queueOfflineTip(
  orderId: string,
  amount: number,
  method: 'cash' | 'card' | 'other'
): Promise<void> {
  await enqueue({
    entity: 'order',
    action: 'record_tip',
    data: { order_id: orderId, amount, method },
  });
  maybeSyncSoon();
}

export async function queueOrderStatusUpdate(
  orderId: string,
  status: string,
  notes?: string
): Promise<void> {
  await enqueue({
    entity: 'order',
    action: 'update_status',
    data: { order_id: orderId, status, notes },
  });
  maybeSyncSoon();
}

export async function queueTableClear(tableId: string): Promise<void> {
  await enqueue({ entity: 'table', action: 'clear', data: { table_id: tableId } });
  maybeSyncSoon();
}

export async function queueTableTransfer(fromTableId: string, toTableId: string): Promise<void> {
  await enqueue({
    entity: 'table',
    action: 'transfer',
    data: { from_table_id: fromTableId, to_table_id: toTableId },
  });
  maybeSyncSoon();
}

// ── Init ─────────────────────────────────────────────────────────────────

/**
 * Initialize offline support. Call once at app startup (after the Supabase
 * client is created). Hydrates the persisted queue, migrates legacy offline
 * orders, and wires auto-sync on reconnect + a periodic retry timer.
 */
export function initOfflineSupport(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  void hydrate().then(() => {
    // Drain anything left over from a previous session
    if (navigator.onLine) {
      setTimeout(() => void syncNow(), 3000);
    }
  });

  window.addEventListener('online', () => {
    // Small delay so the connection can stabilize
    setTimeout(() => void syncNow(), 2000);
  });

  // Periodic retry — covers cases where 'online' fired but the first drain
  // failed midway (e.g. server hiccup) or the browser never fired the event.
  setInterval(() => {
    if (navigator.onLine && useSyncStore.getState().pendingChanges > 0) {
      void syncNow();
    }
  }, 60_000);
}
