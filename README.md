# POS System

A modern, offline-first Point of Sale system built with Tauri, React, and Go.

## Features

- **Multi-Platform Desktop App** - Mac and Windows support via Tauri
- **Offline-First Architecture** - Works without internet, syncs when online
- **Kitchen Display System** - Real-time order display for kitchen staff
- **Multi-Industry Support** - Restaurant and retail modes
- **Plugin Architecture** - Modular system for paid add-ons
- **Role-Based Access** - Admin, Manager, Server, Counter, Kitchen roles
- **Hardware Integration** - Thermal printers, barcode scanners

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop App | Tauri 2.0 + Rust |
| Frontend | React 18 + TypeScript + Tailwind CSS |
| Backend | Go + Gin |
| Database | PostgreSQL + SQLite (local) |
| Cache | Redis |
| Monorepo | Turborepo |

## Project Structure

```
pos-system/
├── apps/
│   ├── desktop/              # Tauri desktop app (POS)
│   │   ├── src/              # React frontend
│   │   └── src-tauri/        # Rust backend (hardware, SQLite)
│   └── (kitchen display integrated in desktop app at /admin/kitchen)
├── packages/
│   ├── types/                # Shared TypeScript types
│   ├── core/                 # Business logic (offline-first)
│   ├── api-client/           # API client for backend
│   └── ui/                   # Shared UI components (future)
├── backend/                  # Go API server
├── database/                 # Database migrations
└── docker-compose.yml        # Development infrastructure
```

## Prerequisites

- Node.js 18+
- Rust (for Tauri)
- Go 1.21+
- Docker & Docker Compose
- PostgreSQL (or use Docker)

## Quick Start

### 1. Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Install Rust (if not installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### 2. Start Development Infrastructure

```bash
# Start PostgreSQL and Redis
npm run db:up
```

### 3. Run Backend

```bash
# In a separate terminal
npm run backend:dev
```

### 4. Run Desktop App

```bash
# Development mode (web)
npm run dev:desktop

# Or run as native desktop app
cd apps/desktop && npm run tauri:dev
```

### 5. Run Kitchen Display

```bash
npm run dev:kitchen
```

## Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Run all apps in development |
| `npm run dev:desktop` | Run desktop app only |
| `npm run dev:kitchen` | Run kitchen display only |
| `npm run build` | Build all apps |
| `npm run build:mac` | Build Mac desktop app (.dmg) |
| `npm run build:win` | Build Windows app (.exe) |
| `npm run lint` | Lint all code |
| `npm run type-check` | TypeScript type checking |
| `npm run db:up` | Start PostgreSQL & Redis |
| `npm run db:down` | Stop infrastructure |

## Building for Production

### Desktop App (Mac)

```bash
cd apps/desktop
npm run tauri build -- --target universal-apple-darwin
```

Output: `apps/desktop/src-tauri/target/release/bundle/dmg/`

### Desktop App (Windows)

```bash
cd apps/desktop
npm run tauri build -- --target x86_64-pc-windows-msvc
```

Output: `apps/desktop/src-tauri/target/release/bundle/nsis/`

## Environment Variables

Create `.env` files in the root and backend directories:

### Backend (.env)
```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres123
DB_NAME=pos_system
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your-secret-key
PORT=8080
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:8080
```

## Architecture

### Offline-First Sync Strategy

| Module | Strategy | Reason |
|--------|----------|--------|
| Orders/Sales | Offline-first | Critical for business continuity |
| Inventory | Offline-first | Stock updates are essential |
| Products/Menu | Cloud-first, cached | Changes infrequently |
| Reports | Cloud-only | Aggregated data |
| User Auth | Cached tokens | Allow offline login |

### Plugin System

Core modules are included free:
- POS Billing
- Basic Reports
- User Management

Premium plugins (planned):
- Advanced Inventory
- CRM & Loyalty
- Multi-location
- Advanced Analytics
- Accounting Integration

## Hardware Integration

The desktop app supports:
- **Thermal Printers** - ESC/POS protocol (Epson, Star, Bixolon)
- **Barcode Scanners** - USB HID devices
- **Cash Drawers** - Printer-connected or serial
- **Weighing Scales** - Serial/USB connection

## License

**Proprietary — All Rights Reserved.** Copyright (c) 2026 Sadaf Sajju.

This repository is publicly visible only because the release pipeline
requires it; visibility does **not** grant any right to use, copy,
modify, or distribute the source. See [LICENSE](LICENSE) for the full
terms. For commercial enquiries: sadafsajju@gmail.com.

## Contributing

By submitting a pull request you assign your contribution to the copyright
holder under the project's licence terms.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request
