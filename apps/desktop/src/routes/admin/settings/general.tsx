import { useState, useEffect, useCallback } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Store, Loader2, MonitorSmartphone, Monitor, Hash, TabletSmartphone, Shield, Check, ChefHat } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSettingsStore, useAuthStore, useCustomerDisplayStore, useTokenDisplayStore, useKioskDisplayStore } from '@pos/core'
import { authApi } from '@pos/api-client'
import { toastHelpers } from '@/lib/toast-helpers'
import { SettingsPageLayout } from '@/components/admin/settings/SettingsPageLayout'
import { PinInput } from '@/components/ui/pin-input'
import type { StoreSettings } from '@pos/types'

export const Route = createFileRoute('/admin/settings/general')({
  component: GeneralSettingsPage,
})

const inputClass = 'w-full h-10 px-3 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder:text-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 transition-colors'

function GeneralSettingsPage() {
  const { settings, isLoading, saveSettings } = useSettingsStore()
  const { isOpen: isDisplayOpen, openWindow: openDisplay, closeWindow: closeDisplay } = useCustomerDisplayStore()
  const { isOpen: isTokenDisplayOpen, openWindow: openTokenDisplay, closeWindow: closeTokenDisplay } = useTokenDisplayStore()
  const { isOpen: isKioskOpen, openWindow: openKiosk, closeWindow: closeKiosk } = useKioskDisplayStore()
  const [localSettings, setLocalSettings] = useState<Partial<StoreSettings>>({
    restaurantName: settings.restaurantName,
    storeAddress: settings.storeAddress,
    storePhone: settings.storePhone,

    touchMode: settings.touchMode,
    enableKds: settings.enableKds,
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
      restaurantName: settings.restaurantName,
      storeAddress: settings.storeAddress,
      storePhone: settings.storePhone,

      touchMode: settings.touchMode,
      enableKds: settings.enableKds,
      currency: settings.currency,
      currencySymbol: settings.currencySymbol,
      taxRate: settings.taxRate,
      serviceCharge: settings.serviceCharge,
    })
  }, [settings])

  useEffect(() => {
    const changed =
      localSettings.restaurantName !== settings.restaurantName ||
      localSettings.storeAddress !== settings.storeAddress ||
      localSettings.storePhone !== settings.storePhone ||

      localSettings.touchMode !== settings.touchMode ||
      localSettings.enableKds !== settings.enableKds ||
      localSettings.currency !== settings.currency ||
      localSettings.taxRate !== settings.taxRate ||
      localSettings.serviceCharge !== settings.serviceCharge
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

      touchMode: settings.touchMode,
      enableKds: settings.enableKds,
      currency: settings.currency,
      currencySymbol: settings.currencySymbol,
      taxRate: settings.taxRate,
      serviceCharge: settings.serviceCharge,
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
      description="Restaurant info, device, and display configuration"
      icon={<Store className="w-5 h-5" />}
      hasChanges={hasChanges}
      saving={saving}
      error={error}
      onSave={handleSave}
      onReset={handleReset}
    >
      {/* User Info */}
      <UserInfoCard />

      {/* Restaurant Info + Financial side by side */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <SectionHeading title="Restaurant Info" />
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-5 space-y-5 mt-3">
            <FieldGroup label="Restaurant Name">
              <input
                id="restaurantName"
                value={localSettings.restaurantName || ''}
                onChange={(e) => setLocalSettings({ ...localSettings, restaurantName: e.target.value })}
                placeholder="Enter restaurant name"
                className={inputClass}
              />
            </FieldGroup>

            <FieldGroup label="Store Address">
              <input
                id="storeAddress"
                value={localSettings.storeAddress || ''}
                onChange={(e) => setLocalSettings({ ...localSettings, storeAddress: e.target.value })}
                placeholder="Enter store address"
                className={inputClass}
              />
            </FieldGroup>

            <FieldGroup label="Phone Number">
              <input
                id="storePhone"
                value={localSettings.storePhone || ''}
                onChange={(e) => setLocalSettings({ ...localSettings, storePhone: e.target.value })}
                placeholder="Enter phone number"
                className={inputClass}
              />
            </FieldGroup>

          </div>
        </div>

        <div>
          <SectionHeading title="Financial" />
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-5 space-y-5 mt-3">
            <FieldGroup label="Currency">
              <div className={inputClass + ' flex items-center text-zinc-400 cursor-not-allowed opacity-70'}>
                INR (₹) - Indian Rupee
              </div>
            </FieldGroup>

            <FieldGroup label="Tax Rate (%)">
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
            </FieldGroup>

            <FieldGroup label="Service Charge (%)">
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={localSettings.serviceCharge ?? 0}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, serviceCharge: parseFloat(e.target.value) || 0 })
                }
                className={inputClass}
              />
            </FieldGroup>
          </div>
        </div>
      </div>

      {/* Device */}
      <SectionHeading title="Device" />
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

      {/* Kitchen Display */}
      <SectionHeading title="Kitchen" />
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-5">
        <button
          onClick={() => setLocalSettings({ ...localSettings, enableKds: !localSettings.enableKds })}
          className={cn(
            'flex items-center justify-between w-full p-3 rounded-lg border transition-colors text-left',
            localSettings.enableKds
              ? 'bg-emerald-500/10 border-emerald-500/20'
              : 'bg-zinc-800/50 border-zinc-800 hover:bg-zinc-800'
          )}
        >
          <div className="flex items-center gap-3">
            <ChefHat className="h-5 w-5 text-zinc-400 flex-shrink-0" />
            <div className="space-y-0.5">
              <span className="block text-sm font-medium text-zinc-200">Kitchen Display System</span>
              <span className="block text-xs text-zinc-500">Send orders to kitchen display for preparation tracking across all order types</span>
            </div>
          </div>
          <div className={cn(
            'w-10 h-6 rounded-full relative transition-colors flex-shrink-0 ml-4',
            localSettings.enableKds ? 'bg-emerald-500' : 'bg-zinc-700'
          )}>
            <div className={cn(
              'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
              localSettings.enableKds ? 'translate-x-5' : 'translate-x-1'
            )} />
          </div>
        </button>
      </div>

      {/* Displays */}
      <SectionHeading title="Displays" />
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

        <div
          className="flex items-center justify-between w-full p-3 rounded-lg border transition-colors text-left bg-zinc-800/30 border-zinc-800 opacity-60 cursor-not-allowed"
        >
          <div className="flex items-center gap-3">
            <TabletSmartphone className="h-5 w-5 text-zinc-500 flex-shrink-0" />
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="block text-sm font-medium text-zinc-400">Kiosk Mode</span>
                <span className="text-[10px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">Coming Soon</span>
              </div>
              <span className="block text-xs text-zinc-600">Open a self-service kiosk window for customers to place orders</span>
            </div>
          </div>
          <div className="w-10 h-6 rounded-full relative transition-colors flex-shrink-0 ml-4 bg-zinc-700">
            <div className="absolute top-1 w-4 h-4 bg-white rounded-full translate-x-1" />
          </div>
        </div>
      </div>
      {/* Security */}
      <SectionHeading title="Security" />
      <AccountSection />
    </SettingsPageLayout>
  )
}

