import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  Banknote,
  CreditCard,
  QrCode,
  Truck,
} from 'lucide-react'

type SelectedMethod = 'cash' | 'card' | 'digital' | 'cod'

interface MethodStepProps {
  formatCurrency: (amount: number) => string
  total: number
  isProcessing: boolean
  selectedMethod: SelectedMethod | null
  onMethodSelect: (method: SelectedMethod) => void
  onBack: () => void
  isDelivery?: boolean
  /** When true, render the tip presets row above the methods. */
  tipEnabled?: boolean
  /** Current tip amount in major units. */
  tipAmount?: number
  onTipChange?: (next: number) => void
}

const TIP_PRESETS = [10, 12.5, 15, 20] as const

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function MethodStep({
  formatCurrency,
  total,
  isProcessing,
  selectedMethod,
  onMethodSelect,
  onBack,
  isDelivery,
  tipEnabled = false,
  tipAmount = 0,
  onTipChange,
}: MethodStepProps) {
  const [customTipOpen, setCustomTipOpen] = useState(false)
  const [customTipInput, setCustomTipInput] = useState('')

  const grandTotal = total + (tipEnabled ? tipAmount : 0)
  const activePreset = TIP_PRESETS.find(p => Math.abs(round2(total * p / 100) - tipAmount) < 0.01) ?? null
  return (
    <div className="w-full max-w-sm space-y-6">
      <button
        onClick={onBack}
        className="w-12 h-12 rounded-full border border-zinc-700 bg-zinc-800 flex items-center justify-center hover:bg-zinc-700 active:scale-95 transition-all"
      >
        <ArrowLeft className="w-6 h-6 text-zinc-100" />
      </button>

      <div className="text-center mb-2">
        <h3 className="text-2xl font-black tracking-tight text-zinc-100">How is the customer paying?</h3>
        <div className=' rounded bg-zinc-800 py-3 my-3'>
          {tipEnabled && tipAmount > 0 && (
            <div className="text-xs text-zinc-500 mb-1 flex justify-center gap-3">
              <span>Subtotal {formatCurrency(total)}</span>
              <span className="text-emerald-400">+ tip {formatCurrency(tipAmount)}</span>
            </div>
          )}
          <p className="text-amber-400 font-black text-3xl mt-2">{formatCurrency(grandTotal)}</p>
        </div>
        </div>

      {tipEnabled && onTipChange && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Tip</span>
            {tipAmount > 0 && (
              <button
                type="button"
                onClick={() => { onTipChange(0); setCustomTipOpen(false); setCustomTipInput('') }}
                className="text-xs text-zinc-500 hover:text-zinc-300"
              >
                Clear
              </button>
            )}
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {TIP_PRESETS.map(p => {
              const isActive = activePreset === p
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => { onTipChange(round2(total * p / 100)); setCustomTipOpen(false); setCustomTipInput('') }}
                  disabled={isProcessing}
                  className={`h-10 text-sm rounded-md border transition-colors ${
                    isActive
                      ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300'
                      : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  {p}%
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => setCustomTipOpen(o => !o)}
              disabled={isProcessing}
              className={`h-10 text-sm rounded-md border transition-colors ${
                customTipOpen || (tipAmount > 0 && activePreset === null)
                  ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300'
                  : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              Custom
            </button>
          </div>
          {customTipOpen && (
            <div className="flex gap-2 pt-1">
              <input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={customTipInput}
                onChange={(e) => setCustomTipInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const v = parseFloat(customTipInput) || 0
                    onTipChange(round2(v))
                    setCustomTipOpen(false)
                  }
                }}
                placeholder="Enter amount"
                autoFocus
                className="flex-1 h-9 px-3 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              />
              <Button
                size="sm"
                className="h-9 bg-emerald-600 hover:bg-emerald-500 text-white"
                onClick={() => {
                  const v = parseFloat(customTipInput) || 0
                  onTipChange(round2(v))
                  setCustomTipOpen(false)
                }}
              >
                Set
              </Button>
            </div>
          )}
        </div>
      )}

      {/* COD option — delivery only, shown first */}
      {isDelivery && (
        <Button
          className="w-full h-20 text-xl justify-start px-8 gap-4 border-amber-600 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20"
          variant="outline"
          size="lg"
          onClick={() => onMethodSelect('cod')}
          disabled={isProcessing}
        >
          {isProcessing && selectedMethod === 'cod' ? (
            <>
              <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Truck className="w-8 h-8" />
              Cash on Delivery
            </>
          )}
        </Button>
      )}

      <Button
        className="w-full h-20 text-xl justify-start px-8 gap-4 border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
        variant="outline"
        size="lg"
        onClick={() => onMethodSelect('cash')}
        disabled={isProcessing}
      >
        <Banknote className="w-8 h-8" />
        Cash
      </Button>

      <Button
        className="w-full h-20 text-xl justify-start px-8 gap-4 border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
        variant="outline"
        size="lg"
        onClick={() => onMethodSelect('card')}
        disabled={isProcessing}
      >
        {isProcessing && selectedMethod === 'card' ? (
          <>
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <CreditCard className="w-8 h-8" />
            Card
          </>
        )}
      </Button>

      <Button
        className="w-full h-20 text-xl justify-start px-8 gap-4 border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
        variant="outline"
        size="lg"
        onClick={() => onMethodSelect('digital')}
        disabled={isProcessing}
      >
        {isProcessing && selectedMethod === 'digital' ? (
          <>
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <QrCode className="w-8 h-8" />
            Digital
          </>
        )}
      </Button>
    </div>
  )
}
