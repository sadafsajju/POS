import { create } from 'zustand'

interface PinVerifyState {
  isOpen: boolean
  title: string
  description: string
  resolve: ((verified: boolean) => void) | null
  openDialog: (title: string, description: string) => Promise<boolean>
  onVerified: () => void
  onCancel: () => void
}

export const usePinVerifyStore = create<PinVerifyState>((set, get) => ({
  isOpen: false,
  title: 'Enter PIN',
  description: 'Enter your 4-digit PIN to confirm this action',
  resolve: null,

  openDialog: (title: string, description: string) => {
    return new Promise<boolean>((resolve) => {
      set({
        isOpen: true,
        title,
        description,
        resolve,
      })
    })
  },

  onVerified: () => {
    const { resolve } = get()
    set({ isOpen: false, resolve: null })
    resolve?.(true)
  },

  onCancel: () => {
    const { resolve } = get()
    set({ isOpen: false, resolve: null })
    resolve?.(false)
  },
}))

/**
 * Hook to trigger PIN verification from any component.
 * Returns a function that opens the PIN dialog and returns a promise.
 *
 * Usage:
 *   const requirePin = useRequirePin()
 *   const verified = await requirePin('Delete Product', 'Enter PIN to confirm deletion')
 *   if (!verified) return
 */
export function useRequirePin() {
  const openDialog = usePinVerifyStore((s) => s.openDialog)
  return openDialog
}
