import { useState, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import apiClient from '@/api/client';
import { subscribeToOrders, subscribeToOrderItems, unsubscribe, getSupabase } from '@pos/supabase';
import type { User as UserType, Order, OrderItem, OrderStatus } from '@/types';

interface NewEnhancedKitchenLayoutProps {
  user: UserType;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function minutesAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 60_000);
}

function urgencyColor(mins: number) {
  if (mins >= 20) return { text: 'text-red-400', bg: 'bg-red-500', pulse: true };
  if (mins >= 10) return { text: 'text-amber-400', bg: 'bg-amber-500', pulse: false };
  return { text: 'text-zinc-400', bg: 'bg-zinc-600', pulse: false };
}

function orderHeadline(order: Order) {
  return order.table
    ? `T${order.table.table_number}`
    : order.order_type === 'takeout'
      ? 'TAKEAWAY'
      : 'COUNTER';
}

// A ticket entry: an order + the filtered items to display in that lane
interface LaneTicket {
  order: Order;
  displayItems: OrderItem[];
}

const LANE_META = {
  new:    { label: 'NEW',    accent: 'bg-amber-500',   border: 'border-l-amber-500',   headerBg: 'bg-amber-500/10',   headerText: 'text-amber-400'   },
  firing: { label: 'FIRING', accent: 'bg-orange-500',  border: 'border-l-orange-500',  headerBg: 'bg-orange-500/10',  headerText: 'text-orange-400'  },
  ready:  { label: 'READY',  accent: 'bg-emerald-500', border: 'border-l-emerald-500', headerBg: 'bg-emerald-500/10', headerText: 'text-emerald-400' },
  done:   { label: 'DONE',   accent: 'bg-zinc-500',    border: 'border-l-zinc-500',    headerBg: 'bg-zinc-500/10',    headerText: 'text-zinc-400'    },
} as const;

type LaneName = keyof typeof LANE_META;

// ── Main Component ───────────────────────────────────────────────────────────

