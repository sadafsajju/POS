import { createFileRoute } from '@tanstack/react-router'
import { Plug } from 'lucide-react'
import { PlatformSettings } from '@/components/admin/PlatformSettings'

export const Route = createFileRoute('/admin/settings/platforms')({
  component: PlatformsSettingsPage,
})

function PlatformsSettingsPage() {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 px-6 py-4 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div >
            <Plug className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-100">Platform Integrations</h2>
            {/* <p className="text-sm text-zinc-500">Configure Swiggy and Zomato order integrations</p> */}
          </div>
        </div>
      </header>

      {/* ── Scrollable Content ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6">
        <PlatformSettings />
      </div>
    </div>
  )
}
