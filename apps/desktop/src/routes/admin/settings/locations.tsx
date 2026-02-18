import { createFileRoute } from '@tanstack/react-router'
import { AdminLocationManagement } from '@/components/admin/AdminLocationManagement'

export const Route = createFileRoute('/admin/settings/locations')({
  component: LocationsSettingsPage,
})

function LocationsSettingsPage() {
  return <AdminLocationManagement />
}
