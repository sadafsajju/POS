import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/more/system')({
  beforeLoad: () => {
    throw redirect({ to: '/admin/more/general' })
  },
  component: () => null,
})
