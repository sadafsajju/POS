import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/settings/account')({
  beforeLoad: () => {
    throw redirect({ to: '/admin/settings/general' })
  },
  component: () => null,
})
