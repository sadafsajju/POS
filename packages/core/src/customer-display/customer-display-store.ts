import { create } from 'zustand'

interface CustomerDisplayStore {
  isOpen: boolean
  // Window in browser mode, WebviewWindow ref in Tauri mode. We don't need to
  // type this strictly — we only call .focus() / .close() / track lifetime.
  windowRef: any
  openWindow: () => void
  closeWindow: () => void
}

const isTauri = () => typeof window !== 'undefined' && '__TAURI__' in window

const WINDOW_LABEL = 'customer-display'

export const useCustomerDisplayStore = create<CustomerDisplayStore>((set, get) => ({
  isOpen: false,
  windowRef: null,

  openWindow: async () => {
    const { windowRef, isOpen } = get()

    // Already open — just focus.
    if (isOpen && windowRef) {
      try {
        if (isTauri()) {
          await windowRef.setFocus?.()
        } else if (!windowRef.closed) {
          windowRef.focus()
          return
        }
      } catch {
        // fall through to re-create
      }
    }

    if (isTauri()) {
      try {
        // Reuse an existing webview window if one is already open under this
        // label (e.g. user reopened the toggle after manually closing).
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
          url: '/customer-display',
          width: 1024,
          height: 768,
          title: 'Customer Display',
          resizable: true,
        })
        webview.once('tauri://created', () => {
          set({ isOpen: true, windowRef: webview })
        })
        webview.once('tauri://error', (e) => {
          console.error('Customer display window failed to open:', e)
          set({ isOpen: false, windowRef: null })
        })
        webview.onCloseRequested(() => {
          set({ isOpen: false, windowRef: null })
        })
      } catch (err) {
        console.error('Failed to open customer display window:', err)
      }
      return
    }

    // Browser fallback
    const newWindow = window.open(
      '/customer-display',
      'pos-customer-display',
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
    } else {
      console.warn('Customer display popup blocked. Allow popups for this app and try again.')
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
      console.warn('Error closing customer display window:', err)
    }
    set({ isOpen: false, windowRef: null })
  },
}))
