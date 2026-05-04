import { useEffect, useState } from 'react'
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

export function UpdateChecker() {
  const [update, setUpdate] = useState<Update | null>(null)
  const [installing, setInstalling] = useState(false)
  const [progress, setProgress] = useState<{ downloaded: number; total: number | null }>({
    downloaded: 0,
    total: null,
  })

  useEffect(() => {
    if (!isTauri()) return

    let cancelled = false
    ;(async () => {
      try {
        const result = await check()
        if (!cancelled && result?.available) {
          setUpdate(result)
        }
      } catch (err) {
        console.warn('Update check failed:', err)
      }
    })()

    return () => {
      cancelled = true
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
