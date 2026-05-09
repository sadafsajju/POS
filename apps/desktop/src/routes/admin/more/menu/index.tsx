import { createFileRoute } from '@tanstack/react-router'
import { AdminMenuManagement } from '@/components/admin/AdminMenuManagement'

export const Route = createFileRoute('/admin/more/menu/')({
  component: () => <AdminMenuManagement />,
})
