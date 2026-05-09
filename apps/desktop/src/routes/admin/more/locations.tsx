import { createFileRoute } from '@tanstack/react-router'
import { AdminLocationManagement } from '@/components/admin/AdminLocationManagement'

export const Route = createFileRoute('/admin/more/locations')({
  component: LocationsSettingsPage,
})

function LocationsSettingsPage() {
  return <AdminLocationManagement />
}
