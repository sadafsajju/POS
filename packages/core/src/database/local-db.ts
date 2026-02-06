// Local database abstraction for SQLite (Tauri) or IndexedDB (Web)

export interface LocalDatabase {
  init(): Promise<void>;
  execute(sql: string, params?: unknown[]): Promise<void>;
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  close(): Promise<void>;
}

export type DatabaseType = 'sqlite' | 'indexeddb';

// Will be implemented differently for Tauri (SQLite) vs Web (IndexedDB)
export class LocalDatabaseFactory {
  private static instance: LocalDatabase | null = null;

  static async create(type: DatabaseType): Promise<LocalDatabase> {
    if (this.instance) {
      return this.instance;
    }

    if (type === 'sqlite') {
      // Tauri SQLite implementation
      this.instance = await this.createSqliteDatabase();
    } else {
      // IndexedDB implementation for web
      this.instance = await this.createIndexedDBDatabase();
    }

    return this.instance;
  }

  private static async createSqliteDatabase(): Promise<LocalDatabase> {
    // Dynamic import for Tauri environment
    try {
      const { Database } = await import('@tauri-apps/plugin-sql');
      const db = await Database.load('sqlite:pos.db');

      return {
        async init() {
          // Run migrations
          await this.execute(`
            CREATE TABLE IF NOT EXISTS sync_queue (
              id TEXT PRIMARY KEY,
              action TEXT NOT NULL,
              entity TEXT NOT NULL,
              data TEXT NOT NULL,
              timestamp TEXT NOT NULL,
              retries INTEGER DEFAULT 0
            )
          `);
        },

        async execute(sql: string, params?: unknown[]) {
          await db.execute(sql, params);
        },

        async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
          return await db.select(sql, params);
        },

        async close() {
          await db.close();
        },
      };
    } catch {
      console.warn('SQLite not available, falling back to IndexedDB');
      return this.createIndexedDBDatabase();
    }
  }

  private static async createIndexedDBDatabase(): Promise<LocalDatabase> {
    // IndexedDB wrapper for web environment
    return {
      async init() {
        return new Promise((resolve, reject) => {
          const request = indexedDB.open('pos_db', 1);

          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve();

          request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            if (!db.objectStoreNames.contains('sync_queue')) {
              db.createObjectStore('sync_queue', { keyPath: 'id' });
            }

            if (!db.objectStoreNames.contains('orders')) {
              const orderStore = db.createObjectStore('orders', { keyPath: 'id' });
              orderStore.createIndex('status', 'status', { unique: false });
            }

            if (!db.objectStoreNames.contains('products')) {
              const productStore = db.createObjectStore('products', { keyPath: 'id' });
              productStore.createIndex('categoryId', 'categoryId', { unique: false });
            }
          };
        });
      },

      async execute(_sql: string, _params?: unknown[]) {
        // IndexedDB doesn't use SQL, operations are done via stores
        console.warn('SQL execute not supported in IndexedDB mode');
      },

      async query<T>(_sql: string, _params?: unknown[]): Promise<T[]> {
        // IndexedDB doesn't use SQL
        console.warn('SQL query not supported in IndexedDB mode');
        return [];
      },

      async close() {
        // IndexedDB connections are managed automatically
      },
    };
  }

  static getInstance(): LocalDatabase | null {
    return this.instance;
  }
}
