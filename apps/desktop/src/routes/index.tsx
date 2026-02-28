import { createFileRoute, redirect } from '@tanstack/react-router'
import { RoleBasedLayout } from '@/components/RoleBasedLayout'

// Use shared packages
import { useAuthStore } from '@pos/core'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    // Get auth state from store
    const { isAuthenticated, user, _hasHydrated, isLoading, isLocked } = useAuthStore.getState()

    console.log('Root beforeLoad:', { isAuthenticated, user: user?.username, _hasHydrated, isLoading, isLocked })

    // Wait for hydration
    if (!_hasHydrated || isLoading) {
      console.log('Root beforeLoad: Still hydrating, allowing render...')
      return
    }

    // Not authenticated - redirect to landing
    if (!isAuthenticated || !user) {
      console.log('Root beforeLoad: Not authenticated, redirecting to /landing')
      throw redirect({ to: '/landing' })
    }

    // Locked - redirect to lock screen
    if (isLocked) {
      console.log('Root beforeLoad: Locked, redirecting to /lock')
      throw redirect({ to: '/lock' })
    }

    // Admin users - redirect to admin POS
    if (user.role === 'admin') {
      console.log('Root beforeLoad: Admin user, redirecting to /admin/pos')
      throw redirect({ to: '/admin/pos' })
    }

    console.log('Root beforeLoad: Authenticated, rendering role-based layout')
  },
  component: HomePage,
})

function HomePage() {
  // Use auth store
  const { user, isLoading, _hasHydrated } = useAuthStore()

  // Show loading while hydrating
  if (!_hasHydrated || isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-zinc-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-zinc-500">Loading POS System...</p>
        </div>
      </div>
    )
  }

  // If we reach here, user is authenticated (beforeLoad handled redirects)
  // Render role-based layout for authenticated users
  return user ? <RoleBasedLayout user={user} /> : null
}
