import { useState, useEffect, useCallback } from 'react'
import { setupApi } from '@pos/api-client'

// Module-level cache to avoid re-checking on every route navigation
let cachedResult: { needsSetup: boolean } | null = null

export function useSetupCheck() {
  const [isChecking, setIsChecking] = useState(cachedResult === null)
  const [needsSetup, setNeedsSetup] = useState(cachedResult?.needsSetup ?? false)
  const [error, setError] = useState<string | null>(null)

  const check = useCallback(async () => {
    setIsChecking(true)
    setError(null)
    try {
      const response = await setupApi.checkStatus()
      // ApiClient.get() returns ApiResponse<SetupStatus> = { success, data, message, error }
      // It never throws — network errors come back as { success: false }
      if (!response.success) {
        setError(response.error || response.message || 'Failed to connect to server')
        cachedResult = null
      } else {
        const result = response.data?.needs_setup ?? false
        cachedResult = { needsSetup: result }
        setNeedsSetup(result)
      }
    } catch (err: unknown) {
      // Shouldn't happen with ApiClient, but just in case (e.g. client not initialized)
      const message = err instanceof Error ? err.message : 'Failed to connect to server'
      setError(message)
      cachedResult = null
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
