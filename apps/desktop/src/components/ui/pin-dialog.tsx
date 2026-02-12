import { useState, useCallback, useEffect } from 'react'
import { Loader2, ShieldAlert } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { PinInput } from '@/components/ui/pin-input'
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

  const handlePinChange = useCallback((value: string) => {
    setPin(value)
    setError('')
    // Auto-submit when all 4 digits are entered
    if (value.length === 4) {
      handleVerify(value)
    }
  }, [handleVerify])

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onCancel() }}>
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader className="items-center text-center">
          <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mb-2">
            <ShieldAlert className="w-6 h-6 text-zinc-600" />
          </div>
          <DialogTitle className="text-lg font-bold">{title}</DialogTitle>
          <DialogDescription className="text-sm">{description}</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <PinInput
            value={pin}
            onChange={handlePinChange}
            disabled={isVerifying}
            error={!!error}
            autoFocus
          />

          {error && (
            <p className="text-sm text-red-500 text-center mt-3">{error}</p>
          )}

          {isVerifying && (
            <div className="flex items-center justify-center gap-2 mt-3 text-sm text-zinc-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Verifying...
            </div>
          )}
        </div>

        <div className="flex justify-center">
          <button
            onClick={onCancel}
            className="px-6 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
