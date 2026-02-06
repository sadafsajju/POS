import { createFileRoute } from '@tanstack/react-router'
import { Plug } from 'lucide-react'
import { PlatformSettings } from '@/components/admin/PlatformSettings'

export const Route = createFileRoute('/admin/settings/platforms')({
  component: PlatformsSettingsPage,
})

function PlatformsSettingsPage() {
  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6 mx-auto max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <Plug className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Platform Integrations</h2>
            <p className="text-sm text-muted-foreground">Configure Swiggy and Zomato order integrations</p>
          </div>
        </div>

        {/* Content - PlatformSettings manages its own save state */}
        <PlatformSettings />
      </div>
    </div>
  )
}
