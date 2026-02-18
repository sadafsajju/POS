import { Control, FieldPath, FieldValues } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import apiClient from '@/api/client'
import type { Location } from '@/types'

interface LocationMultiSelectFieldProps<T extends FieldValues> {
  control: Control<T>
  name: FieldPath<T>
  label: string
  description?: string
}

export function LocationMultiSelectField<T extends FieldValues>({
  control,
  name,
  label,
  description,
}: LocationMultiSelectFieldProps<T>) {
  const { data: locations = [] } = useQuery({
    queryKey: ['admin-locations'],
    queryFn: async () => {
      const res = await apiClient.getLocations()
      if (res && Array.isArray((res as any).data)) {
        return ((res as any).data as Location[]).filter(l => l.is_active)
      }
      return [] as Location[]
    },
  })

  // Don't render if only one location exists
  if (locations.length <= 1) return null

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const selected: string[] = Array.isArray(field.value) ? field.value : []
        const isAllLocations = selected.length === 0

        const toggle = (locationId: string) => {
          const next = selected.includes(locationId)
            ? selected.filter(id => id !== locationId)
            : [...selected, locationId]
          field.onChange(next.length === 0 ? undefined : next)
        }

        const selectAll = () => field.onChange(undefined)

        return (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <FormControl>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className={`
                    w-full px-3 py-1.5 rounded-lg border-2 text-sm transition-all text-left
                    ${isAllLocations
                      ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300 font-medium'
                      : 'border-zinc-700 hover:border-zinc-500 text-zinc-400'
                    }
                  `}
                >
                  All Locations
                </button>
                <div className="flex flex-wrap gap-2">
                  {locations.map((location) => {
                    const isSelected = selected.includes(location.id)
                    return (
                      <button
                        key={location.id}
                        type="button"
                        onClick={() => toggle(location.id)}
                        className={`
                          px-3 py-1.5 rounded-lg border-2 text-sm transition-all
                          ${isSelected
                            ? 'border-blue-500/60 bg-blue-500/10 text-blue-300 font-medium'
                            : 'border-zinc-700 hover:border-zinc-500 text-zinc-400'
                          }
                        `}
                      >
                        {location.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            </FormControl>
            {description && <FormDescription>{description}</FormDescription>}
            <FormMessage />
          </FormItem>
        )
      }}
    />
  )
}
