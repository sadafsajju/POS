import { telemetryDb } from '@pos/supabase'
import { APP_VERSION } from './version'

const DEVICE_ID_KEY = 'pos:device-id'

/**
 * Stable per-install identifier so the same terminal updates one row over time
 * instead of creating a new one each launch. Generated once and persisted.
 */
export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY)
    if (!id) {
      id =
        (typeof crypto !== 'undefined' && crypto.randomUUID?.()) ||
        `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`
      localStorage.setItem(DEVICE_ID_KEY, id)
    }
    return id
  } catch {
    return 'unknown-device'
  }
}

/** 'windows' | 'macos' | 'linux' for installed desktop apps, else 'web'. */
function detectPlatform(): string {
  const isTauri = typeof window !== 'undefined' && '__TAURI__' in window
  const ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '').toLowerCase()
  let os = 'unknown'
  if (ua.includes('windows')) os = 'windows'
  else if (ua.includes('mac')) os = 'macos'
  else if (ua.includes('linux') || ua.includes('x11')) os = 'linux'
  return isTauri ? os : 'web'
}

/**
 * Report this device's current app version (fire-and-forget). Safe to call
 * without an auth session — the RPC rejects unauthenticated calls and we swallow
 * the error so telemetry never disrupts the app.
 */
export async function sendHeartbeat(): Promise<void> {
  try {
    await telemetryDb.recordAppClient({
      device_id: getDeviceId(),
      app_version: APP_VERSION,
      platform: detectPlatform(),
    })
  } catch {
    /* best-effort telemetry */
  }
}
