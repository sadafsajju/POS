import { createFileRoute } from '@tanstack/react-router'
import { AdminStaffManagement } from '@/components/admin/AdminStaffManagement'

export const Route = createFileRoute('/admin/settings/staff')({
  component: () => <AdminStaffManagement />,
})
