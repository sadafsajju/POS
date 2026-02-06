import { createRootRoute, Outlet } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useEffect } from 'react'
import { useSettingsStore } from '@pos/core'
import '../index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

// Component that initializes settings on app load
function SettingsInitializer({ children }: { children: React.ReactNode }) {
  const { fetchSettings, isInitialized, settings } = useSettingsStore()

  useEffect(() => {
    // Skip fetching settings on login page to avoid 401 errors
    if (window.location.pathname === '/login') {
      console.log('SettingsInitializer: On login page, skipping fetch')
      return
    }
    // Fetch settings when the app loads
    console.log('SettingsInitializer: Fetching settings...')
    fetchSettings()
  }, [fetchSettings])

  // Apply theme
  useEffect(() => {
    const root = document.documentElement
    if (settings.theme === 'dark') {
      root.classList.add('dark')
    } else if (settings.theme === 'light') {
      root.classList.remove('dark')
    } else {
      // System preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      if (prefersDark) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }
  }, [settings.theme])

  return <>{children}</>
}

export const Route = createRootRoute({
  component: () => (
    <QueryClientProvider client={queryClient}>
      <SettingsInitializer>
        <div className="min-h-screen bg-background">
          <Outlet />
        </div>
      </SettingsInitializer>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  ),
})
