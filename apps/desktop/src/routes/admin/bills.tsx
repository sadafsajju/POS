import { createFileRoute } from '@tanstack/react-router'
import { BillsInterface } from '@/components/bills/BillsInterface'

export const Route = createFileRoute('/admin/bills')({
  component: () => <BillsInterface />,
})
