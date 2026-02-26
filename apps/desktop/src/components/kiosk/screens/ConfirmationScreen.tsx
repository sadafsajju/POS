import { useEffect, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { useKioskStore } from '../store/kiosk-store'

const AUTO_RESET_SECONDS = 10

export function ConfirmationScreen() {
  const createdOrder = useKioskStore((s) => s.createdOrder)
  const orderType = useKioskStore((s) => s.orderType)
  const resetSession = useKioskStore((s) => s.resetSession)

  const [countdown, setCountdown] = useState(AUTO_RESET_SECONDS)

  // Auto-reset timer
  useEffect(() => {
    if (countdown <= 0) {
      resetSession()
      return
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown, resetSession])

  const tokenNumber = createdOrder?.token_number
  const displayNumber = tokenNumber != null
    ? String(tokenNumber).padStart(4, '0')
    : createdOrder?.order_number || '---'

  return (
    <div className="h-full flex flex-col items-center justify-center gap-8 px-8">
      {/* Success animation */}
      <div className="relative">
        <div className="w-32 h-32 bg-emerald-500/10 rounded-full flex items-center justify-center animate-in zoom-in duration-500">
          <CheckCircle2 className="w-20 h-20 text-emerald-500" />
        </div>
        {/* Pulse ring */}
        <div className="absolute inset-0 w-32 h-32 bg-emerald-500/10 rounded-full animate-ping" />
      </div>

      {/* Message */}
      <div className="text-center space-y-3">
        <h1 className="text-4xl font-black text-zinc-100">Order Placed!</h1>
        <p className="text-xl text-zinc-400">Thank you for your order</p>
      </div>

      {/* Token number */}
      <div className="bg-zinc-900 border-2 border-zinc-700 rounded-2xl px-12 py-6 text-center">
        <p className="text-sm text-zinc-400 uppercase tracking-wider font-semibold">Your Token Number</p>
        <p className="text-5xl font-black text-amber-500 mt-2 tabular-nums">{displayNumber}</p>
      </div>

      {/* Order type message */}
      <div className="text-center">
        {orderType === 'dine_in' ? (
          <p className="text-lg text-zinc-300">Please find a seat. We'll call your number when ready.</p>
        ) : (
          <p className="text-lg text-zinc-300">Please wait at the counter for your order.</p>
        )}
      </div>

      {/* New order button */}
      <button
        onClick={resetSession}
        className="px-10 py-4 bg-amber-500 hover:bg-amber-400 text-white text-lg font-bold rounded-xl transition-colors active:scale-[0.98]"
      >
        Place Another Order
      </button>

      {/* Auto-reset countdown */}
      <p className="text-sm text-zinc-600">
        Returning to start in {countdown}s
      </p>
    </div>
  )
}
