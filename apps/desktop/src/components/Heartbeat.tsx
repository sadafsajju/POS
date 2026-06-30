import { useEffect } from 'react'
import { useAuthStore } from '@pos/core'
import { sendHeartbeat } from '@/lib/heartbeat'

// How often a logged-in terminal re-reports its version. Hourly is plenty for
// fleet visibility and is a negligible amount of traffic.
const HEARTBEAT_INTERVAL_MS = 60 * 60 * 1000

/**
 * Reports the running app version to Supabase (record_app_client) on login and
 * hourly, so the vendor can see which version each customer terminal is on and
 * spot stale installs. Renders nothing.
 */
export function Heartbeat() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  useEffect(() => {
    if (!isAuthenticated) return
    sendHeartbeat()
    const id = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS)
    return () => clearInterval(id)
  }, [isAuthenticated])

  return null
}
