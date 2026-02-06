import { createFileRoute, Outlet } from '@tanstack/react-router'
import { SettingsSidebar } from '@/components/admin/settings/SettingsSidebar'

export const Route = createFileRoute('/admin/settings')({
  component: SettingsLayout,
})

function SettingsLayout() {
  return (
    <div className="flex h-full">
      <SettingsSidebar />
      <div className="flex-1 min-w-0 overflow-hidden flex justify-center">
        <div className="w-full max-w-5xl">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
