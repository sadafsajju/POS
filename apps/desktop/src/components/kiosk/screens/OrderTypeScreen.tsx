import { UtensilsCrossed, ShoppingBag, ArrowLeft } from 'lucide-react'
import { useKioskStore } from '../store/kiosk-store'
import type { KioskOrderType } from '../store/kiosk-store'

export function OrderTypeScreen() {
  const setStep = useKioskStore((s) => s.setStep)
  const setOrderType = useKioskStore((s) => s.setOrderType)
  const resetSession = useKioskStore((s) => s.resetSession)

  const handleSelect = (type: KioskOrderType) => {
    setOrderType(type)
    setStep('menu')
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center px-6 py-4 border-b border-zinc-800">
        <button
          onClick={resetSession}
          className="p-3 rounded-xl hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="flex-1 text-center text-2xl font-bold pr-12">How would you like your order?</h1>
      </div>

      {/* Options */}
      <div className="flex-1 flex items-center justify-center gap-8 px-8">
        <button
          onClick={() => handleSelect('dine_in')}
          className="group flex flex-col items-center gap-6 p-12 rounded-3xl border-2 border-zinc-800 hover:border-amber-500 hover:bg-amber-500/5 transition-all duration-200 w-72 active:scale-[0.97]"
        >
          <div className="w-24 h-24 rounded-2xl bg-zinc-800 group-hover:bg-amber-500/10 flex items-center justify-center transition-colors">
            <UtensilsCrossed className="w-12 h-12 text-zinc-400 group-hover:text-amber-500 transition-colors" />
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-bold">Dine In</h2>
            <p className="text-zinc-400 mt-2">Eat at the restaurant</p>
          </div>
        </button>

        <button
          onClick={() => handleSelect('takeout')}
          className="group flex flex-col items-center gap-6 p-12 rounded-3xl border-2 border-zinc-800 hover:border-amber-500 hover:bg-amber-500/5 transition-all duration-200 w-72 active:scale-[0.97]"
        >
          <div className="w-24 h-24 rounded-2xl bg-zinc-800 group-hover:bg-amber-500/10 flex items-center justify-center transition-colors">
            <ShoppingBag className="w-12 h-12 text-zinc-400 group-hover:text-amber-500 transition-colors" />
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-bold">Takeout</h2>
            <p className="text-zinc-400 mt-2">Order to go</p>
          </div>
        </button>
      </div>
    </div>
  )
}
