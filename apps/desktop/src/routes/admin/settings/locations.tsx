import { createFileRoute } from '@tanstack/react-router'
import { MapPin } from 'lucide-react'
import { AdminLocationManagement } from '@/components/admin/AdminLocationManagement'

export const Route = createFileRoute('/admin/settings/locations')({
  component: LocationsSettingsPage,
})

function LocationsSettingsPage() {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <header className="flex-shrink-0 px-6 py-4 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-zinc-800 rounded-lg text-zinc-300">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-100">Location Management</h2>
            <p className="text-sm text-zinc-500">Manage your restaurant branches and locations</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <AdminLocationManagement />
      </div>
    </div>
  )
}