export function NewEnhancedKitchenLayout({ user }: NewEnhancedKitchenLayoutProps) {
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Optimistic sets: item IDs the user has tapped but server hasn't confirmed yet
  const [optimisticReady, setOptimisticReady] = useState<Set<string>>(new Set());
  const [optimisticServed, setOptimisticServed] = useState<Set<string>>(new Set());

  const queryClient = useQueryClient();

  const { data: ordersResponse, isLoading } = useQuery({
    queryKey: ['kitchenOrders'],
    queryFn: () => apiClient.getKitchenOrders('all'),
    refetchInterval: autoRefresh ? 3000 : false,
    select: (d) => d.data || [],
  });

  // Fetch last served orders for DONE lane
  const { data: servedResponse } = useQuery({
    queryKey: ['kitchenServedOrders'],
    queryFn: () => apiClient.getOrders({ status: 'served', per_page: 10 }),
    refetchInterval: autoRefresh ? 5000 : false,
    select: (d) => d.data || [],
  });

  const orders: Order[] = Array.isArray(ordersResponse) ? ordersResponse : [];
  const servedOrders: Order[] = Array.isArray(servedResponse) ? servedResponse : [];

  // Refresh both the active (pending/confirmed/preparing/ready) and served lists together.
  // If we only refresh one, an order transitioning to 'served' disappears from the active
  // list before the served list refetches on its own interval.
  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['kitchenOrders'] });
    queryClient.invalidateQueries({ queryKey: ['kitchenServedOrders'] });
  }, [queryClient]);

  // Realtime: refetch immediately when orders or items change, instead of waiting for the 3s poll.
  useEffect(() => {
    const ordersChannel = subscribeToOrders(() => refetch());
    const itemsChannel = subscribeToOrderItems(() => refetch());
    return () => {
      unsubscribe(ordersChannel);
      unsubscribe(itemsChannel);
    };
  }, [refetch]);

  // ── Derive if an item is "ready" (server or optimistic) ────────────────

  // An item counts as "ready" (done cooking, not yet served)
  const isItemReady = useCallback((item: OrderItem) => {
    if (optimisticServed.has(item.id)) return false; // already served optimistically
    return item.status === 'ready' || optimisticReady.has(item.id);
  }, [optimisticReady, optimisticServed]);

  // An item counts as "served" (handed off)
  const isItemServed = useCallback((item: OrderItem) => {
    return item.status === 'served' || optimisticServed.has(item.id);
  }, [optimisticServed]);

  // An item is still cooking (not ready, not served)
  const isItemCooking = useCallback((item: OrderItem) => {
    return !isItemReady(item) && !isItemServed(item);
  }, [isItemReady, isItemServed]);

  // ── Build lane tickets ─────────────────────────────────────────────────
  // NEW: fresh tickets awaiting kitchen (KOTs start as 'pending', non-KOT orders may be 'confirmed')
  const newTickets: LaneTicket[] = orders
    .filter((o) => o.status === 'pending' || o.status === 'confirmed')
    .map((o) => ({ order: o, displayItems: o.items || [] }));

  // FIRING: preparing orders, only items still cooking
  const firingTickets: LaneTicket[] = orders
    .filter((o) => o.status === 'preparing')
    .map((o) => ({
      order: o,
      displayItems: (o.items || []).filter((item) => isItemCooking(item)),
    }))
    .filter((t) => t.displayItems.length > 0);

  // READY: items that are ready but not yet served
  const readyTickets: LaneTicket[] = [
    // Fully ready orders — show only non-served items
    ...orders
      .filter((o) => o.status === 'ready')
      .map((o) => ({
        order: o,
        displayItems: (o.items || []).filter((item) => !isItemServed(item)),
      }))
      .filter((t) => t.displayItems.length > 0),
    // Partially ready orders (still preparing, but some items done and not served)
    ...orders
      .filter((o) => o.status === 'preparing')
      .map((o) => ({
        order: o,
        displayItems: (o.items || []).filter((item) => isItemReady(item)),
      }))
      .filter((t) => t.displayItems.length > 0),
  ];

  // DONE: recently served orders (read-only, for reference).
  // Dedupe: in KOT mode the parent bill also gets marked 'served' — skip bills that
  // have served KOT children so we don't render the same order twice.
  const servedBillIdsWithKots = new Set(
    servedOrders
      .map((o) => (o as any).parent_order_id)
      .filter((id): id is string => !!id),
  );
  const doneTickets: LaneTicket[] = servedOrders
    .filter((o) => !servedBillIdsWithKots.has(o.id))
    .map((o) => ({ order: o, displayItems: o.items || [] }));
  // The Lane component sorts DONE by served_at desc internally.

  const totalActive = newTickets.length + firingTickets.length + readyTickets.length + doneTickets.length;
  const urgentCount = orders.filter(
    (o) => ['confirmed', 'preparing'].includes(o.status) && minutesAgo(o.created_at) >= 15,
  ).length;

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleStatusUpdate = useCallback(async (orderId: string, newStatus: string) => {
    try {
      await apiClient.updateOrderStatus(orderId, newStatus as OrderStatus);
      refetch();
    } catch (e) {
      console.error('Status update failed:', e);
    }
  }, [refetch]);

  // If all sibling KOTs for a bill are 'served', advance the parent bill to 'served' too
  // so the Bills page reflects kitchen progress.
  const maybePropagateParentServed = useCallback(async (parentId: string) => {
    const sb = getSupabase();
    const { data: siblings } = await sb
      .from('orders')
      .select('id, status')
      .eq('parent_order_id', parentId);
    if (!siblings || siblings.length === 0) return;
    const allServed = (siblings as Array<{ status: string }>).every((s) => s.status === 'served');
    if (allServed) {
      await apiClient.updateOrderStatus(parentId, 'served' as OrderStatus).catch(console.error);
    }
  }, []);

  // FIRING → READY: tap item to mark as ready.
  // Uses a functional setState so bulk "SERVE ALL" style flows see the in-flight set,
  // not the stale closure from the previous render.
  const handleItemCheck = useCallback((orderId: string, item: OrderItem) => {
    apiClient.updateOrderItemStatus(orderId, item.id, 'ready').catch((e) => {
      console.error('Item status update failed:', e);
      setOptimisticReady((prev) => { const n = new Set(prev); n.delete(item.id); return n; });
    });

    setOptimisticReady((prev) => {
      const next = new Set([...prev, item.id]);
      const order = orders.find((o) => o.id === orderId);
      if (order) {
        const allItems = order.items || [];
        const allReady = allItems.every(
          (i) => next.has(i.id) || i.status === 'ready' || i.status === 'served',
        );
        if (allReady && allItems.length > 0) {
          setTimeout(() => {
            apiClient.updateOrderStatus(orderId, 'ready').then(() => refetch()).catch(console.error);
          }, 300);
        }
      }
      return next;
    });
  }, [orders, refetch]);

  // READY → SERVED: tap item to serve it individually (or bulk via SERVE ALL)
  const handleItemServe = useCallback((orderId: string, item: OrderItem) => {
    apiClient.updateOrderItemStatus(orderId, item.id, 'served').catch((e) => {
      console.error('Item serve failed:', e);
      setOptimisticServed((prev) => { const n = new Set(prev); n.delete(item.id); return n; });
    });

    setOptimisticServed((prev) => {
      const next = new Set([...prev, item.id]);
      const order = orders.find((o) => o.id === orderId);
      if (order) {
        const allItems = order.items || [];
        const allServed = allItems.every(
          (i) => next.has(i.id) || i.status === 'served',
        );
        if (allServed && allItems.length > 0) {
          setTimeout(async () => {
            try {
              await apiClient.updateOrderStatus(orderId, 'served');
              // For KOT mode: if this was a KOT and all sibling KOTs are also served,
              // advance the parent bill so /admin/bills shows 'served' too.
              if (order.is_kot && (order as any).parent_order_id) {
                await maybePropagateParentServed((order as any).parent_order_id);
              }
            } catch (e) {
              console.error(e);
            } finally {
              refetch();
            }
          }, 300);
        }
      }
      return next;
    });
  }, [orders, refetch, maybePropagateParentServed]);

  // Clean up optimistic state when server confirms
  const allServerItems = orders.flatMap((o) => o.items || []);
  const serverReadyIds = new Set(allServerItems.filter((i) => i.status === 'ready' || i.status === 'served').map((i) => i.id));
  const serverServedIds = new Set(allServerItems.filter((i) => i.status === 'served').map((i) => i.id));

  if (optimisticReady.size > 0) {
    const stillPending = new Set([...optimisticReady].filter((id) => !serverReadyIds.has(id)));
    if (stillPending.size !== optimisticReady.size) {
      queueMicrotask(() => setOptimisticReady(stillPending));
    }
  }
  if (optimisticServed.size > 0) {
    const stillPending = new Set([...optimisticServed].filter((id) => !serverServedIds.has(id)));
    if (stillPending.size !== optimisticServed.size) {
      queueMicrotask(() => setOptimisticServed(stillPending));
    }
  }

  const handleLogout = () => {
    apiClient.clearAuth();
    window.location.href = '/login';
  };

  const clock = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden select-none">

      {/* ── Header Strip ─────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold tracking-tight text-zinc-300">KDS</span>
          <div className="h-5 w-px bg-zinc-700" />
          <Pill color="bg-amber-500" count={newTickets.length} label="New" />
          <Pill color="bg-orange-500" count={firingTickets.length} label="Firing" />
          <Pill color="bg-emerald-500" count={readyTickets.length} label="Ready" />
          {doneTickets.length > 0 && <Pill color="bg-zinc-500" count={doneTickets.length} label="Done" />}
          {urgentCount > 0 && <Pill color="bg-red-500" count={urgentCount} label="Late" pulse />}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm font-mono text-zinc-500">{clock}</span>
          <div className="h-5 w-px bg-zinc-700" />
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px]',
              autoRefresh ? 'bg-emerald-500/15 text-emerald-400' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300',
            )}
          >
            <span className={cn('w-2 h-2 rounded-full', autoRefresh ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600')} />
            {autoRefresh ? 'LIVE' : 'PAUSED'}
          </button>
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="p-3 rounded-lg bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors disabled:opacity-40 min-h-[44px] min-w-[44px]"
          >
            <svg className={cn('w-4 h-4', isLoading && 'animate-spin')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <div className="h-5 w-px bg-zinc-700" />
          <span className="text-xs text-zinc-500">{user.first_name}</span>
          <button
            onClick={handleLogout}
            className="p-3 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors min-h-[44px] min-w-[44px]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      {/* ── Lanes ────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-x-auto overflow-y-hidden touch-pan-x" style={{ WebkitOverflowScrolling: 'touch' }}>
        {totalActive === 0 && !isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-5xl mb-4 opacity-20">&#x1F468;&#x200D;&#x1F373;</div>
              <p className="text-xl font-semibold text-zinc-500">All clear</p>
              <p className="text-sm text-zinc-600 mt-1">No active orders right now</p>
            </div>
          </div>
        ) : (
          <>
            <Lane
              name="new"
              tickets={newTickets}
              onStatusUpdate={handleStatusUpdate}
              onItemCheck={handleItemCheck}
              onItemServe={handleItemServe}
            />
            <Lane
              name="firing"
              tickets={firingTickets}
              onStatusUpdate={handleStatusUpdate}
              onItemCheck={handleItemCheck}
              onItemServe={handleItemServe}
            />
            <Lane
              name="ready"
              tickets={readyTickets}
              onStatusUpdate={handleStatusUpdate}
              onItemCheck={handleItemCheck}
              onItemServe={handleItemServe}
            />
            <Lane
              name="done"
              tickets={doneTickets}
              onStatusUpdate={handleStatusUpdate}
              onItemCheck={handleItemCheck}
              onItemServe={handleItemServe}
            />
          </>
        )}
      </div>
    </div>
  );
}

// ── Pill ─────────────────────────────────────────────────────────────────────

function Pill({ color, count, label, pulse }: { color: string; count: number; label: string; pulse?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn('w-2 h-2 rounded-full', color, pulse && 'animate-pulse')} />
      <span className="text-sm font-bold text-zinc-200 tabular-nums">{count}</span>
      <span className="text-xs text-zinc-500 hidden sm:inline">{label}</span>
    </div>
  );
}

// ── Lane ─────────────────────────────────────────────────────────────────────

function Lane({
  name,
  tickets,
  onStatusUpdate,
  onItemCheck,
  onItemServe,
}: {
  name: LaneName;
  tickets: LaneTicket[];
  onStatusUpdate: (id: string, s: string) => void;
  onItemCheck: (orderId: string, item: OrderItem) => void;
  onItemServe: (orderId: string, item: OrderItem) => void;
}) {
  const meta = LANE_META[name];

  // Active lanes: oldest first (kitchen works oldest-to-newest).
  // DONE lane: newest-served at the top, since it's a recent-history view.
  const sorted = [...tickets].sort((a, b) => {
    if (name === 'done') {
      const aTime = new Date(a.order.served_at || a.order.updated_at || a.order.created_at).getTime();
      const bTime = new Date(b.order.served_at || b.order.updated_at || b.order.created_at).getTime();
      return bTime - aTime;
    }
    return new Date(a.order.created_at).getTime() - new Date(b.order.created_at).getTime();
  });

  return (
    <div className="flex-1 min-w-[340px] max-w-[500px] flex flex-col border-r border-zinc-800/60 last:border-r-0">
      <div className={cn('flex-shrink-0 flex items-center justify-between px-4 py-2.5', meta.headerBg)}>
        <div className="flex items-center gap-2">
          <span className={cn('w-2.5 h-2.5 rounded-sm', meta.accent)} />
          <span className={cn('text-sm font-bold tracking-wider', meta.headerText)}>{meta.label}</span>
        </div>
        <span className={cn('text-xl font-black tabular-nums', meta.headerText)}>{tickets.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 overscroll-contain touch-pan-y" style={{ WebkitOverflowScrolling: 'touch' }}>
        {sorted.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-zinc-700 text-sm">No orders</div>
        ) : (
          sorted.map((ticket) => (
            <Ticket
              key={`${ticket.order.id}-${name}`}
              ticket={ticket}
              lane={name}
              onStatusUpdate={onStatusUpdate}
              onItemCheck={onItemCheck}
              onItemServe={onItemServe}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── Ticket ───────────────────────────────────────────────────────────────────

function Ticket({
  ticket,
  lane,
  onStatusUpdate,
  onItemCheck,
  onItemServe,
}: {
  ticket: LaneTicket;
  lane: LaneName;
  onStatusUpdate: (id: string, s: string) => void;
  onItemCheck: (orderId: string, item: OrderItem) => void;
  onItemServe: (orderId: string, item: OrderItem) => void;
}) {
  const { order, displayItems } = ticket;
  const mins = minutesAgo(order.created_at);
  const urg = urgencyColor(mins);
  const meta = LANE_META[lane];
  const headline = orderHeadline(order);
  const allItems = order.items || [];

  // In READY lane for a partially-ready order, show how many items are still cooking
  const isPartialReady = lane === 'ready' && order.status === 'preparing';
  const remainingCount = isPartialReady ? allItems.length - displayItems.length : 0;

  const isDone = lane === 'done';
  const servedTime = (order.served_at || order.updated_at)
    ? new Date(order.served_at || order.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div
      className={cn(
        'rounded-lg border-l-4 overflow-hidden animate-kds-enter transition-colors duration-200',
        isDone ? 'bg-zinc-900/60' : 'bg-zinc-900',
        meta.border,
        urg.pulse && lane !== 'ready' && lane !== 'done' && 'ring-1 ring-red-500/50',
      )}
    >
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className={cn('font-black tracking-tight text-zinc-100', isDone ? 'text-lg' : 'text-2xl')}>{headline}</span>
          {(() => {
            const token = order.token_number ?? (order as any).parent_order?.token_number
            return token != null ? (
              <span className={cn(
                'font-black tracking-wider px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 tabular-nums',
                isDone ? 'text-xs' : 'text-sm',
              )}>
                #{String(token).padStart(4, '0')}
              </span>
            ) : null
          })()}
        </div>
        {isDone ? (
          <span className="text-xs text-zinc-500 tabular-nums">{servedTime}</span>
        ) : (
          <div className={cn('flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold tabular-nums', urg.bg + '/20', urg.text)}>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {mins}m
          </div>
        )}
      </div>

      <div className="px-3 pb-2 flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-zinc-500">#{order.order_number}</span>
        {order.customer_name && (
          <span className="text-xs text-zinc-600 truncate max-w-[120px]">{order.customer_name}</span>
        )}
        {(() => {
          const u = (order as any).created_by_user
          const name = u?.first_name || u?.username
          return name ? (
            <span className="text-[10px] text-zinc-500 truncate max-w-[120px]">by {name}</span>
          ) : null
        })()}
        {order.is_kot && order.kot_number && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400">KOT</span>
        )}
      </div>

      {/* ── Items ─────────────────────────────────────────────────────────── */}
      <div className="px-3 pb-3 space-y-0.5">
        {displayItems.map((item) => (
          <div key={item.id} className="flex flex-col">
            {lane === 'firing' ? (
              /* FIRING: tappable row — tap to mark ready */
              <button
                onClick={() => onItemCheck(order.id, item)}
                className="flex items-center gap-3 w-full text-left min-h-[48px] py-3 px-3 -mx-2 rounded-lg transition-colors hover:bg-zinc-800 active:bg-zinc-700 active:scale-[0.98]"
              >
                <span className="flex-shrink-0 w-8 h-8 rounded-full border-2 border-zinc-600 flex items-center justify-center" />
                <span className="flex-1 text-base font-semibold text-zinc-200 leading-tight">
                  <span className="text-zinc-400 font-bold mr-1">{item.quantity}x</span>
                  {item.product?.name || 'Item'}
                </span>
              </button>
            ) : lane === 'ready' ? (
              /* READY: tap to serve */
              <button
                onClick={() => onItemServe(order.id, item)}
                className="flex items-center gap-3 w-full text-left min-h-[48px] py-3 px-3 -mx-2 rounded-lg transition-colors hover:bg-zinc-800 active:bg-zinc-700 active:scale-[0.98]"
              >
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500 border-2 border-emerald-500 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                <span className="flex-1 text-base font-semibold text-emerald-300 leading-tight">
                  <span className="text-emerald-500 font-bold mr-1">{item.quantity}x</span>
                  {item.product?.name || 'Item'}
                </span>
                <span className="text-[10px] font-bold text-zinc-500 uppercase">tap to serve</span>
              </button>
            ) : lane === 'done' ? (
              /* DONE: dimmed item, no interaction */
              <div className="flex items-center gap-3 py-1 px-2 -mx-2 opacity-50">
                <span className="flex-shrink-0 w-2 h-2 rounded-full bg-zinc-600" />
                <span className="flex-1 text-xs text-zinc-500 leading-tight">
                  <span className="font-bold mr-1">{item.quantity}x</span>
                  {item.product?.name || 'Item'}
                </span>
              </div>
            ) : (
              /* NEW: plain item list, no interaction */
              <div className="flex items-center gap-3 min-h-[44px] py-2.5 px-3 -mx-2">
                <span className="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-zinc-600" />
                <span className="flex-1 text-base font-semibold text-zinc-200 leading-tight">
                  <span className="text-zinc-400 font-bold mr-1">{item.quantity}x</span>
                  {item.product?.name || 'Item'}
                </span>
              </div>
            )}

            {/* Combo sub-items */}
            {Array.isArray(item.combo_choices) && item.combo_choices.length > 0 && lane !== 'done' && (
              <div className={cn('mb-1 space-y-0.5', lane === 'firing' || lane === 'ready' ? 'ml-10' : 'ml-5')}>
                {item.combo_choices.map((choice, idx) => (
                  <div key={idx} className="text-xs text-zinc-400">
                    <span className="text-zinc-500">•</span> {choice.product_name}
                    {choice.selected_options && (() => {
                      const opts = typeof choice.selected_options === 'string' ? (() => { try { return JSON.parse(choice.selected_options) } catch { return [] } })() : choice.selected_options
                      return Array.isArray(opts) && opts.length > 0 ? (
                        <span className="text-zinc-600 ml-1">
                          ({opts.map((o: any) => o.option_name || o.name).join(', ')})
                        </span>
                      ) : null
                    })()}
                  </div>
                ))}
              </div>
            )}

            {/* Special instructions (hidden in done lane) */}
            {item.special_instructions && lane !== 'done' && (
              <div className={cn('mb-1 px-2 py-1 rounded bg-yellow-500/15 border border-yellow-500/20', lane === 'firing' ? 'ml-10' : 'ml-5')}>
                <span className="text-xs font-medium text-yellow-300">{item.special_instructions}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Still cooking indicator in READY lane */}
      {isPartialReady && remainingCount > 0 && (
        <div className="px-3 pb-2">
          <span className="text-xs text-orange-400/70">{remainingCount} more item{remainingCount > 1 ? 's' : ''} still firing...</span>
        </div>
      )}

      {/* Order notes (hidden in done lane) */}
      {order.notes && lane !== 'done' && (
        <div className="mx-3 mb-2 px-2 py-1.5 rounded bg-sky-500/10 border border-sky-500/20">
          <span className="text-xs text-sky-300">{order.notes}</span>
        </div>
      )}

      {/* ── Action Button ─────────────────────────────────────────────────── */}
      {lane === 'new' && (
        <button
          onClick={() => onStatusUpdate(order.id, 'preparing')}
          className="w-full min-h-[56px] py-4 text-lg font-black tracking-wider text-white bg-amber-500 hover:bg-amber-400 active:bg-amber-600 active:scale-[0.98] transition-all"
        >
          START
        </button>
      )}
      {/* READY: bulk serve all visible items at once */}
      {lane === 'ready' && displayItems.length > 1 && (
        <button
          onClick={() => {
            displayItems.forEach((item) => onItemServe(order.id, item));
          }}
          className="w-full min-h-[56px] py-4 text-base font-black tracking-wider text-white bg-sky-500 hover:bg-sky-400 active:bg-sky-600 active:scale-[0.98] transition-all"
        >
          SERVE ALL ({displayItems.length})
        </button>
      )}
    </div>
  );
}
