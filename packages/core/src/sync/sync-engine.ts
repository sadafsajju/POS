import type { OfflineQueueItem } from '@pos/types';

export interface SyncConfig {
  maxRetries: number;
  retryDelayMs: number;
  batchSize: number;
}

export interface SyncResult {
  success: boolean;
  syncedItems: string[];
  failedItems: string[];
  errors: Record<string, string>;
}

/**
 * Handler function that processes a single offline queue item.
 * Must be registered per entity+action before syncing.
 */
type SyncHandler = (data: unknown) => Promise<{ success: boolean; message?: string }>;

export class SyncEngine {
  private config: SyncConfig;
  private isSyncing: boolean = false;
  private handlers: Map<string, SyncHandler> = new Map();

  constructor(config: Partial<SyncConfig> = {}) {
    this.config = {
      maxRetries: 3,
      retryDelayMs: 1000,
      batchSize: 10,
      ...config,
    };
  }

  /**
   * Register a handler for a specific entity+action combination.
   * e.g., registerHandler('orders', 'create', (data) => ordersDb.createOrder(data))
   */
  registerHandler(entity: string, action: string, handler: SyncHandler): void {
    this.handlers.set(`${entity}:${action}`, handler);
  }

  async sync(queue: OfflineQueueItem[]): Promise<SyncResult> {
    if (this.isSyncing) {
      return {
        success: false,
        syncedItems: [],
        failedItems: [],
        errors: { sync: 'Sync already in progress' },
      };
    }

    this.isSyncing = true;
    const result: SyncResult = {
      success: true,
      syncedItems: [],
      failedItems: [],
      errors: {},
    };

    try {
      for (let i = 0; i < queue.length; i += this.config.batchSize) {
        const batch = queue.slice(i, i + this.config.batchSize);

        for (const item of batch) {
          try {
            await this.syncItem(item);
            result.syncedItems.push(item.id);
          } catch (error) {
            result.failedItems.push(item.id);
            result.errors[item.id] = error instanceof Error ? error.message : 'Unknown error';
            result.success = false;
          }
        }
      }
    } finally {
      this.isSyncing = false;
    }

    return result;
  }

  private async syncItem(item: OfflineQueueItem): Promise<void> {
    const key = `${item.entity}:${item.action}`;
    const handler = this.handlers.get(key);

    if (!handler) {
      throw new Error(`No sync handler registered for ${key}`);
    }

    const result = await handler(item.data);
    if (!result.success) {
      throw new Error(result.message || `Sync failed for ${key}`);
    }
  }
}

export const syncEngine = new SyncEngine();
