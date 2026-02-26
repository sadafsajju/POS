import { create } from 'zustand'

interface TokenDisplayStore {
  isOpen: boolean
  windowRef: Window | null
  openWindow: () => void
  closeWindow: () => void
}

export const useTokenDisplayStore = create<TokenDisplayStore>((set, get) => ({
  isOpen: false,
  windowRef: null,

  openWindow: () => {
    const { windowRef, isOpen } = get()

    // If already open and window is still alive, just focus it
    if (isOpen && windowRef && !windowRef.closed) {
      windowRef.focus()
      return
    }

    const newWindow = window.open(
      '/token-display',
      'pos-token-display',
      'popup=true,width=1024,height=768',
    )

    if (newWindow) {
      set({ isOpen: true, windowRef: newWindow })

      // Poll to detect when the window is closed externally
      const timer = setInterval(() => {
        if (newWindow.closed) {
          clearInterval(timer)
          set({ isOpen: false, windowRef: null })
        }
      }, 500)
    }
  },

  closeWindow: () => {
    const { windowRef } = get()
    if (windowRef && !windowRef.closed) {
      windowRef.close()
    }
    set({ isOpen: false, windowRef: null })
  },
}))
