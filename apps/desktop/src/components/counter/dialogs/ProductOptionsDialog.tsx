import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { X, Plus, Minus, Check } from 'lucide-react'
import type { Product, ProductOptionGroup, ProductOptionItem } from '../types'
import type { SelectedOption } from '../types'

interface ProductOptionsDialogProps {
  product: Product
  optionGroups: ProductOptionGroup[]
  open: boolean
  onClose: () => void
  onAddToCart: (product: Product, selectedOptions: SelectedOption[], quantity: number) => void
  formatCurrency: (amount: number) => string
}

/**
 * Dialog for selecting options when adding a configurable product to cart.
 * Shows option groups as radio buttons (single) or checkboxes (multiple).
 */
export function ProductOptionsDialog({
  product,
  optionGroups,
  open,
  onClose,
  onAddToCart,
  formatCurrency,
}: ProductOptionsDialogProps) {
  const [quantity, setQuantity] = useState(1)
  // selections: { [groupId]: string[] (array of item IDs) }
  const [selections, setSelections] = useState<Record<string, string[]>>(() => {
    // Pre-select defaults
    const defaults: Record<string, string[]> = {}
    for (const group of optionGroups) {
      const defaultItems = group.items.filter(item => item.is_default && item.is_available)
      if (defaultItems.length > 0) {
        defaults[group.id] = defaultItems.map(i => i.id)
      }
    }
    return defaults
  })

  if (!open) return null

  // Handle single-select toggle
  const handleSingleSelect = (groupId: string, itemId: string) => {
    setSelections(prev => ({
      ...prev,
      [groupId]: prev[groupId]?.[0] === itemId ? [] : [itemId],
    }))
  }

  // Handle multi-select toggle
  const handleMultiSelect = (groupId: string, itemId: string, maxSelections: number) => {
    setSelections(prev => {
      const current = prev[groupId] || []
      if (current.includes(itemId)) {
        return { ...prev, [groupId]: current.filter(id => id !== itemId) }
      }
      // Enforce max selections (0 = unlimited)
      if (maxSelections > 0 && current.length >= maxSelections) {
        return prev
      }
      return { ...prev, [groupId]: [...current, itemId] }
    })
  }

  // Build a map of item ID -> item for quick lookup
  const itemMap = useMemo(() => {
    const map: Record<string, ProductOptionItem> = {}
    for (const group of optionGroups) {
      for (const item of group.items) {
        map[item.id] = item
      }
    }
    return map
  }, [optionGroups])

  // Calculate total price adjustment
  const totalAdjustment = useMemo(() => {
    let adj = 0
    for (const itemIds of Object.values(selections)) {
      for (const id of itemIds) {
        adj += itemMap[id]?.price_adjustment || 0
      }
    }
    return adj
  }, [selections, itemMap])

  const unitPrice = product.price + totalAdjustment
  const totalPrice = unitPrice * quantity

  // Validate all required groups are satisfied
  const isValid = useMemo(() => {
    for (const group of optionGroups) {
      if (group.is_required) {
        const selected = selections[group.id] || []
        if (selected.length === 0) return false
        if (group.min_selections > 0 && selected.length < group.min_selections) return false
      }
    }
    return true
  }, [optionGroups, selections])

  const handleAddToCart = () => {
    // Build SelectedOption array
    const selectedOptions: SelectedOption[] = []
    for (const group of optionGroups) {
      const selectedIds = selections[group.id] || []
      for (const itemId of selectedIds) {
        const item = itemMap[itemId]
        if (item) {
          selectedOptions.push({
            groupId: group.id,
            groupName: group.name,
            itemId: item.id,
            itemName: item.name,
            priceAdjustment: item.price_adjustment,
          })
        }
      }
    }
    onAddToCart(product, selectedOptions, quantity)
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
          {optionGroups.map(group => {
            const selectedIds = selections[group.id] || []
            const isSingle = group.selection_type === 'single'

            return (
              <div key={group.id} className="space-y-2">
                {/* Group header */}
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{group.name}</span>
                  {group.is_required && (
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                      Required
                    </Badge>
                  )}
                  {!isSingle && group.max_selections > 0 && (
                    <span className="text-xs text-muted-foreground">
                      (max {group.max_selections})
                    </span>
                  )}
                  {!isSingle && group.min_selections > 0 && (
                    <span className="text-xs text-muted-foreground">
                      (min {group.min_selections})
                    </span>
                  )}
                </div>

                {/* Option items */}
                <div className="grid gap-1.5">
                  {group.items
                    .filter(item => item.is_available)
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map(item => {
                      const isSelected = selectedIds.includes(item.id)
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className={`
                            flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-all
                            ${isSelected
                              ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                              : 'border-border hover:border-muted-foreground/40'
                            }
                          `}
                          onClick={() =>
                            isSingle
                              ? handleSingleSelect(group.id, item.id)
                              : handleMultiSelect(group.id, item.id, group.max_selections)
                          }
                        >
                          <div className="flex items-center gap-2">
                            {/* Selection indicator */}
                            <div className={`
                              w-5 h-5 flex items-center justify-center rounded-${isSingle ? 'full' : 'md'} border-2 flex-shrink-0
                              ${isSelected
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-muted-foreground/40'
                              }
                            `}>
                              {isSelected && <Check className="h-3 w-3" />}
                            </div>
                            <span className="text-sm">{item.name}</span>
                          </div>
                          {item.price_adjustment !== 0 && (
                            <span className={`text-sm font-medium ${item.price_adjustment > 0 ? 'text-orange-600' : 'text-green-600'}`}>
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
