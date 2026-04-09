import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/settings/system')({
  beforeLoad: () => {
    throw redirect({ to: '/admin/settings/general' })
  },
  component: () => null,
})
