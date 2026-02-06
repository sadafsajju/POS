import { useState, useMemo, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { X, Plus, Minus, Check, Settings2 } from 'lucide-react'
import type { Product, ComboSlot, ProductOptionGroup, ProductOptionItem } from '../types'
import type { SelectedOption, SelectedComboChoice } from '../types'
import apiClient from '@/api/client'

interface ComboConfigDialogProps {
  product: Product
  comboSlots: ComboSlot[]
  open: boolean
  onClose: () => void
  onAddToCart: (product: Product, selectedOptions: SelectedOption[], quantity: number, selectedComboChoices: SelectedComboChoice[]) => void
  formatCurrency: (amount: number) => string
}

/**
 * Dialog for configuring a combo product before adding to cart.
 * Each combo slot shows available product choices.
 * If a choice is a configurable product, inline option groups are shown.
 */
export function ComboConfigDialog({
  product,
  comboSlots,
  open,
  onClose,
  onAddToCart,
  formatCurrency,
}: ComboConfigDialogProps) {
  const [quantity, setQuantity] = useState(1)
  // selections: { [slotId]: choiceProductId }
  const [selections, setSelections] = useState<Record<string, string>>({})
  // Nested options for configurable choices: { [slotId]: SelectedOption[] }
  const [nestedOptions, setNestedOptions] = useState<Record<string, SelectedOption[]>>({})
  // Loaded option groups for configurable products: { [productId]: ProductOptionGroup[] }
  const [optionGroupsCache, setOptionGroupsCache] = useState<Record<string, ProductOptionGroup[]>>({})
  const [loadingOptions, setLoadingOptions] = useState<Record<string, boolean>>({})

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setQuantity(1)
      setSelections({})
      setNestedOptions({})
    }
  }, [open])

  if (!open) return null

  const handleSelectChoice = async (slotId: string, choiceProductId: string, choiceProduct?: Product) => {
    setSelections(prev => ({
      ...prev,
      [slotId]: prev[slotId] === choiceProductId ? '' : choiceProductId,
    }))
    // Clear nested options when changing choice
    setNestedOptions(prev => ({ ...prev, [slotId]: [] }))

    // If the chosen product is configurable, load its option groups
    if (choiceProduct?.product_type === 'configurable' && !optionGroupsCache[choiceProductId]) {
      setLoadingOptions(prev => ({ ...prev, [choiceProductId]: true }))
      try {
        const response = await apiClient.getOptionGroups(choiceProductId)
        const groups = Array.isArray(response.data) ? response.data : []
        setOptionGroupsCache(prev => ({ ...prev, [choiceProductId]: groups }))
      } catch {
        setOptionGroupsCache(prev => ({ ...prev, [choiceProductId]: [] }))
      } finally {
        setLoadingOptions(prev => ({ ...prev, [choiceProductId]: false }))
      }
    }
  }

  const handleNestedOptionToggle = (slotId: string, group: ProductOptionGroup, item: ProductOptionItem) => {
    setNestedOptions(prev => {
      const current = prev[slotId] || []
      if (group.selection_type === 'single') {
        // Replace any existing selection in this group
        const filtered = current.filter(opt => opt.groupId !== group.id)
        const existing = current.find(opt => opt.groupId === group.id && opt.itemId === item.id)
        if (existing) return { ...prev, [slotId]: filtered }
        return {
          ...prev,
          [slotId]: [...filtered, {
            groupId: group.id,
            groupName: group.name,
            itemId: item.id,
            itemName: item.name,
            priceAdjustment: item.price_adjustment,
          }],
        }
      } else {
        // Toggle for multi-select
        const existing = current.find(opt => opt.itemId === item.id)
        if (existing) {
          return { ...prev, [slotId]: current.filter(opt => opt.itemId !== item.id) }
        }
        if (group.max_selections > 0 && current.filter(opt => opt.groupId === group.id).length >= group.max_selections) {
          return prev
        }
        return {
          ...prev,
          [slotId]: [...current, {
            groupId: group.id,
            groupName: group.name,
            itemId: item.id,
            itemName: item.name,
            priceAdjustment: item.price_adjustment,
          }],
        }
      }
    })
  }

  // Calculate combo total: base price + slot adjustments + nested option adjustments
  const totalAdjustment = useMemo(() => {
    let adj = 0
    for (const slot of comboSlots) {
      const selectedProductId = selections[slot.id]
      if (!selectedProductId) continue
      const choice = (slot.choices || []).find(c => c.product_id === selectedProductId)
      if (choice?.price_override != null) {
        adj += choice.price_override
      }
      // Nested options
      const slotOptions = nestedOptions[slot.id] || []
      for (const opt of slotOptions) {
        adj += opt.priceAdjustment
      }
    }
    return adj
  }, [comboSlots, selections, nestedOptions])

  const unitPrice = product.price + totalAdjustment
  const totalPrice = unitPrice * quantity

  // Validate: all required slots must have a selection
  const isValid = useMemo(() => {
    for (const slot of comboSlots) {
      if (slot.is_required && !selections[slot.id]) return false
    }
    return true
  }, [comboSlots, selections])

  const handleAddToCart = () => {
    const comboChoices: SelectedComboChoice[] = []
    for (const slot of comboSlots) {
      const selectedProductId = selections[slot.id]
      if (!selectedProductId) continue
      const choice = (slot.choices || []).find(c => c.product_id === selectedProductId)
      if (!choice) continue
      comboChoices.push({
        slotName: slot.name,
        productId: choice.product_id,
        productName: choice.product?.name || 'Unknown',
        priceAdjustment: choice.price_override ?? 0,
        selectedOptions: nestedOptions[slot.id] || [],
      })
    }
    onAddToCart(product, [], quantity, comboChoices)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        <CardHeader className="pb-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">{product.name}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Base price: {formatCurrency(product.price)}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto space-y-5 pb-4">
          {comboSlots.map(slot => {
            const selectedProductId = selections[slot.id]
            const choices = slot.choices || []

            return (
              <div key={slot.id} className="space-y-2">
                {/* Slot header */}
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{slot.name}</span>
                  {slot.is_required && (
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                      Required
                    </Badge>
                  )}
                </div>

                {/* Product choices */}
                <div className="grid gap-1.5">
                  {choices.map(choice => {
                    const isSelected = selectedProductId === choice.product_id
                    const choiceProduct = choice.product
                    return (
                      <div key={choice.id}>
                        <button
                          type="button"
                          className={`
                            w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-all
                            ${isSelected
                              ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                              : 'border-border hover:border-muted-foreground/40'
                            }
                          `}
                          onClick={() => handleSelectChoice(slot.id, choice.product_id, choiceProduct)}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`
                              w-5 h-5 flex items-center justify-center rounded-full border-2 flex-shrink-0
                              ${isSelected
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-muted-foreground/40'
                              }
                            `}>
                              {isSelected && <Check className="h-3 w-3" />}
                            </div>
                            <span className="text-sm">{choiceProduct?.name || 'Unknown'}</span>
                            {choiceProduct?.product_type === 'configurable' && (
                              <Settings2 className="h-3 w-3 text-muted-foreground" />
                            )}
                          </div>
                          {choice.price_override != null && choice.price_override > 0 ? (
                            <span className="text-sm font-medium text-orange-600">
                              +{formatCurrency(choice.price_override)}
                            </span>
                          ) : (
                            <span className="text-xs text-green-600">Included</span>
                          )}
                        </button>

                        {/* Nested option groups for configurable choices */}
                        {isSelected && choiceProduct?.product_type === 'configurable' && (
                          <div className="ml-7 mt-2 space-y-3">
                            {loadingOptions[choice.product_id] && (
                              <p className="text-xs text-muted-foreground">Loading options...</p>
                            )}
                            {(optionGroupsCache[choice.product_id] || []).map(group => {
                              const slotOpts = nestedOptions[slot.id] || []
                              return (
                                <div key={group.id} className="space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-medium">{group.name}</span>
                                    {group.is_required && (
                                      <Badge variant="outline" className="text-[9px] px-1 py-0">Req</Badge>
                                    )}
                                  </div>
                                  <div className="grid gap-1">
                                    {group.items
                                      .filter(i => i.is_available)
                                      .sort((a, b) => a.sort_order - b.sort_order)
                                      .map(item => {
                                        const isOptSelected = slotOpts.some(o => o.itemId === item.id)
                                        return (
                                          <button
                                            key={item.id}
                                            type="button"
                                            className={`
                                              flex items-center justify-between px-2 py-1.5 rounded border text-left text-xs transition-all
                                              ${isOptSelected
                                                ? 'border-primary/60 bg-primary/5'
                                                : 'border-border hover:border-muted-foreground/30'
                                              }
                                            `}
                                            onClick={() => handleNestedOptionToggle(slot.id, group, item)}
                                          >
                                            <div className="flex items-center gap-1.5">
                                              <div className={`
                                                w-3.5 h-3.5 flex items-center justify-center rounded-${group.selection_type === 'single' ? 'full' : 'sm'} border flex-shrink-0
                                                ${isOptSelected
                                                  ? 'border-primary bg-primary text-primary-foreground'
                                                  : 'border-muted-foreground/40'
                                                }
                                              `}>
                                                {isOptSelected && <Check className="h-2 w-2" />}
                                              </div>
                                              <span>{item.name}</span>
                                            </div>
                                            {item.price_adjustment !== 0 && (
                                              <span className={`font-medium ${item.price_adjustment > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                                                {item.price_adjustment > 0 ? '+' : ''}{formatCurrency(item.price_adjustment)}
                                              </span>
                                            )}
                                          </button>
                                        )
                                      })}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </CardContent>

        <CardFooter className="flex-shrink-0 border-t pt-4 flex flex-col gap-3">
          {/* Quantity selector */}
          <div className="flex items-center justify-between w-full">
            <span className="text-sm font-medium">Quantity</span>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                disabled={quantity <= 1}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="text-lg font-semibold w-8 text-center">{quantity}</span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setQuantity(q => q + 1)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Add to cart button */}
          <Button
            className="w-full h-12 text-base"
            onClick={handleAddToCart}
            disabled={!isValid}
          >
            Add to Cart — {formatCurrency(totalPrice)}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
