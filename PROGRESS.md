# POS System - Progress Tracker

## Current Status: Phase 9 Complete - Aggregator Order Integration (Local POS)

**Last Updated:** February 7, 2026

---

## Completed

### Phase 1: Foundation Setup

- [x] Clone and evaluate boilerplate (madebyaris/poinf-of-sales)
- [x] Set up Turborepo monorepo structure
- [x] Restructure into `apps/` and `packages/` directories
- [x] Create root `package.json` with workspace configuration
- [x] Configure `turbo.json` for build pipeline

### Phase 2: Tauri Desktop Integration

- [x] Initialize Tauri 2.0 in desktop app
- [x] Create `tauri.conf.json` configuration
- [x] Set up Rust backend structure (`lib.rs`, `main.rs`)
- [x] Create hardware module structure
- [x] Implement thermal printer integration (ESC/POS)
- [x] Implement barcode scanner integration

### Phase 3: Shared Packages

- [x] Create `@pos/types` package with 50+ TypeScript interfaces
- [x] Create `@pos/core` package with:
  - [x] Auth store (Zustand + persist)
  - [x] Cart store (order management)
  - [x] Sync store (offline queue)
  - [x] Settings store (app configuration)
  - [x] Sync engine with conflict resolution
  - [x] Local database abstraction (SQLite/IndexedDB)
  - [x] Database migrations system
  - [x] Utility functions (format, validation, ID generation)
- [x] Create `@pos/api-client` package with:
  - [x] Axios-based HTTP client
  - [x] All REST endpoints
  - [x] React Query key factories

### Phase 4: Kitchen Display App

- [x] Create separate kitchen display application
- [x] Implement order card components
- [x] Add real-time order status tracking
- [x] Add visual/audio alerts for new orders
- [x] Add "bump" functionality for completed orders

### Phase 5: Infrastructure

- [x] Update `docker-compose.yml` with Redis
- [x] Configure PostgreSQL health checks
- [x] Add kitchen display service
- [x] Create comprehensive README.md
- [x] Create CLAUDE.md for AI context

### First Run Setup Sprint

- [x] Install npm dependencies (`npm install`)
- [x] Verify Rust/Cargo installation (v1.88.0)
- [x] Test database startup (`npm run db:up`) - PostgreSQL + Redis running
- [x] Verify backend runs - Running via Docker on http://localhost:8080
- [x] Test desktop app development mode - Running on http://localhost:3002
- [x] Test kitchen display app - Running on http://localhost:3001
- [x] Test Tauri Rust compilation - Compiles successfully
- [x] Build desktop frontend - Built successfully

---

## In Progress

### Phase 9: Aggregator Order Integration (Swiggy/Zomato — Local POS)

**Status: Phase 1 Complete (Local POS Infrastructure)**

#### Completed:
- [x] **Database schema** (`database/init/12_aggregator_orders.sql`)
  - Added `order_source`, `external_order_id`, `external_data`, `delivery_partner_name`, `delivery_partner_phone`, `aggregator_confirmed_at`, `accept_deadline` columns to `orders` table
  - Created `platform_configs` table for Swiggy/Zomato API credentials (unique per platform)
  - Added indexes and `updated_at` trigger

- [x] **Backend models** (`backend/internal/models/models.go`)
  - Extended `Order` struct with aggregator fields
  - Added `PlatformConfig`, `CreatePlatformConfigRequest`, `AggregatorOrderWebhook`, `AggregatorStatusUpdate`, `RejectAggregatorOrderRequest` structs

- [x] **Webhook handlers** (`backend/internal/handlers/webhooks.go`)
  - `ReceiveOrder` — Creates orders from aggregator webhooks with duplicate detection, product matching by name
  - `ReceiveStatusUpdate` — Updates delivery partner info from platform
  - `ReceiveCancellation` — Cancels orders triggered by platform
  - Order numbers prefixed with `SWG-`/`ZMT-` for easy identification

- [x] **HMAC webhook auth middleware** (`backend/internal/middleware/webhook_auth.go`)
  - HMAC-SHA256 signature verification using per-platform `webhook_secret`
  - Checks platform is enabled before allowing requests
  - Restores request body after reading for HMAC computation

