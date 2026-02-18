import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/settings/menu')({
  component: MenuLayout,
})

function MenuLayout() {
  return (
    <div className="h-full overflow-hidden">
      <Outlet />
    </div>
  )
}
