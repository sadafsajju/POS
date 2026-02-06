import type { OfflineQueueItem } from '@pos/types';

export interface SyncConfig {
  apiBaseUrl: string;
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

export class SyncEngine {
  private config: SyncConfig;
  private isSyncing: boolean = false;

  constructor(config: Partial<SyncConfig> = {}) {
    this.config = {
      apiBaseUrl: '',
      maxRetries: 3,
      retryDelayMs: 1000,
      batchSize: 10,
      ...config,
    };
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
      // Process in batches
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
    const endpoint = this.getEndpoint(item.entity, item.action);
    const method = this.getMethod(item.action);

    const response = await fetch(`${this.config.apiBaseUrl}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(item.data),
    });

    if (!response.ok) {
      throw new Error(`Sync failed: ${response.statusText}`);
    }
  }

  private getEndpoint(entity: string, action: string): string {
    const endpoints: Record<string, Record<string, string>> = {
      orders: {
        create: '/api/orders',
        update: '/api/orders',
        delete: '/api/orders',
      },
      products: {
        create: '/api/products',
        update: '/api/products',
        delete: '/api/products',
      },
    };

    return endpoints[entity]?.[action] || `/api/${entity}`;
  }

  private getMethod(action: string): string {
    const methods: Record<string, string> = {
      create: 'POST',
      update: 'PUT',
      delete: 'DELETE',
    };
    return methods[action] || 'POST';
  }

  setApiBaseUrl(url: string): void {
    this.config.apiBaseUrl = url;
  }
}

export const syncEngine = new SyncEngine();
