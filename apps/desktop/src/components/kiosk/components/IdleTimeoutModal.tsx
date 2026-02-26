import { useState, useEffect } from 'react'

interface IdleTimeoutModalProps {
  duration: number // seconds
  onContinue: () => void
  onTimeout: () => void
}

export function IdleTimeoutModal({ duration, onContinue, onTimeout }: IdleTimeoutModalProps) {
  const [remaining, setRemaining] = useState(duration)

  useEffect(() => {
    if (remaining <= 0) {
      onTimeout()
      return
    }

    const timer = setTimeout(() => setRemaining((r) => r - 1), 1000)
    return () => clearTimeout(timer)
  }, [remaining, onTimeout])

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100]">
      <div className="bg-zinc-900 rounded-3xl p-10 max-w-md text-center space-y-6 border border-zinc-700">
        {/* Countdown circle */}
        <div className="w-24 h-24 mx-auto relative">
          <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
            <circle cx="48" cy="48" r="42" fill="none" stroke="#27272a" strokeWidth="6" />
            <circle
              cx="48"
              cy="48"
              r="42"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 42}
              strokeDashoffset={2 * Math.PI * 42 * (1 - remaining / duration)}
              className="transition-all duration-1000 ease-linear"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-3xl font-bold text-amber-500">
            {remaining}
          </span>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-zinc-100">Are you still there?</h2>
          <p className="text-zinc-400 mt-2">
            Your session will reset in {remaining} seconds
          </p>
        </div>

        <button
          onClick={onContinue}
          className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-white text-lg font-bold rounded-xl transition-colors active:scale-[0.98]"
        >
          Yes, I'm still here
        </button>
      </div>
    </div>
  )
}
