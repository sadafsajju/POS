import { useState, useEffect, useCallback, useRef } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Store, Loader2, MonitorSmartphone, Monitor, Hash, TabletSmartphone, Shield, Check, ChefHat, Banknote, Printer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSettingsStore, useAuthStore, useCustomerDisplayStore, useTokenDisplayStore, savePreferredMonitorName } from '@pos/core'
import { authApi } from '@pos/api-client'
import { toastHelpers } from '@/lib/toast-helpers'
import { SettingsPageLayout } from '@/components/admin/settings/SettingsPageLayout'
import { PinInput } from '@/components/ui/pin-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { StoreSettings } from '@pos/types'
import { currencyOptions, findCurrency } from '@/lib/currencies'
import { loadCashDrawerConfig, saveCashDrawerConfig, listSystemPrinters, openCashDrawer, isTauri } from '@/lib/cash-drawer'
import {
  loadThermalPrinterConfig,
  saveThermalPrinterConfig,
  listThermalPrinters,
  printRawBytes,
} from '@/lib/thermal-printer'
import { EscPosBuilder } from '@/lib/escpos'

export const Route = createFileRoute('/admin/more/general')({
  component: GeneralSettingsPage,
})

const inputClass = 'w-full h-10 px-3 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder:text-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 transition-colors'

