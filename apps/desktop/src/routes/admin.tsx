import { createFileRoute, Outlet, useLocation } from '@tanstack/react-router'
import { AdminTopBar, AdminBottomNav } from '@/components/admin/AdminSidebar'
import { useEffect, useState } from 'react'
import { useAuth as useClerkAuth } from '@clerk/clerk-react'

// Use shared packages
import { useAuthStore } from '@pos/core'
import { authApi } from '@pos/api-client'

// Safe Clerk hook — returns defaults when ClerkProvider is absent (offline/self-hosted mode)
function useClerkAuthSafe() {
  try {
    return useClerkAuth()
  } catch {
    return { isSignedIn: undefined as boolean | undefined, isLoaded: true }
  }
}

export const Route = createFileRoute('/admin')({
  component: AdminLayout,
})

function AdminLayout() {
  // Use the shared auth store — all hooks must be called before any early returns
  const { user, isAuthenticated, isLoading, isLocked, _hasHydrated, loginWithClerk } = useAuthStore()
  const location = useLocation()
  const { isSignedIn, isLoaded: clerkLoaded } = useClerkAuthSafe()
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  // Redirect staff members to their appropriate interface (runs when already authenticated)
  useEffect(() => {
    if (!_hasHydrated || !isAuthenticated || !user) {
      return
    }

    const currentPath = location.pathname

    // Redirect staff to their specific interface if they're on wrong route
    if (user.role === 'server' || user.role === 'counter') {
      if (currentPath === '/admin' || currentPath === '/admin/') {
        console.log('🔀 Staff on /admin root, redirecting to POS interface')
        window.location.href = '/admin/pos'
      }
    } else if (user.role === 'kitchen') {
      if (currentPath === '/admin' || currentPath === '/admin/') {
        console.log('🔀 Kitchen staff on /admin root, redirecting to kitchen display')
        window.location.href = '/admin/kitchen'
      }
    }
  }, [_hasHydrated, isAuthenticated, user, location.pathname])

  // If Clerk is signed in but our store isn't authenticated, sync the session
  useEffect(() => {
    console.log('👀 AdminLayout useEffect check:', {
      _hasHydrated,
      isAuthenticated,
      clerkLoaded,
      isSignedIn,
      syncing,
      loggingOut: sessionStorage.getItem('pos-logging-out')
    })

    if (!_hasHydrated || isAuthenticated || !clerkLoaded || !isSignedIn || syncing) {
      console.log('⏭️ Skipping session sync (early return)')
      return
    }

    // Don't re-authenticate if user is in the middle of logging out
    if (sessionStorage.getItem('pos-logging-out')) {
      console.log('🚪 User is logging out, skipping session sync')
      return
    }

    console.log('🔄 Starting Clerk session sync...')
    setSyncing(true)
    authApi.clerkSession().then((res) => {
      if (res.success && res.data) {
        console.log('✓ Clerk session synced successfully')
        const { user, organization, location, locations, needs_setup } = res.data
        loginWithClerk(user, organization, location, locations)

        if (needs_setup) {
          console.log('⚙️ Setup needed, redirecting...')
          window.location.href = '/setup?mode=clerk'
        } else {
          // Redirect based on user role (always redirect staff to their specific interface)
          if (user.role === 'server' || user.role === 'counter') {
            console.log('🔀 Redirecting server/counter role to POS interface')
            window.location.href = '/admin/pos'
          } else if (user.role === 'kitchen') {
            console.log('🔀 Redirecting kitchen role to kitchen display')
            window.location.href = '/admin/kitchen'
          }
          // admin and manager don't get redirected, they stay where they are
        }
      } else {
        console.error('❌ Session sync failed:', res.message)
        setSyncError(res.message || 'Failed to sync session')
      }
      setSyncing(false)
    }).catch((err) => {
      console.error('❌ Session sync error:', err)
      setSyncError(err.message || 'Connection error')
      setSyncing(false)
    })
  }, [_hasHydrated, isAuthenticated, clerkLoaded, isSignedIn, syncing, loginWithClerk])

  // Debug logging
  console.log('AdminLayout auth state:', { user: user?.username, isAuthenticated, isLoading, _hasHydrated, clerkSignedIn: isSignedIn })

  // Show loading while auth store is hydrating
  if (!_hasHydrated || isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-zinc-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-zinc-500">Loading Admin Panel...</p>
        </div>
      </div>
    )
  }

  // Clerk is signed in but session not yet synced — show loading instead of redirecting
  if (!isAuthenticated && clerkLoaded && isSignedIn) {
    if (syncError) {
      return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
          <div className="text-center space-y-4 max-w-sm">
            <p className="text-red-400 text-sm">{syncError}</p>
            <button
              onClick={() => { setSyncError(null); setSyncing(false); }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md"
            >
              Retry
            </button>
          </div>
        </div>
      )
    }
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-zinc-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-zinc-500">Setting up your account...</p>
        </div>
      </div>
    )
  }

  // Check authentication - redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    // If user is logging out, redirect to landing instead of login
    const loggingOut = sessionStorage.getItem('pos-logging-out')
    const redirectTo = loggingOut ? '/landing' : '/login'

    console.log('🚫 AdminLayout: Not authenticated, redirecting...', {
      isAuthenticated,
      hasUser: !!user,
      pathname: window.location.pathname,
      loggingOut: !!loggingOut,
      redirectTo
    })

    window.location.href = redirectTo
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-zinc-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  // Locked - redirect to lock screen
  if (isLocked) {
    window.location.href = '/lock'
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-zinc-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  // Check role-based access
  // Allow access to specific routes based on role
  const allowedRoutes = {
    admin: ['/admin'], // Full admin access
    manager: ['/admin'], // Full admin access
    server: ['/admin/pos'], // POS interface only
    counter: ['/admin/pos'], // POS interface only
    kitchen: ['/admin/kitchen'], // Kitchen display only
  }

  const userAllowedRoutes = allowedRoutes[user.role as keyof typeof allowedRoutes] || []
  const currentPath = location.pathname
  const hasAccess = userAllowedRoutes.some(route => {
    if (route === '/admin') return true // Full admin access
    return currentPath.startsWith(route)
  })

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-400 mb-2">Access Denied</h1>
          <p className="text-zinc-500 mb-4">You don't have permission to access this page.</p>
          <a href={userAllowedRoutes[0] || '/login'} className="text-zinc-300 hover:underline">
            Go to {user.role === 'server' || user.role === 'counter' ? 'POS' : user.role === 'kitchen' ? 'Kitchen' : 'Home'}
          </a>
        </div>
      </div>
    )
  }

  const viewParam = (location.search as Record<string, string>).view
  const isFullScreen = location.pathname === '/admin/pos' && !!viewParam && viewParam !== 'order-type'

  // Only show admin navigation for admin/manager roles
  // Staff (server, counter, kitchen) should only see their specific interface
  const showAdminNav = user.role === 'admin' || user.role === 'manager'

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {!isFullScreen && <AdminTopBar user={user} />}
      <main className="flex-1 min-h-0 overflow-hidden bg-background">
        <Outlet />
      </main>
      {!isFullScreen && showAdminNav && <AdminBottomNav />}
    </div>
  )
}
