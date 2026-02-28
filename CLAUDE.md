# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Offline-first, multi-platform POS system for restaurants and retail. Turborepo monorepo with a Go backend, React+Tauri desktop app, and a standalone kitchen display app. Supports aggregator order integration (Swiggy/Zomato) via cloud relay webhook architecture.

**Base Boilerplate:** [madebyaris/poinf-of-sales](https://github.com/madebyaris/poinf-of-sales)

## Commands

```bash
# Infrastructure (Docker required)
npm run db:up                    # Start PostgreSQL + Redis
npm run db:down                  # Stop infrastructure
docker-compose up -d backend     # Start Go backend (Go NOT installed locally)
docker logs pos-backend          # View backend logs

# Frontend development
npm run dev:desktop              # POS desktop app at http://localhost:3000

# Build
npm run build                    # Build all apps via Turborepo
npm run build:mac                # Mac .dmg (Tauri)
npm run build:win                # Windows .exe (Tauri)

# Tauri native desktop
cd apps/desktop && npm run tauri:dev     # Native desktop with hot reload
cd apps/desktop && npm run tauri:build   # Production native build

# Quality
npm run type-check               # TypeScript checking across all packages
npm run lint                     # ESLint across all packages

# Backend tests (inside Docker, Go not local)
docker exec pos-backend go test ./...

# Railway Deployment
railway up --service backend --path-as-root ./backend   # Deploy Go backend
railway up --service frontend                           # Deploy frontend (Nixpacks)
railway service status --all                            # Check all service statuses
railway logs --service backend                          # View backend deploy logs
railway logs --service frontend                         # View frontend deploy logs
```

## Architecture

### Monorepo Layout (Turborepo + npm workspaces)

- **`apps/desktop/`** — Main POS app. React 18 + TypeScript + TanStack Router + Tailwind/shadcn. Wrapped in Tauri 2.0 for native desktop. Runs as web app in dev.
- Kitchen display is integrated into the desktop app at `/admin/kitchen` route (no separate app).
- **`packages/types/`** — All shared TypeScript interfaces. Uses **snake_case** field names to match the Go API directly (no conversion layer).
- **`packages/core/`** — Business logic: Zustand stores (auth, cart, sync, settings), offline sync engine, local DB abstraction (SQLite for Tauri, IndexedDB for web), utility functions.
- **`packages/api-client/`** — Axios HTTP client with JWT interceptor, all REST endpoints organized by role (`authApi`, `productsApi`, `serverApi`, `counterApi`, `kitchenApi`, `adminApi`, etc.), React Query key factories.
- **`backend/`** — Go 1.21+ / Gin REST API. Standard Go layout under `internal/` with `handlers/`, `models/`, `middleware/`, `database/`, `api/`. Includes webhook handlers for aggregator platforms and HMAC auth middleware.
- **`database/init/`** — PostgreSQL schema (`01_schema.sql`), seed data (`02_seed_data.sql`), and aggregator migration (`12_aggregator_orders.sql`). Auto-applied on first `docker-compose up`.

### Key Data Flow

1. Frontend uses `@pos/api-client` endpoints → Axios with JWT Bearer token
2. Backend Gin handlers use raw SQL with parameterized queries (no ORM)
3. Auth middleware extracts JWT claims and enforces role-based access
4. Offline: orders queue locally via `@pos/core` sync store → auto-sync on reconnect
5. Aggregator orders: Cloud relay → webhook to `/api/v1/webhooks/:platform/order` (HMAC auth) → order created in DB → appears in counter UI + kitchen display

### Aggregator Integration Architecture

```
Swiggy/Zomato → Cloud Relay Server → Webhooks → Local POS Backend → Counter UI + Kitchen KDS
                                                                   ← Accept/Reject → Cloud Relay → Platform API
```

- **Webhook endpoints** receive orders from cloud relay (HMAC-SHA256 signature verification, not JWT)
- **Order source** tracked via `order_source` field: `pos`, `swiggy`, `zomato`
- **Accept deadline** with countdown timer — platforms auto-cancel in ~3-5 min
- **Platform configs** stored in `platform_configs` table (API keys, webhook secrets, restaurant IDs)

### Role-Based Access (5 roles + webhook)

Routes are grouped by role in `backend/internal/api/routes.go`:
- `admin` / `manager` — Full CRUD, dashboard stats, reports, platform config management
- `server` — Dine-in order creation only
- `counter` — All order types + payment processing + aggregator order accept/reject
- `kitchen` — Kitchen display, item status updates (shows platform badges on aggregator orders)
- `webhook` — HMAC-authenticated endpoints for cloud relay (no JWT, uses `WebhookAuthMiddleware`)

### API Response Format

All endpoints return: `{ success: bool, message: string, data?: T, error?: string, meta?: { pagination } }`

## Critical Patterns

- **Always use `Array.isArray()` checks** before calling `.filter()/.map()` on API responses. The API returns error objects (not arrays) when unauthenticated.
- **TypeScript types use snake_case** matching the Go API JSON. No camelCase conversion.
- **Packages reference each other via `*` version** in package.json (workspace linking).
- **Tauri 2.0** (not 1.x) — use Tauri 2 APIs. Hardware stubs in `apps/desktop/src-tauri/src/hardware/`.
- **Go is not installed locally** — always use Docker for backend operations.
- **Offline-first is critical** — consider what happens without internet. Orders must work offline with local queue and sync.
- **Touch mode is toggled via `settings.touchMode`** — All text inputs that support on-screen keyboard must check this setting. When OFF, use regular `<input>` elements. When ON, use tappable fields that open `OnScreenKeyboard` or inline `KeyboardRow`. Toggle lives in Admin > Settings > System. See "Touch Mode" section below.

## Adding New Features

### New API endpoint
1. Add types in `packages/types/src/index.ts`
2. Add endpoint function in `packages/api-client/src/endpoints.ts`
3. Add query key in `packages/api-client/src/hooks.ts`
4. Implement Go handler in `backend/internal/handlers/`
5. Register route in `backend/internal/api/routes.go`

### New frontend component
1. Create in `apps/desktop/src/components/{feature}/`
2. Use shadcn/ui primitives from `components/ui/`
3. Forms: React Hook Form + Zod (`@hookform/resolvers/zod`)
4. Data fetching: TanStack React Query with `@pos/api-client`

### New offline-capable feature
1. Add migration in `packages/core/src/database/migrations.ts`
2. Add to sync queue in `packages/core/src/stores/sync-store.ts`
3. Handle in `packages/core/src/sync/sync-engine.ts`

## Backend Patterns (Go/Gin)

Handler struct pattern with `*sql.DB` dependency injection:
```go
type OrderHandler struct { db *sql.DB }
func NewOrderHandler(db *sql.DB) *OrderHandler { return &OrderHandler{db: db} }
```

- Raw SQL with `$1, $2` parameterized queries (no ORM)
- Transactions via `db.Begin()` / `tx.Commit()` for multi-table ops
- Error responses use `models.APIResponse{Success: false, Message: "...", Error: stringPtr("error_code")}`
- Role enforcement: `middleware.RequireRoles([]string{"admin", "manager"})`
- Webhook auth: `middleware.WebhookAuthMiddleware(db)` — HMAC-SHA256 verification using per-platform `webhook_secret` from `platform_configs` table

### Key Handler Files

| File | Purpose |
|------|---------|
| `handlers/orders.go` | Order CRUD + aggregator accept/reject endpoints |
| `handlers/payments.go` | Payment processing |
| `handlers/products.go` | Product CRUD |
| `handlers/tables.go` | Table management |
| `handlers/settings.go` | App settings + platform config CRUD |
| `handlers/webhooks.go` | Aggregator webhook receivers (order, status, cancel) |
| `handlers/combos.go` | Combo product management |
| `handlers/options.go` | Product option groups |
| `handlers/customers.go` | Customer management |
| `middleware/auth.go` | JWT authentication middleware |
| `middleware/webhook_auth.go` | HMAC webhook signature verification |

## Database Conventions (PostgreSQL)

- UUID v4 primary keys (`uuid_generate_v4()`)
- `DECIMAL(10,2)` for monetary values
- `TIMESTAMP WITH TIME ZONE` for all timestamps
- snake_case table/column names; pluralized table names
- Foreign keys follow `{table}_id` pattern
- Check constraints for enum-like fields (roles, statuses, `order_source`)
- Auto `updated_at` trigger on relevant tables
- JSONB columns for flexible data (`external_data` on orders, `config_data` on platform_configs)

### Key Tables

| Table | Purpose |
|-------|---------|
| `users` | Staff accounts with role-based access |
| `categories` | Product categories |
| `products` | Menu items (simple, configurable, combo) |
| `orders` | All orders (POS + aggregator), supports `order_source` field |
| `order_items` | Line items with product reference |
| `payments` | Payment records |
| `tables` | Dining table layout |
| `customers` | Customer records |
| `platform_configs` | Swiggy/Zomato API credentials and settings (unique per platform) |
| `settings` | App-wide key/value settings |

## Environment

Backend env (set in docker-compose.yml): `DB_HOST=postgres`, `DB_PORT=5432`, `DB_USER=postgres`, `DB_PASSWORD=postgres123`, `DB_NAME=pos_system`, `REDIS_HOST=redis`, `JWT_SECRET=your-super-secret-jwt-key`, `PORT=8080`

Frontend env (apps/desktop/.env): `VITE_API_URL=http://localhost:8080/api/v1`

Default admin login: `admin` / `admin123`

## Railway Deployment (Production)

Project: **zealous-miracle** | Railway CLI linked at project root.

### Live URLs

| Service | URL |
|---------|-----|
| Frontend | `https://frontend-production-b5819.up.railway.app` |
| Backend API | `https://backend-production-3d327.up.railway.app` |
| Postgres | Internal (`postgres.railway.internal:5432`, DB: `railway`) |
| Redis | Internal (`redis.railway.internal:6379`) |

### Deployment Details

- **Backend**: Deployed via `railway up --service backend --path-as-root ./backend`. Uses `backend/Dockerfile` (Go multi-stage build). Environment variables (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `REDIS_HOST`, `JWT_SECRET`, `PORT`) are set in Railway service settings.
- **Frontend**: Deployed via `railway up --service frontend` from monorepo root. Uses **Nixpacks** builder (configured via `nixpacks.toml`). `VITE_API_URL` is set as a Railway variable pointing to the backend URL. Served with `npx serve`.
- **Do NOT create a `railway.json`** at the project root — it overrides per-service build settings and breaks multi-service deployments.
- The `nixpacks.toml` at the project root configures the frontend build only. Backend uses its own `Dockerfile` via `--path-as-root`.

### Redeploying

```bash
# Backend (from monorepo root)
railway up --service backend --path-as-root ./backend

# Frontend (from monorepo root)
railway up --service frontend

# Check status
railway service status --all
```

## Aggregator Integration (Swiggy/Zomato)

### Webhook Endpoints (HMAC auth, no JWT)
- `POST /api/v1/webhooks/:platform/order` — Receive incoming order from cloud relay
- `POST /api/v1/webhooks/:platform/status` — Receive status updates (rider assigned, etc.)
- `POST /api/v1/webhooks/:platform/cancel` — Handle platform-initiated cancellations

### Aggregator Order Management (JWT auth)
- `GET /api/v1/{counter,admin}/aggregator-orders?status=&platform=` — List aggregator orders
- `POST /api/v1/{counter,admin}/orders/:id/accept-aggregator` — Accept with confirmation
- `POST /api/v1/{counter,admin}/orders/:id/reject-aggregator` — Reject with reason

### Platform Config CRUD (Admin only)
- `GET /api/v1/admin/platform-configs` — List all platform configs
- `GET /api/v1/admin/platform-configs/:platform` — Get specific config
- `POST /api/v1/admin/platform-configs` — Create/update (upsert) config
- `DELETE /api/v1/admin/platform-configs/:platform` — Remove config

### Frontend Components
- `AggregatorOrders` — Counter panel showing incoming orders with accept/reject, countdown timer, audio alerts
- `PlatformSettings` — Admin settings page for configuring platform credentials
- Kitchen display shows colored badges: orange for Swiggy, red for Zomato

### Future Phases (not yet built)
- **Cloud Relay Server** — Separate Go service receiving webhooks from Swiggy/Zomato and relaying to local POS via WebSocket
- **Zomato API Integration** — Requires vendor approval as POS partner
- **Swiggy API Integration** — Requires partner program enrollment

## Touch Mode (On-Screen Keyboard)

Controlled by `touchMode: boolean` in `StoreSettings`. Stored as `touch_mode` in the settings API. Default: `false` (off). Toggled in Admin > Settings > System.

### How it works
- **Touch ON**: Text inputs render as tappable `<button>`/`<div>` elements that open `OnScreenKeyboard` (full-screen modal) or inline `KeyboardRow` (fixed at bottom). The `OnScreenKeyboard` also accepts physical keyboard input via a hidden `<input>`.
- **Touch OFF**: Standard `<input>` elements with physical keyboard support. No on-screen keyboard rendered.

### Files that check `touchMode`

| File | What it gates |
|------|---------------|
| `routes/login.tsx` | Username/password fields + keyboard |
| `components/counter/CounterInterface.tsx` | Product search bar + inline keyboard |
| `components/counter/views/TablesView.tsx` | Takeout/delivery customer name input + keyboard |
| `components/counter/panels/CartPanel.tsx` | Item special instructions + order notes |
| `components/counter/payment-steps/CustomerStep.tsx` | New customer name input |

### Adding a new touch-aware input
1. Import `useSettingsStore` from `@pos/core`
2. Read `const { settings } = useSettingsStore()` and check `settings.touchMode`
3. **Touch ON**: Render a tappable element + `<OnScreenKeyboard>` from `@/components/ui/on-screen-keyboard`
4. **Touch OFF**: Render a standard `<input>` or `<textarea>`
5. On-screen keyboard components: `OnScreenKeyboard` (modal), `KeyboardRow` + layouts (inline)

## Current Status

See `PROGRESS.md` for detailed phase tracking. As of Phase 9: monorepo setup, Tauri desktop shell, kitchen display, shared packages, API client integration, offline order creation, first-time onboarding, and aggregator order integration (Phase 1 - local POS infrastructure) are complete. Production deployment on Railway is live. Next priorities: cloud relay server, full offline sync testing, hardware integration, and installers.
