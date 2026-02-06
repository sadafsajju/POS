import { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DollarSign, Loader2 } from 'lucide-react'
import { useSettingsStore } from '@pos/core'
import { toastHelpers } from '@/lib/toast-helpers'
import { SettingsPageLayout } from '@/components/admin/settings/SettingsPageLayout'
import type { StoreSettings } from '@pos/types'

export const Route = createFileRoute('/admin/settings/financial')({
  component: FinancialSettingsPage,
})

const currencyOptions = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
]

function FinancialSettingsPage() {
  const { settings, isLoading, saveSettings } = useSettingsStore()
  const [localSettings, setLocalSettings] = useState<Partial<StoreSettings>>({
    currency: settings.currency,
    currencySymbol: settings.currencySymbol,
    taxRate: settings.taxRate,
    serviceCharge: settings.serviceCharge,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    setLocalSettings({
      currency: settings.currency,
      currencySymbol: settings.currencySymbol,
      taxRate: settings.taxRate,
      serviceCharge: settings.serviceCharge,
    })
  }, [settings])

  useEffect(() => {
    const changed =
      localSettings.currency !== settings.currency ||
      localSettings.taxRate !== settings.taxRate ||
      localSettings.serviceCharge !== settings.serviceCharge
    setHasChanges(changed)
  }, [localSettings, settings])

  const handleCurrencyChange = (currencyCode: string) => {
    const currency = currencyOptions.find((c) => c.code === currencyCode)
    if (currency) {
      setLocalSettings({
        ...localSettings,
        currency: currency.code,
        currencySymbol: currency.symbol,
      })
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await saveSettings({ ...settings, ...localSettings })
      toastHelpers.success('Settings saved', 'Financial settings have been updated.')
    } catch (err: any) {
      setError(err.message || 'Failed to save settings')
      toastHelpers.error('Failed to save', err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setLocalSettings({
      currency: settings.currency,
      currencySymbol: settings.currencySymbol,
      taxRate: settings.taxRate,
      serviceCharge: settings.serviceCharge,
    })
    toastHelpers.info('Changes discarded', 'Settings reset to last saved values.')
  }

  if (isLoading && !settings.currency) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <SettingsPageLayout
      title="Financial Settings"
      description="Configure currency, taxes, and charges"
      icon={<DollarSign className="w-5 h-5" />}
      hasChanges={hasChanges}
      saving={saving}
      error={error}
      onSave={handleSave}
      onReset={handleReset}
    >
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Select value={localSettings.currency || 'USD'} onValueChange={handleCurrencyChange}>
              <SelectTrigger id="currency">
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                {currencyOptions.map((currency) => (
                  <SelectItem key={currency.code} value={currency.code}>
                    {currency.code} ({currency.symbol}) - {currency.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Current symbol: {localSettings.currencySymbol}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="taxRate">Tax Rate (%)</Label>
              <Input
                id="taxRate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={localSettings.taxRate ?? 0}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, taxRate: parseFloat(e.target.value) || 0 })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="serviceCharge">Service Charge (%)</Label>
              <Input
                id="serviceCharge"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={localSettings.serviceCharge ?? 0}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    serviceCharge: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </SettingsPageLayout>
  )
}
