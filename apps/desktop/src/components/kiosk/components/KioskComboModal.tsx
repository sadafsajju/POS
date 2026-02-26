import { useState, useMemo, useEffect } from 'react'
import { X, Plus, Minus, Check } from 'lucide-react'
import type { Product, ComboSlot, ProductOptionGroup, ProductOptionItem } from '@/types'
import type { SelectedOption, SelectedComboChoice } from '../store/kiosk-store'
import apiClient from '@/api/client'

interface KioskComboModalProps {
  product: Product
  comboSlots: ComboSlot[]
  onClose: () => void
  onAddToCart: (product: Product, selectedOptions: SelectedOption[], quantity: number, comboChoices: SelectedComboChoice[]) => void
  formatCurrency: (amount: number) => string
}

export function KioskComboModal({
  product,
  comboSlots,
  onClose,
  onAddToCart,
  formatCurrency,
}: KioskComboModalProps) {
  const [quantity, setQuantity] = useState(1)
  const [selections, setSelections] = useState<Record<string, string>>({})
  const [nestedOptions, setNestedOptions] = useState<Record<string, SelectedOption[]>>({})
  const [optionGroupsCache, setOptionGroupsCache] = useState<Record<string, ProductOptionGroup[]>>({})
  const [loadingOptions, setLoadingOptions] = useState<Record<string, boolean>>({})

  // Pre-select first choice in each slot
  useEffect(() => {
    const defaults: Record<string, string> = {}
    for (const slot of comboSlots) {
      const choices = slot.choices || []
      if (choices.length > 0) {
        defaults[slot.id] = choices[0].product_id
        const choiceProduct = choices[0].product
        if (choiceProduct?.product_type === 'configurable' && !optionGroupsCache[choices[0].product_id]) {
          apiClient.getOptionGroups(choices[0].product_id).then(response => {
            const groups = Array.isArray(response.data) ? response.data : []
            setOptionGroupsCache(prev => ({ ...prev, [choices[0].product_id]: groups }))
          }).catch(() => {})
        }
      }
    }
    setSelections(defaults)
    setNestedOptions({})
  }, [comboSlots])

  const handleSelectChoice = async (slotId: string, choiceProductId: string, choiceProduct?: Product) => {
    setSelections(prev => ({
      ...prev,
      [slotId]: prev[slotId] === choiceProductId ? '' : choiceProductId,
    }))
    setNestedOptions(prev => ({ ...prev, [slotId]: [] }))

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
        const filtered = current.filter(opt => opt.groupId !== group.id)
        const existing = current.find(opt => opt.groupId === group.id && opt.itemId === item.id)
        if (existing) return { ...prev, [slotId]: filtered }
        return {
          ...prev,
          [slotId]: [...filtered, {
            groupId: group.id, groupName: group.name,
            itemId: item.id, itemName: item.name, priceAdjustment: item.price_adjustment,
          }],
        }
      } else {
        const existing = current.find(opt => opt.itemId === item.id)
        if (existing) return { ...prev, [slotId]: current.filter(opt => opt.itemId !== item.id) }
        if (group.max_selections > 0 && current.filter(opt => opt.groupId === group.id).length >= group.max_selections) return prev
        return {
          ...prev,
          [slotId]: [...current, {
            groupId: group.id, groupName: group.name,
            itemId: item.id, itemName: item.name, priceAdjustment: item.price_adjustment,
          }],
        }
      }
    })
  }

  const totalAdjustment = useMemo(() => {
    let adj = 0
    for (const slot of comboSlots) {
      const selectedProductId = selections[slot.id]
      if (!selectedProductId) continue
      const choice = (slot.choices || []).find(c => c.product_id === selectedProductId)
      if (choice?.price_override != null) adj += choice.price_override
      const slotOpts = nestedOptions[slot.id] || []
      for (const opt of slotOpts) adj += opt.priceAdjustment
    }
    return adj
  }, [comboSlots, selections, nestedOptions])

  const unitPrice = product.price + totalAdjustment
  const totalPrice = unitPrice * quantity

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
      const baseName = choice.product?.name || 'Unknown'
      const displayName = choice.variation_item_name ? `${baseName} — ${choice.variation_item_name}` : baseName
      comboChoices.push({
        slotName: slot.name,
        productId: choice.product_id,
        productName: displayName,
        priceAdjustment: choice.price_override ?? 0,
        selectedOptions: nestedOptions[slot.id] || [],
      })
    }
    onAddToCart(product, [], quantity, comboChoices)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="w-full max-w-2xl mx-6 max-h-[85vh] flex flex-col bg-zinc-900 rounded-3xl border border-zinc-800 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-800 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-zinc-100">{product.name}</h2>
            <p className="text-sm text-zinc-400 mt-1">Base price: {formatCurrency(product.price)}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-zinc-800 transition-colors">
            <X className="w-6 h-6 text-zinc-400" />
          </button>
        </div>

        {/* Slots */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {comboSlots.map(slot => {
            const selectedProductId = selections[slot.id]
            const choices = slot.choices || []

            return (
              <div key={slot.id} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-base text-zinc-100">{slot.name}</span>
                  {slot.is_required && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">
                      Required
                    </span>
                  )}
                </div>

                <div className="grid gap-2">
                  {choices.map(choice => {
                    const isSelected = selectedProductId === choice.product_id
                    const choiceProduct = choice.product
                    return (
                      <div key={choice.id}>
                        <button
                          type="button"
                          className={`
                            w-full flex items-center justify-between px-4 py-4 rounded-xl border-2 text-left transition-all
                            ${isSelected ? 'border-amber-500 bg-amber-500/10' : 'border-zinc-700 hover:border-zinc-500'}
                          `}
                          onClick={() => handleSelectChoice(slot.id, choice.product_id, choiceProduct)}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`
                              w-6 h-6 flex items-center justify-center rounded-full border-2 flex-shrink-0
                              ${isSelected ? 'border-amber-500 bg-amber-500 text-white' : 'border-zinc-600'}
                            `}>
                              {isSelected && <Check className="h-3.5 w-3.5" />}
                            </div>
                            <span className="text-base text-zinc-100">
                              {choiceProduct?.name || 'Unknown'}
                              {choice.variation_item_name && (
                                <span className="text-zinc-400"> — {choice.variation_item_name}</span>
                              )}
                            </span>
                          </div>
                          {choice.price_override != null && choice.price_override > 0 ? (
                            <span className="text-base font-semibold text-orange-400">
                              +{formatCurrency(choice.price_override)}
                            </span>
                          ) : (
                            <span className="text-sm text-emerald-400">Included</span>
                          )}
                        </button>

                        {/* Nested options for configurable choices */}
                        {isSelected && choiceProduct?.product_type === 'configurable' && (
                          <div className="ml-9 mt-2 space-y-3">
                            {loadingOptions[choice.product_id] && (
                              <p className="text-sm text-zinc-500">Loading options...</p>
                            )}
                            {(optionGroupsCache[choice.product_id] || []).map(group => {
                              const slotOpts = nestedOptions[slot.id] || []
                              return (
                                <div key={group.id} className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-zinc-100">{group.name}</span>
                                    {group.is_required && (
                                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400">Req</span>
                                    )}
                                  </div>
                                  <div className="grid gap-1.5">
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
                                              flex items-center justify-between px-3 py-3 rounded-lg border text-left transition-all
                                              ${isOptSelected ? 'border-amber-500/60 bg-amber-500/10' : 'border-zinc-700 hover:border-zinc-500'}
                                            `}
                                            onClick={() => handleNestedOptionToggle(slot.id, group, item)}
                                          >
                                            <div className="flex items-center gap-2">
                                              <div className={`
                                                w-5 h-5 flex items-center justify-center rounded-${group.selection_type === 'single' ? 'full' : 'md'} border-2 flex-shrink-0
                                                ${isOptSelected ? 'border-amber-500 bg-amber-500 text-white' : 'border-zinc-600'}
                                              `}>
                                                {isOptSelected && <Check className="h-3 w-3" />}
                                              </div>
                                              <span className="text-sm text-zinc-100">{item.name}</span>
                                            </div>
                                            {item.price_adjustment !== 0 && (
                                              <span className={`text-sm font-medium ${item.price_adjustment > 0 ? 'text-orange-400' : 'text-green-400'}`}>
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
        </div>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-zinc-800 flex-shrink-0 space-y-4">
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
