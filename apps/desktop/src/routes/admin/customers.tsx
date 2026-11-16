import { createFileRoute, redirect } from '@tanstack/react-router'

// Customers moved into the More section — keep the old URL working.
export const Route = createFileRoute('/admin/customers')({
  beforeLoad: () => {
    throw redirect({ to: '/admin/more/customers' })
  },
})
