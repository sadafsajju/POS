# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Offline-first, multi-platform POS system for restaurants and retail. Turborepo monorepo with **Supabase** (Auth + PostgREST + Edge Functions + Realtime + Storage) as the backend and React+Tauri desktop app as the frontend. Deployed on **Vercel** (frontend) + **Supabase Cloud** (backend). Supports aggregator order integration (Swiggy/Zomato).

**Base Boilerplate:** [madebyaris/poinf-of-sales](https://github.com/madebyaris/poinf-of-sales)

## Commands

```bash
# Supabase local development
npm run supabase:start           # Start local Supabase (Docker required)
npm run supabase:stop            # Stop local Supabase
npm run supabase:migrate         # Push migrations to Supabase
npm run supabase:gen-types       # Regenerate TypeScript types from DB schema

# Optional standalone Postgres (if not using Supabase local)
npm run db:up                    # Start PostgreSQL via Docker
npm run db:down                  # Stop PostgreSQL

# Frontend development
npm run dev:desktop              # POS desktop app at http://localhost:3000

# Build
npm run build                    # Build all apps via Turborepo
npm run build:desktop            # Build desktop app only
npm run build:mac                # Mac .dmg (Tauri)
npm run build:win                # Windows .exe (Tauri)

# Tauri native desktop
cd apps/desktop && npm run tauri:dev     # Native desktop with hot reload
cd apps/desktop && npm run tauri:build   # Production native build

# Quality
npm run type-check               # TypeScript checking across all packages
npm run lint                     # ESLint across all packages
```

## Architecture

### Monorepo Layout (Turborepo + npm workspaces)

- **`apps/desktop/`** — Main POS app. React 18 + TypeScript + TanStack Router + Tailwind/shadcn. Wrapped in Tauri 2.0 for native desktop. Runs as web app in dev.
- Kitchen display is integrated into the desktop app at `/admin/kitchen` route (no separate app).
- **`packages/types/`** — All shared TypeScript interfaces. Uses **snake_case** field names matching the database directly.
- **`packages/core/`** — Business logic: Zustand stores (auth, cart, sync, settings), offline sync engine, local DB abstraction (SQLite for Tauri, IndexedDB for web), utility functions.
- **`packages/api-client/`** — Endpoint wrappers organized by domain (`productsApi`, `ordersApi`, `adminApi`, etc.), React Query key factories. Delegates to `@pos/supabase` query modules.
- **`packages/supabase/`** — Supabase client, typed query modules (PostgREST), auth helpers, realtime subscriptions, storage helpers. All database access goes through this package.
- **`supabase/migrations/`** — PostgreSQL migrations applied via Supabase CLI. Includes schema, RLS policies, auth hooks, database functions, and storage buckets.

### Key Data Flow

1. Frontend uses `@pos/api-client` endpoints → delegates to `@pos/supabase` query modules
2. `@pos/supabase` uses Supabase PostgREST client for CRUD, `.rpc()` for complex business logic
3. Auth via Supabase Auth — JWT claims contain `org_id`, `role`, `location_id` in `app_metadata`
4. RLS policies enforce tenant isolation and role-based access at the database level
5. Offline: orders queue locally via `@pos/core` sync store → auto-sync on reconnect
6. Realtime: Supabase Realtime channels for orders, order items, and table changes

### Supabase Backend Architecture

- **PostgREST** — All simple CRUD via typed Supabase client (`.from('table').select/insert/update/delete`)
- **Database Functions** — Complex business logic as PostgreSQL functions called via `.rpc()`:
  - `create_order()`, `process_payment()`, `update_order_status()`
  - `get_bill_summary()`, `get_dashboard_stats()`
  - `get_sales_report()`, `get_orders_report()`, `get_income_report()`
  - `clear_table()`, `transfer_table()`
  - `generate_order_number()`, `generate_token_number()`
  - `register_tenant()`
- **Edge Functions** — HTTP-level concerns (webhooks, PIN login, tenant registration)
- **Realtime** — Channel subscriptions for kitchen display, table management, order status
- **Storage** — Buckets for `products`, `promos`, `media` with public read + authenticated write RLS
- **Auth** — Supabase Auth with custom access token hook injecting claims into JWT

### Role-Based Access (5 roles)

RLS policies enforce access at the database level:
- `admin` / `manager` — Full CRUD, dashboard stats, reports, platform config management
- `server` — Dine-in order creation only
- `counter` — All order types + payment processing + aggregator order accept/reject
- `kitchen` — Kitchen display, item status updates

### API Response Format

All query modules return: `{ success: bool, message: string, data?: T, error?: string, meta?: { pagination } }`

Wrapper helpers in `packages/supabase/src/helpers.ts`: `wrapOne()`, `wrapMany()`, `wrapRpc()`, `paginationRange()`

## Critical Patterns

- **Always use `Array.isArray()` checks** before calling `.filter()/.map()` on API responses. Error responses return objects, not arrays.
- **TypeScript types use snake_case** matching the database. No camelCase conversion.
- **Packages reference each other via `*` version** in package.json (workspace linking).
- **Tauri 2.0** (not 1.x) — use Tauri 2 APIs. Hardware stubs in `apps/desktop/src-tauri/src/hardware/`.
- **Offline-first is critical** — consider what happens without internet. Orders must work offline with local queue and sync.
- **Touch mode is toggled via `settings.touchMode`** — See "Touch Mode" section below.
- **Authentication uses Supabase Auth** — `signInWithPassword()` for email/password, custom access token hook injects claims. See "Authentication" section below.
- **Role-based navigation hides admin UI for staff** — Staff members (server/counter/kitchen) don't see admin navigation. See "Role-Based Navigation" section below.
- **Supabase `.eq()` on union-typed columns** requires `as any` casts when filtering by `string` params (e.g., `.eq('status', status as any)`).
- **Dual type definitions** — `Product` and other interfaces exist in both `packages/types/src/index.ts` and `apps/desktop/src/types/index.ts`. Both must be updated when adding fields.

## Adding New Features

### New database query
1. Add types in `packages/types/src/index.ts`
2. Add query function in `packages/supabase/src/queries/{module}.ts`
3. Export from `packages/supabase/src/queries/index.ts` and `packages/supabase/src/index.ts`
4. Add endpoint wrapper in `packages/api-client/src/endpoints.ts`
5. Update `apps/desktop/src/api/client.ts` if needed (local API client)

### New database function (complex logic)
1. Create migration in `supabase/migrations/` with `CREATE OR REPLACE FUNCTION`
2. Add TypeScript types for params/return in `packages/supabase/src/types.ts` under `Functions`
3. Call via `supabase.rpc('function_name', params)` in query module
4. Wrap with `wrapRpc()` helper

### New frontend component
1. Create in `apps/desktop/src/components/{feature}/`
2. Use shadcn/ui primitives from `components/ui/`
3. Forms: React Hook Form + Zod (`@hookform/resolvers/zod`)
4. Data fetching: TanStack React Query with `@pos/api-client`

### New offline-capable feature
1. Add migration in `packages/core/src/database/migrations.ts`
2. Add to sync queue in `packages/core/src/stores/sync-store.ts`
3. Handle in `packages/core/src/sync/sync-engine.ts`

## Database Conventions (PostgreSQL via Supabase)

- UUID v4 primary keys (`uuid_generate_v4()`)
- `DECIMAL(10,2)` for monetary values
- `TIMESTAMP WITH TIME ZONE` for all timestamps
- snake_case table/column names; pluralized table names
- Foreign keys follow `{table}_id` pattern
- Check constraints for enum-like fields (roles, statuses, `order_source`)
- Auto `updated_at` trigger on relevant tables
- JSONB columns for flexible data (`external_data` on orders, `config_data` on platform_configs)
- RLS enabled on all tables; policies use `auth.jwt() -> 'app_metadata'` for tenant/role checks
- Helper functions: `get_my_org_id()`, `get_my_role()`, `get_my_location_id()`

### Key Tables

| Table | Purpose |
|-------|---------|
| `users` | Staff accounts with `auth_user_id` linking to `auth.users` |
| `categories` | Product categories |
| `products` | Menu items (simple, configurable, combo) |
| `orders` | All orders (POS + aggregator), `order_source` field |
| `order_items` | Line items with product reference |
| `payments` | Payment records |
| `dining_tables` | Dining table layout |
| `customers` | Customer records |
| `platform_configs` | Aggregator API credentials and settings |
| `settings` | App-wide key/value settings per org |
| `locations` | Business locations per org |

### Key Migration Files

| File | Purpose |
|------|---------|
| `20260305000001_initial_schema.sql` | All tables, indexes, triggers |
| `20260305000002_rls_policies.sql` | Row-level security for all tables |
| `20260305000003_auth_hook.sql` | Custom access token hook (JWT claims) |
| `20260305000004_database_functions.sql` | All RPC business logic functions |
| `20260305000005_storage_buckets.sql` | Storage buckets + RLS |

## Environment

Frontend env (`apps/desktop/.env`):
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anonymous/public key

Local dev: `npx supabase start` provides local URLs and keys.

## Deployment (Vercel + Supabase Cloud)

- **Frontend**: Deployed on Vercel. Config in `vercel.json`. Build: `npm run build:desktop`, output: `apps/desktop/dist`.
- **Backend**: Supabase Cloud project. Migrations pushed via `npx supabase db push`. Edge Functions deployed via `npx supabase functions deploy`.
- **Env vars on Vercel**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

## Authentication

Uses **Supabase Auth** exclusively. No Clerk, no internal JWT system.

### Auth Flow
1. User signs in via `supabase.auth.signInWithPassword()`
2. Custom access token hook injects `org_id`, `role`, `location_id`, `user_id` into JWT `app_metadata`
3. RLS policies use these claims for tenant isolation and role enforcement
4. Frontend auth state managed via `@pos/core` → `useAuthStore` (Zustand + localStorage persistence)

### Auth Helpers (`packages/supabase/src/auth.ts`)
- `signInWithPassword(email, password)` — login
- `signUp(email, password, metadata)` — registration
- `signOut()` — logout
- `getSession()` — current session
- `getAccessToken()` — JWT for API calls
- `onAuthStateChange(callback)` — session listener
- `extractUserClaims(session)` — extract role/org/location from JWT

### Logout Flow

```typescript
const { logout } = useAuthStore()

const handleLogout = async () => {
  await signOut() // Supabase auth
  logout()        // Clear Zustand state
  window.location.href = '/login'
}
```

Logout is implemented in `components/ui/user-menu.tsx` and `components/admin/AdminSidebar.tsx` — keep them in sync.

### Role-Based Navigation & Access Control

**Route Access Control** (`routes/admin.tsx`):
- `admin`/`manager` → Full admin access
- `server`/`counter` → `/admin/pos` only
- `kitchen` → `/admin/kitchen` only

**Login Redirects** (`routes/login.tsx`):
- `server`/`counter` → `/admin/pos`
- `kitchen` → `/admin/kitchen`
- `admin`/`manager` → `/admin`

**Navigation Visibility**: Admin/Manager see full nav. Staff see only their specific view.

## Aggregator Integration (Swiggy/Zomato)

- **Order source** tracked via `order_source` field: `pos`, `swiggy`, `zomato`
- **Accept deadline** with countdown timer
- **Platform configs** in `platform_configs` table
- **Webhooks** handled via Supabase Edge Functions
- **Frontend**: `AggregatorOrders` component (counter), `PlatformSettings` (admin), kitchen badges

## Touch Mode (On-Screen Keyboard)

Controlled by `touchMode: boolean` in `StoreSettings`. Stored as `touch_mode` in settings. Default: `false`.

- **Touch ON**: Tappable elements open `OnScreenKeyboard` modal or inline `KeyboardRow`
- **Touch OFF**: Standard `<input>` elements

Files that check `touchMode`: `routes/login.tsx`, `CounterInterface.tsx`, `TablesView.tsx`, `CartPanel.tsx`, `CustomerStep.tsx`

## Current Status

Migration from Go backend + Clerk + Railway to Supabase + Vercel is complete through Phase 6. The Go backend has been removed. All CRUD and business logic routes through Supabase PostgREST and database functions. Remaining: Phase 7 (offline-first adaptation with Supabase sync queue).