function GeneralSettingsPage() {
  const { settings, isLoading, saveSettings } = useSettingsStore()
  const { isOpen: isDisplayOpen, openWindow: openDisplay, closeWindow: closeDisplay } = useCustomerDisplayStore()
  const { isOpen: isTokenDisplayOpen, openWindow: openTokenDisplay, closeWindow: closeTokenDisplay } = useTokenDisplayStore()
  const [monitors, setMonitors] = useState<Array<{ name: string; label: string; isPrimary: boolean }>>([])
  const [customerMonitor, setCustomerMonitor] = useState<string>(() => {
    try { return localStorage.getItem('pos:display:monitor:customer-display') || 'auto' } catch { return 'auto' }
  })
  const [tokenMonitor, setTokenMonitor] = useState<string>(() => {
    try { return localStorage.getItem('pos:display:monitor:token-display') || 'auto' } catch { return 'auto' }
  })

  useEffect(() => {
    if (!('__TAURI__' in window)) return
    let cancelled = false
    ;(async () => {
      try {
        const { availableMonitors, primaryMonitor } = await import('@tauri-apps/api/window')
        const [all, primary] = await Promise.all([availableMonitors(), primaryMonitor()])
        if (cancelled || !all) return
        setMonitors(
          all.map((m, i) => ({
            name: m.name || `monitor-${i}`,
            label: `${m.name || `Monitor ${i + 1}`} — ${m.size.width}×${m.size.height}${primary && m.name === primary.name ? ' (primary)' : ''}`,
            isPrimary: !!(primary && m.name === primary.name),
          })),
        )
      } catch (e) {
        console.warn('Could not enumerate monitors', e)
      }
    })()
    return () => { cancelled = true }
  }, [])
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
  // True once the user has typed into / toggled any field on this page. When
  // true we keep their in-flight edits even if the upstream settings store
  // re-emits (which can happen on window-focus refetches, realtime pushes,
  // or — historically — when opening the customer-display window). Without
  // this guard, the "Save Changes" button would silently disable mid-edit
  // because localSettings got force-synced back to whatever's in the store.
  const userEditedRef = useRef(false)

  useEffect(() => {
    if (userEditedRef.current) return
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

  // Wrap setLocalSettings so any field change marks the form as user-edited.
  // We don't replace the existing setLocalSettings callsites — instead we
  // pipe through this single helper which keeps the ref + the React state
  // perfectly aligned. Inputs still call setLocalSettings directly so the
  // wrapper hook is a no-op for code-review diff size; the ref flip happens
  // in a covering useEffect below.
  useEffect(() => {
    // Whenever localSettings diverges from the store's settings, we know the
    // user has made a change. Flag it.
    const diverged =
      localSettings.restaurantName !== settings.restaurantName ||
      localSettings.storeAddress !== settings.storeAddress ||
      localSettings.storePhone !== settings.storePhone ||
      localSettings.touchMode !== settings.touchMode ||
      localSettings.enableKds !== settings.enableKds ||
      localSettings.currency !== settings.currency ||
      localSettings.taxRate !== settings.taxRate ||
      localSettings.serviceCharge !== settings.serviceCharge
    if (diverged) userEditedRef.current = true
  }, [localSettings, settings])

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
      userEditedRef.current = false
      toastHelpers.success('Settings saved', 'General settings have been updated.')
    } catch (err: any) {
      setError(err.message || 'Failed to save settings')
      toastHelpers.error('Failed to save', err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    userEditedRef.current = false
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
              <Select
                value={localSettings.currency || ''}
                onValueChange={(code) => {
                  const match = findCurrency(code)
                  setLocalSettings({
                    ...localSettings,
                    currency: code,
                    currencySymbol: match?.symbol ?? localSettings.currencySymbol,
                  })
                }}
              >
                <SelectTrigger className={inputClass}>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  {currencyOptions.map((opt) => (
                    <SelectItem
                      key={opt.code}
                      value={opt.code}
                      className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100"
                    >
                      {opt.code} ({opt.symbol}) - {opt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
        {monitors.length > 1 && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-3 space-y-3">
            <div className="text-xs text-zinc-500">
              {monitors.length} monitors detected. Auto-detect uses the first non-primary monitor.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-zinc-400">Customer Display monitor</label>
                <Select
                  value={customerMonitor}
                  onValueChange={(v) => {
                    setCustomerMonitor(v)
                    savePreferredMonitorName('customer-display', v === 'auto' ? null : v)
                    if (isDisplayOpen) {
                      closeDisplay()
                      setTimeout(() => openDisplay(), 200)
                    }
                  }}
                >
                  <SelectTrigger className="h-9 bg-zinc-900 border-zinc-700 text-zinc-100 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto (secondary monitor)</SelectItem>
                    {monitors.map((m) => (
                      <SelectItem key={`cust-${m.name}`} value={m.name}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-zinc-400">Token Display monitor</label>
                <Select
                  value={tokenMonitor}
                  onValueChange={(v) => {
                    setTokenMonitor(v)
                    savePreferredMonitorName('token-display', v === 'auto' ? null : v)
                    if (isTokenDisplayOpen) {
                      closeTokenDisplay()
                      setTimeout(() => openTokenDisplay(), 200)
                    }
                  }}
                >
                  <SelectTrigger className="h-9 bg-zinc-900 border-zinc-700 text-zinc-100 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto (secondary monitor)</SelectItem>
                    {monitors.map((m) => (
                      <SelectItem key={`tok-${m.name}`} value={m.name}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
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
      {/* Thermal printer */}
      <SectionHeading title="Thermal printer" />
      <ThermalPrinterSection />

      {/* Cash Drawer */}
      <SectionHeading title="Cash drawer" />
      <CashDrawerSection />

      {/* Security */}
      <SectionHeading title="Security" />
      <AccountSection />
    </SettingsPageLayout>
  )
}

function CashDrawerSection() {
  const [cfg, setCfg] = useState(() => loadCashDrawerConfig())
  const [printers, setPrinters] = useState<string[]>([])
  const [testing, setTesting] = useState(false)
  const inTauri = isTauri()

  useEffect(() => {
    if (!inTauri) return
    listSystemPrinters().then(setPrinters)
  }, [inTauri])

  const update = (partial: Partial<typeof cfg>) => {
    const next = saveCashDrawerConfig(partial)
    setCfg(next)
  }

  const testDrawer = async () => {
    setTesting(true)
    const res = await openCashDrawer({ force: true })
    setTesting(false)
    if (res.ok) toastHelpers.success('Drawer kick sent')
    else toastHelpers.error(res.error || 'Failed to open drawer')
  }

  if (!inTauri) {
    return (
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-5">
        <div className="flex items-center gap-3 text-zinc-400">
          <Banknote className="h-5 w-5 flex-shrink-0" />
          <span className="text-sm">Cash drawer support is only available in the desktop app.</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-5 space-y-3">
      <button
        onClick={() => update({ enabled: !cfg.enabled })}
        className={cn(
          'flex items-center justify-between w-full p-3 rounded-lg border transition-colors text-left',
          cfg.enabled ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-zinc-800/50 border-zinc-800 hover:bg-zinc-800',
        )}
      >
        <div className="flex items-center gap-3">
          <Banknote className="h-5 w-5 text-zinc-400 flex-shrink-0" />
          <div className="space-y-0.5">
            <span className="block text-sm font-medium text-zinc-200">Cash drawer</span>
            <span className="block text-xs text-zinc-500">Pop the drawer connected to your thermal receipt printer.</span>
          </div>
        </div>
        <div className={cn('w-10 h-6 rounded-full relative transition-colors flex-shrink-0 ml-4', cfg.enabled ? 'bg-emerald-500' : 'bg-zinc-700')}>
          <div className={cn('absolute top-1 w-4 h-4 bg-white rounded-full transition-transform', cfg.enabled ? 'translate-x-5' : 'translate-x-1')} />
        </div>
      </button>

      {cfg.enabled && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Printer (drawer plugged in here)</label>
              {printers.length > 0 ? (
                <Select value={cfg.printerName || ''} onValueChange={(v) => update({ printerName: v })}>
                  <SelectTrigger className="h-9 bg-zinc-900 border-zinc-700 text-zinc-100 text-sm">
                    <SelectValue placeholder="Select a printer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {printers.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <input
                  className={inputClass}
                  placeholder="Printer queue name"
                  value={cfg.printerName}
                  onChange={(e) => update({ printerName: e.target.value })}
                />
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Drawer pin</label>
              <Select value={String(cfg.pin)} onValueChange={(v) => update({ pin: (v === '5' ? 5 : 2) as 2 | 5 })}>
                <SelectTrigger className="h-9 bg-zinc-900 border-zinc-700 text-zinc-100 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">Pin 2 (most drawers)</SelectItem>
                  <SelectItem value="5">Pin 5 (Star / some Epson)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <button
            onClick={() => update({ autoOpenOnCash: !cfg.autoOpenOnCash })}
            className={cn(
              'flex items-center justify-between w-full p-3 rounded-lg border transition-colors text-left',
              cfg.autoOpenOnCash ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-zinc-800/50 border-zinc-800 hover:bg-zinc-800',
            )}
          >
            <div className="space-y-0.5">
              <span className="block text-sm font-medium text-zinc-200">Open automatically on cash payment</span>
              <span className="block text-xs text-zinc-500">Fires the kick as soon as a cash sale completes.</span>
            </div>
            <div className={cn('w-10 h-6 rounded-full relative transition-colors flex-shrink-0 ml-4', cfg.autoOpenOnCash ? 'bg-emerald-500' : 'bg-zinc-700')}>
              <div className={cn('absolute top-1 w-4 h-4 bg-white rounded-full transition-transform', cfg.autoOpenOnCash ? 'translate-x-5' : 'translate-x-1')} />
            </div>
          </button>

          <button
            onClick={testDrawer}
            disabled={testing || !cfg.printerName}
            className="w-full h-10 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium text-sm transition-colors"
          >
            {testing ? 'Sending kick…' : 'Test drawer'}
          </button>
        </div>
      )}
    </div>
  )
}

function ThermalPrinterSection() {
  const [cfg, setCfg] = useState(() => loadThermalPrinterConfig())
  const [printers, setPrinters] = useState<string[]>([])
  const [testing, setTesting] = useState(false)
  const inTauri = isTauri()

  useEffect(() => {
    if (!inTauri) return
    listThermalPrinters().then(setPrinters)
  }, [inTauri])

  const update = (partial: Partial<typeof cfg>) => {
    const next = saveThermalPrinterConfig(partial)
    setCfg(next)
  }

  const testPrint = async () => {
    setTesting(true)
    // Self-contained ESC/POS test sample. Confirms the queue accepts RAW
    // bytes, the printer recognises the commands, and the cut fires.
    const p = new EscPosBuilder(cfg.width)
    p.align('center').size({ doubleHeight: true, doubleWidth: true }).bold(true).textln('TEST PRINT')
    p.size().bold(false).align('left').hr()
    p.textln('If you can read this, the')
    p.textln('thermal-printer path is wired')
    p.textln('correctly.')
    p.hr()
    p.bold(true).textln(`Width: ${cfg.width} columns`).bold(false)
    p.textln(`Printer: ${cfg.receiptPrinter || '(system default)'}`)
    p.textln(`Time: ${new Date().toLocaleString()}`)
    p.feed(1)
    p.align('center').textln('— Sample line items —').align('left')
    p.item(2, 'Espresso', '5.00')
    p.item(1, 'Sandwich with a fairly long name to test wrapping', '7.50')
    p.modifier('No mayo')
    p.hr()
    p.twoCol('Subtotal', '12.50')
    p.twoCol('VAT @ 20%', '2.50')
    p.size({ doubleHeight: true }).bold(true).twoCol('TOTAL', '15.00').size().bold(false)
    p.cut()

    const res = await printRawBytes(p.build(), cfg.receiptPrinter)
    setTesting(false)
    if (res.ok) toastHelpers.success('Test page sent to printer')
    else toastHelpers.error(res.error || 'Failed to send test page')
  }

  if (!inTauri) {
    return (
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-5">
        <div className="flex items-center gap-3 text-zinc-400">
          <Printer className="h-5 w-5 flex-shrink-0" />
          <span className="text-sm">Native thermal printing is only available in the desktop app.</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-5 space-y-3">
      <button
        onClick={() => update({ enabled: !cfg.enabled })}
        className={cn(
          'flex items-center justify-between w-full p-3 rounded-lg border transition-colors text-left',
          cfg.enabled ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-zinc-800/50 border-zinc-800 hover:bg-zinc-800',
        )}
      >
        <div className="flex items-center gap-3">
          <Printer className="h-5 w-5 text-zinc-400 flex-shrink-0" />
          <div className="space-y-0.5">
            <span className="block text-sm font-medium text-zinc-200">Use thermal printer</span>
            <span className="block text-xs text-zinc-500">Send ESC/POS bytes directly — instant print, no dialog, automatic cut. Falls back to the OS print dialog when off.</span>
          </div>
        </div>
        <div className={cn('w-10 h-6 rounded-full relative transition-colors flex-shrink-0 ml-4', cfg.enabled ? 'bg-emerald-500' : 'bg-zinc-700')}>
          <div className={cn('absolute top-1 w-4 h-4 bg-white rounded-full transition-transform', cfg.enabled ? 'translate-x-5' : 'translate-x-1')} />
        </div>
      </button>

      {cfg.enabled && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Receipt printer</label>
              {printers.length > 0 ? (
                <Select value={cfg.receiptPrinter || ''} onValueChange={(v) => update({ receiptPrinter: v })}>
                  <SelectTrigger className="h-9 bg-zinc-900 border-zinc-700 text-zinc-100 text-sm">
                    <SelectValue placeholder="Select a printer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {printers.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <input
                  className={inputClass}
                  placeholder="Printer queue name"
                  value={cfg.receiptPrinter}
                  onChange={(e) => update({ receiptPrinter: e.target.value })}
                />
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Paper width</label>
              <Select value={String(cfg.width)} onValueChange={(v) => update({ width: (v === '32' ? 32 : 48) as 32 | 48 })}>
                <SelectTrigger className="h-9 bg-zinc-900 border-zinc-700 text-zinc-100 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="48">80 mm (48 columns)</SelectItem>
                  <SelectItem value="32">58 mm (32 columns)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-400">Kitchen printer <span className="text-zinc-600">(optional)</span></label>
            {printers.length > 0 ? (
              <Select value={cfg.kotPrinter || '__same__'} onValueChange={(v) => update({ kotPrinter: v === '__same__' ? '' : v })}>
                <SelectTrigger className="h-9 bg-zinc-900 border-zinc-700 text-zinc-100 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__same__">Use the receipt printer</SelectItem>
                  {printers.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <input
                className={inputClass}
                placeholder="Leave empty to use the receipt printer"
                value={cfg.kotPrinter}
                onChange={(e) => update({ kotPrinter: e.target.value })}
              />
            )}
          </div>

          <button
            onClick={() => update({ drawerKickOnReceipt: !cfg.drawerKickOnReceipt })}
            className={cn(
              'flex items-center justify-between w-full p-3 rounded-lg border transition-colors text-left',
              cfg.drawerKickOnReceipt ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-zinc-800/50 border-zinc-800 hover:bg-zinc-800',
            )}
          >
            <div className="space-y-0.5">
              <span className="block text-sm font-medium text-zinc-200">Kick drawer on cash receipt</span>
              <span className="block text-xs text-zinc-500">Appends the drawer-pulse to the receipt print so the drawer opens in the same impulse.</span>
            </div>
            <div className={cn('w-10 h-6 rounded-full relative transition-colors flex-shrink-0 ml-4', cfg.drawerKickOnReceipt ? 'bg-emerald-500' : 'bg-zinc-700')}>
              <div className={cn('absolute top-1 w-4 h-4 bg-white rounded-full transition-transform', cfg.drawerKickOnReceipt ? 'translate-x-5' : 'translate-x-1')} />
            </div>
          </button>

          <button
            onClick={testPrint}
            disabled={testing || !cfg.receiptPrinter}
            className="w-full h-10 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium text-sm transition-colors"
          >
            {testing ? 'Sending test…' : 'Print test page'}
          </button>
        </div>
      )}
    </div>
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
