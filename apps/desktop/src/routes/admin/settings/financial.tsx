import { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
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
  { code: 'EUR', symbol: '\u20AC', name: 'Euro' },
  { code: 'GBP', symbol: '\u00A3', name: 'British Pound' },
  { code: 'INR', symbol: '\u20B9', name: 'Indian Rupee' },
  { code: 'JPY', symbol: '\u00A5', name: 'Japanese Yen' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
]

const inputClass = 'w-full h-10 px-3 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder:text-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 transition-colors'
const selectClass = inputClass + ' appearance-none cursor-pointer'

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
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
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
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-5 space-y-5">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-zinc-300">Currency</label>
          <select
            value={localSettings.currency || 'USD'}
            onChange={(e) => handleCurrencyChange(e.target.value)}
            className={selectClass}
          >
            {currencyOptions.map((currency) => (
              <option key={currency.code} value={currency.code}>
                {currency.code} ({currency.symbol}) - {currency.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-zinc-500">
            Current symbol: {localSettings.currencySymbol}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-300">Tax Rate (%)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={localSettings.taxRate ?? 0}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, taxRate: parseFloat(e.target.value) || 0 })
              }
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-300">Service Charge (%)</label>
            <input
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
              className={inputClass}
            />
          </div>
        </div>
      </div>
    </SettingsPageLayout>
  )
}
