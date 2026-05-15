import { useEffect, useRef, useState } from 'react'
import { check, Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { Loader2, Download } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const isTauri = () => typeof window !== 'undefined' && '__TAURI__' in window

// How often the running app re-checks for a new release. Keep this generous
// — the POS is often open all day and we don't want chatty network calls,
// but we also don't want users stuck waiting for the next app restart to
// pick up an emergency hotfix.
const POLL_INTERVAL_MS = 60 * 60 * 1000 // 60 min

export function UpdateChecker() {
  const [update, setUpdate] = useState<Update | null>(null)
  const [installing, setInstalling] = useState(false)
  const [progress, setProgress] = useState<{ downloaded: number; total: number | null }>({
    downloaded: 0,
    total: null,
  })
  // Versions the operator has already clicked "Later" on this session. Used
  // to suppress the modal from re-appearing on every poll for the same
  // version — but a NEWER release that lands later still surfaces because
  // its version string won't be in this set.
  const dismissedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!isTauri()) return

    let cancelled = false

    const runCheck = async () => {
      try {
        const result = await check()
        if (cancelled || !result?.available) return
        if (dismissedRef.current.has(result.version)) return
        setUpdate(result)
      } catch (err) {
        console.warn('Update check failed:', err)
      }
    }

    runCheck() // immediate on mount
    const intervalId = setInterval(runCheck, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [])

  const handleInstall = async () => {
    if (!update) return
    setInstalling(true)
    try {
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          setProgress({ downloaded: 0, total: event.data.contentLength ?? null })
        } else if (event.event === 'Progress') {
          setProgress((p) => ({ ...p, downloaded: p.downloaded + event.data.chunkLength }))
        }
      })
      await relaunch()
    } catch (err) {
      console.error('Update install failed:', err)
      setInstalling(false)
      setUpdate(null)
    }
  }

  const handleLater = () => {
    // Remember this version so the next periodic check doesn't immediately
    // re-pop the dialog while the operator is mid-sale.
    if (update?.version) dismissedRef.current.add(update.version)
    setUpdate(null)
  }

  if (!update) return null

  const pct =
    progress.total && progress.total > 0
      ? Math.min(100, Math.round((progress.downloaded / progress.total) * 100))
      : null

  return (
    <Dialog open={true} onOpenChange={(open) => !open && !installing && handleLater()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update available</DialogTitle>
          <DialogDescription>
            Version {update.version} is ready to install. The app will restart automatically once
            the update is applied.
          </DialogDescription>
        </DialogHeader>
        {update.body ? (
          <div className="max-h-40 overflow-y-auto rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">
            {update.body}
          </div>
        ) : null}
        {installing ? (
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{pct !== null ? `Downloading… ${pct}%` : 'Downloading…'}</span>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={handleLater} disabled={installing}>
            Later
          </Button>
          <Button onClick={handleInstall} disabled={installing}>
            <Download className="mr-2 h-4 w-4" />
            Install &amp; restart
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
