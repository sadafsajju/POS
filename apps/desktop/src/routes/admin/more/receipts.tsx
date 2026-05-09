import { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Printer, Loader2 } from 'lucide-react'
import { useSettingsStore } from '@pos/core'
import { toastHelpers } from '@/lib/toast-helpers'
import { SettingsPageLayout } from '@/components/admin/settings/SettingsPageLayout'
import type { StoreSettings } from '@pos/types'

export const Route = createFileRoute('/admin/more/receipts')({
  component: ReceiptsSettingsPage,
})

const textareaClass = 'w-full px-3 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder:text-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 transition-colors resize-none'

function ReceiptsSettingsPage() {
  const { settings, isLoading, saveSettings } = useSettingsStore()
  const [localSettings, setLocalSettings] = useState<Partial<StoreSettings>>({
    receiptHeader: settings.receiptHeader,
    receiptFooter: settings.receiptFooter,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    setLocalSettings({
      receiptHeader: settings.receiptHeader,
      receiptFooter: settings.receiptFooter,
    })
  }, [settings])

  useEffect(() => {
    const changed =
      localSettings.receiptHeader !== settings.receiptHeader ||
      localSettings.receiptFooter !== settings.receiptFooter
    setHasChanges(changed)
  }, [localSettings, settings])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await saveSettings({ ...settings, ...localSettings })
      toastHelpers.success('Settings saved', 'Receipt settings have been updated.')
    } catch (err: any) {
      setError(err.message || 'Failed to save settings')
      toastHelpers.error('Failed to save', err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setLocalSettings({
      receiptHeader: settings.receiptHeader,
      receiptFooter: settings.receiptFooter,
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

  const restaurantName = settings.restaurantName || 'My Restaurant'
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

  return (
    <SettingsPageLayout
      title="Receipt Settings"
      description="Customize receipt appearance and messages"
      icon={<Printer className="w-5 h-5" />}
      hasChanges={hasChanges}
      saving={saving}
      error={error}
      onSave={handleSave}
      onReset={handleReset}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

        {/* ── Left: Editor ──────────────────────────────────────────────── */}
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-5 space-y-5">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-300">Receipt Header</label>
            <textarea
              value={localSettings.receiptHeader || ''}
              onChange={(e) => setLocalSettings({ ...localSettings, receiptHeader: e.target.value })}
              placeholder="Header message shown at the top of receipts"
              rows={3}
              className={textareaClass}
            />
            <p className="text-xs text-zinc-500">This text appears at the top of every receipt</p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-300">Receipt Footer</label>
            <textarea
              value={localSettings.receiptFooter || ''}
              onChange={(e) => setLocalSettings({ ...localSettings, receiptFooter: e.target.value })}
              placeholder="Footer message shown at the bottom of receipts"
              rows={3}
              className={textareaClass}
            />
            <p className="text-xs text-zinc-500">
              This text appears at the bottom of every receipt
            </p>
          </div>
        </div>

        {/* ── Right: Live Receipt Preview (sticky) ─────────────────────── */}
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 lg:sticky lg:top-4">
          <div className="px-4 pt-4 pb-2 flex items-baseline justify-between">
            <div>
              <h3 className="text-sm font-bold text-zinc-300">Live Preview</h3>
              <p className="text-xs text-zinc-600">Updates as you type</p>
            </div>
            <span className="text-[10px] text-zinc-600 tabular-nums">80mm thermal</span>
          </div>

          <div className="px-4 pb-4 flex justify-center">
            {/* 80mm = 302px at 96dpi */}
            <div className="bg-white shadow-lg overflow-hidden" style={{ width: '302px' }}>
              {/* Thermal receipt paper effect */}
              <div className="px-4 py-3 font-mono text-[10px] leading-[1.6] text-gray-800">

                {/* Header */}
                <div className="text-center pb-2 mb-2 border-b border-dashed border-gray-300">
                  <p className="font-bold text-xs text-black">{restaurantName}</p>
                  {settings.storeAddress && (
                    <p className="text-gray-500 mt-0.5">{settings.storeAddress}</p>
                  )}
                  {settings.storePhone && (
                    <p className="text-gray-500">Tel: {settings.storePhone}</p>
                  )}
                  {localSettings.receiptHeader && (
                    <p className="mt-1.5 whitespace-pre-wrap text-gray-700">{localSettings.receiptHeader}</p>
                  )}
                </div>

                {/* Order info */}
                <div className="flex justify-between text-gray-500 mb-2">
                  <span>#{String(1042).padStart(4, '0')}</span>
                  <span>{dateStr} {timeStr}</span>
                </div>
                <div className="text-gray-500 mb-2">
                  <span>Table: T3 &middot; Server: John</span>
                </div>

                {/* Divider */}
                <div className="border-b border-dashed border-gray-300 mb-2" />

                {/* Items */}
                <div className="space-y-1 mb-2">
                  <div className="flex justify-between">
                    <span>2x Chicken Biryani</span>
                    <span>{settings.currencySymbol}598.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>1x Butter Naan</span>
                    <span>{settings.currencySymbol}60.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>2x Masala Chai</span>
                    <span>{settings.currencySymbol}80.00</span>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-b border-dashed border-gray-300 mb-2" />

                {/* Totals */}
                <div className="space-y-0.5 mb-2">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{settings.currencySymbol}738.00</span>
                  </div>
                  {settings.taxRate > 0 && (
                    <div className="flex justify-between text-gray-500">
                      <span>Tax ({settings.taxRate}%)</span>
                      <span>{settings.currencySymbol}{(738 * settings.taxRate / 100).toFixed(2)}</span>
                    </div>
                  )}
                  {settings.serviceCharge > 0 && (
                    <div className="flex justify-between text-gray-500">
                      <span>Service ({settings.serviceCharge}%)</span>
                      <span>{settings.currencySymbol}{(738 * settings.serviceCharge / 100).toFixed(2)}</span>
                    </div>
                  )}
                </div>

                <div className="border-b border-double border-gray-400 mb-2" />

                <div className="flex justify-between font-bold text-black text-xs">
                  <span>TOTAL</span>
                  <span>
                    {settings.currencySymbol}
                    {(738 + 738 * (settings.taxRate || 0) / 100 + 738 * (settings.serviceCharge || 0) / 100).toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between mt-1.5 text-gray-500">
                  <span>Payment: Cash</span>
                  <span>Paid</span>
                </div>

                {/* Footer */}
                <div className="text-center mt-3 pt-2 border-t border-dashed border-gray-300">
                  {localSettings.receiptFooter && (
                    <p className="whitespace-pre-wrap text-gray-600">{localSettings.receiptFooter}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SettingsPageLayout>
  )
}
