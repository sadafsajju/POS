import { useEffect, useCallback, useRef, useState } from 'react'
import { useSettingsStore } from '@pos/core'
import { useKioskStore } from './store/kiosk-store'
import { WelcomeScreen } from './screens/WelcomeScreen'
import { OrderTypeScreen } from './screens/OrderTypeScreen'
import { MenuScreen } from './screens/MenuScreen'
import { CartScreen } from './screens/CartScreen'
import { PaymentScreen } from './screens/PaymentScreen'
import { ConfirmationScreen } from './screens/ConfirmationScreen'
import { IdleTimeoutModal } from './components/IdleTimeoutModal'

const IDLE_TIMEOUT = 120 // seconds before showing warning
const WARNING_DURATION = 15 // seconds of warning before reset

export function KioskApp() {
  const { fetchSettings } = useSettingsStore()
  const step = useKioskStore((s) => s.step)
  const lastInteraction = useKioskStore((s) => s.lastInteraction)
  const resetSession = useKioskStore((s) => s.resetSession)
  const touchInteraction = useKioskStore((s) => s.touchInteraction)

  const [showIdleWarning, setShowIdleWarning] = useState(false)
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null)
  const idleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Check if there's a valid auth token
  useEffect(() => {
    try {
      const storedAuth = localStorage.getItem('pos-auth')
      if (storedAuth) {
        const parsed = JSON.parse(storedAuth)
        setIsAuthed(!!parsed.state?.token)
      } else {
        setIsAuthed(false)
      }
    } catch {
      setIsAuthed(false)
    }
  }, [])

  // Fetch settings on mount
  useEffect(() => {
    if (isAuthed) {
      fetchSettings()
    }
  }, [isAuthed, fetchSettings])

  // Idle timer — only active when not on welcome/confirmation
  useEffect(() => {
    if (step === 'welcome' || step === 'confirmation') {
      setShowIdleWarning(false)
      return
    }

    idleTimerRef.current = setInterval(() => {
      const elapsed = (Date.now() - lastInteraction) / 1000
      if (elapsed >= IDLE_TIMEOUT && !showIdleWarning) {
        setShowIdleWarning(true)
      }
    }, 1000)

    return () => {
      if (idleTimerRef.current) clearInterval(idleTimerRef.current)
    }
  }, [step, lastInteraction, showIdleWarning])

  const handleIdleContinue = useCallback(() => {
    setShowIdleWarning(false)
    touchInteraction()
  }, [touchInteraction])

  const handleIdleTimeout = useCallback(() => {
    setShowIdleWarning(false)
    resetSession()
  }, [resetSession])

  // Global touch listener to reset idle timer
  const handleGlobalTouch = useCallback(() => {
    touchInteraction()
  }, [touchInteraction])

  if (isAuthed === null) {
    return (
      <div className="h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAuthed) {
    return (
      <div className="h-screen bg-zinc-950 flex items-center justify-center text-zinc-100">
        <div className="text-center space-y-4 max-w-md px-6">
          <div className="w-20 h-20 mx-auto bg-zinc-800 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">Kiosk Not Configured</h1>
          <p className="text-zinc-400">
            Please log in from the POS admin panel first, then open this kiosk page.
          </p>
        </div>
      </div>
    )
  }

  const renderScreen = () => {
    switch (step) {
      case 'welcome':
        return <WelcomeScreen />
      case 'order-type':
        return <OrderTypeScreen />
      case 'menu':
        return <MenuScreen />
      case 'cart':
        return <CartScreen />
      case 'payment':
        return <PaymentScreen />
      case 'confirmation':
        return <ConfirmationScreen />
      default:
        return <WelcomeScreen />
    }
  }

  return (
    <div
      className="h-screen overflow-hidden bg-zinc-950 text-zinc-100 select-none"
      onPointerDown={handleGlobalTouch}
    >
      {renderScreen()}

      {showIdleWarning && (
        <IdleTimeoutModal
          duration={WARNING_DURATION}
          onContinue={handleIdleContinue}
          onTimeout={handleIdleTimeout}
        />
      )}
    </div>
  )
}
