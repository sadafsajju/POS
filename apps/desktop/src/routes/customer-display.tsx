import { createFileRoute } from '@tanstack/react-router'
import { CustomerDisplay } from '@/components/customer-display/CustomerDisplay'

export const Route = createFileRoute('/customer-display')({
  component: CustomerDisplay,
})
