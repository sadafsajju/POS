import { Button } from '@/components/ui/button'
import {
  Printer,
  CheckCircle2,
} from 'lucide-react'

type SelectedMethod = 'cash' | 'card' | 'digital'

interface CompleteStepProps {
  formatCurrency: (amount: number) => string
  total: number
  selectedMethod: SelectedMethod | null
  cashReceivedNum: number
  changeAmount: number
  onPrint: () => void
  onSkipClose: () => void
}

export function CompleteStep({
  formatCurrency,
  total,
  selectedMethod,
  cashReceivedNum,
  changeAmount,
  onPrint,
  onSkipClose,
}: CompleteStepProps) {
  return (
    <div className="w-full max-w-sm space-y-6 text-center">
      {selectedMethod === 'cash' ? (
        <>
          {/* Cash Drawer Screen */}
          <div className="space-y-2">
            <CheckCircle2 className="w-16 h-16 mx-auto text-green-600" />
            <h3 className="text-2xl font-semibold">Payment Complete</h3>
          </div>

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground uppercase tracking-wide">
              Give back to customer
            </p>
            <p className="text-5xl font-bold text-green-600">
              {formatCurrency(changeAmount)}
            </p>
          </div>

          <div className="space-y-2 text-muted-foreground">
            <div className="flex justify-between px-4">
              <span>Received</span>
              <span className="font-medium text-foreground">{formatCurrency(cashReceivedNum)}</span>
            </div>
            <div className="flex justify-between px-4">
              <span>Bill Total</span>
              <span className="font-medium text-foreground">{formatCurrency(total)}</span>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Card/Digital Complete Screen */}
          <div className="space-y-2">
            <CheckCircle2 className="w-16 h-16 mx-auto text-green-600" />
            <h3 className="text-2xl font-semibold">Payment Complete</h3>
          </div>

          <div className="space-y-2 text-muted-foreground">
            <div className="flex justify-between px-4">
              <span>Method</span>
              <span className="font-medium text-foreground capitalize">{selectedMethod}</span>
            </div>
            <div className="flex justify-between px-4">
              <span>Amount</span>
              <span className="font-medium text-foreground">{formatCurrency(total)}</span>
            </div>
          </div>
        </>
      )}

      <div className="pt-4 space-y-3">
        <Button
          className="w-full h-14 text-lg bg-blue-600 hover:bg-blue-700 text-white"
          size="lg"
          onClick={onPrint}
        >
          <Printer className="w-5 h-5 mr-2" />
          Print
        </Button>

        <button
          onClick={onSkipClose}
          className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          Skip & Close
        </button>
      </div>
    </div>
  )
}
