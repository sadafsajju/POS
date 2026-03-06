import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { toastHelpers } from '@/lib/toast-helpers'
import apiClient from '@/api/client'
import type { ComboSlot, Product } from '@/types'
import { X, Search, Plus, GripVertical, Check, ChevronRight, ImageIcon } from 'lucide-react'
import type { ProductVariationLinkResponse } from '@/types'
import { imageUrl } from '@/lib/utils'

/** Draft combo slot stored locally before product is saved */
export interface DraftComboSlot {
  name: string
  is_required: boolean
  sort_order: number
  choices: DraftComboSlotChoice[]
}

export interface DraftComboSlotChoice {
  product_id: string
  variation_item_id?: string
  product_name: string
  product_price: number
  price_override?: number | null
  sort_order: number
}

interface ComboSlotsEditorProps {
  productId?: string
  draftSlots?: DraftComboSlot[]
  onDraftSlotsChange?: (slots: DraftComboSlot[]) => void
}

interface PickerSelection {
  product_id: string
  variation_item_id?: string
  product_name: string
  product_price: number
}

/** Dialog state: which slot is picking products */
interface PickerState {
  slotKey: string
  slotName: string
  existingIds: Set<string>
  onAdd: (selections: PickerSelection[]) => void
}

export function ComboSlotsEditor({ productId, draftSlots, onDraftSlotsChange }: ComboSlotsEditorProps) {
  const queryClient = useQueryClient()
  const [picker, setPicker] = useState<PickerState | null>(null)
  const [pickerSearch, setPickerSearch] = useState('')
  // key = product_id or "product_id::variation_item_id"
  const [pickerSelected, setPickerSelected] = useState<Map<string, { product_id: string; variation_item_id?: string; product_name: string; product_price: number }>>(new Map())
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())
  const [variationCache, setVariationCache] = useState<Record<string, ProductVariationLinkResponse[]>>({})
  const [addingSlot, setAddingSlot] = useState(false)
  const [newSlotName, setNewSlotName] = useState('')
  const [newSlotRequired, setNewSlotRequired] = useState(true)

  const isDraftMode = !productId

  // Fetch existing combo slots (only in API mode)
  const { data: slotsResponse, isLoading } = useQuery({
    queryKey: ['comboSlots', productId],
    queryFn: () => apiClient.getComboSlots(productId!),
    enabled: !!productId,
  })

  // Fetch all products for the picker (exclude combos)
  const { data: productsResponse } = useQuery({
    queryKey: ['products'],
    queryFn: () => apiClient.getProducts(),
  })

  const apiSlots: ComboSlot[] = Array.isArray(slotsResponse?.data) ? slotsResponse.data : []
  const allProducts: Product[] = Array.isArray(productsResponse?.data)
    ? (productsResponse.data as Product[]).filter(p => p.product_type !== 'combo' && p.id !== productId)
    : []

  // --- API mode mutations ---
  const createSlotMutation = useMutation({
    mutationFn: () => apiClient.createComboSlot(productId!, {
      name: newSlotName,
      is_required: newSlotRequired,
      sort_order: apiSlots.length,
      choices: [],
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comboSlots', productId] })
      setNewSlotName('')
      setNewSlotRequired(true)
      setAddingSlot(false)
      toastHelpers.success('Combo slot created')
    },
    onError: () => toastHelpers.error('Failed to create combo slot'),
  })

  const deleteSlotMutation = useMutation({
    mutationFn: (slotId: string) => apiClient.deleteComboSlot(productId!, slotId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comboSlots', productId] })
      toastHelpers.success('Combo slot deleted')
    },
    onError: () => toastHelpers.error('Failed to delete combo slot'),
  })

  const addChoiceMutation = useMutation({
    mutationFn: ({ slotId, choiceProductId, variationItemId }: { slotId: string; choiceProductId: string; variationItemId?: string }) =>
      apiClient.createComboSlotChoice(slotId, {
        product_id: choiceProductId,
        variation_item_id: variationItemId,
        price_override: null,
        sort_order: 0,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comboSlots', productId] })
      toastHelpers.success('Choice added')
    },
    onError: () => toastHelpers.error('Failed to add choice'),
  })

  const deleteChoiceMutation = useMutation({
    mutationFn: (choiceId: string) => apiClient.deleteComboSlotChoice(choiceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comboSlots', productId] })
      toastHelpers.success('Choice removed')
    },
    onError: () => toastHelpers.error('Failed to remove choice'),
  })

  // --- Handlers ---
  const handleAddSlot = () => {
    if (!newSlotName.trim()) return
    if (isDraftMode && onDraftSlotsChange && draftSlots) {
      onDraftSlotsChange([...draftSlots, {
        name: newSlotName.trim(),
        is_required: newSlotRequired,
        sort_order: draftSlots.length,
        choices: [],
      }])
      setNewSlotName('')
      setNewSlotRequired(true)
      setAddingSlot(false)
    } else {
      createSlotMutation.mutate()
    }
  }

  const handleDeleteDraftSlot = (index: number) => {
    if (onDraftSlotsChange && draftSlots) {
      onDraftSlotsChange(draftSlots.filter((_, i) => i !== index))
    }
  }

  const handleAddDraftChoices = (slotIndex: number, selections: PickerSelection[]) => {
    if (!onDraftSlotsChange || !draftSlots || selections.length === 0) return
    const updated = [...draftSlots]
    const existing = updated[slotIndex].choices
    const newChoices = selections.map((sel, i) => ({
      product_id: sel.product_id,
      variation_item_id: sel.variation_item_id,
      product_name: sel.product_name,
      product_price: sel.product_price,
      price_override: null as number | null,
      sort_order: existing.length + i,
    }))
    updated[slotIndex] = {
      ...updated[slotIndex],
      choices: [...existing, ...newChoices],
    }
    onDraftSlotsChange(updated)
  }

  const handleDeleteDraftChoice = (slotIndex: number, choiceIndex: number) => {
    if (!onDraftSlotsChange || !draftSlots) return
    const updated = [...draftSlots]
    updated[slotIndex] = {
      ...updated[slotIndex],
      choices: updated[slotIndex].choices.filter((_, i) => i !== choiceIndex),
    }
    onDraftSlotsChange(updated)
  }

  const handleApiAddChoices = (slotId: string, selections: PickerSelection[]) => {
    for (const sel of selections) {
      addChoiceMutation.mutate({ slotId, choiceProductId: sel.product_id, variationItemId: sel.variation_item_id })
    }
  }

  const toggleDraftRequired = (index: number) => {
    if (!onDraftSlotsChange || !draftSlots) return
    const updated = [...draftSlots]
    updated[index] = { ...updated[index], is_required: !updated[index].is_required }
    onDraftSlotsChange(updated)
  }

  const openPicker = (slotKey: string, slotName: string, existingIds: Set<string>, onAdd: (selections: PickerSelection[]) => void) => {
    setPicker({ slotKey, slotName, existingIds, onAdd })
    setPickerSearch('')
    setPickerSelected(new Map())
    setExpandedProducts(new Set())
  }

  const togglePickerItem = (key: string, info: { product_id: string; variation_item_id?: string; product_name: string; product_price: number }) => {
    setPickerSelected(prev => {
      const next = new Map(prev)
      if (next.has(key)) next.delete(key)
      else next.set(key, info)
      return next
    })
  }

  const toggleExpandProduct = async (product: Product) => {
    setExpandedProducts(prev => {
      const next = new Set(prev)
      if (next.has(product.id)) next.delete(product.id)
      else next.add(product.id)
      return next
    })
    // Fetch variations if not cached
    if (!variationCache[product.id]) {
      try {
        const resp = await apiClient.getProductVariationLinks(product.id)
        if (Array.isArray(resp.data)) {
          setVariationCache(prev => ({ ...prev, [product.id]: resp.data! }))
        }
      } catch { /* ignore */ }
    }
  }

  const handleConfirmPicker = () => {
    if (!picker) return
    const selections: PickerSelection[] = Array.from(pickerSelected.values())
    picker.onAdd(selections)
    setPicker(null)
    setPickerSelected(new Map())
  }

  const pickerProducts = picker
    ? allProducts.filter(p =>
        !picker.existingIds.has(p.id) &&
        (!pickerSearch || p.name.toLowerCase().includes(pickerSearch.toLowerCase()))
      )
    : []

  if (!isDraftMode && isLoading) {
    return <div className="text-sm text-zinc-500 py-4">Loading combo slots...</div>
  }

  // Unified slot list
  type SlotRow = {
    key: string
    name: string
    isRequired: boolean
    choices: { id?: string; name: string; price: number; priceOverride?: number | null }[]
    existingIds: Set<string>
    onDelete: () => void
    onAddChoices: (selections: PickerSelection[]) => void
    onDeleteChoice: (idx: number, choiceId?: string) => void
    onToggleRequired: () => void
  }

  const slots: SlotRow[] = isDraftMode
    ? (draftSlots || []).map((slot, index) => ({
        key: `draft-${index}`,
        name: slot.name,
        isRequired: slot.is_required,
        choices: slot.choices.map(c => ({ name: c.product_name, price: c.product_price, priceOverride: c.price_override })),
        existingIds: new Set(slot.choices.map(c => c.product_id)),
        onDelete: () => handleDeleteDraftSlot(index),
        onAddChoices: (selections: PickerSelection[]) => handleAddDraftChoices(index, selections),
        onDeleteChoice: (choiceIdx: number) => handleDeleteDraftChoice(index, choiceIdx),
        onToggleRequired: () => toggleDraftRequired(index),
      }))
    : apiSlots.map(slot => ({
        key: slot.id,
        name: slot.name,
        isRequired: slot.is_required,
        choices: (slot.choices || []).map(c => ({ id: c.id, name: c.product?.name || 'Unknown', price: c.product?.price || 0, priceOverride: c.price_override })),
        existingIds: new Set((slot.choices || []).map(c => c.product_id)),
        onDelete: () => deleteSlotMutation.mutate(slot.id),
        onAddChoices: (selections: PickerSelection[]) => handleApiAddChoices(slot.id, selections),
        onDeleteChoice: (_idx: number, choiceId?: string) => { if (choiceId) deleteChoiceMutation.mutate(choiceId) },
        onToggleRequired: () => {}, // API toggle not implemented yet
      }))

  return (
    <>
      <div className="space-y-5">
        {/* Header */}
        <div>
          <h3 className="text-sm font-semibold text-zinc-200">Build this combo</h3>
          <p className="text-xs text-zinc-500 mt-0.5">Add item options so your customers can customize this combo.</p>
        </div>

        {/* Table */}
        <div>
          {/* Column headers */}
          <div className="flex items-center px-3 pb-2 border-b border-zinc-700">
            <span className="flex-1 text-xs font-medium text-zinc-400">Combo choice</span>
            <span className="w-8" />
          </div>

          {/* Slot rows */}
          {slots.map((slot) => (
            <div key={slot.key} className="border-b border-zinc-800 last:border-b-0">
              {/* Slot row */}
              <div className="flex items-center px-3 py-3 group">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <GripVertical className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                  <span className="text-sm text-zinc-200 font-medium truncate">{slot.name}</span>
                  <span className="text-xs text-zinc-500">
                    {slot.choices.length > 0 ? `${slot.choices.length} item${slot.choices.length > 1 ? 's' : ''}` : 'No items'}
                  </span>
                </div>
                <div className="w-8 flex justify-end">
                  <button
                    type="button"
                    onClick={slot.onDelete}
                    className="p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Choices under the slot */}
              <div className="pl-9 pr-3 pb-3 space-y-1.5">
                {slot.choices.map((choice, idx) => (
                  <div
                    key={choice.id || idx}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 group/item"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <GripVertical className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                      <span className="text-sm text-zinc-200 truncate">{choice.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {choice.priceOverride != null && (
                        <span className="text-xs text-amber-400 font-medium">+${choice.priceOverride.toFixed(2)}</span>
                      )}
                      <span className="text-xs text-zinc-500">${choice.price.toFixed(2)}</span>
                      <button
                        type="button"
                        onClick={() => slot.onDeleteChoice(idx, choice.id)}
                        className="p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover/item:opacity-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => openPicker(slot.key, slot.name, slot.existingIds, slot.onAddChoices)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {slot.choices.length > 0 ? 'Add item' : 'Add items to this choice'}
                </button>
              </div>
            </div>
          ))}

          {/* Add options row */}
          {!addingSlot ? (
            <div className="px-3 py-3">
              <button
                type="button"
                onClick={() => setAddingSlot(true)}
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add options
              </button>
            </div>
          ) : (
            <div className="px-3 py-3 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  placeholder="Choice name (e.g. Main, Side, Drink)"
                  value={newSlotName}
                  onChange={(e) => setNewSlotName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); handleAddSlot() }
                    if (e.key === 'Escape') { setAddingSlot(false); setNewSlotName('') }
                  }}
                  className="h-8 text-sm flex-1 rounded-md bg-zinc-800 border border-zinc-700 px-3 text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddSlot}
                  disabled={!newSlotName.trim() || (!isDraftMode && createSlotMutation.isPending)}
                  className="px-3 h-7 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => { setAddingSlot(false); setNewSlotName('') }}
                  className="px-3 h-7 rounded-md text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Product picker dialog */}
      <Dialog open={!!picker} onOpenChange={(open) => { if (!open) { setPicker(null); setPickerSelected(new Map()) } }}>
        <DialogContent className="max-w-md bg-zinc-900 border-zinc-800 flex flex-col max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Add products to "{picker?.slotName}"</DialogTitle>
            <DialogDescription className="text-zinc-500">
              Select products to include in this combo slot.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 min-h-0 flex-1">
            {/* Search */}
            <div className="relative shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                autoFocus
                placeholder="Search products..."
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                className="w-full h-9 text-sm rounded-md bg-zinc-800 border border-zinc-700 pl-9 pr-3 text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600"
              />
            </div>

            {/* Product list */}
            <div className="overflow-y-auto min-h-0 flex-1 space-y-0.5">
              {pickerProducts.length > 0 ? (
                pickerProducts.map(product => {
                  const hasVariations = product.has_option_groups
                  const isExpanded = expandedProducts.has(product.id)
                  const variations = variationCache[product.id] || []
                  const variationItems = variations.flatMap(g => g.items)
                  const isProductChecked = pickerSelected.has(product.id)

                  return (
                    <div key={product.id}>
                      {/* Product row */}
                      <div className={`
                        flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors
                        ${isProductChecked ? 'bg-primary/10 border border-primary/30' : 'hover:bg-zinc-800 border border-transparent'}
                      `}>
                        {/* Expand toggle for products with variations */}
                        {hasVariations ? (
                          <button
                            type="button"
                            onClick={() => toggleExpandProduct(product)}
                            className="shrink-0 p-0.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                          >
                            <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                          </button>
                        ) : (
                          <span className="w-5" />
                        )}

                        {/* Checkbox (only for products WITHOUT variations) */}
                        {!hasVariations ? (
                          <button
                            type="button"
                            onClick={() => togglePickerItem(product.id, { product_id: product.id, product_name: product.name, product_price: product.price })}
                            className="shrink-0"
                          >
                            <div className={`
                              w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
                              ${isProductChecked ? 'bg-primary border-primary' : 'border-zinc-600 hover:border-zinc-400'}
                            `}>
                              {isProductChecked && <Check className="w-3 h-3 text-primary-foreground" />}
                            </div>
                          </button>
                        ) : (
                          <span className="w-5" />
                        )}

                        {/* Product image */}
                        {product.image_url ? (
                          <img
                            src={imageUrl(product.image_url)}
                            alt={product.name}
                            className="w-10 h-10 rounded-md object-cover shrink-0 bg-zinc-800"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-md bg-zinc-800 flex items-center justify-center shrink-0">
                            <ImageIcon className="w-4 h-4 text-zinc-600" />
                          </div>
                        )}

                        {/* Product info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-zinc-200 font-medium truncate">{product.name}</p>
                          <p className="text-xs text-zinc-500">
                            {hasVariations
                              ? `${variationItems.length || '...'} variation${variationItems.length !== 1 ? 's' : ''}`
                              : `$${product.price.toFixed(2)}`
                            }
                          </p>
                        </div>

                        {/* Price for non-variation products */}
                        {!hasVariations && (
                          <span className="text-xs text-zinc-500 shrink-0">${product.price.toFixed(2)}</span>
                        )}
                      </div>

                      {/* Variation items (expanded) */}
                      {hasVariations && isExpanded && (
                        <div className="ml-5 border-l border-zinc-800 pl-2 space-y-0.5 my-0.5">
                          {variationItems.length > 0 ? variationItems.map(item => {
                            const varKey = `${product.id}::${item.variation_item_id}`
                            const isVarChecked = pickerSelected.has(varKey)
                            return (
                              <button
                                key={varKey}
                                type="button"
                                onClick={() => togglePickerItem(varKey, {
                                  product_id: product.id,
                                  variation_item_id: item.variation_item_id,
                                  product_name: `${product.name} - ${item.item_name}`,
                                  product_price: item.price,
                                })}
                                className={`
                                  w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors
                                  ${isVarChecked ? 'bg-primary/10 border border-primary/30' : 'hover:bg-zinc-800 border border-transparent'}
                                `}
                              >
                                <div className={`
                                  w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors
                                  ${isVarChecked ? 'bg-primary border-primary' : 'border-zinc-600 hover:border-zinc-400'}
                                `}>
                                  {isVarChecked && <Check className="w-3 h-3 text-primary-foreground" />}
                                </div>
                                <div className="w-10 h-10 rounded-md bg-zinc-800 flex items-center justify-center shrink-0">
                                  <ImageIcon className="w-4 h-4 text-zinc-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-zinc-200 truncate">{item.item_name}</p>
                                </div>
                                <span className="text-xs text-zinc-500 shrink-0">${item.price.toFixed(2)}</span>
                              </button>
                            )
                          }) : (
                            <p className="text-xs text-zinc-500 px-3 py-2">Loading variations...</p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              ) : (
                <p className="text-sm text-zinc-600 text-center py-6">
                  {pickerSearch ? 'No matching products' : 'No more products available'}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-zinc-800 shrink-0">
              <span className="text-xs text-zinc-500">
                {pickerSelected.size > 0 ? `${pickerSelected.size} selected` : 'None selected'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setPicker(null); setPickerSelected(new Map()) }}
                  className="px-3 h-8 rounded-md text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPicker}
                  disabled={pickerSelected.size === 0}
                  className="px-4 h-8 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
                >
                  Add {pickerSelected.size > 0 ? `(${pickerSelected.size})` : ''}
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
