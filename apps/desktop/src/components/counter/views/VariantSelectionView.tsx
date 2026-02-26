import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ImageOff, Check, ChevronRight, ShoppingCart } from 'lucide-react'
import type { InlineConfigState } from '../types'
import type { ProductOptionItem, ComboSlot } from '@/types'

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:8080'

interface VariantSelectionViewProps {
  config: InlineConfigState
  formatCurrency: (amount: number) => string
  onSelect: (stepIndex: number, itemId: string) => void
  onContinue: () => void
  onComplete: () => void
}

/**
 * Inline grid view for variant/combo selection.
 * Variations: step-by-step drill. Combos: single screen with all slots as sections.
 */
export function VariantSelectionView({
  config,
  formatCurrency,
  onSelect,
  onContinue,
  onComplete,
}: VariantSelectionViewProps) {
  if (config.mode === 'variation') {
    return <VariationStepView config={config} formatCurrency={formatCurrency} onSelect={onSelect} onContinue={onContinue} />
  }
  return <ComboSingleScreenView config={config} formatCurrency={formatCurrency} onSelect={onSelect} onComplete={onComplete} />
}

// ── Variation mode: step through option groups ─────────────────────────────

function VariationStepView({
  config,
  formatCurrency,
  onSelect,
  onContinue,
}: {
  config: InlineConfigState
  formatCurrency: (amount: number) => string
  onSelect: (stepIndex: number, itemId: string) => void
  onContinue: () => void
}) {
  const groups = config.optionGroups || []
  const group = groups[config.currentStep]
  if (!group) return null

  const selectedIds = config.selections[group.id] || []
  const isMulti = group.selection_type === 'multiple'
  const meetsMin = selectedIds.length >= (group.min_selections || 0)
  const atMax = group.max_selections > 0 && selectedIds.length >= group.max_selections

  return (
    <div className="space-y-0">
      {/* Step header */}
      <div className="sticky top-0 z-10 bg-zinc-900 border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black tracking-tight text-zinc-100">{group.name}</h2>
          <p className="text-xs text-zinc-500">
            {isMulti
              ? `Select ${group.min_selections}–${group.max_selections || '∞'} options`
              : 'Select one'}
            {group.is_required && <span className="text-amber-500 ml-1">• Required</span>}
          </p>
        </div>
        <StepBadge current={config.currentStep + 1} total={config.totalSteps} />
      </div>

      {/* Option items grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 p-2">
        {group.items.filter((i: ProductOptionItem) => i.is_available).map((item: ProductOptionItem) => (
          <OptionItemCard
            key={item.id}
            item={item}
            selected={selectedIds.includes(item.id)}
            disabled={!selectedIds.includes(item.id) && atMax}
            formatCurrency={formatCurrency}
            onClick={() => onSelect(config.currentStep, item.id)}
          />
        ))}
      </div>

      {/* Continue button for multi-select */}
      {isMulti && (
        <div className="sticky bottom-0 p-3 bg-zinc-900 border-t border-zinc-800">
          <Button
            onClick={onContinue}
            disabled={!meetsMin}
            className="w-full h-12 text-lg font-bold bg-amber-500 hover:bg-amber-600 text-black disabled:opacity-40"
          >
            Continue
            <ChevronRight className="w-5 h-5 ml-1" />
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Combo mode: single screen with all slots as sections ────────────────────

function ComboSingleScreenView({
  config,
  formatCurrency,
  onSelect,
  onComplete,
}: {
  config: InlineConfigState
  formatCurrency: (amount: number) => string
  onSelect: (stepIndex: number, itemId: string) => void
  onComplete: () => void
}) {
  const slots = config.comboSlots || []

  // Validate: all required slots must have a selection
  const isValid = useMemo(() => {
    for (const slot of slots) {
      if (slot.is_required && !(config.selections[slot.id]?.length)) return false
    }
    return slots.length > 0
  }, [slots, config.selections])

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {slots.map((slot: ComboSlot, slotIndex: number) => {
          const selectedIds = config.selections[slot.id] || []

          return (
            <div key={slot.id}>
              {/* Slot section header */}
              <div className="sticky top-0 z-10 bg-zinc-900 border-b border-zinc-800 px-4 py-2.5 flex items-center gap-2">
                <h2 className="text-base font-black tracking-tight text-zinc-100">{slot.name}</h2>
                {slot.is_required && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-500/15 text-amber-500 border-amber-500/30">
                    Required
                  </Badge>
                )}
                {selectedIds.length > 0 && (
                  <Check className="w-4 h-4 text-emerald-500 ml-auto" />
                )}
              </div>

              {/* Choices grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 p-2">
                {(slot.choices || []).map((choice: ComboSlotChoice) => {
                  const product = choice.product
                  if (!product) return null
                  const isSelected = selectedIds.includes(choice.id)
                  const priceAdj = choice.price_override ?? 0

                  return (
                    <div
                      key={choice.id}
                      onClick={() => onSelect(slotIndex, choice.id)}
                      className={`
                        relative overflow-hidden cursor-pointer transition-all rounded-xl flex flex-col bg-zinc-900
                        hover:bg-zinc-800 active:scale-[0.98]
                        ${isSelected ? 'ring-2 ring-amber-500' : ''}
                      `}
                    >
                      {/* Product image */}
                      <div className="relative h-28 bg-zinc-800 overflow-hidden">
                        {product.image_url ? (
                          <img
                            src={product.image_url.startsWith('/') ? `${API_BASE}${product.image_url}` : product.image_url}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                            <ImageOff className="w-10 h-10 text-zinc-700" />
                          </div>
                        )}
                        {isSelected && (
                          <div className="absolute top-2 right-2 bg-amber-500 text-white w-7 h-7 rounded-full flex items-center justify-center">
                            <Check className="w-4 h-4" />
                          </div>
                        )}
                      </div>

                      {/* Choice info */}
                      <div className="p-2 flex-1 flex flex-col justify-between">
                        <h3 className="font-bold text-sm leading-tight line-clamp-2 text-zinc-100">
                          {product.name}
                        </h3>
                        {priceAdj !== 0 && (
                          <span className="text-xs font-mono tabular-nums text-emerald-600 mt-1">
                            {priceAdj > 0 ? '+' : ''}{formatCurrency(priceAdj)}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Add to Cart button - sticky at bottom */}
      <div className="sticky bottom-0 p-3 bg-zinc-900 border-t border-zinc-800">
        <Button
          onClick={onComplete}
          disabled={!isValid}
          className="w-full h-12 text-lg font-bold bg-amber-500 hover:bg-amber-600 text-black disabled:opacity-40"
        >
          <ShoppingCart className="w-5 h-5 mr-2" />
          Add to Cart
        </Button>
      </div>
    </div>
  )
}

// ── Shared components ──────────────────────────────────────────────────────

function OptionItemCard({
  item,
  selected,
  disabled,
  formatCurrency,
  onClick,
}: {
  item: ProductOptionItem
  selected: boolean
  disabled: boolean
  formatCurrency: (amount: number) => string
  onClick: () => void
}) {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      className={`
        relative overflow-hidden cursor-pointer transition-all rounded-xl flex flex-col bg-zinc-900 p-4 h-24 justify-center
        ${selected ? 'ring-2 ring-amber-500 bg-amber-500/10' : 'hover:bg-zinc-800 active:scale-[0.98]'}
        ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
      `}
    >
      {selected && (
        <div className="absolute top-2 right-2 bg-amber-500 text-white w-5 h-5 rounded-full flex items-center justify-center">
          <Check className="w-3 h-3" />
        </div>
      )}
      <h3 className="font-bold text-sm leading-tight text-zinc-100">{item.name}</h3>
      {item.price_adjustment !== 0 && (
        <span className="text-xs font-mono tabular-nums text-emerald-600 mt-1">
          {item.price_adjustment > 0 ? '+' : ''}{formatCurrency(item.price_adjustment)}
        </span>
      )}
    </div>
  )
}

function StepBadge({ current, total }: { current: number; total: number }) {
  return (
    <Badge variant="secondary" className="text-xs bg-zinc-800 text-zinc-400 border-zinc-700">
      Step {current} of {total}
    </Badge>
  )
}
