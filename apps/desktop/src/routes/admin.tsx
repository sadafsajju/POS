import { createFileRoute, Outlet, useLocation } from '@tanstack/react-router'
import { AdminTopBar, AdminBottomNav } from '@/components/admin/AdminSidebar'
import { useEffect } from 'react'

// Use shared packages
import { useAuthStore } from '@pos/core'

export const Route = createFileRoute('/admin')({
  component: AdminLayout,
})

function AdminLayout() {
  const { user, isAuthenticated, isLoading, isLocked, _hasHydrated } = useAuthStore()
  const location = useLocation()

  // Redirect staff members to their appropriate interface (runs when already authenticated)
  useEffect(() => {
    if (!_hasHydrated || !isAuthenticated || !user) {
      return
    }

    const currentPath = location.pathname

    // Redirect staff to their specific interface if they're on wrong route
    if (user.role === 'server' || user.role === 'counter') {
      if (currentPath === '/admin' || currentPath === '/admin/') {
        window.location.href = '/admin/pos'
      }
    } else if (user.role === 'kitchen') {
      if (currentPath === '/admin' || currentPath === '/admin/') {
        window.location.href = '/admin/kitchen'
      }
    }
  }, [_hasHydrated, isAuthenticated, user, location.pathname])

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

  // Check authentication - redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    window.location.href = '/login'
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
  const showAdminNav = user.role === 'admin' || user.role === 'manager'

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {!isFullScreen && <AdminTopBar user={user as any} />}
      <main className="flex-1 min-h-0 overflow-hidden bg-background">
        <Outlet />
      </main>
      {!isFullScreen && showAdminNav && <AdminBottomNav />}
    </div>
  )
}
