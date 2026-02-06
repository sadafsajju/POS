import { useState, useEffect } from 'react'

export interface UseElapsedTimerReturn {
  tick: number
}

/**
 * Hook that provides a ticker for elapsed time display
 * Forces re-render at specified interval to update time displays
 */
export function useElapsedTimer(intervalMs: number = 1000): UseElapsedTimerReturn {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1)
    }, intervalMs)

    return () => clearInterval(interval)
  }, [intervalMs])

  return { tick }
}
