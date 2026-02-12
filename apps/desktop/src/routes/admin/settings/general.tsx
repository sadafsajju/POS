import { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Store, Loader2 } from 'lucide-react'
import { useSettingsStore } from '@pos/core'
import { toastHelpers } from '@/lib/toast-helpers'
import { SettingsPageLayout } from '@/components/admin/settings/SettingsPageLayout'
import type { StoreSettings } from '@pos/types'

export const Route = createFileRoute('/admin/settings/general')({
  component: GeneralSettingsPage,
})

function GeneralSettingsPage() {
  const { settings, isLoading, saveSettings } = useSettingsStore()
  const [localSettings, setLocalSettings] = useState<Partial<StoreSettings>>({
    restaurantName: settings.restaurantName,
    storeAddress: settings.storeAddress,
    storePhone: settings.storePhone,
    language: settings.language,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    setLocalSettings({
      restaurantName: settings.restaurantName,
      storeAddress: settings.storeAddress,
      storePhone: settings.storePhone,
      language: settings.language,
    })
  }, [settings])

  useEffect(() => {
    const changed =
      localSettings.restaurantName !== settings.restaurantName ||
      localSettings.storeAddress !== settings.storeAddress ||
      localSettings.storePhone !== settings.storePhone ||
      localSettings.language !== settings.language
    setHasChanges(changed)
  }, [localSettings, settings])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await saveSettings({ ...settings, ...localSettings })
      toastHelpers.success('Settings saved', 'General settings have been updated.')
    } catch (err: any) {
      setError(err.message || 'Failed to save settings')
      toastHelpers.error('Failed to save', err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setLocalSettings({
      restaurantName: settings.restaurantName,
      storeAddress: settings.storeAddress,
      storePhone: settings.storePhone,
      language: settings.language,
    })
    toastHelpers.info('Changes discarded', 'Settings reset to last saved values.')
  }

  if (isLoading && !settings.restaurantName) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
      </div>
    )
  }

  return (
    <SettingsPageLayout
      title="General Settings"
      description="Basic information about your restaurant"
      icon={<Store className="w-5 h-5" />}
      hasChanges={hasChanges}
      saving={saving}
      error={error}
      onSave={handleSave}
      onReset={handleReset}
    >
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-5 space-y-5">
        <FieldGroup label="Restaurant Name">
          <input
            id="restaurantName"
            value={localSettings.restaurantName || ''}
            onChange={(e) => setLocalSettings({ ...localSettings, restaurantName: e.target.value })}
            placeholder="Enter restaurant name"
            className="w-full h-10 px-3 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder:text-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 transition-colors"
          />
        </FieldGroup>

        <FieldGroup label="Store Address">
          <input
            id="storeAddress"
            value={localSettings.storeAddress || ''}
            onChange={(e) => setLocalSettings({ ...localSettings, storeAddress: e.target.value })}
            placeholder="Enter store address"
            className="w-full h-10 px-3 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder:text-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 transition-colors"
          />
        </FieldGroup>

        <FieldGroup label="Phone Number">
          <input
            id="storePhone"
            value={localSettings.storePhone || ''}
            onChange={(e) => setLocalSettings({ ...localSettings, storePhone: e.target.value })}
            placeholder="Enter phone number"
            className="w-full h-10 px-3 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder:text-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 transition-colors"
          />
        </FieldGroup>

        <FieldGroup label="Language">
          <select
            id="language"
            value={localSettings.language || 'en'}
            onChange={(e) => setLocalSettings({ ...localSettings, language: e.target.value })}
            className="w-full h-10 px-3 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 transition-colors appearance-none cursor-pointer"
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="hi">Hindi</option>
          </select>
        </FieldGroup>
      </div>
    </SettingsPageLayout>
  )
}

function FieldGroup({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-zinc-300">{label}</label>
      {children}
      {hint && <p className="text-xs text-zinc-500">{hint}</p>}
    </div>
  )
}
