import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Plus,
  Trash2,
  Edit,
  MapPin,
  Phone,
  Building2,
  X,
  Save,
  Loader2,
} from 'lucide-react'
import apiClient from '@/api/client'
import { toastHelpers } from '@/lib/toast-helpers'
import type { Location } from '@/types'

interface LocationFormData {
  name: string
  code: string
  address: string
  phone: string
}

const emptyForm: LocationFormData = { name: '', code: '', address: '', phone: '' }

export function AdminLocationManagement() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)
  const [formData, setFormData] = useState<LocationFormData>(emptyForm)

  // Fetch locations
  const { data: locationsData, isLoading, error: queryError } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const res = await apiClient.getLocations()
      // Extract the data array from the API response wrapper
      if (res && Array.isArray((res as any).data)) {
        return (res as any).data as Location[]
      }
      return [] as Location[]
    },
  })

  const locations: Location[] = Array.isArray(locationsData) ? locationsData : []

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: LocationFormData) =>
      apiClient.createLocation({
        name: data.name,
        code: data.code,
        address: data.address || undefined,
        phone: data.phone || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] })
      toastHelpers.success('Location created', 'New branch has been added.')
      resetForm()
    },
    onError: (error: any) => {
      toastHelpers.apiError('Create location', error)
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: LocationFormData }) =>
      apiClient.updateLocation(id, {
        name: data.name,
        code: data.code,
        address: data.address || undefined,
        phone: data.phone || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] })
      toastHelpers.success('Location updated', 'Branch details have been saved.')
      resetForm()
    },
    onError: (error: any) => {
      toastHelpers.apiError('Update location', error)
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteLocation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] })
      toastHelpers.success('Location deleted', 'Branch has been removed.')
    },
    onError: (error: any) => {
      toastHelpers.apiError('Delete location', error)
    },
  })

  const resetForm = () => {
    setShowForm(false)
    setEditingLocation(null)
    setFormData(emptyForm)
  }

  const handleEdit = (location: Location) => {
    setEditingLocation(location)
    setFormData({
      name: location.name,
      code: location.code,
      address: location.address || '',
      phone: location.phone || '',
    })
    setShowForm(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim() || !formData.code.trim()) return

    if (editingLocation) {
      updateMutation.mutate({ id: editingLocation.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
      </div>
    )
  }

  if (queryError) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          Failed to load locations: {queryError.message}. Try logging out and back in.
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Add Button */}
      {!showForm && (
        <div className="flex justify-end">
          <Button
            onClick={() => { setFormData(emptyForm); setEditingLocation(null); setShowForm(true) }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Location
          </Button>
        </div>
      )}

      {/* Create / Edit Form */}
      {showForm && (
        <Card className="border-teal-500/30">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">
                  {editingLocation ? 'Edit Location' : 'New Location'}
                </h3>
                <Button type="button" variant="ghost" size="icon" onClick={resetForm}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-zinc-300">Branch Name *</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. MG Road Branch"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-zinc-300">Location Code *</label>
                  <Input
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. MG-ROAD"
                    required
                  />
                  <p className="text-xs text-zinc-500">Short unique identifier for this branch</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-300">Address</label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Full address"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-300">Phone</label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Contact number"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={isSaving} className="gap-2">
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {editingLocation ? 'Update Location' : 'Create Location'}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm} disabled={isSaving}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Locations List */}
      {locations.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <MapPin className="mx-auto h-12 w-12 text-zinc-600" />
              <h3 className="mt-3 text-sm font-medium text-zinc-300">No locations</h3>
              <p className="mt-1 text-sm text-zinc-500">
                Add your first branch to start managing multiple locations.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {locations.map((location) => (
            <Card key={location.id} className="hover:border-zinc-700 transition-colors">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 min-w-0 flex-1">
                    <div className="p-2.5 bg-teal-500/10 rounded-lg flex-shrink-0">
                      <Building2 className="h-5 w-5 text-teal-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-base font-semibold text-zinc-100 truncate">
                          {location.name}
                        </h4>
                        <Badge variant="outline" className="text-xs font-mono flex-shrink-0">
                          {location.code}
                        </Badge>
                        {location.is_active ? (
                          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs flex-shrink-0">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs flex-shrink-0">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-500">
                        {location.address && (
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5" />
                            {location.address}
                          </span>
                        )}
                        {location.phone && (
                          <span className="flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5" />
                            {location.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(location)}
                      className="gap-1.5"
                    >
                      <Edit className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteMutation.mutate(location.id)}
                      disabled={deleteMutation.isPending}
                      className="gap-1.5 text-red-400 hover:text-red-300 hover:border-red-500/50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
