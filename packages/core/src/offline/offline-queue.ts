// Persistent offline write queue + offline order records + local→server id map.
// Everything is stored via the KV store (SQLite in Tauri) so it survives restarts.

import { getKV } from './kv-store';
import { useSyncStore } from '../stores/sync-store';
import type { OfflineQueueItem, OfflineOrder } from '@pos/types';

const QUEUE_KEY = 'sync_queue';
const ORDERS_KEY = 'offline_orders';
const IDMAP_KEY = 'id_map';
const FAILED_KEY = 'failed_queue';
const LEGACY_ORDERS_LS_KEY = 'pos_offline_orders';

export const ORDERS_CHANGED_EVENT = 'pos-offline-orders-changed';
export const SYNC_COMPLETE_EVENT = 'pos-offline-sync-complete';

export const isLocalId = (id?: string | null): boolean =>
  !!id && id.startsWith('offline_');

export const generateLocalId = (): string =>
  `offline_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

const generateQueueId = (): string =>
  `sync_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

const emit = (event: string) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(event));
  }
};

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const kv = await getKV();
    const raw = await kv.get(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  const kv = await getKV();
  await kv.set(key, JSON.stringify(value));
}

// Serialize read-modify-write cycles so an enqueue during a sync drain can't
// lose updates (all queue/order mutations funnel through this lock).
let lock: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = lock.then(fn, fn);
  lock = run.catch(() => undefined);
  return run;
}

// ── Queue ────────────────────────────────────────────────────────────────

export async function getQueue(): Promise<OfflineQueueItem[]> {
  return readJson<OfflineQueueItem[]>(QUEUE_KEY, []);
}

async function setQueue(items: OfflineQueueItem[]): Promise<void> {
  await writeJson(QUEUE_KEY, items);
  useSyncStore.setState({ pendingChanges: items.length, queue: items });
}

export async function enqueue(
  item: Omit<OfflineQueueItem, 'id' | 'timestamp' | 'retries'>
): Promise<OfflineQueueItem> {
  const queueItem: OfflineQueueItem = {
    ...item,
    id: generateQueueId(),
    timestamp: new Date(),
    retries: 0,
  };
  await withLock(async () => {
    const queue = await getQueue();
    await setQueue([...queue, queueItem]);
  });
  return queueItem;
}

export async function removeQueueItem(id: string): Promise<void> {
  await withLock(async () => {
    const queue = await getQueue();
    await setQueue(queue.filter((i) => i.id !== id));
  });
}

export async function updateQueueItem(
  id: string,
  patch: Partial<OfflineQueueItem>
): Promise<void> {
  await withLock(async () => {
    const queue = await getQueue();
    await setQueue(queue.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  });
}

/** Permanently failed items (exceeded retries) — kept for inspection. */
export async function moveToFailed(item: OfflineQueueItem, error: string): Promise<void> {
  const failed = await readJson<Array<OfflineQueueItem & { error: string }>>(FAILED_KEY, []);
  await writeJson(FAILED_KEY, [...failed, { ...item, error }]);
  await removeQueueItem(item.id);
}

export async function getFailedItems(): Promise<Array<OfflineQueueItem & { error: string }>> {
  return readJson(FAILED_KEY, []);
}

// ── Offline order records (for UI display & receipts) ───────────────────

export async function getOfflineOrders(): Promise<OfflineOrder[]> {
  const orders = await readJson<OfflineOrder[]>(ORDERS_KEY, []);
  return orders.map((o) => ({ ...o, createdAt: new Date(o.createdAt) }));
}

async function setOfflineOrders(orders: OfflineOrder[]): Promise<void> {
  await writeJson(ORDERS_KEY, orders);
  emit(ORDERS_CHANGED_EVENT);
}

export async function addOfflineOrder(order: OfflineOrder): Promise<void> {
  await withLock(async () => {
    const orders = await getOfflineOrders();
    await setOfflineOrders([...orders, order]);
  });
}

export async function updateOfflineOrder(
  localId: string,
  patch: Partial<OfflineOrder>
): Promise<void> {
  await withLock(async () => {
    const orders = await getOfflineOrders();
    await setOfflineOrders(orders.map((o) => (o.localId === localId ? { ...o, ...patch } : o)));
  });
}

/**
 * Remove just the offline order display record — used by the sync manager
 * after the order reaches the server. Queued writes that reference this
 * local id (payments, discounts, tips) MUST stay in the queue: they resolve
 * to the server id via the id map and sync right after.
 */
export async function clearOfflineOrderRecord(localId: string): Promise<void> {
  await withLock(async () => {
    const orders = await getOfflineOrders();
    await setOfflineOrders(orders.filter((o) => o.localId !== localId));
  });
}

/** Cancel an offline order: removes the record AND all queued writes for it. */
export async function removeOfflineOrder(localId: string): Promise<void> {
  await withLock(async () => {
    const orders = await getOfflineOrders();
    await setOfflineOrders(orders.filter((o) => o.localId !== localId));
    // Also drop any queue items that were created for this order
    const queue = await getQueue();
    await setQueue(
      queue.filter((i) => {
        const data = i.data as { local_id?: string; order_id?: string } | undefined;
        return data?.local_id !== localId && data?.order_id !== localId;
      })
    );
  });
}

// ── Local → server id mapping ────────────────────────────────────────────

export async function mapLocalId(localId: string, serverId: string): Promise<void> {
  const map = await readJson<Record<string, string>>(IDMAP_KEY, {});
  map[localId] = serverId;
  await writeJson(IDMAP_KEY, map);
}

/** Resolve a possibly-local id to its server id (returns input if not mapped). */
export async function resolveId(id: string): Promise<string> {
  if (!isLocalId(id)) return id;
  const map = await readJson<Record<string, string>>(IDMAP_KEY, {});
  return map[id] ?? id;
}

// ── Hydration & legacy migration ─────────────────────────────────────────

/**
 * Load persisted queue into the sync store (so the pending badge is correct
 * after a restart) and migrate any orders from the legacy localStorage queue.
 */
export async function hydrate(): Promise<void> {
  // Migrate legacy offline orders (pre-persistent-queue localStorage format)
  try {
    if (typeof localStorage !== 'undefined') {
      const legacy = localStorage.getItem(LEGACY_ORDERS_LS_KEY);
      if (legacy) {
        const legacyOrders = JSON.parse(legacy) as OfflineOrder[];
        if (Array.isArray(legacyOrders) && legacyOrders.length > 0) {
          const existing = await getOfflineOrders();
          const existingIds = new Set(existing.map((o) => o.localId));
          for (const order of legacyOrders) {
            if (existingIds.has(order.localId) || order.status === 'synced') continue;
            await addOfflineOrder({ ...order, status: 'pending_sync' });
            await enqueue({
              entity: 'order',
              action: 'create',
              data: {
                local_id: order.localId,
                request: {
                  table_id: order.tableId,
                  customer_name: order.customerName,
                  order_type: order.orderType,
                  items: order.items,
                  notes: order.notes,
                },
              },
            });
          }
        }
        localStorage.removeItem(LEGACY_ORDERS_LS_KEY);
      }
    }
  } catch (e) {
    console.warn('[offline] Legacy order migration failed:', e);
  }

  const queue = await getQueue();
  useSyncStore.setState({ pendingChanges: queue.length, queue });
  emit(ORDERS_CHANGED_EVENT);
}
