import { useState, useEffect, useRef, useCallback } from 'react'
import { useCustomerDisplayReceiver } from '@pos/core'
import type { CustomerDisplayState, DisplayCartItem } from '@pos/core'
import { ShoppingBag, Clock, CreditCard, CheckCircle2 } from 'lucide-react'
import { imageUrl } from '@/lib/utils'
import { getSupabase } from '@pos/supabase'

interface PublicPromo {
  id: string
  title: string | null
  media_type: 'image' | 'video'
  file_url: string
  display_order: number
  duration_seconds: number
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

// --- Clock Overlay ---

function ClockOverlay() {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const hours = time.getHours()
  const minutes = time.getMinutes().toString().padStart(2, '0')
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12

  return (
    <div className="absolute top-6 right-6 z-10 flex items-center gap-2 px-4 py-2 rounded-full bg-black/50 backdrop-blur-sm">
      <Clock className="w-4 h-4 text-zinc-400" />
      <span className="text-sm font-mono tracking-widest text-zinc-300">
        {displayHours}:{minutes} {period}
      </span>
    </div>
  )
}

// --- Promo Carousel ---

function PromoCarousel({ promos }: { promos: PublicPromo[] }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [fadeIn, setFadeIn] = useState(true)
  const videoRef = useRef<HTMLVideoElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  const isSingle = promos.length === 1

  const advanceSlide = useCallback(() => {
    if (isSingle) return
    setFadeIn(false)
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % promos.length)
      setFadeIn(true)
    }, 500) // crossfade duration
  }, [promos.length, isSingle])

  const current = promos[currentIndex]

  useEffect(() => {
    if (!current || isSingle) return

    if (current.media_type === 'image') {
      const duration = (current.duration_seconds || 5) * 1000
      timerRef.current = setTimeout(advanceSlide, duration)
    }
    // For video, we advance on 'ended' event

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [currentIndex, current, advanceSlide, isSingle])

  // Reset to first slide if promos change
  useEffect(() => {
    setCurrentIndex(0)
    setFadeIn(true)
  }, [promos])

  if (!current) return null

  const mediaUrl = imageUrl(current.file_url)

  return (
    <div className="relative w-full h-full overflow-hidden bg-black">
      <ClockOverlay />

      <div
        className={`absolute inset-0 ${
          isSingle ? '' : `transition-opacity duration-500 ${fadeIn ? 'opacity-100' : 'opacity-0'}`
        }`}
      >
        {current.media_type === 'video' ? (
          <video
            ref={videoRef}
            key={current.id}
            src={mediaUrl}
            className="w-full h-full object-contain"
            autoPlay
            muted
            loop={isSingle}
            playsInline
            onEnded={isSingle ? undefined : advanceSlide}
          />
        ) : (
          <img
            key={current.id}
            src={mediaUrl}
            alt={current.title || ''}
            className="w-full h-full object-contain"
          />
        )}
      </div>

      {/* Slide indicator dots */}
      {promos.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
          {promos.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                i === currentIndex
                  ? 'bg-white w-6'
                  : 'bg-white/40'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// --- Idle Screen ---

function IdleScreen() {
  const [promos, setPromos] = useState<PublicPromo[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false

    const fetchPromos = async () => {
      try {
        const sb = getSupabase()
        const { data, error } = await sb
          .from('promos')
          .select('id, title, media_type, file_url, display_order, duration_seconds')
          .eq('is_active', true)
          .order('display_order')
        if (!cancelled && !error && Array.isArray(data) && data.length > 0) {
          setPromos(data as unknown as PublicPromo[])
        }
      } catch {
        // Silently fail — show fallback
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }

    fetchPromos()
    // Refresh promos every 2 minutes
    const interval = setInterval(fetchPromos, 2 * 60 * 1000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  // Show carousel if promos available
  if (loaded && promos.length > 0) {
    return <PromoCarousel promos={promos} />
  }

  // Fallback welcome screen
  return <WelcomeScreen />
}

function WelcomeScreen() {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const hours = time.getHours()
  const minutes = time.getMinutes().toString().padStart(2, '0')
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 animate-in fade-in duration-500">
      {/* Clock */}
      <div className="flex items-center gap-3 text-zinc-500">
        <Clock className="w-5 h-5" />
        <span className="text-xl font-mono tracking-widest">
          {displayHours}:{minutes} {period}
        </span>
      </div>

      {/* Welcome */}
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-black tracking-tight text-zinc-100">
          Welcome
        </h1>
        <p className="text-xl text-zinc-400">
          Your order will appear here
        </p>
      </div>

      {/* Decorative icon */}
      <div className="mt-8 p-6 rounded-full bg-zinc-800/50 border border-zinc-700/50">
        <ShoppingBag className="w-12 h-12 text-zinc-600" />
      </div>
    </div>
  )
}

// --- Cart View ---

function CartView({ state }: { state: CustomerDisplayState }) {
  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      {/* Header */}
      <div className="px-8 pt-8 pb-4">
        <div className="flex items-center gap-3">
          <ShoppingBag className="w-6 h-6 text-amber-400" />
          <h2 className="text-2xl font-bold text-zinc-100">Your Order</h2>
          <span className="ml-auto text-sm text-zinc-500">
            {state.items.length} {state.items.length === 1 ? 'item' : 'items'}
          </span>
        </div>
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto px-8">
        <div className="space-y-1">
          {state.items.map((item: DisplayCartItem, idx: number) => (
            <div
              key={idx}
              className="flex items-center justify-between py-3 border-b border-zinc-800/70 last:border-0"
            >
              <div className="flex-1 min-w-0">
                <p className="text-lg text-zinc-100 truncate">{item.name}</p>
                {item.quantity > 1 && (
                  <p className="text-sm text-zinc-500">
                    {formatCurrency(item.unitPrice)} each
                  </p>
                )}
              </div>
              <div className="flex items-center gap-6 ml-4">
                <span className="text-zinc-400 text-lg tabular-nums">
                  x{item.quantity}
                </span>
                <span className="text-lg font-semibold text-zinc-100 tabular-nums w-24 text-right">
                  {formatCurrency(item.lineTotal)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Totals */}
      <div className="px-8 py-6 border-t border-zinc-800 bg-zinc-900/50 space-y-2">
        <div className="flex justify-between text-zinc-400">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatCurrency(state.subtotal)}</span>
        </div>
        {state.tax > 0 && (
          <div className="flex justify-between text-zinc-400">
            <span>Tax</span>
            <span className="tabular-nums">{formatCurrency(state.tax)}</span>
          </div>
        )}
        <div className="flex justify-between items-center pt-2 border-t border-zinc-700">
          <span className="text-2xl font-bold text-zinc-100">Total</span>
          <span className="text-3xl font-black text-amber-400 tabular-nums">
            {formatCurrency(state.total)}
          </span>
        </div>
      </div>
    </div>
  )
}

// --- Payment View ---

function PaymentProcessing({ state }: { state: CustomerDisplayState }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 animate-in fade-in duration-300">
      <div className="p-6 rounded-full bg-blue-500/10 border border-blue-500/20">
        <CreditCard className="w-16 h-16 text-blue-400 animate-pulse" />
      </div>
      <h2 className="text-3xl font-bold text-zinc-100">Processing Payment</h2>
      <p className="text-xl text-zinc-400">
        {formatCurrency(state.total)}
      </p>
      {state.paymentMethod && (
        <span className="px-4 py-1.5 rounded-full bg-zinc-800 text-zinc-300 text-sm capitalize">
          {state.paymentMethod}
        </span>
      )}
    </div>
  )
}

function PaymentComplete({ state }: { state: CustomerDisplayState }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 animate-in fade-in duration-300">
      <div className="p-6 rounded-full bg-emerald-500/10 border border-emerald-500/20">
        <CheckCircle2 className="w-16 h-16 text-emerald-400" />
      </div>
      <h2 className="text-4xl font-black text-zinc-100">Thank You!</h2>
      <p className="text-xl text-zinc-400">
        Payment of {formatCurrency(state.total)} received
      </p>
      {state.changeAmount != null && state.changeAmount > 0 && (
        <div className="mt-2 px-6 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <p className="text-lg text-amber-400">
            Change: <span className="font-bold text-xl">{formatCurrency(state.changeAmount)}</span>
          </p>
        </div>
      )}
    </div>
  )
}

// --- Main Component ---

export function CustomerDisplay() {
  const state = useCustomerDisplayReceiver()

  // Auto-return to idle 8 seconds after payment complete
  const [showComplete, setShowComplete] = useState(false)

  useEffect(() => {
    if (state.mode === 'payment-complete') {
      setShowComplete(true)
      const timer = setTimeout(() => setShowComplete(false), 8000)
      return () => clearTimeout(timer)
    } else {
      setShowComplete(false)
    }
  }, [state.mode])

  const effectiveMode = state.mode === 'payment-complete' && !showComplete ? 'idle' : state.mode

  return (
    <div className="h-screen bg-zinc-950 text-zinc-100 flex flex-col select-none">
      {effectiveMode === 'idle' && <IdleScreen />}
      {effectiveMode === 'cart' && <CartView state={state} />}
      {effectiveMode === 'payment-processing' && <PaymentProcessing state={state} />}
      {effectiveMode === 'payment-complete' && <PaymentComplete state={state} />}
    </div>
  )
}