- [x] **Aggregator order management** (`backend/internal/handlers/orders.go`)
  - `AcceptAggregatorOrder` — Validates aggregator order, checks deadline, moves to confirmed
  - `RejectAggregatorOrder` — Cancels with reason
  - `GetAggregatorOrders` — Lists aggregator orders with status/platform filtering
  - Updated `getOrderByID` helper to include all aggregator fields

- [x] **Platform config CRUD** (`backend/internal/handlers/settings.go`)
  - `GetPlatformConfigs` — Lists all configs with masked sensitive fields
  - `GetPlatformConfig` — Single config by platform name
  - `UpsertPlatformConfig` — INSERT or UPDATE with dynamic field handling
  - `DeletePlatformConfig` — Removes config by platform

- [x] **Route registration** (`backend/internal/api/routes.go`)
  - Webhook routes: `/webhooks/:platform/{order,status,cancel}` with HMAC auth
  - Aggregator routes on counter + admin groups
  - Platform config routes on admin group
  - Updated kitchen orders query to include aggregator fields

- [x] **Frontend types** (`packages/types/src/index.ts`)
  - Added `OrderSource` type, aggregator fields on `Order` and `KitchenOrder`
  - Added `PlatformConfig`, `CreatePlatformConfigRequest`, `AggregatorOrder` interfaces

- [x] **API client endpoints** (`packages/api-client/src/endpoints.ts`)
  - `counterApi`: `getAggregatorOrders`, `acceptAggregatorOrder`, `rejectAggregatorOrder`
  - `adminApi`: aggregator orders + `getPlatformConfigs`, `upsertPlatformConfig`, `deletePlatformConfig`

- [x] **Kitchen display badges** (`apps/desktop/src/components/kitchen/`)
  - Orange badge for Swiggy orders, red badge for Zomato orders
  - Applied to both `KitchenOrderCard` and `EnhancedKitchenOrderCard`

- [x] **Aggregator orders panel** (`apps/desktop/src/components/counter/AggregatorOrders.tsx`)
  - Polls pending aggregator orders every 10 seconds
  - Countdown timer for accept deadline
  - Accept/reject buttons with reject reason input
  - Audio alert (two beeps) for incoming orders
  - Integrated into `CounterInterface` on the tables tab

- [x] **Platform settings page** (`apps/desktop/src/components/admin/PlatformSettings.tsx`)
  - Configure Swiggy/Zomato API credentials (key, secret, webhook secret, restaurant ID)
  - Enable/disable toggle per platform
  - Show/hide credential fields
  - Webhook URL reference section
  - Route: `/admin/settings/platforms` (added to SettingsSidebar)

#### Pending (Future Phases):
- [ ] Build cloud relay server (separate Go service for receiving platform webhooks)
- [ ] Zomato API integration (requires vendor approval as POS partner)
- [ ] Swiggy API integration (requires partner program enrollment)
- [ ] UrbanPiper middleware integration (optional, covers multiple platforms)

---

### Phase 8: First-Time Onboarding Flow

**Status: Implementation Complete**

#### Completed:
- [x] **Add setup check endpoint to backend** ([routes.go](backend/internal/api/routes.go))
  - `GET /setup/check` - Check if setup is needed (returns needs_setup, has_admin, etc.)
  - `POST /setup/admin` - Create initial admin user (only works if no admin exists)
  - Stores optional settings: store_name, currency, currency_symbol, tax_rate

- [x] **Add setup API to frontend api-client** ([endpoints.ts](packages/api-client/src/endpoints.ts))
  - `setupApi.checkStatus()` - Check if setup is needed
  - `setupApi.createAdmin()` - Create first admin user with store settings

- [x] **Create SetupWizard component** ([SetupWizard.tsx](apps/desktop/src/components/setup/SetupWizard.tsx))
  - Multi-step wizard: Welcome → Admin Account → Store Settings → Complete
  - Form validation for all fields
  - Currency selection with symbol auto-fill
  - Tax rate configuration
  - Success screen with login redirect

- [x] **Add setup route** ([setup.tsx](apps/desktop/src/routes/setup.tsx))
  - Dedicated `/setup` route for the wizard

- [x] **Update app entry to check setup** ([index.tsx](apps/desktop/src/routes/index.tsx), [login.tsx](apps/desktop/src/routes/login.tsx))
  - Index route checks `setupApi.checkStatus()` on load
  - Redirects to `/setup` if `needs_setup` is true
  - Login page also checks and redirects to setup if needed

