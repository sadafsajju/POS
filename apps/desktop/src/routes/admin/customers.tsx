import { createFileRoute } from '@tanstack/react-router'
import { CustomerDirectory } from '@/components/customers/CustomerDirectory'

export const Route = createFileRoute('/admin/customers')({
  component: CustomersPage,
})

function CustomersPage() {
  return <CustomerDirectory />
}
