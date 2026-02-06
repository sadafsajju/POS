import { createFileRoute } from '@tanstack/react-router'
import { AdminMenuManagement } from '@/components/admin/AdminMenuManagement'

export const Route = createFileRoute('/admin/settings/menu/')({
  component: () => <AdminMenuManagement />,
})
