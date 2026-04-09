import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Trash2,
  Edit,
  MapPin,
  Phone,
  Building2,
  Save,
  Loader2,
  MoreVertical,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
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

  const locations: Location[] = (Array.isArray(locationsData) ? locationsData : [])
    .slice()
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

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
      <div className="h-full flex flex-col bg-zinc-950 text-zinc-100 select-none">
        <header className="flex-shrink-0 flex items-center justify-between px-6 py-3 bg-zinc-900 border-b border-zinc-800">
          <span className="text-lg font-bold tracking-tight text-zinc-300">Locations</span>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
        </div>
      </div>
    )
  }

  if (queryError) {
    return (
      <div className="h-full flex flex-col bg-zinc-950 text-zinc-100 select-none">
        <header className="flex-shrink-0 flex items-center justify-between px-6 py-3 bg-zinc-900 border-b border-zinc-800">
          <span className="text-lg font-bold tracking-tight text-zinc-300">Locations</span>
        </header>
        <div className="flex-1 p-6">
          <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            Failed to load locations: {queryError.message}. Try logging out and back in.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-zinc-950 text-zinc-100 select-none">
      {/* Header Strip */}
      <header className="flex-shrink-0 flex items-center justify-between px-6 py-3 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold tracking-tight text-zinc-300">Locations</span>
          <div className="h-5 w-px bg-zinc-700" />
          <span className="text-sm font-bold text-zinc-200 tabular-nums">{locations.length}</span>
          <span className="text-xs text-zinc-500">total</span>
        </div>
        <button
          onClick={() => { setFormData(emptyForm); setEditingLocation(null); setShowForm(true) }}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-emerald-500/15 text-emerald-400 text-sm font-medium hover:bg-emerald-500/25 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Location
        </button>
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">

      {/* Locations List */}
      {locations.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <MapPin className="mx-auto h-10 w-10 text-zinc-700 mb-3" />
            <p className="text-sm font-semibold text-zinc-500">No locations</p>
            <p className="text-xs text-zinc-600 mt-1">
              Add your first branch to start managing multiple locations.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          {locations.map((location) => (
            <div
              key={location.id}
              className="rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-start justify-between px-4 py-4">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="p-2 bg-teal-500/10 rounded-lg flex-shrink-0 mt-0.5">
                    <Building2 className="h-4 w-4 text-teal-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-base font-bold text-zinc-100 truncate">
                        {location.name}
                      </span>
                      <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-zinc-800 text-zinc-400 border border-zinc-700 flex-shrink-0">
                        {location.code}
                      </span>
                      {location.is_active ? (
                        <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex-shrink-0">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-bold bg-zinc-500/15 text-zinc-500 border border-zinc-500/30 flex-shrink-0">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
                      {location.address && (
                        <span className="flex items-center gap-1.5">
                          <MapPin className="h-3 w-3 text-zinc-600" />
                          {location.address}
                        </span>
                      )}
                      {location.phone && (
                        <span className="flex items-center gap-1.5">
                          <Phone className="h-3 w-3 text-zinc-600" />
                          {location.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex-shrink-0 ml-4 p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-700 min-w-[140px]">
                    <DropdownMenuItem
                      onClick={() => handleEdit(location)}
                      className="gap-2 text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100"
                    >
                      <Edit className="h-3.5 w-3.5" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => deleteMutation.mutate(location.id)}
                      disabled={deleteMutation.isPending}
                      className="gap-2 text-red-400 focus:bg-red-500/10 focus:text-red-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}

      </div>

      {/* Create / Edit Location Dialog */}
      <Dialog open={showForm} onOpenChange={(v) => { if (!v) resetForm() }}>
        <DialogContent className="dark flex flex-col !max-w-none !w-screen !h-screen !rounded-none p-0 gap-0 overflow-hidden bg-zinc-950 border-zinc-800 text-zinc-100">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-zinc-800 flex-shrink-0 bg-zinc-900">
            <DialogTitle className="text-zinc-100">
              {editingLocation ? 'Edit Location' : 'Create New Location'}
            </DialogTitle>
            <DialogDescription className="text-zinc-500">
              {editingLocation
                ? `Editing "${editingLocation.name}"`
                : 'Add a new branch to your organization'}
            </DialogDescription>
          </DialogHeader>
          <form id="location-form" onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="max-w-2xl mx-auto p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-400">Branch Name *</label>
                    <input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. MG Road Branch"
                      required
                      className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-400">Location Code *</label>
                    <input
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      placeholder="e.g. MG-ROAD"
                      required
                      className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-colors font-mono"
                    />
                    <p className="text-[11px] text-zinc-600">Short unique identifier for this branch</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">Address</label>
                  <input
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Full address"
                    className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">Phone</label>
                  <input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Contact number"
                    className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Fixed footer */}
            <div className="flex-shrink-0 border-t border-zinc-800 bg-zinc-900 px-6 py-4">
              <div className="max-w-2xl mx-auto flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-md text-sm font-medium text-zinc-400 bg-zinc-800 hover:bg-zinc-700 ring-1 ring-zinc-700 transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center justify-center gap-2 px-6 py-2 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {editingLocation ? 'Update Location' : 'Create Location'}
                </button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
