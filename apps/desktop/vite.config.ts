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
    // The app is a large, feature-rich offline SPA; 500 kB is unrealistically
    // low for the main bundle. We split heavy vendors into their own cacheable
    // chunks (below) and set the warning threshold to match the real size.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Group heavy third-party libs into separate, long-lived chunks so they
        // cache independently of app code and don't bloat the entry chunk.
        // Function form (vs a name→deps map) so transitive deps like d3 land
        // with their parent (recharts).
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('recharts') || id.includes('/d3-') || id.includes('victory-vendor')) return 'charts'
          if (id.includes('@supabase')) return 'supabase'
          if (id.includes('lucide-react')) return 'icons'
          if (id.includes('@tanstack/react-router')) return 'router'
          if (id.includes('@tanstack/react-query')) return 'query'
          if (id.includes('@tanstack/react-table')) return 'table'
          if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('/zod/')) return 'forms'
          if (id.includes('date-fns') || id.includes('react-day-picker')) return 'dates'
          if (id.includes('i18next')) return 'i18n'
          if (id.includes('@radix-ui')) return 'ui'
          if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/scheduler/')) return 'vendor'
        },
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', '@tanstack/react-router', '@tanstack/react-query'],
  },
})

