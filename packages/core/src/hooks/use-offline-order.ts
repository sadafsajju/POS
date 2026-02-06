import { useState, useCallback, useEffect } from 'react';
import { useSyncStore } from '../stores/sync-store';
import type { CreateOrderRequest, OfflineOrder, Order, ApiResponse } from '@pos/types';

// Generate a unique local ID for offline orders
const generateLocalId = () =>
  `offline_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

// Generate a temporary order number for display
const generateTempOrderNumber = () =>
  `TEMP-${Date.now().toString(36).toUpperCase()}`;

// Local storage key for offline orders
const OFFLINE_ORDERS_KEY = 'pos_offline_orders';

// Load offline orders from local storage
const loadOfflineOrders = (): OfflineOrder[] => {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(OFFLINE_ORDERS_KEY);
    if (!stored) return [];
    const orders = JSON.parse(stored);
    // Convert date strings back to Date objects
    return orders.map((o: OfflineOrder) => ({
      ...o,
      createdAt: new Date(o.createdAt),
    }));
  } catch (e) {
    console.error('Failed to load offline orders:', e);
    return [];
  }
};

// Save offline orders to local storage
const saveOfflineOrders = (orders: OfflineOrder[]): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(OFFLINE_ORDERS_KEY, JSON.stringify(orders));
  } catch (e) {
    console.error('Failed to save offline orders:', e);
  }
};

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
  createOrder: (order: CreateOrderRequest) => Promise<Order | OfflineOrder>;
  // Get all pending offline orders
  pendingOrders: OfflineOrder[];
  // Sync all pending orders
  syncPendingOrders: () => Promise<void>;
  // Remove a pending order (e.g., after it's synced or cancelled)
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
  const { isOnline, addToQueue, removeFromQueue, startSync, completeSync, failSync, isSyncing } = useSyncStore();
  const [pendingOrders, setPendingOrders] = useState<OfflineOrder[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  // Load offline orders on mount
  useEffect(() => {
    setPendingOrders(loadOfflineOrders());
  }, []);

  // Create an order - works online or offline
  const createOrder = useCallback(
    async (orderRequest: CreateOrderRequest): Promise<Order | OfflineOrder> => {
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
        } else {
          // Offline: store locally and queue for sync
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
          };

          // Add to local state and persist
          const updatedOrders = [...pendingOrders, offlineOrder];
          setPendingOrders(updatedOrders);
          saveOfflineOrders(updatedOrders);

          // Add to sync queue
          addToQueue({
            action: 'create',
            entity: 'order',
            data: orderRequest,
          });

          onSuccess?.(offlineOrder, true);
          return offlineOrder;
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        onError?.(err);
        throw err;
      } finally {
        setIsCreating(false);
      }
    },
    [isOnline, createOrderApi, onSuccess, onError, addToQueue, pendingOrders]
  );

  // Sync all pending orders
  const syncPendingOrders = useCallback(async () => {
    if (!isOnline || pendingOrders.length === 0 || isSyncing) return;

    startSync();

    const remainingOrders: OfflineOrder[] = [];
    const syncedOrderIds: string[] = [];

    for (const offlineOrder of pendingOrders) {
      if (offlineOrder.status === 'synced') continue;

      try {
        // Mark as syncing
        offlineOrder.status = 'syncing';

        // Create the order via API
        const orderRequest: CreateOrderRequest = {
          table_id: offlineOrder.tableId,
          customer_name: offlineOrder.customerName,
          order_type: offlineOrder.orderType,
          items: offlineOrder.items,
          notes: offlineOrder.notes,
        };

        const response = await createOrderApi(orderRequest);

        if (response.success && response.data) {
          // Mark as synced
          offlineOrder.status = 'synced';
          syncedOrderIds.push(offlineOrder.localId);
        } else {
          // Mark as failed
          offlineOrder.status = 'failed';
          offlineOrder.syncError = response.message || 'Unknown error';
          remainingOrders.push(offlineOrder);
        }
      } catch (error) {
        // Mark as failed
        offlineOrder.status = 'failed';
        offlineOrder.syncError = error instanceof Error ? error.message : 'Unknown error';
        remainingOrders.push(offlineOrder);
      }
    }

    // Update state and persist
    setPendingOrders(remainingOrders);
    saveOfflineOrders(remainingOrders);

    // Remove synced items from queue
    syncedOrderIds.forEach((id) => removeFromQueue(id));

    if (remainingOrders.length === 0) {
      completeSync();
    } else {
      failSync();
    }
  }, [isOnline, pendingOrders, isSyncing, createOrderApi, startSync, completeSync, failSync, removeFromQueue]);

  // Remove a pending order
  const removePendingOrder = useCallback(
    (localId: string) => {
      const updatedOrders = pendingOrders.filter((o) => o.localId !== localId);
      setPendingOrders(updatedOrders);
      saveOfflineOrders(updatedOrders);
      removeFromQueue(localId);
    },
    [pendingOrders, removeFromQueue]
  );

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pendingOrders.length > 0 && !isSyncing) {
      // Small delay to ensure connection is stable
      const timer = setTimeout(() => {
        syncPendingOrders();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, pendingOrders.length, isSyncing, syncPendingOrders]);

  return {
    createOrder,
    pendingOrders,
    syncPendingOrders,
    removePendingOrder,
    isCreating,
    isSyncing,
  };
}
