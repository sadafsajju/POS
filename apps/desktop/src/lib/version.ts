// App version, injected at build time by vite.config.ts from tauri.conf.json.
// Single source of truth: bump tauri.conf.json + Cargo.toml on each release
// and this constant updates automatically — no parallel bump needed.

declare const __APP_VERSION__: string

export const APP_VERSION: string =
  typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0-dev'
