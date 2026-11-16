import { createFileRoute, Navigate } from '@tanstack/react-router'
import { useSettingsStore } from '@pos/core'
import { useState, useEffect } from 'react'
import { NewEnhancedKitchenLayout } from '@/components/kitchen/NewEnhancedKitchenLayout'
import type { User } from '@/types'

export const Route = createFileRoute('/admin/kitchen')({
  component: AdminKitchenPage,
})

function AdminKitchenPage() {
  const [user, setUser] = useState<User | null>(null)
  const { settings } = useSettingsStore()

  useEffect(() => {
    try {
      const storedAuth = localStorage.getItem('pos-auth')
      if (storedAuth) {
        const parsed = JSON.parse(storedAuth)
        if (parsed.state?.user) {
          setUser(parsed.state.user)
        }
      }
    } catch (error) {
      console.error('Failed to parse stored user:', error)
    }
  }, [])

  if (!user) {
    return <div className="flex items-center justify-center h-screen bg-background text-foreground">Loading...</div>
  }

  // KDS turned off (More → General): the Kitchen tab is already hidden, this
  // covers bookmarks, direct URLs and the kitchen-role login redirect.
  if (!settings.enableKds) {
    if (user.role === 'admin' || user.role === 'manager') {
      return <Navigate to="/admin/pos" replace />
    }
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950 text-center px-4">
        <div className="max-w-sm">
          <h1 className="text-xl font-semibold text-zinc-200 mb-2">Kitchen display is turned off</h1>
          <p className="text-sm text-zinc-500">
            This store works from printed KOTs. An admin can turn the kitchen display back on in More → General.
          </p>
        </div>
      </div>
    )
  }

  return <NewEnhancedKitchenLayout user={user} />
}