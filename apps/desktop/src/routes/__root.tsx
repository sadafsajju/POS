import { createRootRoute, Outlet } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useEffect } from 'react'
import { useSettingsStore, useSetupCheck, usePinVerifyStore } from '@pos/core'
import { Loader2, WifiOff, RefreshCw } from 'lucide-react'
import { PinDialog } from '@/components/ui/pin-dialog'
import '../index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

// Gate that checks if initial setup is needed before rendering the app
function SetupGate({ children }: { children: React.ReactNode }) {
  const pathname = window.location.pathname
  const isCustomerDisplay = pathname === '/customer-display' || pathname === '/token-display' || pathname === '/kiosk'
  const { needsSetup, isChecking, error, retry } = useSetupCheck()

  useEffect(() => {
    if (isCustomerDisplay || isChecking || error) return

    if (needsSetup && pathname !== '/setup') {
      window.location.href = '/setup'
    } else if (!needsSetup && pathname === '/setup') {
      window.location.href = '/login'
    }
  }, [needsSetup, isChecking, error, pathname, isCustomerDisplay])

  // Customer display is a standalone read-only window — skip all gates
  if (isCustomerDisplay) {
    return <>{children}</>
  }

  // Loading state while checking setup status
  if (isChecking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Starting up...</p>
        </div>
      </div>
    )
  }

  // Error state — backend unreachable
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-sm mx-auto p-6">
          <div className="w-16 h-16 mx-auto bg-destructive/10 rounded-full flex items-center justify-center">
            <WifiOff className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold">Connection Error</h2>
          <p className="text-sm text-muted-foreground">
            Unable to connect to the POS backend. Make sure the server is running and try again.
          </p>
          <button
            onClick={retry}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    )
  }

  // Redirect is in progress — show nothing to avoid flash
  if (needsSetup && pathname !== '/setup') return null
  if (!needsSetup && pathname === '/setup') return null

  return <>{children}</>
}

// Component that initializes settings on app load
function SettingsInitializer({ children }: { children: React.ReactNode }) {
  const { fetchSettings, isInitialized, settings } = useSettingsStore()

  useEffect(() => {
    // Skip fetching settings on login, setup, lock, and customer-display pages
    const pathname = window.location.pathname
    if (pathname === '/login' || pathname === '/setup' || pathname === '/lock' || pathname === '/customer-display' || pathname === '/token-display' || pathname === '/kiosk') {
      console.log('SettingsInitializer: On login/setup page, skipping fetch')
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

// Global PIN verification dialog — rendered once, triggered via usePinVerifyStore
function GlobalPinDialog() {
  const isOpen = usePinVerifyStore((s) => s.isOpen)
  const title = usePinVerifyStore((s) => s.title)
  const description = usePinVerifyStore((s) => s.description)
  const onVerified = usePinVerifyStore((s) => s.onVerified)
  const onCancel = usePinVerifyStore((s) => s.onCancel)

  if (!isOpen) return null

  return (
    <PinDialog
      open={isOpen}
      title={title}
      description={description}
      onVerified={onVerified}
      onCancel={onCancel}
    />
  )
}

export const Route = createRootRoute({
  component: () => {
    const pathname = window.location.pathname
    // Landing, register, and login pages need scrolling
    const needsScrolling = pathname === '/landing' || pathname === '/register' || pathname === '/login'

    return (
      <QueryClientProvider client={queryClient}>
        <SetupGate>
          <SettingsInitializer>
            <div className={needsScrolling ? "min-h-screen bg-background" : "h-screen overflow-hidden bg-background"}>
              <Outlet />
            </div>
          </SettingsInitializer>
        </SetupGate>
        <GlobalPinDialog />
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    )
  },
})
