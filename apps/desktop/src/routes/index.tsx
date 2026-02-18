import { createFileRoute } from '@tanstack/react-router'
import { RoleBasedLayout } from '@/components/RoleBasedLayout'

// Use shared packages
import { useAuthStore } from '@pos/core'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  // Use auth store
  const { user, isAuthenticated, isLoading, isLocked, _hasHydrated } = useAuthStore()

  // Debug logging
  console.log('HomePage auth state:', { user: user?.username, isAuthenticated, isLoading, _hasHydrated })

  // Wait for zustand to hydrate from localStorage
  if (!_hasHydrated || isLoading) {
    console.log('HomePage: Still hydrating...')
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-zinc-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-zinc-500">Loading POS System...</p>
        </div>
      </div>
    )
  }

  // Not authenticated - redirect to login
  if (!isAuthenticated || !user) {
    console.log('HomePage: Not authenticated, redirecting to login...')
    if (window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
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

  // Admin users go to admin POS
  if (user.role === 'admin') {
    if (window.location.pathname !== '/admin/pos') {
      console.log('HomePage: Admin user, redirecting to admin...')
      window.location.href = '/admin/pos'
    }
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-zinc-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  // Render role-based layout for non-admin authenticated users
  return <RoleBasedLayout user={user} />
}
