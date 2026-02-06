import { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Settings, Loader2 } from 'lucide-react'
import { useSettingsStore } from '@pos/core'
import { toastHelpers } from '@/lib/toast-helpers'
import { SettingsPageLayout } from '@/components/admin/settings/SettingsPageLayout'
import type { StoreSettings } from '@pos/types'

export const Route = createFileRoute('/admin/settings/system')({
  component: SystemSettingsPage,
})

function SystemSettingsPage() {
  const { settings, isLoading, saveSettings } = useSettingsStore()
  const [localSettings, setLocalSettings] = useState<Partial<StoreSettings>>({
    theme: settings.theme,
    backupFrequency: settings.backupFrequency,
    notificationEmail: settings.notificationEmail,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    setLocalSettings({
      theme: settings.theme,
      backupFrequency: settings.backupFrequency,
      notificationEmail: settings.notificationEmail,
    })
  }, [settings])

  useEffect(() => {
    const changed =
      localSettings.theme !== settings.theme ||
      localSettings.backupFrequency !== settings.backupFrequency ||
      localSettings.notificationEmail !== settings.notificationEmail
    setHasChanges(changed)
  }, [localSettings, settings])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await saveSettings({ ...settings, ...localSettings })
      toastHelpers.success('Settings saved', 'System settings have been updated.')
    } catch (err: any) {
      setError(err.message || 'Failed to save settings')
      toastHelpers.error('Failed to save', err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setLocalSettings({
      theme: settings.theme,
      backupFrequency: settings.backupFrequency,
      notificationEmail: settings.notificationEmail,
    })
    toastHelpers.info('Changes discarded', 'Settings reset to last saved values.')
  }

  if (isLoading && !settings.theme) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <SettingsPageLayout
      title="System Settings"
      description="Configure theme, backups, and notifications"
      icon={<Settings className="w-5 h-5" />}
      hasChanges={hasChanges}
      saving={saving}
      error={error}
      onSave={handleSave}
      onReset={handleReset}
    >
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="theme">Theme</Label>
            <Select
              value={localSettings.theme || 'system'}
              onValueChange={(value) =>
                setLocalSettings({ ...localSettings, theme: value as StoreSettings['theme'] })
              }
            >
              <SelectTrigger id="theme">
                <SelectValue placeholder="Select theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Choose how the application appears
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="backupFrequency">Backup Frequency</Label>
            <Select
              value={localSettings.backupFrequency || 'daily'}
              onValueChange={(value) =>
                setLocalSettings({
                  ...localSettings,
                  backupFrequency: value as StoreSettings['backupFrequency'],
                })
              }
            >
              <SelectTrigger id="backupFrequency">
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hourly">Hourly</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="manual">Manual Only</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              How often to automatically backup data
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="notificationEmail">Notification Email</Label>
            <Input
              id="notificationEmail"
              type="email"
              value={localSettings.notificationEmail || ''}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, notificationEmail: e.target.value })
              }
              placeholder="admin@restaurant.com"
            />
            <p className="text-xs text-muted-foreground">
              Email address for system alerts and notifications
            </p>
          </div>
        </CardContent>
      </Card>
    </SettingsPageLayout>
  )
}
