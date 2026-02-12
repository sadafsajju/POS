import { useState, useCallback, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Shield, Loader2, Check, KeyRound } from 'lucide-react'
import { useAuthStore, useRequirePin } from '@pos/core'
import { authApi } from '@pos/api-client'
import { toastHelpers } from '@/lib/toast-helpers'
import { PinInput } from '@/components/ui/pin-input'

export const Route = createFileRoute('/admin/settings/account')({
  component: AccountSettingsPage,
})

function AccountSettingsPage() {
  const { user } = useAuthStore()
  const requirePin = useRequirePin()

  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSavePin = useCallback(async () => {
    setError(null)
    setSuccess(false)

    if (newPin.length !== 4) {
      setError('PIN must be exactly 4 digits')
      return
    }

    if (!/^\d{4}$/.test(newPin)) {
      setError('PIN must contain only digits')
      return
    }

    if (newPin !== confirmPin) {
      setError('PINs do not match')
      return
    }

    // If user already has a PIN, require current PIN verification first
    // We try to verify — if the user has no PIN set, the backend will reject it,
    // so we skip verification for first-time PIN setup
    const verified = await requirePin('Confirm Identity', 'Enter your current PIN to change it')
    if (!verified) return

    setSaving(true)
    try {
      const response = await authApi.updatePin(newPin)
      if (response.success) {
        setSuccess(true)
        setNewPin('')
        setConfirmPin('')
        toastHelpers.success('PIN Updated', 'Your PIN has been changed successfully.')
      } else {
        setError(response.message || 'Failed to update PIN')
      }
    } catch {
      setError('Failed to update PIN')
    } finally {
      setSaving(false)
    }
  }, [newPin, confirmPin, requirePin])

  const handleSetFirstPin = useCallback(async () => {
    setError(null)
    setSuccess(false)

    if (newPin.length !== 4) {
      setError('PIN must be exactly 4 digits')
      return
    }

    if (!/^\d{4}$/.test(newPin)) {
      setError('PIN must contain only digits')
      return
    }

    if (newPin !== confirmPin) {
      setError('PINs do not match')
      return
    }

    setSaving(true)
    try {
      const response = await authApi.updatePin(newPin)
      if (response.success) {
        setSuccess(true)
        setNewPin('')
        setConfirmPin('')
        toastHelpers.success('PIN Set', 'Your PIN has been set successfully.')
      } else {
        setError(response.message || 'Failed to set PIN')
      }
    } catch {
      setError('Failed to set PIN')
    } finally {
      setSaving(false)
    }
  }, [newPin, confirmPin])

  // Check if user has a PIN by attempting a verify — but for UX simplicity,
  // we provide both options and let the user choose
  const [hasPin, setHasPin] = useState<boolean | null>(null)

  // Auto-detect if user has PIN on first render
  useEffect(() => {
    authApi.verifyPin('0000').then((res) => {
      // If we get success=false with 'pin_not_set' error, user has no PIN
      if (!res.success && res.error === 'pin_not_set') {
        setHasPin(false)
      } else {
        // Either the PIN matched (unlikely) or it was invalid — either way, PIN exists
        setHasPin(true)
      }
    }).catch(() => {
      setHasPin(true) // Assume PIN exists on error
    })
  }, [])

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 px-6 py-4 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-zinc-800 rounded-lg text-zinc-300">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-100">Account</h2>
            <p className="text-sm text-zinc-500">Manage your PIN and account security</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* User Info */}
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 font-bold text-sm">
              {user?.first_name?.[0]}{user?.last_name?.[0]}
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-200">{user?.first_name} {user?.last_name}</p>
              <p className="text-xs text-zinc-500">@{user?.username} &middot; {user?.role}</p>
            </div>
          </div>
        </div>

        {/* PIN Management */}
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-5 space-y-5">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-zinc-200 tracking-wide uppercase">
              {hasPin === false ? 'Set PIN' : 'Change PIN'}
            </h3>
          </div>

          <p className="text-xs text-zinc-500">
            Your 4-digit PIN is used for quick login and confirming actions like deleting items or canceling orders.
          </p>

          {hasPin === false && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2.5">
              <p className="text-xs text-amber-400">You don't have a PIN set yet. Set one to enable quick login and action verification.</p>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-zinc-300">New PIN</label>
              <PinInput
                value={newPin}
                onChange={(v) => { setNewPin(v); setError(null); setSuccess(false) }}
                autoFocus={false}
                error={!!error}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-zinc-300">Confirm New PIN</label>
              <PinInput
                value={confirmPin}
                onChange={(v) => { setConfirmPin(v); setError(null); setSuccess(false) }}
                autoFocus={false}
                error={!!error && newPin !== confirmPin}
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-2.5 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <p className="text-sm text-emerald-400">PIN updated successfully</p>
            </div>
          )}

          <button
            onClick={hasPin === false ? handleSetFirstPin : handleSavePin}
            disabled={saving || newPin.length !== 4 || confirmPin.length !== 4}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold tracking-wide transition-colors bg-emerald-500 text-white hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Shield className="w-3.5 h-3.5" />
            )}
            {saving ? 'Saving...' : hasPin === false ? 'Set PIN' : 'Change PIN'}
          </button>
        </div>
      </div>
    </div>
  )
}
