import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  Banknote,
  CreditCard,
  QrCode,
} from 'lucide-react'

type SelectedMethod = 'cash' | 'card' | 'digital'

interface MethodStepProps {
  formatCurrency: (amount: number) => string
  total: number
  isProcessing: boolean
  selectedMethod: SelectedMethod | null
  onMethodSelect: (method: SelectedMethod) => void
  onBack: () => void
}

export function MethodStep({
  formatCurrency,
  total,
  isProcessing,
  selectedMethod,
  onMethodSelect,
  onBack,
}: MethodStepProps) {
  return (
    <div className="w-full max-w-sm space-y-6">
      <button
        onClick={onBack}
        className="w-12 h-12 rounded-full border border-border bg-background flex items-center justify-center hover:bg-accent active:scale-95 transition-all"
      >
        <ArrowLeft className="w-6 h-6" />
      </button>

      <div className="text-center mb-2">
        <h3 className="text-2xl font-semibold">How is the customer paying?</h3>
        <div className=' rounded bg-muted/50 py-3 my-3'>
          <p className="text-primary font-bold text-3xl mt-2">{formatCurrency(total)}</p>
        </div>
        </div>

      <Button
        className="w-full h-20 text-xl justify-start px-8 gap-4"
        variant="outline"
        size="lg"
        onClick={() => onMethodSelect('cash')}
        disabled={isProcessing}
      >
        <Banknote className="w-8 h-8" />
        Cash
      </Button>

      <Button
        className="w-full h-20 text-xl justify-start px-8 gap-4"
        variant="outline"
        size="lg"
        onClick={() => onMethodSelect('card')}
        disabled={isProcessing}
      >
        {isProcessing && selectedMethod === 'card' ? (
          <>
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
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
        className="w-full h-20 text-xl justify-start px-8 gap-4"
        variant="outline"
        size="lg"
        onClick={() => onMethodSelect('digital')}
        disabled={isProcessing}
      >
        {isProcessing && selectedMethod === 'digital' ? (
          <>
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
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
