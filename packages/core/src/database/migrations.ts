// Database migrations for SQLite

export interface Migration {
  version: number;
  name: string;
  up: string;
  down: string;
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'create_sync_queue',
    up: `
      CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        entity TEXT NOT NULL,
        data TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        retries INTEGER DEFAULT 0
      );
    `,
    down: 'DROP TABLE IF EXISTS sync_queue;',
  },
  {
    version: 2,
    name: 'create_local_orders',
    up: `
      CREATE TABLE IF NOT EXISTS local_orders (
        id TEXT PRIMARY KEY,
        order_number TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        table_id TEXT,
        customer_id TEXT,
        items TEXT NOT NULL,
        subtotal REAL NOT NULL,
        tax_amount REAL NOT NULL,
        discount_amount REAL NOT NULL,
        total REAL NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by TEXT NOT NULL,
        paid_at TEXT,
        payment_method TEXT,
        synced INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_orders_status ON local_orders(status);
      CREATE INDEX IF NOT EXISTS idx_orders_synced ON local_orders(synced);
    `,
    down: 'DROP TABLE IF EXISTS local_orders;',
  },
  {
    version: 3,
    name: 'create_local_products',
    up: `
      CREATE TABLE IF NOT EXISTS local_products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        category_id TEXT NOT NULL,
        image TEXT,
        sku TEXT,
        barcode TEXT,
        is_active INTEGER DEFAULT 1,
        stock_quantity INTEGER,
        variants TEXT,
        modifiers TEXT,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_products_category ON local_products(category_id);
      CREATE INDEX IF NOT EXISTS idx_products_barcode ON local_products(barcode);
    `,
    down: 'DROP TABLE IF EXISTS local_products;',
  },
  {
    version: 4,
    name: 'create_local_categories',
    up: `
      CREATE TABLE IF NOT EXISTS local_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        image TEXT,
        sort_order INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1
      );
    `,
    down: 'DROP TABLE IF EXISTS local_categories;',
  },
  {
    version: 5,
    name: 'create_settings',
    up: `
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
    down: 'DROP TABLE IF EXISTS settings;',
  },
];

export async function runMigrations(
  execute: (sql: string) => Promise<void>,
  query: <T>(sql: string) => Promise<T[]>
): Promise<void> {
  // Create migrations table
  await execute(`
    CREATE TABLE IF NOT EXISTS migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  // Get applied migrations
  const applied = await query<{ version: number }>('SELECT version FROM migrations');
  const appliedVersions = new Set(applied.map((m) => m.version));

  // Run pending migrations
  for (const migration of migrations) {
    if (!appliedVersions.has(migration.version)) {
      console.log(`Running migration: ${migration.name}`);
      await execute(migration.up);
      await execute(`
        INSERT INTO migrations (version, name, applied_at)
        VALUES (${migration.version}, '${migration.name}', '${new Date().toISOString()}')
      `);
    }
  }
}
