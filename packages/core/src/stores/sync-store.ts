import { create } from 'zustand';
import type { SyncStatus, OfflineQueueItem } from '@pos/types';

interface SyncStore extends SyncStatus {
  queue: OfflineQueueItem[];

  // Connection
  setOnline: (isOnline: boolean) => void;

  // Queue management
  addToQueue: (item: Omit<OfflineQueueItem, 'id' | 'timestamp' | 'retries'>) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
  incrementRetries: (id: string) => void;

  // Sync actions
  startSync: () => void;
  completeSync: () => void;
  failSync: () => void;
}

const generateId = () => `sync_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

export const useSyncStore = create<SyncStore>((set) => ({
  isOnline: true,
  lastSyncAt: null,
  pendingChanges: 0,
  isSyncing: false,
  queue: [],

  setOnline: (isOnline) => {
    set({ isOnline });
  },

  addToQueue: (item) => {
    const queueItem: OfflineQueueItem = {
      ...item,
      id: generateId(),
      timestamp: new Date(),
      retries: 0,
    };

    set((state) => ({
      queue: [...state.queue, queueItem],
      pendingChanges: state.pendingChanges + 1,
    }));
  },

  removeFromQueue: (id) => {
    set((state) => ({
      queue: state.queue.filter((item) => item.id !== id),
      pendingChanges: Math.max(0, state.pendingChanges - 1),
    }));
  },

  clearQueue: () => {
    set({ queue: [], pendingChanges: 0 });
  },

  incrementRetries: (id) => {
    set((state) => ({
      queue: state.queue.map((item) =>
        item.id === id ? { ...item, retries: item.retries + 1 } : item
      ),
    }));
  },

  startSync: () => {
    set({ isSyncing: true });
  },

  completeSync: () => {
    set({
      isSyncing: false,
      lastSyncAt: new Date(),
    });
  },

  failSync: () => {
    set({ isSyncing: false });
  },
}));

// Auto-detect online/offline status
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useSyncStore.getState().setOnline(true);
  });

  window.addEventListener('offline', () => {
    useSyncStore.getState().setOnline(false);
  });
}
