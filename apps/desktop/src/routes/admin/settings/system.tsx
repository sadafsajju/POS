import { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Settings, Loader2, MonitorSmartphone, Monitor, Hash, TabletSmartphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSettingsStore, useCustomerDisplayStore, useTokenDisplayStore, useKioskDisplayStore } from '@pos/core'
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
  const { isOpen: isDisplayOpen, openWindow: openDisplay, closeWindow: closeDisplay } = useCustomerDisplayStore()
  const { isOpen: isTokenDisplayOpen, openWindow: openTokenDisplay, closeWindow: closeTokenDisplay } = useTokenDisplayStore()
  const { isOpen: isKioskOpen, openWindow: openKiosk, closeWindow: closeKiosk } = useKioskDisplayStore()
  const [localSettings, setLocalSettings] = useState<Partial<StoreSettings>>({
    theme: settings.theme,
    backupFrequency: settings.backupFrequency,
    notificationEmail: settings.notificationEmail,
    touchMode: settings.touchMode,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    setLocalSettings({
      theme: settings.theme,
      backupFrequency: settings.backupFrequency,
      notificationEmail: settings.notificationEmail,
      touchMode: settings.touchMode,
    })
  }, [settings])

  useEffect(() => {
    const changed =
      localSettings.theme !== settings.theme ||
      localSettings.backupFrequency !== settings.backupFrequency ||
      localSettings.notificationEmail !== settings.notificationEmail ||
      localSettings.touchMode !== settings.touchMode
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
      touchMode: settings.touchMode,
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

      {/* Device */}
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-5">
        <button
          onClick={() => setLocalSettings({ ...localSettings, touchMode: !localSettings.touchMode })}
          className={cn(
            'flex items-center justify-between w-full p-3 rounded-lg border transition-colors text-left',
            localSettings.touchMode
              ? 'bg-emerald-500/10 border-emerald-500/20'
              : 'bg-zinc-800/50 border-zinc-800 hover:bg-zinc-800'
          )}
        >
          <div className="flex items-center gap-3">
            <MonitorSmartphone className="h-5 w-5 text-zinc-400 flex-shrink-0" />
            <div className="space-y-0.5">
              <span className="block text-sm font-medium text-zinc-200">Touch Screen Mode</span>
              <span className="block text-xs text-zinc-500">Enable on-screen keyboard for touch devices without a physical keyboard</span>
            </div>
          </div>
          <div className={cn(
            'w-10 h-6 rounded-full relative transition-colors flex-shrink-0 ml-4',
            localSettings.touchMode ? 'bg-emerald-500' : 'bg-zinc-700'
          )}>
            <div className={cn(
              'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
              localSettings.touchMode ? 'translate-x-5' : 'translate-x-1'
            )} />
          </div>
        </button>
      </div>

      {/* Displays */}
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-5 space-y-3">
        <button
          onClick={isDisplayOpen ? closeDisplay : openDisplay}
          className={cn(
            'flex items-center justify-between w-full p-3 rounded-lg border transition-colors text-left',
            isDisplayOpen
              ? 'bg-emerald-500/10 border-emerald-500/20'
              : 'bg-zinc-800/50 border-zinc-800 hover:bg-zinc-800'
          )}
        >
          <div className="flex items-center gap-3">
            <Monitor className="h-5 w-5 text-zinc-400 flex-shrink-0" />
            <div className="space-y-0.5">
              <span className="block text-sm font-medium text-zinc-200">Customer Display</span>
              <span className="block text-xs text-zinc-500">Open a customer-facing display window showing order details and promotions</span>
            </div>
          </div>
          <div className={cn(
            'w-10 h-6 rounded-full relative transition-colors flex-shrink-0 ml-4',
            isDisplayOpen ? 'bg-emerald-500' : 'bg-zinc-700'
          )}>
            <div className={cn(
              'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
              isDisplayOpen ? 'translate-x-5' : 'translate-x-1'
            )} />
          </div>
        </button>

        <button
          onClick={isTokenDisplayOpen ? closeTokenDisplay : openTokenDisplay}
          className={cn(
            'flex items-center justify-between w-full p-3 rounded-lg border transition-colors text-left',
            isTokenDisplayOpen
              ? 'bg-emerald-500/10 border-emerald-500/20'
              : 'bg-zinc-800/50 border-zinc-800 hover:bg-zinc-800'
          )}
        >
          <div className="flex items-center gap-3">
            <Hash className="h-5 w-5 text-zinc-400 flex-shrink-0" />
            <div className="space-y-0.5">
              <span className="block text-sm font-medium text-zinc-200">Token Display</span>
              <span className="block text-xs text-zinc-500">Open a display window showing order token numbers and their status</span>
            </div>
          </div>
          <div className={cn(
            'w-10 h-6 rounded-full relative transition-colors flex-shrink-0 ml-4',
            isTokenDisplayOpen ? 'bg-emerald-500' : 'bg-zinc-700'
          )}>
            <div className={cn(
              'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
              isTokenDisplayOpen ? 'translate-x-5' : 'translate-x-1'
            )} />
          </div>
        </button>

        <button
          onClick={isKioskOpen ? closeKiosk : openKiosk}
          className={cn(
            'flex items-center justify-between w-full p-3 rounded-lg border transition-colors text-left',
            isKioskOpen
              ? 'bg-emerald-500/10 border-emerald-500/20'
              : 'bg-zinc-800/50 border-zinc-800 hover:bg-zinc-800'
          )}
        >
          <div className="flex items-center gap-3">
            <TabletSmartphone className="h-5 w-5 text-zinc-400 flex-shrink-0" />
            <div className="space-y-0.5">
              <span className="block text-sm font-medium text-zinc-200">Kiosk Mode</span>
              <span className="block text-xs text-zinc-500">Open a self-service kiosk window for customers to place orders</span>
            </div>
          </div>
          <div className={cn(
            'w-10 h-6 rounded-full relative transition-colors flex-shrink-0 ml-4',
            isKioskOpen ? 'bg-emerald-500' : 'bg-zinc-700'
          )}>
            <div className={cn(
              'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
              isKioskOpen ? 'translate-x-5' : 'translate-x-1'
            )} />
          </div>
        </button>
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
