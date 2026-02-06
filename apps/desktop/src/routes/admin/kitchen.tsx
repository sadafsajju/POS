import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { NewEnhancedKitchenLayout } from '@/components/kitchen/NewEnhancedKitchenLayout'
import type { User } from '@/types'

export const Route = createFileRoute('/admin/kitchen')({
  component: AdminKitchenPage,
})

function AdminKitchenPage() {
  const [user, setUser] = useState<User | null>(null)

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

  return <NewEnhancedKitchenLayout user={user} />
}