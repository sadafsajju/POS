import { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Settings, Loader2 } from 'lucide-react'
import { useSettingsStore } from '@pos/core'
import { toastHelpers } from '@/lib/toast-helpers'
import { SettingsPageLayout } from '@/components/admin/settings/SettingsPageLayout'
import type { StoreSettings } from '@pos/types'

export const Route = createFileRoute('/admin/settings/system')({
  component: SystemSettingsPage,
})

const selectClass = 'w-full h-10 px-3 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 transition-colors appearance-none cursor-pointer'
const inputClass = 'w-full h-10 px-3 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder:text-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 transition-colors'

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
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
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
      {/* Appearance & Backup */}
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-5 space-y-5">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-zinc-300">Theme</label>
          <select
            value={localSettings.theme || 'system'}
            onChange={(e) =>
              setLocalSettings({ ...localSettings, theme: e.target.value as StoreSettings['theme'] })
            }
            className={selectClass}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
          <p className="text-xs text-zinc-500">Choose how the application appears</p>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-zinc-300">Backup Frequency</label>
          <select
            value={localSettings.backupFrequency || 'daily'}
            onChange={(e) =>
              setLocalSettings({
                ...localSettings,
                backupFrequency: e.target.value as StoreSettings['backupFrequency'],
              })
            }
            className={selectClass}
          >
            <option value="hourly">Hourly</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="manual">Manual Only</option>
          </select>
          <p className="text-xs text-zinc-500">How often to automatically backup data</p>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-5">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-zinc-300">Notification Email</label>
          <input
            type="email"
            value={localSettings.notificationEmail || ''}
            onChange={(e) =>
              setLocalSettings({ ...localSettings, notificationEmail: e.target.value })
            }
            placeholder="admin@restaurant.com"
            className={inputClass}
          />
          <p className="text-xs text-zinc-500">Email address for system alerts and notifications</p>
        </div>
      </div>
    </SettingsPageLayout>
  )
}
