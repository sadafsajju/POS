import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { MapPin, ChevronDown } from 'lucide-react'
import { LocationPickerDialog } from '@/components/ui/location-picker-dialog'
import { useAuthStore } from '@pos/core'
import apiClient from '@/api/client'
import type { Location } from '@/types'

export function LocationSwitcher() {
  const { location, locations, switchLocation } = useAuthStore()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  const switchMutation = useMutation({
    mutationFn: (locationId: string) => apiClient.switchLocation(locationId),
    onSuccess: (data) => {
      if (data.success && data.data) {
        switchLocation(data.data.token, data.data.location)
        queryClient.invalidateQueries()
      }
      setOpen(false)
    },
  })

  const currentName = location?.name || 'All Locations'

  // No locations or single location — show static badge
  if (!locations || locations.length <= 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-zinc-400">
        <MapPin className="w-4 h-4" />
        <span className="truncate max-w-[140px]">{currentName}</span>
      </div>
    )
  }

  // Multiple locations — clickable badge that opens dialog
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-zinc-300 hover:bg-zinc-800 active:bg-zinc-700 transition-colors min-h-[40px]"
      >
        <MapPin className="w-4 h-4 text-zinc-400" />
        <span className="truncate max-w-[140px]">{currentName}</span>
        <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
      </button>

      <LocationPickerDialog
        open={open}
        onOpenChange={setOpen}
        locations={locations}
        currentLocationId={location?.id}
        onSelect={(loc: Location) => switchMutation.mutate(loc.id)}
        isLoading={switchMutation.isPending}
        loadingLocationId={switchMutation.variables}
      />
    </>
  )
}
