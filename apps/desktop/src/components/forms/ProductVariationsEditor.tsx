import { useState, useEffect, useCallback, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toastHelpers } from '@/lib/toast-helpers'
import apiClient from '@/api/client'
import type { VariationGroup, ProductVariationLinkResponse } from '@/types'
import { Plus, X, GripVertical, ChevronDown, Pencil, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

// Simple variation row: name + price
export interface DraftVariation {
  name: string
  price: string
}

// What the parent (ProductForm) stores in state
export interface DraftVariationData {
  title: string
  selectedGroupId?: string
  items: DraftVariation[]
}

interface ProductVariationsEditorProps {
  productId?: string
  draft?: DraftVariationData
  onDraftChange?: (data: DraftVariationData) => void
  onHasVariations?: (hasVariations: boolean) => void
}

const emptyRow = (): DraftVariation => ({ name: '', price: '' })

export function ProductVariationsEditor({
  productId,
  draft,
  onDraftChange,
  onHasVariations,
}: ProductVariationsEditorProps) {
  const queryClient = useQueryClient()
  const isDraftMode = !productId

  // The "committed" data (what's been confirmed via the dialog)
  const [committedData, setCommittedData] = useState<DraftVariationData | null>(
    draft?.items?.some((i) => i.name.trim()) ? draft : null
  )

  // Dialog open state
  const [dialogOpen, setDialogOpen] = useState(false)

  // Editor state inside the dialog
  const [title, setTitle] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState<string | undefined>()
  const [items, setItems] = useState<DraftVariation[]>([emptyRow()])

  // Dropdown state
  const [showDropdown, setShowDropdown] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Fetch all variation groups for autocomplete
  const { data: variationGroups = [] } = useQuery({
    queryKey: ['admin-variations'],
    queryFn: async () => {
      const res = await apiClient.getVariationGroups({ per_page: 100 })
      return Array.isArray(res.data) ? (res.data as VariationGroup[]) : []
    },
  })

  // Filter groups based on search query
  const filteredGroups = variationGroups.filter((g) =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Fetch existing links when editing a product
  const { data: existingLinks = [], isLoading } = useQuery({
    queryKey: ['product-variation-links', productId],
    queryFn: async () => {
      const res = await apiClient.getProductVariationLinks(productId!)
      return Array.isArray(res.data) ? res.data : []
    },
    enabled: !!productId,
  })

  // Populate committedData from API when editing
  useEffect(() => {
    if (!isDraftMode && existingLinks.length > 0) {
      const link = existingLinks[0] as ProductVariationLinkResponse
      setCommittedData({
        title: link.group_name || '',
        selectedGroupId: link.variation_group_id,
        items: link.items.map((item) => ({
          name: item.item_name,
          price: item.price > 0 ? item.price.toString() : '',
        })),
      })
    }
  }, [isDraftMode, existingLinks])

  // Count filled variations from committed data
  const filledCount = committedData?.items.filter((i) => i.name.trim()).length || 0

  // Notify parent about whether variations exist
  const notifyParent = useCallback(
    (count: number) => {
      onHasVariations?.(count > 0)
    },
    [onHasVariations]
  )

  useEffect(() => {
    notifyParent(filledCount)
  }, [filledCount, notifyParent])

  // Push committed data to parent in draft mode
  useEffect(() => {
    if (isDraftMode && onDraftChange) {
      onDraftChange(committedData || { title: '', items: [] })
    }
  }, [committedData, isDraftMode, onDraftChange])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Open dialog and populate editor state
  const openDialog = (editExisting?: boolean) => {
    if (editExisting && committedData) {
      setTitle(committedData.title)
      setSelectedGroupId(committedData.selectedGroupId)
      setItems(committedData.items.length > 0 ? [...committedData.items] : [emptyRow()])
    } else {
      setTitle('')
      setSelectedGroupId(undefined)
      setItems([emptyRow()])
    }
    setSearchQuery('')
    setShowDropdown(false)
    setDialogOpen(true)
  }

  // Confirm dialog: commit the editor state
  const confirmDialog = () => {
    const validItems = items.filter((i) => i.name.trim())
    if (validItems.length > 0) {
      // If items were modified from the original group, clear the link
      const effectiveGroupId =
        selectedGroupId && itemsMatchGroup(selectedGroupId, items) ? selectedGroupId : undefined
      setCommittedData({ title, selectedGroupId: effectiveGroupId, items })
      setDialogOpen(false)

      // In edit mode, also trigger the save
      if (!isDraftMode) {
        saveMutation.mutate({ title, selectedGroupId: effectiveGroupId, items })
      }
    } else {
      setDialogOpen(false)
    }
  }

  // Remove all variations
  const removeVariations = () => {
    setCommittedData(null)
    if (!isDraftMode) {
      saveMutation.mutate({ title: '', items: [] })
    }
  }

  // Select a variation group from the dropdown
  const selectGroup = (group: VariationGroup) => {
    setTitle(group.name)
    setSelectedGroupId(group.id)
    setSearchQuery('')
    setShowDropdown(false)

    const groupItems: DraftVariation[] = (group.items || []).map((item) => ({
      name: item.name,
      price: '',
    }))
    setItems(groupItems.length > 0 ? groupItems : [emptyRow()])
  }

  // Check if items still match the original group (same count + same names in order)
  const itemsMatchGroup = (groupId: string, currentItems: DraftVariation[]): boolean => {
    const group = variationGroups.find((g) => g.id === groupId)
    if (!group) return false
    const validItems = currentItems.filter((i) => i.name.trim())
    if (validItems.length !== group.items.length) return false
    return validItems.every((item, i) => item.name.trim() === group.items[i]?.name)
  }

  // Save mutation for edit mode
  const saveMutation = useMutation({
    mutationFn: async (data: { title: string; selectedGroupId?: string; items: DraftVariation[] }) => {
      if (!productId) return
      const validItems = data.items.filter((i) => i.name.trim())
      if (validItems.length === 0) {
        await apiClient.linkVariationsToProduct(productId, [])
        return
      }

      // If an existing group was selected and items haven't been changed, link directly
      if (data.selectedGroupId && itemsMatchGroup(data.selectedGroupId, data.items)) {
        const group = variationGroups.find((g) => g.id === data.selectedGroupId)!
        await apiClient.linkVariationsToProduct(productId, [
          {
            variation_group_id: group.id,
            sort_order: 1,
            item_prices: group.items.map((vi, i) => ({
              variation_item_id: vi.id,
              price: parseFloat(validItems[i]?.price || '0') || 0,
            })),
          },
        ])
        return
      }

      // Otherwise create a new group (items were modified or no group selected)
      const groupRes = await apiClient.createVariationGroup({
        name: data.title.trim() || 'Variations',
        selection_type: 'single',
        is_required: true,
        min_selections: 0,
        max_selections: 0,
        sort_order: 0,
        items: validItems.map((item, i) => ({
          name: item.name.trim(),
          is_default: i === 0,
          sort_order: i + 1,
        })),
      })

      if (!groupRes.data) throw new Error('Failed to create variation group')
      const group = groupRes.data

      await apiClient.linkVariationsToProduct(productId, [
        {
          variation_group_id: group.id,
          sort_order: 1,
          item_prices: (group.items || []).map((vi: { id: string }, i: number) => ({
            variation_item_id: vi.id,
            price: parseFloat(validItems[i]?.price || '0') || 0,
          })),
        },
      ])
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-variation-links', productId] })
      queryClient.invalidateQueries({ queryKey: ['admin-variations'] })
      toastHelpers.success('Variations saved')
    },
    onError: (err) => toastHelpers.apiError('Save variations', err),
  })

  const updateItem = (index: number, field: 'name' | 'price', value: string) => {
    setItems((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const removeItem = (index: number) => {
    if (items.length <= 1) return
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const addItem = () => {
    setItems((prev) => [...prev, emptyRow()])
  }

  const editorFilledCount = items.filter((i) => i.name.trim()).length

  if (!isDraftMode && isLoading) {
    return <div className="text-sm text-zinc-500 py-4">Loading variations...</div>
  }

  return (
    <>
      {/* Default view: description + Add button, or summary of existing variations */}
      {!committedData ? (
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-zinc-200">Variations</p>
            <p className="text-xs text-zinc-500">
              Set prices and availability by variations such as sizes or colours.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openDialog()}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-zinc-700 transition-colors"
          >
            Add
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-zinc-200">
                {committedData.title || 'Variations'}
              </p>
              <p className="text-xs text-zinc-500">
                {filledCount} variation{filledCount !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => openDialog(true)}
                className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={removeVariations}
                className="p-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Summary of items */}
          <div className="rounded-lg border border-zinc-800 overflow-hidden">
            {committedData.items
              .filter((i) => i.name.trim())
              .map((item, idx) => (
                <div
                  key={idx}
                  className={`flex items-center justify-between px-4 py-2.5 text-sm ${
                    idx > 0 ? 'border-t border-zinc-800' : ''
                  }`}
                >
                  <span className="text-zinc-300">{item.name}</span>
                  <span className="text-zinc-400 tabular-nums">
                    {item.price ? `$${parseFloat(item.price).toFixed(2)}` : '-'}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Dialog with the full editor */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg bg-zinc-900 border-zinc-700">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">
              {committedData ? 'Edit Variations' : 'Add Variations'}
            </DialogTitle>
            <DialogDescription className="text-zinc-500">
              Select an existing variation group or create new ones.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Title input with autocomplete */}
            <div className="relative" ref={dropdownRef}>
              <div className="relative">
                <input
                  ref={inputRef}
                  className="w-full h-11 text-sm rounded-lg bg-zinc-800 border border-zinc-700 px-4 pr-10 text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500"
                  placeholder="Set title or select existing variation..."
                  value={showDropdown ? searchQuery : title}
                  onChange={(e) => {
                    const val = e.target.value
                    setSearchQuery(val)
                    setTitle(val)
                    setSelectedGroupId(undefined)
                    if (!showDropdown) setShowDropdown(true)
                  }}
                  onFocus={() => {
                    setSearchQuery(title)
                    setShowDropdown(true)
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery(title)
                    setShowDropdown(!showDropdown)
                    inputRef.current?.focus()
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
                  />
                </button>
              </div>

              {showDropdown && (
                <div className="absolute z-50 mt-1 w-full rounded-lg bg-zinc-800 border border-zinc-700 shadow-xl max-h-48 overflow-auto">
                  {filteredGroups.length > 0 ? (
                    filteredGroups.map((group) => (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => selectGroup(group)}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-700 transition-colors ${
                          selectedGroupId === group.id
                            ? 'bg-zinc-700/50 text-emerald-400'
                            : 'text-zinc-200'
                        }`}
                      >
                        <div className="font-medium">{group.name}</div>
                        <div className="text-xs text-zinc-500 mt-0.5">
                          {group.items?.length || 0} items:{' '}
                          {group.items?.map((i) => i.name).join(', ')}
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-sm text-zinc-500">
                      {variationGroups.length === 0
                        ? 'No variation groups created yet'
                        : 'No matching groups found'}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Column headers */}
            <div className="flex items-center gap-3 px-1">
              <div className="w-6" />
              <span className="flex-1 text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                Variation
              </span>
              <span className="w-28 text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                Price
              </span>
              <div className="w-6" />
            </div>

            <div className="border-t border-zinc-700/50" />

            {/* Variation rows */}
            <div className="space-y-2 max-h-64 overflow-auto">
              {items.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="w-6 flex justify-center">
                    <GripVertical className="h-4 w-4 text-zinc-600" />
                  </div>

                  <input
                    className="flex-1 h-10 text-sm rounded-lg bg-zinc-800 border border-zinc-700 px-3 text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500"
                    placeholder="Variation name"
                    value={item.name}
                    onChange={(e) => updateItem(index, 'name', e.target.value)}
                  />

                  <div className="relative w-28">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
                      $
                    </span>
                    <input
                      type="number"
                      className="w-full h-10 text-sm rounded-lg bg-zinc-800 border border-zinc-700 pl-7 pr-3 text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 tabular-nums"
                      placeholder="0.00"
                      value={item.price}
                      onChange={(e) => updateItem(index, 'price', e.target.value)}
                      step="0.01"
                      min="0"
                    />
                  </div>

                  <div className="w-6 flex justify-center">
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      disabled={items.length <= 1}
                      className="p-0.5 rounded text-zinc-600 hover:text-red-400 transition-colors disabled:opacity-20"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-2 w-full"
              >
                <div className="w-6 flex justify-center">
                  <Plus className="h-4 w-4 text-zinc-600" />
                </div>
                <span className="flex-1 h-10 flex items-center text-sm text-zinc-500 hover:text-zinc-300 transition-colors px-3 rounded-lg border border-dashed border-zinc-700 hover:border-zinc-500">
                  Add a variation
                </span>
                <div className="w-28" />
                <div className="w-6" />
              </button>
            </div>

            {/* Dialog footer */}
            <div className="flex justify-end gap-3 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDialog}
                disabled={editorFilledCount === 0 || saveMutation.isPending}
                className="px-5 py-2 text-sm font-medium rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors disabled:opacity-40"
              >
                {saveMutation.isPending ? 'Saving...' : 'Done'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
