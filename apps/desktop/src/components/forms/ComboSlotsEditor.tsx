import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { toastHelpers } from '@/lib/toast-helpers'
import apiClient from '@/api/client'
import type { ComboSlot, Product } from '@/types'
import { Plus, Trash2, ChevronDown, ChevronUp, Package } from 'lucide-react'

/** Draft combo slot stored locally before product is saved */
export interface DraftComboSlot {
  name: string
  is_required: boolean
  sort_order: number
  choices: DraftComboSlotChoice[]
}

export interface DraftComboSlotChoice {
  product_id: string
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

export function ComboSlotsEditor({ productId, draftSlots, onDraftSlotsChange }: ComboSlotsEditorProps) {
  const queryClient = useQueryClient()
  const [expandedSlots, setExpandedSlots] = useState<Record<string, boolean>>({})
  const [newSlotName, setNewSlotName] = useState('')
  const [newSlotRequired, setNewSlotRequired] = useState(true)
  const [productSearch, setProductSearch] = useState<Record<string, string>>({})
  const [priceOverrides, setPriceOverrides] = useState<Record<string, string>>({})

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
    mutationFn: ({ slotId, choiceProductId, priceOverride }: { slotId: string; choiceProductId: string; priceOverride?: number | null }) =>
      apiClient.createComboSlotChoice(slotId, {
        product_id: choiceProductId,
        price_override: priceOverride,
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

  // --- Shared handlers ---
  const toggleSlot = (key: string) => {
    setExpandedSlots(prev => ({ ...prev, [key]: !prev[key] }))
  }

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
    } else {
      createSlotMutation.mutate()
    }
  }

  const handleDeleteDraftSlot = (index: number) => {
    if (onDraftSlotsChange && draftSlots) {
      onDraftSlotsChange(draftSlots.filter((_, i) => i !== index))
    }
  }

  const handleAddDraftChoice = (slotIndex: number, product: Product) => {
    if (!onDraftSlotsChange || !draftSlots) return
    const overrideStr = priceOverrides[`draft-${slotIndex}`]
    const priceOverride = overrideStr && overrideStr.trim() !== '' ? parseFloat(overrideStr) : null

    const updated = [...draftSlots]
    updated[slotIndex] = {
      ...updated[slotIndex],
      choices: [...updated[slotIndex].choices, {
        product_id: product.id,
        product_name: product.name,
        product_price: product.price,
        price_override: isNaN(priceOverride as number) ? null : priceOverride,
        sort_order: updated[slotIndex].choices.length,
      }],
    }
    onDraftSlotsChange(updated)
    setProductSearch(prev => ({ ...prev, [`draft-${slotIndex}`]: '' }))
    setPriceOverrides(prev => ({ ...prev, [`draft-${slotIndex}`]: '' }))
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

  const handleApiAddChoice = (slotId: string, choiceProductId: string) => {
    const overrideStr = priceOverrides[slotId]
    const priceOverride = overrideStr && overrideStr.trim() !== '' ? parseFloat(overrideStr) : null
    addChoiceMutation.mutate({ slotId, choiceProductId, priceOverride: isNaN(priceOverride as number) ? null : priceOverride })
    setProductSearch(prev => ({ ...prev, [slotId]: '' }))
    setPriceOverrides(prev => ({ ...prev, [slotId]: '' }))
  }

  // Filter products for slot picker
  const getAvailableProductsForApiSlot = (slot: ComboSlot) => {
    const existingIds = new Set((slot.choices || []).map(c => c.product_id))
    const search = (productSearch[slot.id] || '').toLowerCase()
    return allProducts.filter(p =>
      !existingIds.has(p.id) &&
      (!search || p.name.toLowerCase().includes(search))
    )
  }

  const getAvailableProductsForDraftSlot = (slot: DraftComboSlot, slotIndex: number) => {
    const existingIds = new Set(slot.choices.map(c => c.product_id))
    const search = (productSearch[`draft-${slotIndex}`] || '').toLowerCase()
    return allProducts.filter(p =>
      !existingIds.has(p.id) &&
      (!search || p.name.toLowerCase().includes(search))
    )
  }

  const slotCount = isDraftMode ? (draftSlots?.length || 0) : apiSlots.length

  if (!isDraftMode && isLoading) {
    return <div className="text-sm text-muted-foreground py-4">Loading combo slots...</div>
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Combo Slots</h3>
        <Badge variant="secondary" className="text-xs">{slotCount} slots</Badge>
      </div>

      {/* Draft mode: show draft slots */}
      {isDraftMode && draftSlots?.map((slot, index) => {
        const key = `draft-${index}`
        const isExpanded = expandedSlots[key] !== false
        const searchValue = productSearch[key] || ''
        const available = getAvailableProductsForDraftSlot(slot, index)

        return (
          <Card key={key} className="border">
            <CardHeader className="py-2 px-3 cursor-pointer" onClick={() => toggleSlot(key)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm">{slot.name}</CardTitle>
                  {slot.is_required && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Required</Badge>}
                  <span className="text-xs text-muted-foreground">{slot.choices.length} choices</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => { e.stopPropagation(); handleDeleteDraftSlot(index) }}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="pt-0 px-3 pb-3 space-y-3">
                {/* Current choices */}
                {slot.choices.length > 0 && (
                  <div className="space-y-1">
                    {slot.choices.map((choice, choiceIdx) => (
                      <div key={choiceIdx} className="flex items-center justify-between py-1.5 px-2 bg-muted/50 rounded text-sm">
                        <span>{choice.product_name}</span>
                        <div className="flex items-center gap-2">
                          {choice.price_override != null ? (
                            <span className="text-xs text-orange-600 font-medium">
                              +${choice.price_override.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-xs text-green-600">Included</span>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={() => handleDeleteDraftChoice(index, choiceIdx)}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add choice - product search */}
                <div className="space-y-2 border-t pt-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Search products..."
                      value={searchValue}
                      onChange={(e) => setProductSearch(prev => ({ ...prev, [key]: e.target.value }))}
                      className="h-8 text-xs flex-1"
                    />
                    <Input
                      placeholder="Extra $ (blank=included)"
                      value={priceOverrides[key] || ''}
                      onChange={(e) => setPriceOverrides(prev => ({ ...prev, [key]: e.target.value }))}
                      className="h-8 text-xs w-40"
                      type="number"
                      step="0.01"
                    />
                  </div>
                  {searchValue && available.length > 0 && (
                    <div className="max-h-32 overflow-y-auto border rounded bg-background">
                      {available.slice(0, 10).map(product => (
                        <button
                          key={product.id}
                          type="button"
                          className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted flex items-center justify-between"
                          onClick={() => handleAddDraftChoice(index, product)}
                        >
                          <span>{product.name}</span>
                          <span className="text-muted-foreground">${product.price.toFixed(2)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchValue && available.length === 0 && (
                    <p className="text-xs text-muted-foreground px-1">No matching products found</p>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        )
      })}

      {/* API mode: show existing slots */}
      {!isDraftMode && apiSlots.map(slot => {
        const isExpanded = expandedSlots[slot.id] !== false
        const choices = slot.choices || []
        const available = getAvailableProductsForApiSlot(slot)
        const searchValue = productSearch[slot.id] || ''

        return (
          <Card key={slot.id} className="border">
            <CardHeader className="py-2 px-3 cursor-pointer" onClick={() => toggleSlot(slot.id)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm">{slot.name}</CardTitle>
                  {slot.is_required && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Required</Badge>}
                  <span className="text-xs text-muted-foreground">{choices.length} choices</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => { e.stopPropagation(); deleteSlotMutation.mutate(slot.id) }}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="pt-0 px-3 pb-3 space-y-3">
                {/* Current choices */}
                {choices.length > 0 && (
                  <div className="space-y-1">
                    {choices.map(choice => (
                      <div key={choice.id} className="flex items-center justify-between py-1.5 px-2 bg-muted/50 rounded text-sm">
                        <div className="flex items-center gap-2">
                          <span>{choice.product?.name || 'Unknown product'}</span>
                          {choice.product?.product_type === 'configurable' && (
                            <Badge variant="outline" className="text-[10px]">Has options</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {choice.price_override != null && (
                            <span className="text-xs text-orange-600 font-medium">
                              +${choice.price_override.toFixed(2)}
                            </span>
                          )}
                          {choice.price_override == null && (
                            <span className="text-xs text-green-600">Included</span>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={() => deleteChoiceMutation.mutate(choice.id)}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add choice */}
                <div className="space-y-2 border-t pt-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Search products..."
                      value={searchValue}
                      onChange={(e) => setProductSearch(prev => ({ ...prev, [slot.id]: e.target.value }))}
                      className="h-8 text-xs flex-1"
                    />
                    <Input
                      placeholder="Extra $ (blank=included)"
                      value={priceOverrides[slot.id] || ''}
                      onChange={(e) => setPriceOverrides(prev => ({ ...prev, [slot.id]: e.target.value }))}
                      className="h-8 text-xs w-40"
                      type="number"
                      step="0.01"
                    />
                  </div>
                  {searchValue && available.length > 0 && (
                    <div className="max-h-32 overflow-y-auto border rounded bg-background">
                      {available.slice(0, 10).map(product => (
                        <button
                          key={product.id}
                          type="button"
                          className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted flex items-center justify-between"
                          onClick={() => handleApiAddChoice(slot.id, product.id)}
                        >
                          <span>{product.name}</span>
                          <span className="text-muted-foreground">${product.price.toFixed(2)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchValue && available.length === 0 && (
                    <p className="text-xs text-muted-foreground px-1">No matching products found</p>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        )
      })}

      {/* Add new slot */}
      <Card className="border border-dashed">
        <CardContent className="py-3 px-3">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Slot name (e.g., Main, Side, Drink)"
              value={newSlotName}
              onChange={(e) => setNewSlotName(e.target.value)}
              className="h-8 text-sm flex-1"
              onKeyDown={e => e.key === 'Enter' && handleAddSlot()}
            />
            <div className="flex items-center gap-1.5">
              <Switch
                checked={newSlotRequired}
                onCheckedChange={setNewSlotRequired}
                className="scale-75"
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">Required</span>
            </div>
            <Button
              type="button"
              size="sm"
              className="h-8"
              disabled={!newSlotName.trim() || (!isDraftMode && createSlotMutation.isPending)}
              onClick={handleAddSlot}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Slot
            </Button>
          </div>
        </CardContent>
      </Card>

      {slotCount === 0 && (
        <p className="text-sm text-muted-foreground text-center py-2">
          No combo slots yet. Add slots like "Main", "Side", "Drink" to build the combo.
        </p>
      )}
    </div>
  )
}
