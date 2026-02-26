import { useState, useMemo } from 'react'
import { X, Plus, Minus, Check } from 'lucide-react'
import type { Product, ProductOptionGroup, ProductOptionItem } from '@/types'
import type { SelectedOption } from '../store/kiosk-store'

interface KioskOptionsModalProps {
  product: Product
  optionGroups: ProductOptionGroup[]
  onClose: () => void
  onAddToCart: (product: Product, selectedOptions: SelectedOption[], quantity: number) => void
  formatCurrency: (amount: number) => string
}

export function KioskOptionsModal({
  product,
  optionGroups,
  onClose,
  onAddToCart,
  formatCurrency,
}: KioskOptionsModalProps) {
  const [quantity, setQuantity] = useState(1)
  const [selections, setSelections] = useState<Record<string, string[]>>(() => {
    const defaults: Record<string, string[]> = {}
    for (const group of optionGroups) {
      const defaultItems = group.items.filter(item => item.is_default && item.is_available)
      if (defaultItems.length > 0) {
        defaults[group.id] = defaultItems.map(i => i.id)
      }
    }
    return defaults
  })

  const handleSingleSelect = (groupId: string, itemId: string) => {
    setSelections(prev => ({
      ...prev,
      [groupId]: prev[groupId]?.[0] === itemId ? [] : [itemId],
    }))
  }

  const handleMultiSelect = (groupId: string, itemId: string, maxSelections: number) => {
    setSelections(prev => {
      const current = prev[groupId] || []
      if (current.includes(itemId)) {
        return { ...prev, [groupId]: current.filter(id => id !== itemId) }
      }
      if (maxSelections > 0 && current.length >= maxSelections) return prev
      return { ...prev, [groupId]: [...current, itemId] }
    })
  }

  const itemMap = useMemo(() => {
    const map: Record<string, ProductOptionItem> = {}
    for (const group of optionGroups) {
      for (const item of group.items) {
        map[item.id] = item
      }
    }
    return map
  }, [optionGroups])

  const totalAdjustment = useMemo(() => {
    let adj = 0
    for (const itemIds of Object.values(selections)) {
      for (const id of itemIds) {
        adj += itemMap[id]?.price_adjustment || 0
      }
    }
    return adj
  }, [selections, itemMap])

  const isVariationBased = product.price === 0 && product.min_variation_price != null
  const unitPrice = product.price + totalAdjustment
  const totalPrice = unitPrice * quantity

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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="w-full max-w-2xl mx-6 max-h-[85vh] flex flex-col bg-zinc-900 rounded-3xl border border-zinc-800 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-800 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-zinc-100">{product.name}</h2>
            {!isVariationBased && (
              <p className="text-sm text-zinc-400 mt-1">Base price: {formatCurrency(product.price)}</p>
            )}
            {isVariationBased && (
              <p className="text-sm text-zinc-400 mt-1">Select a variation</p>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-zinc-800 transition-colors">
            <X className="w-6 h-6 text-zinc-400" />
          </button>
        </div>

        {/* Option groups */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {optionGroups.map(group => {
            const selectedIds = selections[group.id] || []
            const isSingle = group.selection_type === 'single'

            return (
              <div key={group.id} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-base text-zinc-100">{group.name}</span>
                  {group.is_required && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">
                      Required
                    </span>
                  )}
                  {!isSingle && group.max_selections > 0 && (
                    <span className="text-xs text-zinc-500">(max {group.max_selections})</span>
                  )}
                </div>

                <div className="grid gap-2">
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
                            flex items-center justify-between px-4 py-4 rounded-xl border-2 text-left transition-all
                            ${isSelected
                              ? 'border-amber-500 bg-amber-500/10'
                              : 'border-zinc-700 hover:border-zinc-500'
                            }
                          `}
                          onClick={() =>
                            isSingle
                              ? handleSingleSelect(group.id, item.id)
                              : handleMultiSelect(group.id, item.id, group.max_selections)
                          }
                        >
                          <div className="flex items-center gap-3">
                            <div className={`
                              w-6 h-6 flex items-center justify-center rounded-${isSingle ? 'full' : 'lg'} border-2 flex-shrink-0
                              ${isSelected ? 'border-amber-500 bg-amber-500 text-white' : 'border-zinc-600'}
                            `}>
                              {isSelected && <Check className="h-3.5 w-3.5" />}
                            </div>
                            <span className="text-base text-zinc-100">{item.name}</span>
                          </div>
                          {isVariationBased && item.price_adjustment > 0 ? (
                            <span className="text-base font-semibold text-amber-400">
                              {formatCurrency(item.price_adjustment)}
                            </span>
                          ) : item.price_adjustment !== 0 ? (
                            <span className={`text-base font-semibold ${item.price_adjustment > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                              {item.price_adjustment > 0 ? '+' : ''}{formatCurrency(item.price_adjustment)}
                            </span>
                          ) : null}
                        </button>
                      )
                    })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-zinc-800 flex-shrink-0 space-y-4">
          {/* Quantity */}
          <div className="flex items-center justify-between">
            <span className="text-base font-semibold text-zinc-100">Quantity</span>
            <div className="flex items-center gap-4">
              <button
                className="w-10 h-10 rounded-xl bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors disabled:opacity-30"
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                disabled={quantity <= 1}
              >
                <Minus className="w-5 h-5" />
              </button>
              <span className="text-xl font-bold w-8 text-center">{quantity}</span>
              <button
                className="w-10 h-10 rounded-xl bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors"
                onClick={() => setQuantity(q => q + 1)}
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          <button
            className="w-full py-4 bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-lg font-bold rounded-xl transition-colors active:scale-[0.98]"
            onClick={handleAddToCart}
            disabled={!isValid}
          >
            Add to Order — {formatCurrency(totalPrice)}
          </button>
        </div>
      </div>
    </div>
  )
}
