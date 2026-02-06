import { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
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
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="restaurantName">Restaurant Name</Label>
            <Input
              id="restaurantName"
              value={localSettings.restaurantName || ''}
              onChange={(e) => setLocalSettings({ ...localSettings, restaurantName: e.target.value })}
              placeholder="Enter restaurant name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="storeAddress">Store Address</Label>
            <Input
              id="storeAddress"
              value={localSettings.storeAddress || ''}
              onChange={(e) => setLocalSettings({ ...localSettings, storeAddress: e.target.value })}
              placeholder="Enter store address"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="storePhone">Phone Number</Label>
            <Input
              id="storePhone"
              value={localSettings.storePhone || ''}
              onChange={(e) => setLocalSettings({ ...localSettings, storePhone: e.target.value })}
              placeholder="Enter phone number"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="language">Language</Label>
            <Select
              value={localSettings.language || 'en'}
              onValueChange={(value) => setLocalSettings({ ...localSettings, language: value })}
            >
              <SelectTrigger id="language">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Spanish</SelectItem>
                <SelectItem value="fr">French</SelectItem>
                <SelectItem value="hi">Hindi</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </SettingsPageLayout>
  )
}
