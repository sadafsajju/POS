import { useSettingsStore } from '@pos/core'
import { useKioskStore } from '../store/kiosk-store'

export function WelcomeScreen() {
  const { settings } = useSettingsStore()
  const setStep = useKioskStore((s) => s.setStep)

  return (
    <div
      className="h-full flex flex-col items-center justify-center relative overflow-hidden cursor-pointer"
      onClick={() => setStep('order-type')}
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-500/5 via-transparent to-transparent" />

      {/* Content */}
      <div className="relative z-10 text-center space-y-8 px-8">
        {/* Restaurant logo placeholder */}
        <div className="w-28 h-28 mx-auto bg-gradient-to-br from-amber-500 to-amber-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-amber-500/20">
          <span className="text-5xl font-black text-white">
            {(settings.restaurantName || 'R').charAt(0).toUpperCase()}
          </span>
        </div>

        {/* Restaurant name */}
        <div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-zinc-100">
            {settings.restaurantName || 'Restaurant'}
          </h1>
          <p className="text-lg md:text-xl text-zinc-400 mt-3">
            Self-Order Kiosk
          </p>
        </div>

        {/* CTA Button */}
        <button className="mt-8 px-12 py-5 bg-amber-500 hover:bg-amber-400 text-white text-xl md:text-2xl font-bold rounded-2xl transition-all duration-200 shadow-lg shadow-amber-500/25 hover:shadow-amber-400/30 hover:scale-[1.02] active:scale-[0.98] animate-pulse">
          Tap to Start Order
        </button>
      </div>

      {/* Bottom hint */}
      <div className="absolute bottom-8 left-0 right-0 text-center">
        <p className="text-sm text-zinc-600">Touch anywhere to begin</p>
      </div>
    </div>
  )
}