#### User Flow:
1. User visits app for first time (no users in database)
2. App checks `/setup/check` → returns `needs_setup: true`
3. User is redirected to `/setup`
4. User creates admin account and configures store
5. Backend creates admin user and saves settings
6. User is redirected to login page
7. User logs in with new admin credentials

---

### Phase 7: Implement Offline Order Creation

**Status: Core Implementation Complete**

#### Completed:
- [x] **Create OfflineIndicator component** ([offline-indicator.tsx](apps/desktop/src/components/ui/offline-indicator.tsx))
  - Compact indicator for header (online/offline icon + pending count)
  - Full indicator with connection status and sync time
  - OfflineBanner component for prominent offline messaging

- [x] **Add offline indicator to RoleBasedLayout** ([RoleBasedLayout.tsx](apps/desktop/src/components/RoleBasedLayout.tsx))
  - Compact indicator in header next to user info
  - OfflineBanner below navigation bar

- [x] **Create useOfflineOrder hook** ([use-offline-order.ts](packages/core/src/hooks/use-offline-order.ts))
  - Smart online/offline detection using useSyncStore
  - Queue orders locally when offline using localStorage
  - Auto-sync when connection is restored
  - Generate temporary order numbers for offline orders
  - Export from @pos/core package

- [x] **Implement offline queue in CounterInterface** ([CounterInterface.tsx](apps/desktop/src/components/counter/CounterInterface.tsx))
  - "Save Offline" button when disconnected
  - Pending offline orders banner with sync button
  - Manual sync trigger when coming back online
  - Visual feedback for offline order status

#### New Types Added:
- `OfflineOrder` - Local order storage with sync status tracking

#### Pending:
- [ ] Test full offline → online sync flow
- [ ] Add offline support to ServerInterface
- [ ] Add offline support to POSLayout
- [ ] Handle offline order conflicts on sync

---

### Phase 6: Connect Frontend to Shared Packages

**Status: Foundation Complete, Frontend Integration Pending**

#### Completed (Phase 6.1):
- [x] **Update `@pos/types`** - All types now match backend API format (snake_case)
  - Added: `ApiResponse`, `PaginatedResponse`, `PaginationMeta`
  - Added: `LoginRequest`, `LoginResponse`, `CreateOrderRequest`, `UpdateOrderStatusRequest`
  - Added: `ProcessPaymentRequest`, `PaymentSummary`, `DashboardStats`
  - Added: `SalesReportItem`, `OrdersReportItem`, `IncomeReport`
  - Added: `KitchenOrder`, `KitchenOrderItem`, `TableStatusSummary`
  - Added: `OrderFilters`, `ProductFilters`, `TableFilters`
  - Updated: All interfaces to use snake_case field names matching backend

- [x] **Update `@pos/api-client`** - Complete endpoint coverage
  - Added: `authApi` (login, logout, me)
  - Added: `productsApi` (getAll, getById, getByCategory)
  - Added: `categoriesApi` (getAll, getById)
  - Added: `tablesApi` (getAll, getById, getByLocation, getStatus)
  - Added: `ordersApi` (getAll, getById, updateStatus)
  - Added: `paymentsApi` (getByOrder, getSummary)
  - Added: `serverApi` (createOrder, addItems) - Server role endpoints
  - Added: `counterApi` (createOrder, addItems, processPayment) - Counter role endpoints
  - Added: `kitchenApi` (getOrders, updateItemStatus)
  - Added: `adminApi` (full dashboard, reports, CRUD for users/products/categories/tables/orders)
  - Added: `customersApi` (getAll, getById, getByPhone, create, update, search)

- [x] **Update `@pos/core` stores** - Synchronized with new types
  - Updated: `useCartStore` with `toCreateOrderItems()` helper
  - Verified: `useAuthStore` works with new User type
  - Verified: `useSettingsStore` conversion functions work

- [x] **Update React Query configuration** - Comprehensive query keys and caching
  - Added: Query keys for all endpoint groups
  - Added: Stale times configured per entity type
  - Added: Refetch intervals for real-time data

