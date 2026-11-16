import { createFileRoute, redirect } from '@tanstack/react-router'

// Moved into the Customization hub — keep the old URL working.
export const Route = createFileRoute('/admin/more/receipts')({
  beforeLoad: () => {
    throw redirect({ to: '/admin/more/customization/receipts' })
  },
})
