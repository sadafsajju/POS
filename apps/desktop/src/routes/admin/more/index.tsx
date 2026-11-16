import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/more/')({
  beforeLoad: () => {
    // Land on the first item of the sidebar's first group (Manage → Food Menu)
    throw redirect({ to: '/admin/more/menu' })
  },
})
