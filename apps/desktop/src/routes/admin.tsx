import { createFileRoute, Outlet } from '@tanstack/react-router'
import { AdminTopBar, AdminBottomNav } from '@/components/admin/AdminSidebar'

// Use shared packages
import { useAuthStore } from '@pos/core'

export const Route = createFileRoute('/admin')({
  component: AdminLayout,
})

function AdminLayout() {
  // Use the shared auth store
  const { user, isAuthenticated, isLoading, _hasHydrated } = useAuthStore()

  // Debug logging
  console.log('AdminLayout auth state:', { user: user?.username, isAuthenticated, isLoading, _hasHydrated })

  // Show loading while auth store is hydrating
  if (!_hasHydrated || isLoading) {
    console.log('AdminLayout: Still hydrating...')
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading Admin Panel...</p>
        </div>
      </div>
    )
  }

  // Check authentication - redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    console.log('AdminLayout: Not authenticated, redirecting to login...')
    window.location.href = '/login'
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  // Check admin role
  if (user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-4">You don't have admin privileges.</p>
          <a href="/" className="text-blue-600 hover:underline">Go to Home</a>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <AdminTopBar user={user} />
      <main className="flex-1 min-h-0 overflow-hidden bg-background">
        <Outlet />
      </main>
      <AdminBottomNav />
    </div>
  )
}
