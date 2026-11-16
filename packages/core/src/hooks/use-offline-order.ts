import { useState, useCallback, useEffect } from 'react';
import { useSyncStore } from '../stores/sync-store';
import {
  addOfflineOrder,
  getOfflineOrders,
  removeOfflineOrder,
  enqueue,
  generateLocalId,
  ORDERS_CHANGED_EVENT,
  SYNC_COMPLETE_EVENT,
} from '../offline/offline-queue';
import { syncNow } from '../offline/sync-manager';
import type { CreateOrderRequest, OfflineOrder, Order, ApiResponse } from '@pos/types';

// Generate a temporary order number for display
const generateTempOrderNumber = () =>
  `TEMP-${Date.now().toString(36).toUpperCase()}`;

/** Locally-computed money + display info for offline receipts and payments. */
export interface OfflineOrderComputed {
  subtotal?: number;
  tax_amount?: number;
  total_amount?: number;
  display_items?: Array<{
    product_id: string;
    name: string;
    quantity: number;
    price: number;
  }>;
}

interface UseOfflineOrderOptions {
  // The API function to call when online
  createOrderApi: (order: CreateOrderRequest) => Promise<ApiResponse<Order>>;
  // Called when order is created successfully (online or queued)
  onSuccess?: (order: Order | OfflineOrder, isOffline: boolean) => void;
  // Called when order creation fails
  onError?: (error: Error) => void;
}

interface UseOfflineOrderReturn {
  // Create an order (online or offline)
  createOrder: (
    order: CreateOrderRequest,
    computed?: OfflineOrderComputed
  ) => Promise<Order | OfflineOrder>;
  // Get all pending offline orders
  pendingOrders: OfflineOrder[];
  // Sync all pending queue items now
  syncPendingOrders: () => Promise<void>;
  // Remove a pending order (e.g., after it's cancelled)
  removePendingOrder: (localId: string) => void;
  // Loading state
  isCreating: boolean;
  // Whether currently syncing
  isSyncing: boolean;
}

export function useOfflineOrder({
  createOrderApi,
  onSuccess,
  onError,
}: UseOfflineOrderOptions): UseOfflineOrderReturn {
  const { isOnline, isSyncing } = useSyncStore();
  const [pendingOrders, setPendingOrders] = useState<OfflineOrder[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const refreshPendingOrders = useCallback(() => {
    void getOfflineOrders().then(setPendingOrders);
  }, []);

  // Load offline orders on mount and whenever the offline store changes
  // (order queued, synced away, or removed — including from other components).
  useEffect(() => {
    refreshPendingOrders();
    if (typeof window === 'undefined') return;
    window.addEventListener(ORDERS_CHANGED_EVENT, refreshPendingOrders);
    window.addEventListener(SYNC_COMPLETE_EVENT, refreshPendingOrders);
    return () => {
      window.removeEventListener(ORDERS_CHANGED_EVENT, refreshPendingOrders);
      window.removeEventListener(SYNC_COMPLETE_EVENT, refreshPendingOrders);
    };
  }, [refreshPendingOrders]);

  // Create an order - works online or offline
  const createOrder = useCallback(
    async (
      orderRequest: CreateOrderRequest,
      computed?: OfflineOrderComputed
    ): Promise<Order | OfflineOrder> => {
      setIsCreating(true);

      try {
        if (isOnline) {
          // Online: call the API directly
          const response = await createOrderApi(orderRequest);
          if (response.success && response.data) {
            onSuccess?.(response.data, false);
            return response.data;
          } else {
            throw new Error(response.message || 'Failed to create order');
          }
        }

        // Offline: store locally and add to the persistent sync queue
        const offlineOrder: OfflineOrder = {
          localId: generateLocalId(),
          orderNumber: generateTempOrderNumber(),
          tableId: orderRequest.table_id,
          customerName: orderRequest.customer_name,
          orderType: orderRequest.order_type,
          items: orderRequest.items,
          notes: orderRequest.notes,
          status: 'pending_sync',
          createdAt: new Date(),
          ...computed,
        };

        await addOfflineOrder(offlineOrder);
        await enqueue({
          entity: 'order',
          action: 'create',
          data: { local_id: offlineOrder.localId, request: orderRequest },
        });

        onSuccess?.(offlineOrder, true);
        return offlineOrder;
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        onError?.(err);
        throw err;
      } finally {
        setIsCreating(false);
      }
    },
    [isOnline, createOrderApi, onSuccess, onError]
  );

  // Drain the persistent queue (orders, payments, discounts, table ops)
  const syncPendingOrders = useCallback(async () => {
    await syncNow();
  }, []);

  // Remove a pending order and any queued writes that reference it
  const removePendingOrder = useCallback((localId: string) => {
    void removeOfflineOrder(localId);
  }, []);

  return {
    createOrder,
    pendingOrders,
    syncPendingOrders,
    removePendingOrder,
    isCreating,
    isSyncing,
  };
}
