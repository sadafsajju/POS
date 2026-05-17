import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import path from 'path'
import { readFileSync } from 'node:fs'

// Read the app version once at build time from tauri.conf.json — that's the
// single source of truth that's already bumped on every release tag, so the
// in-app "Version" badge stays in sync without a parallel bump.
const tauriConfig = JSON.parse(
  readFileSync(path.resolve(__dirname, 'src-tauri/tauri.conf.json'), 'utf8'),
)
const APP_VERSION = tauriConfig.version as string

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  plugins: [
    react(),
    TanStackRouterVite(),
    tsconfigPaths()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    // No proxy needed — Supabase client connects directly to Supabase URL
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['@tanstack/react-router'],
          query: ['@tanstack/react-query'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', '@tanstack/react-router', '@tanstack/react-query'],
  },
})