function AccountSection() {
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [saving, setSaving] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [hasPin, setHasPin] = useState<boolean | null>(null)

  useEffect(() => {
    authApi.pinStatus().then((res: any) => {
      if (res.success && res.data) {
        setHasPin(res.data.has_pin)
      } else {
        setHasPin(true)
      }
    }).catch(() => {
      setHasPin(true)
    })
  }, [])

  const clearForm = () => {
    setCurrentPin('')
    setNewPin('')
    setConfirmPin('')
  }

  const handleSavePin = useCallback(async () => {
    setPinError(null)
    setSuccess(false)

    if (hasPin && currentPin.length !== 4) {
      setPinError('Enter your current PIN')
      return
    }
    if (newPin.length !== 4) {
      setPinError('PIN must be exactly 4 digits')
      return
    }
    if (!/^\d{4}$/.test(newPin)) {
      setPinError('PIN must contain only digits')
      return
    }
    if (newPin !== confirmPin) {
      setPinError('PINs do not match')
      return
    }

    setSaving(true)
    try {
      const response = await authApi.updatePin(hasPin ? currentPin : '', newPin)
      if (response.success) {
        setSuccess(true)
        clearForm()
        setHasPin(true)
        toastHelpers.success(hasPin ? 'PIN Updated' : 'PIN Set', hasPin ? 'Your PIN has been changed successfully.' : 'Your PIN has been set successfully.')
      } else {
        setPinError(response.message || 'Failed to update PIN')
      }
    } catch {
      setPinError('Failed to update PIN')
    } finally {
      setSaving(false)
    }
  }, [currentPin, newPin, confirmPin, hasPin])

  return (
    <>
      {/* PIN Management */}
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-5 space-y-5">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold text-zinc-200 tracking-wide uppercase">
            {hasPin === false ? 'Set PIN' : 'Change PIN'}
          </h3>
        </div>

        <p className="text-xs text-zinc-500">
          Your 4-digit PIN is used for quick login and confirming actions like deleting items or canceling orders.
        </p>

        {hasPin === false && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2.5">
            <p className="text-xs text-amber-400">You don't have a PIN set yet. Set one to enable quick login and action verification.</p>
          </div>
        )}

        <div className="space-y-4">
          {hasPin && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-zinc-300">Current PIN</label>
              <PinInput
                value={currentPin}
                onChange={(v) => { setCurrentPin(v); setPinError(null); setSuccess(false) }}
                autoFocus={false}
                error={!!pinError && pinError.toLowerCase().includes('current')}
                mask
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-300">New PIN</label>
            <PinInput
              value={newPin}
              onChange={(v) => { setNewPin(v); setPinError(null); setSuccess(false) }}
              autoFocus={false}
              error={!!pinError}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-300">Confirm New PIN</label>
            <PinInput
              value={confirmPin}
              onChange={(v) => { setConfirmPin(v); setPinError(null); setSuccess(false) }}
              autoFocus={false}
              error={!!pinError && newPin !== confirmPin}
            />
          </div>
        </div>

        {pinError && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5">
            <p className="text-sm text-red-400">{pinError}</p>
          </div>
        )}

        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-2.5 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <p className="text-sm text-emerald-400">PIN updated successfully</p>
          </div>
        )}

        <button
          onClick={handleSavePin}
          disabled={saving || newPin.length !== 4 || confirmPin.length !== 4 || (hasPin === true && currentPin.length !== 4)}
          className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold tracking-wide transition-colors bg-emerald-500 text-white hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Shield className="w-3.5 h-3.5" />
          )}
          {saving ? 'Saving...' : hasPin === false ? 'Set PIN' : 'Change PIN'}
        </button>
      </div>
    </>
  )
}

function UserInfoCard() {
  const { user } = useAuthStore()
  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 font-bold text-sm">
          {user?.first_name?.[0]}{user?.last_name?.[0]}
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-200">{user?.first_name} {user?.last_name}</p>
          <p className="text-xs text-zinc-500">@{user?.username} &middot; {user?.role}</p>
        </div>
      </div>
    </div>
  )
}

function SectionHeading({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">{title}</h3>
      <div className="flex-1 h-px bg-zinc-800" />
    </div>
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
