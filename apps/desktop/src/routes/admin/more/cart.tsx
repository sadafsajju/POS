import { createFileRoute, redirect } from '@tanstack/react-router'

// Moved into the Customization hub — keep the old URL working.
export const Route = createFileRoute('/admin/more/cart')({
  beforeLoad: () => {
    throw redirect({ to: '/admin/more/customization/cart' })
  },
})