#### Completed (Phase 6.2 - Frontend Integration):
- [x] **Initialize `@pos/api-client` in app entry point** ([main.tsx](apps/desktop/src/main.tsx))
  - API client initialized with auth store token getter
  - Unauthorized handler clears auth and redirects to login
  - React Query configured with shared stale times
- [x] **Wire up `useAuthStore` in login flow** ([login.tsx](apps/desktop/src/routes/login.tsx))
  - Login uses `authApi.login()` from shared api-client
  - Auth state saved via `useAuthStore.login()`
  - Authentication check uses `isAuthenticated` from store
- [x] **Update index route** ([index.tsx](apps/desktop/src/routes/index.tsx))
  - Uses `useAuthStore` instead of localStorage
  - Clean role-based redirects
- [x] **Update RoleBasedLayout** ([RoleBasedLayout.tsx](apps/desktop/src/components/RoleBasedLayout.tsx))
  - Uses `User` type from `@pos/types`
  - Logout uses `useAuthStore.logout()`

#### Optional Cleanup (Low Priority):
- [ ] Remove duplicate types file (`apps/desktop/src/types/index.ts`) - kept for backwards compatibility
- [ ] Remove duplicate API client (`apps/desktop/src/api/client.ts`) - kept for backwards compatibility
- [ ] Update remaining components to import from `@pos/types`

---

## What's Next

### Priority 1: Core Functionality (MVP)

| Task | Status | Priority |
|------|--------|----------|
| ~~Connect frontend to shared packages~~ | **Phase 6 Complete** | High |
| ~~Frontend integration with shared packages~~ | **Phase 6.2 Complete** | High |
| ~~Implement offline order creation~~ | **Phase 7 Complete** | High |
| ~~First-time onboarding flow~~ | **Phase 8 Complete** | High |
| ~~Aggregator order integration (local POS)~~ | **Phase 9 Complete** | High |
| Cloud relay server for Swiggy/Zomato | Not Started | High |
| Test sync when coming back online | In Progress | High |
| Add customer display app | Not Started | Medium |
| Implement retail mode toggle | Not Started | Medium |

### Priority 2: Hardware Integration Testing

| Task | Status | Priority |
|------|--------|----------|
| Test thermal printer (physical device) | Not Started | High |
| Test barcode scanner input | Not Started | High |
| Add cash drawer kick command | Not Started | Medium |
| Add weighing scale integration | Not Started | Low |

### Priority 3: Multi-Platform

| Task | Status | Priority |
|------|--------|----------|
| Build Mac .dmg installer | Not Started | High |
| Build Windows .exe installer | Not Started | High |
| Set up auto-updater | Not Started | Medium |
| Create React Native mobile foundation | Not Started | Low |

### Priority 4: Advanced Features

| Task | Status | Priority |
|------|--------|----------|
| Zomato vendor approval & API integration | Not Started | High |
| Swiggy partner enrollment & API integration | Not Started | High |
| UrbanPiper middleware (optional multi-platform) | Not Started | Medium |
| Plugin system architecture | Not Started | Medium |
| Multi-location support | Not Started | Medium |
| Advanced inventory module | Not Started | Medium |
| CRM & loyalty module | Not Started | Low |
| Accounting integration | Not Started | Low |

### Priority 5: Internationalization

| Task | Status | Priority |
|------|--------|----------|
| Set up i18next | Not Started | Medium |
| Extract all strings | Not Started | Medium |
| Add multi-currency support | Not Started | Medium |
| Add tax system flexibility (GST/VAT/Sales Tax) | Not Started | Medium |
| Add RTL support | Not Started | Low |

---

## Known Issues

