import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toastHelpers } from '@/lib/toast-helpers'
import apiClient from '@/api/client'
import type { VariationGroup, CreateVariationGroupRequest, CreateVariationItemRequest } from '@/types'
import { Plus, X, Check } from 'lucide-react'

interface VariationGroupFormProps {
  variationGroup?: VariationGroup
  onSuccess?: () => void
  onCancel?: () => void
  mode?: 'create' | 'edit'
}

const defaultItem: CreateVariationItemRequest = {
  name: '',
  price_adjustment: 0,
  is_default: false,
  sort_order: 0,
}

export function VariationGroupForm({ variationGroup, onSuccess, onCancel, mode = 'create' }: VariationGroupFormProps) {
  const queryClient = useQueryClient()
  const isEditing = mode === 'edit' && variationGroup

  const [name, setName] = useState(variationGroup?.name || '')
  const [selectionType, setSelectionType] = useState<'single' | 'multiple'>(variationGroup?.selection_type || 'single')
  const [isRequired, setIsRequired] = useState(variationGroup?.is_required || false)
  const [maxSelections, setMaxSelections] = useState(variationGroup?.max_selections || 0)
  const [items, setItems] = useState<CreateVariationItemRequest[]>(
    isEditing && variationGroup?.items?.length
      ? variationGroup.items.map((item, i) => ({
          name: item.name,
          price_adjustment: item.price_adjustment,
          is_default: item.is_default,
          sort_order: i + 1,
        }))
      : [{ ...defaultItem, sort_order: 1 }]
  )

  // Track existing item IDs for edit mode (to know which are new vs existing)
  const existingItemIds = isEditing ? variationGroup.items.map(i => i.id) : []

  const createMutation = useMutation({
    mutationFn: (data: CreateVariationGroupRequest) => apiClient.createVariationGroup(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-variations'] })
      toastHelpers.success('Variation created')
      onSuccess?.()
    },
    onError: (err) => toastHelpers.apiError('Create variation', err),
  })

  const updateMutation = useMutation({
    mutationFn: (data: Partial<CreateVariationGroupRequest>) =>
      apiClient.updateVariationGroup(variationGroup!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-variations'] })
      toastHelpers.success('Variation updated')
      onSuccess?.()
    },
    onError: (err) => toastHelpers.apiError('Update variation', err),
  })

  const addItemMutation = useMutation({
    mutationFn: (data: { groupId: string; item: CreateVariationItemRequest }) =>
      apiClient.createVariationItem(data.groupId, data.item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-variations'] })
    },
    onError: (err) => toastHelpers.apiError('Add option', err),
  })

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) => apiClient.deleteVariationItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-variations'] })
    },
    onError: (err) => toastHelpers.apiError('Delete option', err),
  })

  const updateItem = (index: number, field: string, value: unknown) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  const addItem = () => {
    setItems([...items, { ...defaultItem, sort_order: items.length + 1 }])
  }

  const removeItem = (index: number) => {
    if (items.length <= 1) return

    // If editing and this is an existing item, delete it from API
    if (isEditing && index < existingItemIds.length) {
      deleteItemMutation.mutate(existingItemIds[index])
    }

    setItems(items.filter((_, i) => i !== index))
  }

  const handleSubmit = () => {
    if (!name.trim()) return
    const validItems = items.filter(i => i.name.trim())
    if (validItems.length === 0) return

    const groupData: CreateVariationGroupRequest = {
      name: name.trim(),
      selection_type: selectionType,
      is_required: isRequired,
      min_selections: 0,
      max_selections: maxSelections,
      sort_order: 0,
      items: validItems.map((item, i) => ({ ...item, sort_order: i + 1 })),
    }

    if (isEditing) {
      // Update group metadata
      updateMutation.mutate({
        name: groupData.name,
        selection_type: groupData.selection_type,
        is_required: groupData.is_required,
        max_selections: groupData.max_selections,
      })

      // Add new items (items beyond the existing count)
      const newItems = validItems.slice(existingItemIds.length)
      for (const item of newItems) {
        addItemMutation.mutate({ groupId: variationGroup!.id, item })
      }
    } else {
      createMutation.mutate(groupData)
    }
  }

  const isLoading = createMutation.isPending || updateMutation.isPending
  const isValid = name.trim() && items.some(i => i.name.trim())

  return (
    <div className="w-full max-w-2xl mx-auto rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 bg-zinc-900">
        <h3 className="text-base font-semibold text-zinc-200">
          {isEditing ? 'Edit Variation' : 'Create New Variation'}
        </h3>
        {onCancel && (
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="p-5 space-y-5">
        {/* Group name */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-zinc-300">Variation Name</label>
          <input
            autoFocus
            className="w-full h-9 text-sm rounded-md bg-zinc-800 border border-zinc-700 px-3 text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600"
            placeholder='e.g. Size, Crust Type, Toppings'
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>

        {/* Settings row */}
        <div className="flex items-center gap-4">
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-400">Selection Type</label>
            <Select value={selectionType} onValueChange={val => setSelectionType(val as 'single' | 'multiple')}>
              <SelectTrigger className="h-8 text-xs w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Pick one</SelectItem>
                <SelectItem value="multiple">Pick many</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 pt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={isRequired}
                onCheckedChange={(checked) => setIsRequired(checked === true)}
              />
              <span className="text-xs text-zinc-400">Required</span>
            </label>
          </div>

          {selectionType === 'multiple' && (
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400">Max Selections</label>
              <input
                type="number"
                className="h-8 w-20 text-xs rounded-md bg-zinc-800 border border-zinc-700 px-2 text-zinc-200 focus:outline-none focus:border-zinc-600"
                value={maxSelections}
                onChange={e => setMaxSelections(parseInt(e.target.value) || 0)}
                min={0}
                placeholder="0 = unlimited"
              />
            </div>
          )}
        </div>

        {/* Options */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-300">Options</label>
          <p className="text-xs text-zinc-500">Define the choices available in this variation group</p>

          <div className="space-y-2 pt-1">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className="h-8 text-sm flex-1 rounded-md bg-zinc-800 border border-zinc-700 px-3 text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600"
                  placeholder="Option name"
                  value={item.name}
                  onChange={e => updateItem(i, 'name', e.target.value)}
                />
                <button
                  type="button"
                  className="p-1 rounded text-zinc-600 hover:text-red-400 transition-colors disabled:opacity-30"
                  onClick={() => removeItem(i)}
                  disabled={items.length <= 1}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            <button
              type="button"
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              onClick={addItem}
            >
              <Plus className="h-3 w-3" />
              Add option
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-3 border-t border-zinc-800">
          <button
            type="button"
            className="flex-1 h-9 rounded-md text-sm font-medium bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
            onClick={handleSubmit}
            disabled={isLoading || !isValid}
          >
            <Check className="h-4 w-4" />
            {isLoading
              ? (isEditing ? 'Updating...' : 'Creating...')
              : (isEditing ? 'Update Variation' : 'Create Variation')}
          </button>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1 px-4 py-2 rounded-md text-sm font-medium text-zinc-400 bg-zinc-800 hover:bg-zinc-700 ring-1 ring-zinc-700 transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
