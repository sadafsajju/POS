// Helpers for placing auxiliary Tauri windows (customer display, token display)
// on a non-primary monitor when one is connected.

export interface MonitorInfo {
  name: string | null
  position: { x: number; y: number }
  size: { width: number; height: number }
  scaleFactor: number
}

export interface ChosenMonitor {
  monitor: MonitorInfo
  isPrimary: boolean
}

const STORAGE_PREFIX = 'pos:display:monitor:'

function loadPreferredMonitorName(key: string): string | null {
  try {
    return typeof localStorage !== 'undefined'
      ? localStorage.getItem(STORAGE_PREFIX + key)
      : null
  } catch {
    return null
  }
}

export function savePreferredMonitorName(key: string, name: string | null) {
  try {
    if (typeof localStorage === 'undefined') return
    if (name) localStorage.setItem(STORAGE_PREFIX + key, name)
    else localStorage.removeItem(STORAGE_PREFIX + key)
  } catch {
    // ignore
  }
}

// Pick the best monitor for a customer-facing display:
// 1. If user previously chose one by name, use it (if still connected).
// 2. Otherwise, prefer the first non-primary monitor.
// 3. Fall back to the primary monitor.
export async function pickDisplayMonitor(prefKey: string): Promise<ChosenMonitor | null> {
  try {
    const { availableMonitors, primaryMonitor } = await import('@tauri-apps/api/window')
    const [all, primary] = await Promise.all([availableMonitors(), primaryMonitor()])
    if (!all || all.length === 0) return null

    const preferredName = loadPreferredMonitorName(prefKey)
    const preferred = preferredName ? all.find((m) => m.name === preferredName) : null
    const nonPrimary = all.find((m) => !primary || m.name !== primary.name)
    const chosen = preferred ?? nonPrimary ?? primary ?? all[0]

    return {
      monitor: {
        name: chosen.name,
        position: { x: chosen.position.x, y: chosen.position.y },
        size: { width: chosen.size.width, height: chosen.size.height },
        scaleFactor: chosen.scaleFactor,
      },
      isPrimary: !primary || chosen.name === primary.name,
    }
  } catch (err) {
    console.warn('Monitor enumeration failed; falling back to default placement', err)
    return null
  }
}

// Convert physical monitor bounds to logical coordinates that WebviewWindow
// expects when x/y/width/height are passed without explicit physical-unit hints.
export function monitorLogicalBounds(m: MonitorInfo) {
  const s = m.scaleFactor || 1
  return {
    x: Math.round(m.position.x / s),
    y: Math.round(m.position.y / s),
    width: Math.round(m.size.width / s),
    height: Math.round(m.size.height / s),
  }
}
