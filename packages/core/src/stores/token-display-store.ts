import { create } from 'zustand'

interface TokenDisplayStore {
  isOpen: boolean
  windowRef: any
  openWindow: () => void
  closeWindow: () => void
}

const isTauri = () => typeof window !== 'undefined' && '__TAURI__' in window

const WINDOW_LABEL = 'token-display'

export const useTokenDisplayStore = create<TokenDisplayStore>((set, get) => ({
  isOpen: false,
  windowRef: null,

  openWindow: async () => {
    const { windowRef, isOpen } = get()

    if (isOpen && windowRef) {
      try {
        if (isTauri()) {
          await windowRef.setFocus?.()
        } else if (!windowRef.closed) {
          windowRef.focus()
          return
        }
      } catch {
        // fall through to recreate
      }
    }

    if (isTauri()) {
      try {
        const { WebviewWindow, getAllWebviewWindows } = await import('@tauri-apps/api/webviewWindow')
        const existing = (await getAllWebviewWindows()).find((w) => w.label === WINDOW_LABEL)
        if (existing) {
          await existing.setFocus()
          set({ isOpen: true, windowRef: existing })
          existing.onCloseRequested(() => {
            set({ isOpen: false, windowRef: null })
          })
          return
        }

        const webview = new WebviewWindow(WINDOW_LABEL, {
          url: '/token-display',
          width: 1024,
          height: 768,
          title: 'Token Display',
          resizable: true,
        })
        webview.once('tauri://created', () => {
          set({ isOpen: true, windowRef: webview })
        })
        webview.once('tauri://error', (e) => {
          console.error('Token display window failed to open:', e)
          set({ isOpen: false, windowRef: null })
        })
        webview.onCloseRequested(() => {
          set({ isOpen: false, windowRef: null })
        })
      } catch (err) {
        console.error('Failed to open token display window:', err)
      }
      return
    }

    const newWindow = window.open(
      '/token-display',
      'pos-token-display',
      'popup=true,width=1024,height=768',
    )

    if (newWindow) {
      set({ isOpen: true, windowRef: newWindow })

      const timer = setInterval(() => {
        if (newWindow.closed) {
          clearInterval(timer)
          set({ isOpen: false, windowRef: null })
        }
      }, 500)
    } else {
      console.warn('Token display popup blocked. Allow popups for this app and try again.')
    }
  },

  closeWindow: async () => {
    const { windowRef } = get()
    if (!windowRef) {
      set({ isOpen: false, windowRef: null })
      return
    }
    try {
      if (isTauri()) {
        await windowRef.close?.()
      } else if (!windowRef.closed) {
        windowRef.close()
      }
    } catch (err) {
      console.warn('Error closing token display window:', err)
    }
    set({ isOpen: false, windowRef: null })
  },
}))
