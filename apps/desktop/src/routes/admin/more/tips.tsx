import { createFileRoute } from '@tanstack/react-router'
import { TipAllocation } from '@/components/admin/TipAllocation'

export const Route = createFileRoute('/admin/more/tips')({
  component: () => <TipAllocation />,
})
