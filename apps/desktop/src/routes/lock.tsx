import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback } from 'react'
import { NumberPad } from '@/components/ui/number-pad'
import { authApi } from '@pos/api-client'
import { useAuthStore } from '@pos/core'
import { Lock, Loader2, LogOut, ShieldCheck, Clock } from 'lucide-react'

export const Route = createFileRoute('/lock')({
  component: LockScreen,
})

const roleColors: Record<string, string> = {
  admin: 'from-red-400 to-red-600',
  manager: 'from-purple-400 to-purple-600',
  server: 'from-blue-400 to-blue-600',
  counter: 'from-emerald-400 to-emerald-600',
  kitchen: 'from-orange-400 to-orange-600',
}

const roleLabels: Record<string, string> = {
  admin: 'Administrator',
  manager: 'Manager',
  server: 'Server',
  counter: 'Counter Staff',
  kitchen: 'Kitchen Staff',
}

function LockScreen() {
  const { user, isAuthenticated, isLocked, unlock, logout, _hasHydrated, isLoading } = useAuthStore()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)

  // Wait for hydration
  if (!_hasHydrated || isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-600" />
      </div>
    )
  }

  // Not authenticated — go to login
  if (!isAuthenticated || !user) {
    window.location.href = '/login'
    return null
  }

  // Not locked — go to appropriate page
  if (!isLocked) {
    window.location.href = user.role === 'admin' ? '/admin/pos' : '/'
    return null
  }

  const handlePinChange = useCallback((value: string) => {
    // Limit to 4 digits
    if (value.length > 4) return
    setPin(value)
    setError('')
    if (value.length === 4) {
      handleVerify(value)
    }
  }, [])

  const handleVerify = async (pinValue: string) => {
    setIsVerifying(true)
    setError('')
    try {
      const response = await authApi.verifyPin(pinValue)
      if (response.success) {
        unlock()
        window.location.href = user.role === 'admin' ? '/admin/pos' : '/'
      } else {
        setError(response.message || 'Invalid PIN')
        setPin('')
      }
    } catch {
      setError('Failed to verify PIN')
      setPin('')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleSignOut = () => {
    logout()
    window.location.href = '/login'
  }

  const gradient = roleColors[user.role] || 'from-zinc-400 to-zinc-600'
  const now = new Date()
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const dateStr = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-zinc-950">
      {/* Left Panel — Visual / User Identity */}
      <div className="hidden lg:flex flex-col justify-between bg-zinc-900 p-10 relative overflow-hidden">
        {/* Decorative gradient blob */}
        <div className={`absolute -top-32 -left-32 w-96 h-96 rounded-full bg-gradient-to-br ${gradient} opacity-[0.07] blur-3xl`} />
        <div className={`absolute -bottom-32 -right-32 w-80 h-80 rounded-full bg-gradient-to-br ${gradient} opacity-[0.05] blur-3xl`} />

        {/* Top — Lock status */}
        <div className="flex items-center gap-3 text-zinc-500 relative z-10">
          <div className="w-9 h-9 rounded-lg bg-zinc-800 border border-zinc-700/50 flex items-center justify-center">
            <Lock className="w-4 h-4" />
          </div>
          <span className="text-sm font-medium">Session Locked</span>
        </div>

        {/* Center — User identity */}
        <div className="flex flex-col items-center gap-6 relative z-10">
          <div className={`w-28 h-28 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center shadow-2xl ring-4 ring-zinc-800`}>
            <span className="text-4xl font-bold text-white">
              {user.first_name[0]}{user.last_name[0]}
            </span>
          </div>
          <div className="text-center space-y-1.5">
            <h2 className="text-2xl font-bold text-zinc-100">
              {user.first_name} {user.last_name}
            </h2>
            <p className="text-sm text-zinc-500 capitalize">
              {roleLabels[user.role] || user.role}
            </p>
          </div>
        </div>

        {/* Bottom — Time display */}
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2 text-zinc-600">
            <Clock className="w-4 h-4" />
            <span className="text-sm">{timeStr}</span>
            <span className="text-zinc-700">·</span>
            <span className="text-sm">{dateStr}</span>
          </div>
          <div className="flex items-center gap-2 text-zinc-700">
            <ShieldCheck className="w-4 h-4" />
            <span className="text-xs">Secured</span>
          </div>
        </div>
      </div>

      {/* Right Panel — PIN Entry */}
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-8 text-center">
          {/* Mobile only — user avatar (hidden on lg) */}
          <div className="lg:hidden space-y-3">
            <div className={`h-20 w-20 mx-auto rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}>
              <span className="text-2xl font-bold text-white">
                {user.first_name[0]}{user.last_name[0]}
              </span>
            </div>
            <div>
              <p className="text-lg font-semibold text-zinc-100">
                {user.first_name} {user.last_name}
              </p>
              <p className="text-sm text-zinc-500 capitalize">{user.role}</p>
            </div>
          </div>

          {/* Lock icon + heading */}
          <div className="space-y-3">
            <div className="hidden lg:flex justify-center">
              <div className="w-14 h-14 rounded-full bg-zinc-800 border border-zinc-700/50 flex items-center justify-center">
                <Lock className="w-6 h-6 text-zinc-400" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-zinc-100 hidden lg:block">Welcome back</h1>
              <p className="text-sm text-zinc-500 mt-1">Enter your 4-digit PIN to unlock</p>
            </div>
          </div>

          {/* PIN dots display */}
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full transition-all duration-150 ${
                    error
                      ? 'bg-red-500'
                      : i < pin.length
                        ? 'bg-zinc-100 scale-110'
                        : 'bg-zinc-700'
                  }`}
                />
              ))}
            </div>

            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}

            {isVerifying && (
              <div className="flex items-center justify-center gap-2 text-sm text-zinc-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Verifying...
              </div>
            )}
          </div>

          {/* On-screen numpad */}
          <NumberPad
            value={pin}
            onValueChange={handlePinChange}
            maxDigits={4}
            allowDecimal={false}
          />

          {/* Sign out link */}
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
