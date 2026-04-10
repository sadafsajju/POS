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
}

export function MethodStep({
  formatCurrency,
  total,
  isProcessing,
  selectedMethod,
  onMethodSelect,
  onBack,
  isDelivery,
}: MethodStepProps) {
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
          <p className="text-amber-400 font-black text-3xl mt-2">{formatCurrency(total)}</p>
        </div>
        </div>

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
