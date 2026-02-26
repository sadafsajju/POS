import { ShoppingCart } from 'lucide-react'
import { useKioskStore } from '../store/kiosk-store'

interface CartFloatingButtonProps {
  formatCurrency: (amount: number) => string
}

export function CartFloatingButton({ formatCurrency }: CartFloatingButtonProps) {
  const getItemCount = useKioskStore((s) => s.getItemCount)
  const getSubtotal = useKioskStore((s) => s.getSubtotal)
  const setStep = useKioskStore((s) => s.setStep)

  const count = getItemCount()
  const subtotal = getSubtotal()

  if (count === 0) return null

  return (
    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-zinc-950 via-zinc-950/95 to-transparent pointer-events-none">
      <button
        onClick={() => setStep('cart')}
        className="pointer-events-auto w-full flex items-center justify-between px-6 py-4 bg-amber-500 hover:bg-amber-400 text-white rounded-2xl shadow-xl shadow-amber-500/25 transition-all active:scale-[0.98]"
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <ShoppingCart className="w-6 h-6" />
            <span className="absolute -top-2 -right-2 bg-white text-amber-600 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center">
              {count}
            </span>
          </div>
          <span className="text-lg font-bold">View Cart</span>
        </div>
        <span className="text-lg font-bold">{formatCurrency(subtotal)}</span>
      </button>
    </div>
  )
}
