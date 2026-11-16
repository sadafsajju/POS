import { createFileRoute } from '@tanstack/react-router'
import { CustomerDirectory } from '@/components/customers/CustomerDirectory'

export const Route = createFileRoute('/admin/more/customers')({
  component: CustomersPage,
})

function CustomersPage() {
  return <CustomerDirectory />
}
