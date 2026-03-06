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
    </div>
  )
}