| Issue | Severity | Notes |
|-------|----------|-------|
| @pos/core type errors | Low | Pre-existing Tauri plugin type issues, doesn't affect runtime |
| Frontend has duplicate types/client | Medium | Will be resolved in Phase 6.2 |

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| Jan 31, 2026 | Use Tauri 2.0 over Electron | Smaller bundle size (10-20MB vs 150MB+), better performance, native SQLite |
| Jan 31, 2026 | Use Turborepo for monorepo | Faster builds, good npm workspace support |
| Jan 31, 2026 | Use Zustand over Redux | Simpler API, less boilerplate, works well with persist |
| Jan 31, 2026 | Hybrid sync strategy | Orders offline-first, products cloud-first cached |
| Jan 31, 2026 | Use boilerplate as base | Saves time on core POS UI, already has role-based access |
| Jan 31, 2026 | Use snake_case in types | Match backend API response format, avoid conversion overhead |
| Feb 7, 2026 | PetPooja-style aggregator architecture | Cloud relay receives platform webhooks, pushes to local POS via WebSocket. Build local POS infra first while awaiting vendor approval. |
| Feb 7, 2026 | HMAC auth for webhooks (not JWT) | Webhook endpoints use HMAC-SHA256 signature verification with per-platform secrets, separate from JWT user auth |
| Feb 7, 2026 | Aggregator orders in existing orders table | Add `order_source` column instead of separate table — reuses all existing order logic (kitchen display, payments, status tracking) |

---

## Architecture Notes

### Shared Packages Structure

```
packages/
├── types/           # All TypeScript interfaces (snake_case, matches API)
├── core/            # Business logic & state
│   ├── stores/      # Zustand stores (auth, cart, sync, settings)
│   ├── hooks/       # React hooks (useOfflineOrder)
│   ├── sync/        # Offline sync engine
│   ├── database/    # Local DB abstraction
│   └── utils/       # Format, validation, ID helpers
└── api-client/      # HTTP client & endpoints
    ├── client.ts    # Axios singleton with interceptors
    ├── endpoints.ts # Role-based API endpoints
    └── hooks.ts     # React Query configuration
```

### API Endpoint Groups

| Group | Endpoints | Access |
|-------|-----------|--------|
| `authApi` | login, logout, me | Public + Protected |
| `productsApi` | getAll, getById, getByCategory | Protected |
| `categoriesApi` | getAll, getById | Protected |
| `tablesApi` | getAll, getById, getByLocation, getStatus | Protected |
| `ordersApi` | getAll, getById, updateStatus | Protected |
| `paymentsApi` | getByOrder, getSummary | Protected |
| `serverApi` | createOrder, addItems | Server role |
| `counterApi` | createOrder, addItems, processPayment, aggregator orders | Counter role |
| `kitchenApi` | getOrders, updateItemStatus (shows platform badges) | Kitchen role |
| `adminApi` | Full CRUD + reports + platform configs + aggregator orders | Admin/Manager role |
| `customersApi` | CRUD + search | Protected |
| `webhooks` | Receive order, status update, cancellation (HMAC auth) | Webhook (no JWT) |

---

## Metrics

| Metric | Value |
|--------|-------|
| Total Files Created | 160+ |
| Shared Type Interfaces | 80+ |
| Lines of Rust Code | ~400 |
| Lines of TypeScript | ~5000+ |
| Lines of Go (new handlers) | ~800+ |
| API Endpoints Covered | 60+ |
| Estimated Time Saved (vs from scratch) | 2-3 months |

---

## Quick Commands Reference

```bash
# Development
npm install                  # Install all dependencies
npm run db:up               # Start PostgreSQL + Redis
npm run backend:dev         # Start Go backend
npm run dev:desktop         # Start desktop app (web)
npm run dev:kitchen         # Start kitchen display

# Type Checking
npm run type-check          # Check all packages

# Build
npm run build               # Build all apps
npm run build:mac           # Build Mac .dmg
npm run build:win           # Build Windows .exe

# Tauri
cd apps/desktop
npm run tauri:dev           # Desktop with hot reload
npm run tauri:build         # Production build
```

---

## Team Notes

_Add notes for team members here_

- Backend API is ready from boilerplate, may need new endpoints for sync
- Frontend components exist but need to import from shared packages
- Hardware integration is stubbed - needs testing with real devices
- **Phase 6 complete** - shared packages updated and frontend integration done
- **Phase 7 complete** - offline order creation implemented in CounterInterface
- **Phase 8 complete** - first-time onboarding flow with setup wizard
- **Phase 9 complete** - Swiggy/Zomato aggregator integration (local POS infrastructure ready)
  - Webhook endpoints with HMAC auth, aggregator order accept/reject, platform config CRUD
  - Kitchen display badges (orange=Swiggy, red=Zomato), counter panel with countdown timer
  - Next: Build cloud relay server, apply for Zomato/Swiggy vendor partnerships
- Next: Cloud relay server, test full offline→online sync, hardware integration testing
