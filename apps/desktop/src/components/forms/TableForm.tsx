import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Form } from '@/components/ui/form'
import {
  TextInputField,
  TextareaField,
  NumberInputField,
  SelectField,
  tableStatusOptions
} from '@/components/forms/FormComponents'
import { createTableSchema, updateTableSchema, floorOptions, type CreateTableData, type UpdateTableData } from '@/lib/form-schemas'
import { toastHelpers } from '@/lib/toast-helpers'
import apiClient from '@/api/client'
import type { DiningTable, Location } from '@/types'
import { X } from 'lucide-react'

interface TableFormProps {
  table?: DiningTable // If provided, we're editing; otherwise creating
  onSuccess?: () => void
  onCancel?: () => void
  mode?: 'create' | 'edit'
  /** When true, hides the card wrapper/header so the parent dialog provides chrome */
  hideChrome?: boolean
}

export function TableForm({ table, onSuccess, onCancel, mode = 'create', hideChrome }: TableFormProps) {
  const queryClient = useQueryClient()
  const isEditing = mode === 'edit' && table

  // Fetch locations for the dropdown
  const { data: locationsData } = useQuery({
    queryKey: ['locations'],
    queryFn: () => apiClient.getLocations(),
  })
  const locations: Location[] = Array.isArray(locationsData)
    ? locationsData
    : Array.isArray((locationsData as any)?.data)
      ? (locationsData as any).data
      : []

  // Choose the appropriate schema and default values
  const schema = isEditing ? updateTableSchema : createTableSchema
  const defaultValues = isEditing
    ? {
        id: table.id,
        table_number: table.table_number,
        seating_capacity: table.seating_capacity || table.capacity || 4,
        status: table.status as any,
        floor: table.floor || 'Ground',
        location: table.location || '',
        location_id: (table as any).location_id || '',
      }
    : {
        table_number: '',
        seating_capacity: 4,
        status: 'available' as const,
        floor: 'Ground',
        location: '',
        location_id: locations.length === 1 ? locations[0].id : '',
      }

  const form = useForm<CreateTableData | UpdateTableData>({
    resolver: zodResolver(schema),
    defaultValues,
  })

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateTableData) => apiClient.createTable(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['admin-tables'] })
      queryClient.invalidateQueries({ queryKey: ['tables'] })
      queryClient.invalidateQueries({ queryKey: ['tables-summary'] })
      toastHelpers.tableCreated(form.getValues('table_number'))
      form.reset()
      onSuccess?.()
    },
    onError: (error) => {
      toastHelpers.apiError('Create table', error)
    },
  })

  // Update mutation  
  const updateMutation = useMutation({
    mutationFn: (data: UpdateTableData) => apiClient.updateTable(data.id.toString(), data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['admin-tables'] })
      queryClient.invalidateQueries({ queryKey: ['tables'] })
      queryClient.invalidateQueries({ queryKey: ['tables-summary'] })
      toastHelpers.apiSuccess('Update', `Table ${form.getValues('table_number')}`)
      onSuccess?.()
    },
    onError: (error) => {
      toastHelpers.apiError('Update table', error)
    },
  })

  const onSubmit = (data: CreateTableData | UpdateTableData) => {
    if (isEditing) {
      updateMutation.mutate(data as UpdateTableData)
    } else {
      createMutation.mutate(data as CreateTableData)
    }
  }

  const isLoading = createMutation.isPending || updateMutation.isPending

  const formFields = (
    <>
      {/* Location Assignment */}
      {locations.length > 0 && (
        <SelectField
          control={form.control}
          name="location_id"
          label="Location"
          placeholder="Select location"
          description="Which branch/outlet does this table belong to"
          options={locations.filter(l => l.is_active).map(l => ({ value: l.id, label: `${l.name} (${l.code})` }))}
        />
      )}

      {/* Table Identification */}
      <div className="space-y-4">
        <TextInputField
          control={form.control}
          name="table_number"
          label="Table Number"
          placeholder="Enter table number (e.g., T1, Table 5, A1)"
          description="Unique identifier for this table (unique per location)"
        />

        <TextareaField
          control={form.control}
          name="location"
          label="Location/Notes"
          placeholder="Describe table location (e.g., 'By the window', 'Near kitchen', 'Private section')"
          rows={2}
          description="Optional location description or special notes"
        />
      </div>

      {/* Table Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <NumberInputField
          control={form.control}
          name="seating_capacity"
          label="Number of Seats"
          min={1}
          max={20}
          description="Maximum seating capacity"
        />

        <SelectField
          control={form.control}
          name="floor"
          label="Floor"
          options={floorOptions.map(floor => ({ value: floor, label: floor }))}
          description="Floor where the table is located"
        />

        <SelectField
          control={form.control}
          name="status"
          label="Table Status"
          options={tableStatusOptions}
          description="Current operational status"
        />
      </div>

      {/* Status Information */}
      <div className="bg-zinc-800/50 border border-zinc-700/50 p-4 rounded-lg">
        <h4 className="font-medium mb-2 text-zinc-300 text-sm">Table Status Guide:</h4>
        <ul className="text-xs text-zinc-500 space-y-1">
          <li><span className="text-emerald-400 font-semibold">Available:</span> Table is ready for new guests</li>
          <li><span className="text-amber-400 font-semibold">Occupied:</span> Table currently has guests</li>
          <li><span className="text-sky-400 font-semibold">Reserved:</span> Table is reserved for future guests</li>
          <li><span className="text-red-400 font-semibold">Maintenance:</span> Table is out of service for cleaning/repair</li>
        </ul>
      </div>
    </>
  )

  if (hideChrome) {
    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="max-w-2xl mx-auto p-6 space-y-6">
              {formFields}
            </div>
          </div>
          <div className="flex-shrink-0 border-t border-zinc-800 bg-zinc-900 px-6 py-4">
            <div className="max-w-2xl mx-auto flex items-center justify-end gap-3">
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={isLoading}
                  className="px-4 py-2 rounded-md text-sm font-medium text-zinc-400 bg-zinc-800 hover:bg-zinc-700 ring-1 ring-zinc-700 transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex items-center justify-center gap-2 px-6 py-2 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isLoading
                  ? (isEditing ? 'Updating...' : 'Creating...')
                  : (isEditing ? 'Update Table' : 'Create Table')}
              </button>
            </div>
          </div>
        </form>
      </Form>
    )
  }

  return (
    <div className="w-full max-w-2xl mx-auto rounded-lg bg-zinc-900 border border-zinc-800">
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <h2 className="text-lg font-bold tracking-tight text-zinc-100">
          {isEditing ? 'Edit Table' : 'Create New Table'}
        </h2>
        {onCancel && (
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="p-2 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="px-6 py-5">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {formFields}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 py-3 rounded-md bg-emerald-500 text-white text-sm font-bold tracking-wide hover:bg-emerald-400 active:bg-emerald-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isLoading
                  ? (isEditing ? 'Updating...' : 'Creating...')
                  : (isEditing ? 'Update Table' : 'Create Table')}
              </button>

              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={isLoading}
                  className="flex-1 py-3 rounded-md bg-zinc-800 text-zinc-300 text-sm font-medium hover:bg-zinc-700 hover:text-zinc-100 transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </Form>
      </div>
    </div>
  )
}
