import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/more/menu')({
  component: MenuLayout,
})

function MenuLayout() {
  return (
    <div className="h-full overflow-hidden">
      <Outlet />
    </div>
  )
}
