import { createFileRoute } from '@tanstack/react-router'
import { VatExport } from '@/components/admin/VatExport'

export const Route = createFileRoute('/admin/more/vat-export')({
  component: () => <VatExport />,
})
