import { useState, useEffect, useCallback } from 'react'
import { setupApi } from '@pos/api-client'

// Module-level cache to avoid re-checking on every route navigation
let cachedResult: { needsSetup: boolean } | null = null

/** Check if offline setup was already completed (stored in localStorage) */
function isOfflineSetupComplete(): boolean {
  try {
    return localStorage.getItem('pos_setup_complete') === 'true'
  } catch {
    return false
  }
}

export function useSetupCheck() {
  const [isChecking, setIsChecking] = useState(cachedResult === null)
  const [needsSetup, setNeedsSetup] = useState(cachedResult?.needsSetup ?? false)
  const [error, setError] = useState<string | null>(null)

  const check = useCallback(async () => {
    setIsChecking(true)
    setError(null)

    // If offline setup was completed, skip the cloud check
    if (isOfflineSetupComplete()) {
      cachedResult = { needsSetup: false }
      setNeedsSetup(false)
      setIsChecking(false)
      return
    }

    try {
      const response = await setupApi.checkStatus()
      if (!response.success) {
        // If Supabase is unreachable but no offline setup exists, show setup
        // (not an error — the user just hasn't set up yet)
        cachedResult = { needsSetup: true }
        setNeedsSetup(true)
      } else {
        const result = response.data?.needs_setup ?? false
        cachedResult = { needsSetup: result }
        setNeedsSetup(result)
      }
    } catch (err: unknown) {
      // Can't reach server and no offline setup — needs setup
      cachedResult = { needsSetup: true }
      setNeedsSetup(true)
    } finally {
      setIsChecking(false)
    }
  }, [])

  useEffect(() => {
    if (cachedResult !== null) {
      setNeedsSetup(cachedResult.needsSetup)
      setIsChecking(false)
      return
    }
    check()
  }, [check])

  return { needsSetup, isChecking, error, retry: check }
}

/** Call after setup wizard completes to update the cache without another API call */
export function markSetupComplete() {
  cachedResult = { needsSetup: false }
}

/** Clear the cache to force a fresh check on next render */
export function clearSetupCache() {
  cachedResult = null
}
