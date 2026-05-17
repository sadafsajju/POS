import { useEffect, useRef, useState } from 'react'
import { check, type Update } from '@tauri-apps/plugin-updater'
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
import { useUpdateStore } from '@/lib/update-store'

const isTauri = () => typeof window !== 'undefined' && '__TAURI__' in window

// How often the running app re-checks for a new release. Keep this generous
// — the POS is often open all day and we don't want chatty network calls,
// but we also don't want users stuck waiting for the next app restart to
// pick up an emergency hotfix.
const POLL_INTERVAL_MS = 60 * 60 * 1000 // 60 min

/**
 * Two roles:
 *   1. Periodic poller — drives `useUpdateStore`. When a new version is
 *      found it's stashed in the store so the header "Update" button can
 *      render. We also auto-open the dialog the first time we see a
 *      given version; the operator's "Later" click is per-version so we
 *      don't keep popping the modal on every poll.
 *   2. Modal dialog — gated by `dialogVisible` from the store. The header
 *      button toggles `dialogVisible` so the operator can re-open the
 *      install prompt after dismissing it.
 */
export function UpdateChecker() {
  const update = useUpdateStore((s) => s.update) as Update | null
  const dialogVisible = useUpdateStore((s) => s.dialogVisible)
  const setAvailable = useUpdateStore((s) => s.setAvailable)
  const clear = useUpdateStore((s) => s.clear)
  const showDialog = useUpdateStore((s) => s.showDialog)
  const hideDialog = useUpdateStore((s) => s.hideDialog)

  const [installing, setInstalling] = useState(false)
  const [progress, setProgress] = useState<{ downloaded: number; total: number | null }>({
    downloaded: 0,
    total: null,
  })

  // Versions the operator has already clicked "Later" on this session.
  // Controls AUTO-popup only — the header button still lets them re-open
  // the dialog manually. A genuinely newer version still auto-pops because
  // its version string won't be in this set.
  const dismissedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!isTauri()) return

    let cancelled = false

    const runCheck = async () => {
      try {
        const result = await check()
        if (cancelled || !result?.available) return
        const isAlreadyKnown = useUpdateStore.getState().version === result.version
        setAvailable(result, result.version)
        // First time we see this version this session AND user hasn't
        // dismissed it → pop the dialog. Otherwise leave dialog state alone
        // so periodic re-checks don't interrupt the operator mid-sale.
        if (!isAlreadyKnown && !dismissedRef.current.has(result.version)) {
          showDialog()
        }
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
    // setAvailable/showDialog are stable Zustand references; intentionally
    // exclude from deps so the polling effect runs once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      clear()
    }
  }

  const handleLater = () => {
    if (update?.version) dismissedRef.current.add(update.version)
    hideDialog() // keep `update` set so the header button stays visible
  }

  if (!update || !dialogVisible) return null

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
