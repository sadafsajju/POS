import { Button } from '@/components/ui/button'
import { NumberPad } from '@/components/ui/number-pad'
import { ArrowLeft } from 'lucide-react'

interface CashAmountStepProps {
  formatCurrency: (amount: number) => string
  total: number
  isProcessing: boolean
  cashReceived: string
  onCashReceivedChange: (value: string) => void
  onPay: () => void
  onBack: () => void
}

export function CashAmountStep({
  formatCurrency,
  total,
  isProcessing,
  cashReceived,
  onCashReceivedChange,
  onPay,
  onBack,
}: CashAmountStepProps) {
  const cashReceivedNum = parseFloat(cashReceived) || 0
  const changeAmount = cashReceivedNum > total ? cashReceivedNum - total : 0
  const canContinue = cashReceivedNum >= total

  const quickAmounts = [
    total,
    Math.ceil(total / 10) * 10,
    Math.ceil(total / 100) * 100,
    Math.ceil(total / 500) * 500,
  ].filter((v, i, a) => a.indexOf(v) === i && v >= total)

  return (
    <div className="w-full max-w-sm flex flex-col gap-4">
      <button
        onClick={onBack}
        className="w-12 h-12 rounded-full border border-border bg-background flex items-center justify-center hover:bg-accent active:scale-95 transition-all"
      >
        <ArrowLeft className="w-6 h-6" />
      </button>

      {/* Amount display */}
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-muted-foreground text-xs uppercase tracking-wide">Total Due</p>
          <p className="text-2xl font-bold mt-0.5">{formatCurrency(total)}</p>
        </div>
        {canContinue && changeAmount > 0 && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Change</p>
            <p className="text-2xl font-bold text-green-600 mt-0.5">{formatCurrency(changeAmount)}</p>
          </div>
        )}
      </div>

      <div className="w-full h-16 px-6 rounded-lg border-2 border-input bg-background flex items-center justify-center">
        <span className={`text-3xl font-bold ${cashReceived ? 'text-foreground' : 'text-muted-foreground'}`}>
          {cashReceived ? formatCurrency(parseFloat(cashReceived) || 0) : '0.00'}
        </span>
      </div>

      {/* Quick Amounts */}
      <div className="flex gap-2 flex-wrap">
        {quickAmounts.map((amount) => (
          <Button
            key={amount}
            variant="outline"
            className="flex-1 min-w-[80px] h-10 text-sm"
            onClick={() => onCashReceivedChange(amount.toString())}
          >
            {formatCurrency(amount)}
          </Button>
        ))}
      </div>

      {/* Inline Number Pad */}
      <NumberPad
        value={cashReceived}
        onValueChange={onCashReceivedChange}
        maxDigits={10}
        maxDecimals={2}
      />

      {/* Pay button */}
      <Button
        className="w-full h-14 text-lg"
        size="lg"
        onClick={onPay}
        disabled={!canContinue || isProcessing}
      >
        {isProcessing ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
            Processing...
          </>
        ) : (
          'Continue'
        )}
      </Button>
    </div>
  )
}
