import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/more/customization/')({
  beforeLoad: () => {
    throw redirect({ to: '/admin/more/customization/products' })
  },
})
