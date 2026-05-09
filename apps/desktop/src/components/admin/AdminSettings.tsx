import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Settings,
  Database,
  Bell,
  Globe,
  DollarSign,
  Printer,
  Save,
  RotateCcw,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { useSettingsStore } from '@pos/core'
import { toastHelpers } from '@/lib/toast-helpers'
import type { StoreSettings } from '@pos/types'

const currencyOptions = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
]

// IANA names — the runtime needs the full ID (no abbreviations) for DST handling.
const timezoneOptions = [
  { value: 'Europe/London', label: 'London — GMT/BST' },
  { value: 'Europe/Dublin', label: 'Dublin — GMT/IST' },
  { value: 'Europe/Paris', label: 'Paris — CET/CEST' },
  { value: 'Europe/Berlin', label: 'Berlin — CET/CEST' },
  { value: 'Europe/Madrid', label: 'Madrid — CET/CEST' },
  { value: 'Europe/Rome', label: 'Rome — CET/CEST' },
  { value: 'Asia/Kolkata', label: 'India — IST' },
  { value: 'Asia/Dubai', label: 'Dubai — GST' },
  { value: 'Asia/Singapore', label: 'Singapore — SGT' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong — HKT' },
  { value: 'Asia/Tokyo', label: 'Tokyo — JST' },
  { value: 'Australia/Sydney', label: 'Sydney — AEST/AEDT' },
  { value: 'America/New_York', label: 'New York — EST/EDT' },
  { value: 'America/Chicago', label: 'Chicago — CST/CDT' },
  { value: 'America/Denver', label: 'Denver — MST/MDT' },
  { value: 'America/Los_Angeles', label: 'Los Angeles — PST/PDT' },
  { value: 'America/Toronto', label: 'Toronto — EST/EDT' },
  { value: 'UTC', label: 'UTC' },
]

export function AdminSettings() {
  const { settings, isLoading, saveSettings } = useSettingsStore()
  const [localSettings, setLocalSettings] = useState<StoreSettings>(settings)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [apiStatus, setApiStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking')

  // Sync local settings when store settings change
  useEffect(() => {
    setLocalSettings(settings)
  }, [settings])

  // Check for changes
  useEffect(() => {
    setHasChanges(JSON.stringify(localSettings) !== JSON.stringify(settings))
  }, [localSettings, settings])

  // Check API status
  useEffect(() => {
    const checkApi = async () => {
      try {
        let token = null
        const storedAuth = localStorage.getItem('pos-auth')
        if (storedAuth) {
          const parsed = JSON.parse(storedAuth)
          token = parsed.state?.token
        }
        if (!token) {
          setApiStatus('disconnected')
          return
        }
        const response = await fetch('http://localhost:8080/api/v1/auth/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        setApiStatus(response.ok ? 'connected' : 'disconnected')
      } catch {
        setApiStatus('disconnected')
      }
    }
    checkApi()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await saveSettings(localSettings)
      toastHelpers.success('Settings saved', 'Your settings have been saved and applied across the application.')
    } catch (err: any) {
      setError(err.message || 'Failed to save settings')
      toastHelpers.error('Failed to save settings', err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setLocalSettings(settings)
    toastHelpers.info('Changes discarded', 'Settings have been reset to last saved values.')
  }

  const handleCurrencyChange = (currencyCode: string) => {
    const currency = currencyOptions.find(c => c.code === currencyCode)
    if (currency) {
      setLocalSettings({
        ...localSettings,
        currency: currency.code,
        currencySymbol: currency.symbol
      })
    }
  }

  if (isLoading && !localSettings.restaurantName) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading settings...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">System Settings</h2>
          <p className="text-muted-foreground">
            Configure your restaurant's POS system settings
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!hasChanges || saving}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Discard Changes
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saving}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-destructive" />
          <span className="text-destructive">{error}</span>
        </div>
      )}

      {hasChanges && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-yellow-600" />
          <span className="text-yellow-600">You have unsaved changes</span>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Restaurant Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Restaurant Information
            </CardTitle>
            <CardDescription>
              Basic information about your restaurant
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Restaurant Name</label>
              <Input
                value={localSettings.restaurantName}
                onChange={(e) => setLocalSettings({...localSettings, restaurantName: e.target.value})}
                placeholder="Enter restaurant name"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Language</label>
              <Select
                value={localSettings.language}
                onValueChange={(value) => setLocalSettings({...localSettings, language: value})}
              >
                <SelectTrigger className="w-full">
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

        {/* Financial Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Financial Settings
            </CardTitle>
            <CardDescription>
              Configure currency, taxes, and charges
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Currency</label>
              <Select
                value={localSettings.currency}
                onValueChange={handleCurrencyChange}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {currencyOptions.map(currency => (
                    <SelectItem key={currency.code} value={currency.code}>
                      {currency.code} ({currency.symbol}) - {currency.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Tax regime</label>
              <Select
                value={localSettings.taxRegime ?? 'flat'}
                onValueChange={(v) => setLocalSettings({ ...localSettings, taxRegime: v as 'flat' | 'uk_vat' })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flat">Flat tax (single rate)</SelectItem>
                  <SelectItem value="uk_vat">UK VAT (multi-rate, eat-in/takeaway)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-zinc-500 mt-1">
                Flat applies one rate to subtotal. UK VAT uses per-product VAT category and the eat-in/takeaway rule.
              </p>
            </div>

            {localSettings.taxRegime !== 'uk_vat' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Tax Rate (%)</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={localSettings.taxRate}
                    onChange={(e) => setLocalSettings({...localSettings, taxRate: parseFloat(e.target.value) || 0})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Service Charge (%)</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={localSettings.serviceCharge}
                    onChange={(e) => setLocalSettings({...localSettings, serviceCharge: parseFloat(e.target.value) || 0})}
                  />
                </div>
              </div>
            )}

            {localSettings.taxRegime === 'uk_vat' && (
              <div className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="text-xs uppercase tracking-wide text-zinc-500">UK VAT</div>
                <div>
                  <label className="text-sm font-medium mb-2 block">VAT registration number</label>
                  <Input
                    value={localSettings.vatNumber ?? ''}
                    onChange={(e) => setLocalSettings({ ...localSettings, vatNumber: e.target.value })}
                    placeholder="GB123456789"
                  />
                  <p className="text-xs text-zinc-500 mt-1">Printed on every VAT invoice/receipt.</p>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Standard (%)</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={localSettings.vatRates?.standard ?? 20}
                      onChange={(e) => setLocalSettings({
                        ...localSettings,
                        vatRates: { ...localSettings.vatRates, standard: parseFloat(e.target.value) || 0 },
                      })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Reduced (%)</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={localSettings.vatRates?.reduced ?? 5}
                      onChange={(e) => setLocalSettings({
                        ...localSettings,
                        vatRates: { ...localSettings.vatRates, reduced: parseFloat(e.target.value) || 0 },
                      })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Zero (%)</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={localSettings.vatRates?.zero ?? 0}
                      onChange={(e) => setLocalSettings({
                        ...localSettings,
                        vatRates: { ...localSettings.vatRates, zero: parseFloat(e.target.value) || 0 },
                      })}
                    />
                  </div>
                </div>
                <p className="text-xs text-zinc-500">
                  Per-product VAT category and "Hot food" toggle live on each product. Hot food and eat-in cold food are
                  always standard-rated; cold takeaway uses the product's VAT category.
                </p>
              </div>
            )}

            <div className="flex items-start justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-zinc-100">Allergen surfacing &amp; staff confirmation</div>
                <div className="text-xs text-zinc-500 mt-1">
                  Shows allergen warnings on cart, KOT and receipts. Requires staff to confirm allergens with the customer
                  before any order containing flagged allergens can be sent (UK Natasha's Law / FIC Regs).
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLocalSettings({ ...localSettings, showAllergens: !localSettings.showAllergens })}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all ${
                  localSettings.showAllergens
                    ? 'border-red-500/60 bg-red-500/10 text-red-300'
                    : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
                }`}
              >
                {localSettings.showAllergens ? 'On' : 'Off'}
              </button>
            </div>

            <div className="flex items-start justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-zinc-100">Calorie labelling</div>
                <div className="text-xs text-zinc-500 mt-1">
                  Shows kcal per item on the menu, cart and receipts, plus the "Adults need around 2000 kcal a day" note
                  on receipts. Mandatory in England for businesses with 250+ employees (Calorie Labelling Regs 2021).
                  Set the kcal value on each product.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLocalSettings({ ...localSettings, showCalories: !localSettings.showCalories })}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all ${
                  localSettings.showCalories
                    ? 'border-amber-500/60 bg-amber-500/10 text-amber-300'
                    : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
                }`}
              >
                {localSettings.showCalories ? 'On' : 'Off'}
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Receipt Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Printer className="w-5 h-5" />
              Receipt Settings
            </CardTitle>
            <CardDescription>
              Customize receipt appearance and messages
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Receipt Header</label>
              <Input
                value={localSettings.receiptHeader || ''}
                onChange={(e) => setLocalSettings({...localSettings, receiptHeader: e.target.value})}
                placeholder="Header message"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Receipt Footer</label>
              <Input
                value={localSettings.receiptFooter || ''}
                onChange={(e) => setLocalSettings({...localSettings, receiptFooter: e.target.value})}
                placeholder="Footer message"
              />
            </div>
          </CardContent>
        </Card>

        {/* System Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              System Configuration
            </CardTitle>
            <CardDescription>
              System behavior and preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Theme</label>
              <Select
                value={localSettings.theme}
                onValueChange={(value) => setLocalSettings({...localSettings, theme: value as StoreSettings['theme']})}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Timezone</label>
              <Select
                value={localSettings.timezone || 'Europe/London'}
                onValueChange={(value) => setLocalSettings({ ...localSettings, timezone: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {timezoneOptions.map(tz => (
                    <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-zinc-500 mt-1">
                Defines the business day for order numbering, dashboard, EOD and reports. Crosses midnight here, not UTC.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Backup Frequency</label>
              <Select
                value={localSettings.backupFrequency}
                onValueChange={(value) => setLocalSettings({...localSettings, backupFrequency: value as StoreSettings['backupFrequency']})}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="manual">Manual Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notification Settings
            </CardTitle>
            <CardDescription>
              Configure alerts and notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Notification Email</label>
              <Input
                type="email"
                value={localSettings.notificationEmail || ''}
                onChange={(e) => setLocalSettings({...localSettings, notificationEmail: e.target.value})}
                placeholder="admin@restaurant.com"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            System Status
          </CardTitle>
          <CardDescription>
            Current system health and information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <Badge variant="outline" className="w-full">
                Database
              </Badge>
              <p className={`text-sm mt-1 ${apiStatus === 'connected' ? 'text-green-600' : 'text-red-600'}`}>
                {apiStatus === 'connected' ? 'Connected' : apiStatus === 'checking' ? 'Checking...' : 'Disconnected'}
              </p>
            </div>
            <div className="text-center">
              <Badge variant="outline" className="w-full">
                API Server
              </Badge>
              <p className={`text-sm mt-1 ${apiStatus === 'connected' ? 'text-green-600' : 'text-red-600'}`}>
                {apiStatus === 'connected' ? 'Online' : apiStatus === 'checking' ? 'Checking...' : 'Offline'}
              </p>
            </div>
            <div className="text-center">
              <Badge variant="outline" className="w-full">
                Currency
              </Badge>
              <p className="text-sm text-muted-foreground mt-1">
                {localSettings.currency} ({localSettings.currencySymbol})
              </p>
            </div>
            <div className="text-center">
              <Badge variant="outline" className="w-full">
                Version
              </Badge>
              <p className="text-sm text-muted-foreground mt-1">v1.0.0</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Privacy & Data Retention (GDPR / UK DPA) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Privacy &amp; data retention
          </CardTitle>
          <CardDescription>
            GDPR / UK DPA settings for customer data handling
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Privacy notice URL</label>
            <Input
              type="url"
              value={localSettings.privacyPolicyUrl ?? ''}
              onChange={(e) => setLocalSettings({ ...localSettings, privacyPolicyUrl: e.target.value })}
              placeholder="https://example.com/privacy"
            />
            <p className="text-xs text-zinc-500 mt-1">
              Linked from the customer-create dialog so staff can show the notice when capturing consent.
            </p>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Customer retention (months)</label>
            <Input
              type="number"
              min="0"
              step="1"
              value={localSettings.customerRetentionMonths ?? ''}
              onChange={(e) => {
                const v = e.target.value === '' ? undefined : parseInt(e.target.value, 10)
                setLocalSettings({ ...localSettings, customerRetentionMonths: Number.isFinite(v as number) ? (v as number) : undefined })
              }}
              placeholder="e.g. 36"
            />
            <p className="text-xs text-zinc-500 mt-1">
              Customers with no activity past this window can be bulk-anonymised from the customers screen. Leave blank for no auto-policy.
              Order history is always retained for HMRC tax compliance (6 years).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Tipping (UK Tipping Act 2023) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Tipping
          </CardTitle>
          <CardDescription>
            Employment (Allocation of Tips) Act 2023 — capture tips per order and allocate to staff.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-zinc-100">Enable tipping</div>
              <div className="text-xs text-zinc-500 mt-1">
                Shows tip controls on each bill, totals on the day-end report, and unlocks the staff allocation page.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setLocalSettings({ ...localSettings, tippingEnabled: !localSettings.tippingEnabled })}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all ${
                localSettings.tippingEnabled
                  ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300'
                  : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
              }`}
            >
              {localSettings.tippingEnabled ? 'On' : 'Off'}
            </button>
          </div>
          {localSettings.tippingEnabled && (
            <>
              <div>
                <label className="text-sm font-medium mb-2 block">Tipping policy URL</label>
                <Input
                  type="url"
                  value={localSettings.tippingPolicyUrl ?? ''}
                  onChange={(e) => setLocalSettings({ ...localSettings, tippingPolicyUrl: e.target.value })}
                  placeholder="https://example.com/tipping-policy"
                />
                <p className="text-xs text-zinc-500 mt-1">
                  The Act requires a written tipping policy. Linked from the cart and the staff allocation page.
                </p>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Default allocation method</label>
                <Select
                  value={localSettings.tipDefaultAllocationMethod ?? 'equal'}
                  onValueChange={(v) =>
                    setLocalSettings({ ...localSettings, tipDefaultAllocationMethod: v as 'equal' | 'hours_weighted' | 'manual' })
                  }
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equal">Equal — split evenly across all staff</SelectItem>
                    <SelectItem value="hours_weighted">Hours-weighted — by hours worked</SelectItem>
                    <SelectItem value="manual">Manual — enter amounts directly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
