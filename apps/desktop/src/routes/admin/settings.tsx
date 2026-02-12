import { createFileRoute, Outlet } from '@tanstack/react-router'
import { SettingsSidebar } from '@/components/admin/settings/SettingsSidebar'

export const Route = createFileRoute('/admin/settings')({
  component: SettingsLayout,
})

function SettingsLayout() {
  return (
    <div className="dark flex h-full bg-zinc-950 text-zinc-100 overflow-hidden">
      <SettingsSidebar />
      <div className="flex-1 min-w-0 h-full overflow-hidden">
        <Outlet />
      </div>
    </div>
  )
}
