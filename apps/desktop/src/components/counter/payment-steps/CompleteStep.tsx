import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  Printer,
  CheckCircle2,
  Truck,
} from 'lucide-react'
import { loadCashDrawerConfig, openCashDrawer } from '@/lib/cash-drawer'
import { toastHelpers } from '@/lib/toast-helpers'
import { useSettingsStore } from '@pos/core'

type SelectedMethod = 'cash' | 'card' | 'digital' | 'cod'

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
  // Auto-kick the cash drawer once per payment when this step is shown for
  // a cash sale and the operator has enabled "open on cash" in settings.
  const drawerKickedRef = useRef(false)
  useEffect(() => {
    if (drawerKickedRef.current) return
    if (selectedMethod !== 'cash') return
    const cfg = loadCashDrawerConfig()
    if (!cfg.enabled || !cfg.autoOpenOnCash) return
    drawerKickedRef.current = true
    // Surface drawer-kick failures so the operator knows the drawer didn't
    // actually pop, instead of silently swallowing the error. The most
    // common cause is the printer name in settings not matching the real
    // OS queue name (e.g., driver rename after update) or the printer
    // being offline.
    openCashDrawer().then((res) => {
      if (!res.ok) {
        console.error('Cash drawer kick failed:', res.error)
        toastHelpers.error('Drawer did not open', res.error || 'Check Settings → Cash drawer.')
      }
    })
  }, [selectedMethod])

  // Auto-print once when CompleteStep mounts, if the operator has enabled
  // "Auto-print receipt" in Settings → Receipts. Number of copies comes
  // from the same settings group and is honoured inside `onPrint` →
  // `printThermalReceipt`. We guard with a ref so React StrictMode's
  // double-effect doesn't double-print.
  const autoPrintedRef = useRef(false)
  const { settings } = useSettingsStore()
  useEffect(() => {
    if (autoPrintedRef.current) return
    if (!selectedMethod) return // payment hasn't completed yet
    if (!settings.autoPrintReceipt) return
    autoPrintedRef.current = true
    onPrint()
  }, [selectedMethod, settings.autoPrintReceipt, onPrint])

  return (
    <div className="w-full max-w-sm space-y-6 text-center">
      {selectedMethod === 'cod' ? (
        <>
          {/* COD Complete Screen */}
          <div className="space-y-2">
            <Truck className="w-16 h-16 mx-auto text-amber-400" />
            <h3 className="text-2xl font-black tracking-tight text-zinc-100">Cash on Delivery</h3>
          </div>

          <div className="space-y-2 text-zinc-400">
            <p className="text-base">Payment will be collected at delivery</p>
            <div className="flex justify-between px-4">
              <span>Amount to Collect</span>
              <span className="font-medium text-zinc-100">{formatCurrency(total)}</span>
            </div>
          </div>
        </>
      ) : selectedMethod === 'cash' ? (
        <>
          {/* Cash Drawer Screen */}
          <div className="space-y-2">
            <CheckCircle2 className="w-16 h-16 mx-auto text-emerald-400" />
            <h3 className="text-2xl font-black tracking-tight text-zinc-100">Payment Complete</h3>
          </div>

          <div className="space-y-1">
            <p className="text-sm text-zinc-400 uppercase tracking-wide">
              Give back to customer
            </p>
            <p className="text-5xl font-bold text-emerald-400">
              {formatCurrency(changeAmount)}
            </p>
          </div>

          <div className="space-y-2 text-zinc-400">
            <div className="flex justify-between px-4">
              <span>Received</span>
              <span className="font-medium text-zinc-100">{formatCurrency(cashReceivedNum)}</span>
            </div>
            <div className="flex justify-between px-4">
              <span>Bill Total</span>
              <span className="font-medium text-zinc-100">{formatCurrency(total)}</span>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Card/Digital Complete Screen */}
          <div className="space-y-2">
            <CheckCircle2 className="w-16 h-16 mx-auto text-emerald-400" />
            <h3 className="text-2xl font-black tracking-tight text-zinc-100">Payment Complete</h3>
          </div>

          <div className="space-y-2 text-zinc-400">
            <div className="flex justify-between px-4">
              <span>Method</span>
              <span className="font-medium text-zinc-100 capitalize">{selectedMethod}</span>
            </div>
            <div className="flex justify-between px-4">
              <span>Amount</span>
              <span className="font-medium text-zinc-100">{formatCurrency(total)}</span>
            </div>
          </div>
        </>
      )}

      <div className="pt-4 space-y-3">
        <Button
          className="w-full h-14 text-lg bg-amber-500 hover:bg-amber-400 font-black tracking-wider text-white"
          size="lg"
          onClick={onPrint}
        >
          <Printer className="w-5 h-5 mr-2" />
          Print
        </Button>

        <button
          onClick={onSkipClose}
          className="text-sm text-zinc-400 hover:text-zinc-100 underline-offset-4 hover:underline"
        >
          Skip & Close
        </button>
      </div>
    </div>
  )
}
