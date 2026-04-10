import { useState, useCallback, useEffect } from 'react'
import { Loader2, ShieldAlert } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { NumberPad } from '@/components/ui/number-pad'
import { authApi } from '@pos/api-client'

interface PinDialogProps {
  open: boolean
  title?: string
  description?: string
  onVerified: () => void
  onCancel: () => void
}

export function PinDialog({
  open,
  title = 'Enter PIN',
  description = 'Enter your 4-digit PIN to confirm this action',
  onVerified,
  onCancel,
}: PinDialogProps) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setPin('')
      setError('')
      setIsVerifying(false)
    }
  }, [open])

  const handleVerify = useCallback(async (pinValue: string) => {
    if (pinValue.length !== 4) return

    setIsVerifying(true)
    setError('')

    try {
      const response = await authApi.verifyPin(pinValue)
      if (response.success) {
        onVerified()
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
  }, [onVerified])

  // Accept keyboard input for PIN entry
  useEffect(() => {
    if (!open || isVerifying) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault()
        setPin(prev => {
          if (prev.length >= 4) return prev
          const next = prev + e.key
          setError('')
          if (next.length === 4) {
            handleVerify(next)
          }
          return next
        })
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        setPin(prev => prev.slice(0, -1))
        setError('')
      } else if (e.key === 'Escape') {
        onCancel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, isVerifying, handleVerify, onCancel])

  const handlePinChange = useCallback((value: string) => {
    if (value.length > 4) return
    setPin(value)
    setError('')
    // Auto-submit when all 4 digits are entered
    if (value.length === 4) {
      handleVerify(value)
    }
  }, [handleVerify])

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onCancel() }}>
      <DialogContent className="sm:max-w-[360px] bg-zinc-900 border-zinc-800 text-zinc-100">
        <DialogHeader className="items-center text-center">
          <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-2">
            <ShieldAlert className="w-6 h-6 text-zinc-400" />
          </div>
          <DialogTitle className="text-lg font-bold text-zinc-100">{title}</DialogTitle>
          <DialogDescription className="text-sm text-zinc-500">{description}</DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-5">
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
              <p className="text-sm text-red-400 text-center">{error}</p>
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
        </div>

        <div className="flex justify-center">
          <button
            onClick={onCancel}
            className="px-6 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
