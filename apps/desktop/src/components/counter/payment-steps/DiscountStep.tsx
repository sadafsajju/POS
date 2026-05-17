import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Percent, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { adminApi, queryKeys, staleTime } from '@pos/api-client'
import type { DiscountItem } from '@pos/api-client'

interface DiscountStepProps {
  formatCurrency: (amount: number) => string
  /** Pre-discount total — what the customer would pay without any discount. */
  baseTotal: number
  /** Currently selected discount preset, or null for "no discount". */
  selectedDiscount: DiscountItem | null
  onSelect: (discount: DiscountItem | null) => void
  onContinue: () => void
  onBack: () => void
}

/**
 * Step shown right before the payment-method picker. Lists the active
 * discount presets as chips; the cashier picks one (or "No discount") and
 * taps Continue. The selection is held in PaymentOverlay state and applied
 * to the bill at payment time.
 */
export function DiscountStep({
  formatCurrency,
  baseTotal,
  selectedDiscount,
  onSelect,
  onContinue,
  onBack,
}: DiscountStepProps) {
  const { data: res, isLoading } = useQuery({
    queryKey: queryKeys.discounts.active,
    queryFn: () => adminApi.getActiveDiscounts(),
    staleTime: staleTime.discounts,
  })

  const discounts: DiscountItem[] = Array.isArray(res?.data) ? res.data : []
  const discountAmount = selectedDiscount
    ? Math.round(baseTotal * selectedDiscount.percent) / 100
    : 0
  const finalTotal = Math.max(0, baseTotal - discountAmount)

  return (
    <div className="w-full max-w-sm space-y-6">
      <button
        onClick={onBack}
        className="w-12 h-12 rounded-full border border-zinc-700 bg-zinc-800 flex items-center justify-center hover:bg-zinc-700 active:scale-95 transition-all"
      >
        <ArrowLeft className="w-6 h-6 text-zinc-100" />
      </button>

      <div className="text-center">
        <h3 className="text-2xl font-black tracking-tight text-zinc-100">Apply a discount?</h3>
        <p className="text-sm text-zinc-500 mt-1">
          Pick a discount preset, or skip to keep the full total.
        </p>
      </div>

      {/* Total preview — reactive to current selection */}
      <div className="rounded-lg bg-zinc-800 py-4 px-4 text-center space-y-1">
        {selectedDiscount && discountAmount > 0 && (
          <div className="text-xs text-zinc-500 flex justify-center gap-3">
            <span>Was {formatCurrency(baseTotal)}</span>
            <span className="text-emerald-400">
              − {formatCurrency(discountAmount)} ({selectedDiscount.percent}%)
            </span>
          </div>
        )}
        <p className="text-amber-400 font-black text-3xl">{formatCurrency(finalTotal)}</p>
      </div>

      {/* Chip row of active discounts */}
      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
        </div>
      ) : discounts.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-6 text-center">
          <Percent className="w-8 h-8 mx-auto text-zinc-700 mb-2" />
          <p className="text-sm text-zinc-500">No discount presets configured.</p>
          <p className="text-xs text-zinc-600 mt-1">
            Admins can add discounts in More → Discounts.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 px-1">
            Discounts
          </p>
          <div className="flex flex-wrap gap-2">
            {discounts.map((d) => {
              const isActive = selectedDiscount?.id === d.id
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onSelect(d)}
                  className={
                    'flex-1 min-w-[120px] h-12 px-4 rounded-lg border text-sm font-medium transition-colors ' +
                    (isActive
                      ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300'
                      : 'border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700')
                  }
                >
                  <div className="flex items-baseline justify-center gap-1.5">
                    <span>{d.name}</span>
                    <span className="text-xs opacity-70">{d.percent}%</span>
                  </div>
                </button>
              )
            })}
          </div>
          {selectedDiscount && (
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="w-full mt-2 h-9 rounded-md text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 flex items-center justify-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" /> Clear discount
            </button>
          )}
        </div>
      )}

      <Button
        onClick={onContinue}
        size="lg"
        className="w-full h-14 text-base font-bold bg-emerald-600 hover:bg-emerald-500"
      >
        Continue to payment
      </Button>
    </div>
  )
}
