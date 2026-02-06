import { useSyncStore } from '@pos/core'
import { Wifi, WifiOff, Cloud, CloudOff, RefreshCw } from 'lucide-react'
import { Badge } from './badge'

interface OfflineIndicatorProps {
  showPendingCount?: boolean
  compact?: boolean
}

export function OfflineIndicator({ showPendingCount = true, compact = false }: OfflineIndicatorProps) {
  const { isOnline, pendingChanges, isSyncing, lastSyncAt } = useSyncStore()

  if (compact) {
    // Compact mode - just an icon
    return (
      <div className="flex items-center gap-2">
        {isOnline ? (
          <Wifi className="w-4 h-4 text-green-500" />
        ) : (
          <WifiOff className="w-4 h-4 text-red-500 animate-pulse" />
        )}
        {pendingChanges > 0 && (
          <Badge variant="secondary" className="text-xs px-1.5 py-0">
            {pendingChanges}
          </Badge>
        )}
      </div>
    )
  }

  // Full indicator with status text
  return (
    <div className="flex items-center gap-3">
      {/* Connection status */}
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
        isOnline
          ? 'bg-green-100 text-green-800'
          : 'bg-red-100 text-red-800 animate-pulse'
      }`}>
        {isOnline ? (
          <>
            <Wifi className="w-4 h-4" />
            <span>Online</span>
          </>
        ) : (
          <>
            <WifiOff className="w-4 h-4" />
            <span>Offline</span>
          </>
        )}
      </div>

      {/* Pending changes */}
      {showPendingCount && pendingChanges > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-amber-100 text-amber-800">
          {isSyncing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Syncing...</span>
            </>
          ) : (
            <>
              <CloudOff className="w-4 h-4" />
              <span>{pendingChanges} pending</span>
            </>
          )}
        </div>
      )}

      {/* Last sync time */}
      {isOnline && lastSyncAt && pendingChanges === 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Cloud className="w-3 h-3" />
          <span>Synced {formatRelativeTime(lastSyncAt)}</span>
        </div>
      )}
    </div>
  )
}

// Helper to format relative time
function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)

  if (diffSecs < 60) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return date.toLocaleDateString()
}

// Offline banner for showing at the top of the screen
export function OfflineBanner() {
  const { isOnline, pendingChanges } = useSyncStore()

  if (isOnline && pendingChanges === 0) return null

  return (
    <div className={`px-4 py-2 text-sm font-medium text-center ${
      isOnline
        ? 'bg-amber-100 text-amber-800 border-b border-amber-200'
        : 'bg-red-100 text-red-800 border-b border-red-200'
    }`}>
      {!isOnline ? (
        <div className="flex items-center justify-center gap-2">
          <WifiOff className="w-4 h-4" />
          <span>You're offline. Orders will be saved locally and synced when connection is restored.</span>
        </div>
      ) : pendingChanges > 0 && (
        <div className="flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Syncing {pendingChanges} pending order{pendingChanges > 1 ? 's' : ''}...</span>
        </div>
      )}
    </div>
  )
}
