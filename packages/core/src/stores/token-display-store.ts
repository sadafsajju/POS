import { create } from 'zustand'
import { pickDisplayMonitor, monitorLogicalBounds } from '../customer-display/monitor-utils'

interface TokenDisplayStore {
  isOpen: boolean
  windowRef: any
  openWindow: () => void
  closeWindow: () => void
}

const isTauri = () => typeof window !== 'undefined' && '__TAURI__' in window

const WINDOW_LABEL = 'token-display'
const MONITOR_PREF_KEY = 'token-display'

export const useTokenDisplayStore = create<TokenDisplayStore>((set, get) => ({
  isOpen: false,
  windowRef: null,

  openWindow: async () => {
    const { windowRef, isOpen } = get()

    if (isOpen && windowRef) {
      try {
        if (isTauri()) {
          await windowRef.setFocus?.()
          return
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
        const { LogicalPosition, LogicalSize } = await import('@tauri-apps/api/dpi')

        const chosen = await pickDisplayMonitor(MONITOR_PREF_KEY)
        const bounds = chosen ? monitorLogicalBounds(chosen.monitor) : null
        const shouldFullscreen = !!(chosen && !chosen.isPrimary)

        const existing = (await getAllWebviewWindows()).find((w) => w.label === WINDOW_LABEL)
        if (existing) {
          if (bounds) {
            try {
              await existing.setFullscreen(false)
              await existing.setPosition(new LogicalPosition(bounds.x, bounds.y))
              await existing.setSize(new LogicalSize(bounds.width, bounds.height))
              if (shouldFullscreen) await existing.setFullscreen(true)
            } catch (e) {
              console.warn('Could not reposition existing token display:', e)
            }
          }
          await existing.setFocus()
          set({ isOpen: true, windowRef: existing })
          existing.onCloseRequested(() => {
            set({ isOpen: false, windowRef: null })
          })
          return
        }

        const opts: Record<string, any> = {
          url: '/token-display',
          title: 'Token Display',
          resizable: true,
          decorations: !shouldFullscreen,
          fullscreen: shouldFullscreen,
        }
        if (bounds) {
          opts.x = bounds.x
          opts.y = bounds.y
          opts.width = bounds.width
          opts.height = bounds.height
        } else {
          opts.width = 1024
          opts.height = 768
          opts.center = true
        }

        const webview = new WebviewWindow(WINDOW_LABEL, opts as any)
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
