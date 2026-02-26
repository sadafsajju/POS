import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import apiClient from '@/api/client';
import { kitchenSoundService } from '@/services/soundService';
import type { Order } from '@/types';

// ── Types ────────────────────────────────────────────────────────────────────

interface TokenOrder {
  order: Order;
  tokenNumber: string;
}

// ── Token partitioning ───────────────────────────────────────────────────────

function partitionOrders(orders: Order[]): { preparing: TokenOrder[]; ready: TokenOrder[] } {
  const preparing: TokenOrder[] = [];
  const ready: TokenOrder[] = [];

  for (const order of orders) {
    const tokenNumber = order.token_number
      ? String(order.token_number).padStart(4, '0')
      : order.order_number;

    if (order.status === 'confirmed' || order.status === 'preparing') {
      preparing.push({ order, tokenNumber });
    } else if (order.status === 'ready') {
      ready.push({ order, tokenNumber });
    }
  }

  // Sort by token number ascending
  preparing.sort((a, b) => a.tokenNumber.localeCompare(b.tokenNumber));
  ready.sort((a, b) => a.tokenNumber.localeCompare(b.tokenNumber));

  return { preparing, ready };
}

// ── Header ───────────────────────────────────────────────────────────────────

function TokenHeader() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = time.getHours();
  const minutes = time.getMinutes().toString().padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;

  return (
    <header className="flex-shrink-0 flex items-center justify-between px-8 py-5 bg-zinc-900 border-b border-zinc-800">
      <h1 className="text-3xl font-black tracking-tight text-zinc-100">
        ORDER STATUS
      </h1>
      <div className="flex items-center gap-3 text-zinc-400">
        <Clock className="w-6 h-6" />
        <span className="text-2xl font-mono tabular-nums tracking-widest">
          {displayHours}:{minutes} {period}
        </span>
      </div>
    </header>
  );
}

// ── Token Row ────────────────────────────────────────────────────────────────

interface TokenRowProps {
  tokenOrder: TokenOrder;
  isReady: boolean;
}

function TokenRow({ tokenOrder, isReady }: TokenRowProps) {
  const { order, tokenNumber } = tokenOrder;

  const orderTypeLabel =
    {
      dine_in: 'Dine-in',
      takeout: 'Takeout',
      delivery: 'Delivery',
    }[order.order_type] || order.order_type;

  const orderSource = order.order_source;
  const isNonPos = orderSource && orderSource !== 'pos';

  const sourceBadge: Record<string, { bg: string; text: string; label: string }> = {
    kiosk: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', label: 'Kiosk' },
    swiggy: { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'Swiggy' },
    zomato: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Zomato' },
  };

  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-lg px-5 py-3 transition-all',
        isReady
          ? 'bg-emerald-500/10 border border-emerald-500/30 animate-pulse'
          : 'bg-zinc-900 border border-zinc-800'
      )}
    >
      <span
        className={cn(
          'text-4xl font-black tabular-nums',
          isReady ? 'text-emerald-400' : 'text-amber-400'
        )}
      >
        {tokenNumber}
      </span>

      {isNonPos && orderSource && sourceBadge[orderSource] ? (
        <span
          className={cn(
            'text-xs font-bold px-2.5 py-1 rounded-full',
            sourceBadge[orderSource].bg,
            sourceBadge[orderSource].text
          )}
        >
          {sourceBadge[orderSource].label}
        </span>
      ) : (
        <span className="text-sm font-medium text-zinc-500">
          {orderTypeLabel}
        </span>
      )}
    </div>
  );
}

// ── Token Column ─────────────────────────────────────────────────────────────

interface TokenColumnProps {
  title: string;
  tokens: TokenOrder[];
  colorScheme: 'amber' | 'emerald';
}

function TokenColumn({ title, tokens, colorScheme }: TokenColumnProps) {
  const colors = {
    amber: {
      headerBg: 'bg-amber-500/15',
      headerText: 'text-amber-400',
      dot: 'bg-amber-500',
    },
    emerald: {
      headerBg: 'bg-emerald-500/15',
      headerText: 'text-emerald-400',
      dot: 'bg-emerald-500',
    },
  };
  const c = colors[colorScheme];

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className={cn('flex items-center justify-between px-6 py-4', c.headerBg)}>
        <div className="flex items-center gap-3">
          <span className={cn('w-3 h-3 rounded-full', c.dot)} />
          <span className={cn('text-2xl font-black tracking-widest', c.headerText)}>
            {title}
          </span>
        </div>
        <span className={cn('text-3xl font-black tabular-nums', c.headerText)}>
          {tokens.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {tokens.length === 0 ? (
          <div className="flex items-center justify-center h-full text-zinc-700 text-lg">
            No orders
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {tokens.map((tokenOrder) => (
              <TokenRow
                key={tokenOrder.order.id}
                tokenOrder={tokenOrder}
                isReady={colorScheme === 'emerald'}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function TokenDisplay() {
  const [audioActivated, setAudioActivated] = useState(false);
  const previousReadyIdsRef = useRef<Set<string>>(new Set());

  // Fetch active orders (confirmed, preparing, ready)
  const { data: kitchenOrders = [] } = useQuery({
    queryKey: ['tokenDisplay', 'kitchenOrders'],
    queryFn: () => apiClient.getKitchenOrders('all'),
    refetchInterval: 5000,
    select: (d) => (Array.isArray(d.data) ? d.data : []),
    enabled: audioActivated,
  });

  // Partition into columns using backend-provided token_number
  const { preparing, ready } = useMemo(
    () => partitionOrders(kitchenOrders),
    [kitchenOrders]
  );

  // Sound alerts for newly ready orders
  useEffect(() => {
    if (!audioActivated) return;

    const currentReadyIds = new Set(ready.map((t) => t.order.id));
    const prev = previousReadyIdsRef.current;

    const newReadyOrders = ready.filter((t) => !prev.has(t.order.id));
    if (newReadyOrders.length > 0) {
      kitchenSoundService
        .playOrderReadySound(newReadyOrders[0].order.id, newReadyOrders[0].order.order_type)
        .catch(() => {});
    }

    previousReadyIdsRef.current = currentReadyIds;
  }, [ready, audioActivated]);

  // Audio activation screen (browser requires user gesture for audio)
  if (!audioActivated) {
    return (
      <div
        className="h-screen bg-zinc-950 flex items-center justify-center cursor-pointer select-none"
        onClick={async () => {
          try {
            await kitchenSoundService.initialize();
          } catch { /* ignore */ }
          setAudioActivated(true);
        }}
      >
        <div className="text-center space-y-6">
          <h1 className="text-5xl font-black text-zinc-100">Order Status</h1>
          <p className="text-2xl text-zinc-500">Tap anywhere to start</p>
          <div className="w-16 h-16 mx-auto border-4 border-zinc-700 rounded-full flex items-center justify-center">
            <Volume2 className="w-8 h-8 text-zinc-600" />
          </div>
        </div>
      </div>
    );
  }

  // Main display
  return (
    <div className="h-screen bg-zinc-950 text-zinc-100 flex flex-col select-none overflow-hidden">
      <TokenHeader />
      <div className="flex-1 flex overflow-hidden">
        <TokenColumn title="PREPARING" tokens={preparing} colorScheme="amber" />
        <div className="w-px bg-zinc-800" />
        <TokenColumn title="READY" tokens={ready} colorScheme="emerald" />
      </div>
    </div>
  );
}
