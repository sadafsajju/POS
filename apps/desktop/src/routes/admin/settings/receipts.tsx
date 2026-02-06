import { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Printer, Loader2 } from 'lucide-react'
import { useSettingsStore } from '@pos/core'
import { toastHelpers } from '@/lib/toast-helpers'
import { SettingsPageLayout } from '@/components/admin/settings/SettingsPageLayout'
import type { StoreSettings } from '@pos/types'

export const Route = createFileRoute('/admin/settings/receipts')({
  component: ReceiptsSettingsPage,
})

function ReceiptsSettingsPage() {
  const { settings, isLoading, saveSettings } = useSettingsStore()
  const [localSettings, setLocalSettings] = useState<Partial<StoreSettings>>({
    receiptHeader: settings.receiptHeader,
    receiptFooter: settings.receiptFooter,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    setLocalSettings({
      receiptHeader: settings.receiptHeader,
      receiptFooter: settings.receiptFooter,
    })
  }, [settings])

  useEffect(() => {
    const changed =
      localSettings.receiptHeader !== settings.receiptHeader ||
      localSettings.receiptFooter !== settings.receiptFooter
    setHasChanges(changed)
  }, [localSettings, settings])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await saveSettings({ ...settings, ...localSettings })
      toastHelpers.success('Settings saved', 'Receipt settings have been updated.')
    } catch (err: any) {
      setError(err.message || 'Failed to save settings')
      toastHelpers.error('Failed to save', err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setLocalSettings({
      receiptHeader: settings.receiptHeader,
      receiptFooter: settings.receiptFooter,
    })
    toastHelpers.info('Changes discarded', 'Settings reset to last saved values.')
  }

  if (isLoading && !settings.restaurantName) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <SettingsPageLayout
      title="Receipt Settings"
      description="Customize receipt appearance and messages"
      icon={<Printer className="w-5 h-5" />}
      hasChanges={hasChanges}
      saving={saving}
      error={error}
      onSave={handleSave}
      onReset={handleReset}
    >
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="receiptHeader">Receipt Header</Label>
            <Textarea
              id="receiptHeader"
              value={localSettings.receiptHeader || ''}
              onChange={(e) => setLocalSettings({ ...localSettings, receiptHeader: e.target.value })}
              placeholder="Header message shown at the top of receipts"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              This text appears at the top of every receipt
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="receiptFooter">Receipt Footer</Label>
            <Textarea
              id="receiptFooter"
              value={localSettings.receiptFooter || ''}
              onChange={(e) => setLocalSettings({ ...localSettings, receiptFooter: e.target.value })}
              placeholder="Footer message shown at the bottom of receipts"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              This text appears at the bottom of every receipt (e.g., "Thank you for dining with us!")
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Preview Card */}
      <Card>
        <CardContent className="pt-6">
          <Label className="mb-3 block">Preview</Label>
          <div className="bg-white border rounded-lg p-4 font-mono text-sm text-black max-w-xs mx-auto">
            <div className="text-center border-b pb-2 mb-2">
              <p className="whitespace-pre-wrap">{localSettings.receiptHeader || 'Receipt Header'}</p>
            </div>
            <div className="py-4 text-center text-muted-foreground">
              [Receipt content here]
            </div>
            <div className="text-center border-t pt-2 mt-2">
              <p className="whitespace-pre-wrap">{localSettings.receiptFooter || 'Receipt Footer'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </SettingsPageLayout>
  )
}
