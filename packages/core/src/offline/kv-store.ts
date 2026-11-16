// Persistent key-value storage for offline support.
// Tauri: SQLite via @tauri-apps/plugin-sql (survives restarts, no size limits).
// Web: localStorage fallback (dev mode / browser).

export interface KVStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

const isTauri = () => typeof window !== 'undefined' && '__TAURI__' in window;

const LS_PREFIX = 'pos_kv:';

class LocalStorageKV implements KVStore {
  async get(key: string): Promise<string | null> {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(LS_PREFIX + key);
  }
  async set(key: string, value: string): Promise<void> {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(LS_PREFIX + key, value);
  }
  async remove(key: string): Promise<void> {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(LS_PREFIX + key);
  }
}

interface SqlDatabase {
  execute(sql: string, params?: unknown[]): Promise<unknown>;
  select<T>(sql: string, params?: unknown[]): Promise<T>;
}

class SqliteKV implements KVStore {
  constructor(private db: SqlDatabase) {}

  async get(key: string): Promise<string | null> {
    const rows = await this.db.select<Array<{ value: string }>>(
      'SELECT value FROM offline_kv WHERE key = $1',
      [key]
    );
    return rows.length > 0 ? rows[0].value : null;
  }

  async set(key: string, value: string): Promise<void> {
    await this.db.execute(
      `INSERT INTO offline_kv (key, value, updated_at) VALUES ($1, $2, $3)
       ON CONFLICT(key) DO UPDATE SET value = $2, updated_at = $3`,
      [key, value, new Date().toISOString()]
    );
  }

  async remove(key: string): Promise<void> {
    await this.db.execute('DELETE FROM offline_kv WHERE key = $1', [key]);
  }
}

let kvPromise: Promise<KVStore> | null = null;

async function createKV(): Promise<KVStore> {
  if (isTauri()) {
    try {
      const mod = await import('@tauri-apps/plugin-sql');
      const Database = mod.default;
      const db = (await Database.load('sqlite:pos_offline.db')) as unknown as SqlDatabase;
      await db.execute(`
        CREATE TABLE IF NOT EXISTS offline_kv (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      return new SqliteKV(db);
    } catch (e) {
      console.warn('[offline] SQLite unavailable, falling back to localStorage:', e);
    }
  }
  return new LocalStorageKV();
}

/** Get the shared KV store (initialized lazily, singleton). */
export function getKV(): Promise<KVStore> {
  if (!kvPromise) kvPromise = createKV();
  return kvPromise;
}
