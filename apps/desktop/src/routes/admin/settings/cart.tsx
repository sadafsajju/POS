import { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { ShoppingCart, Loader2, Minus, Plus, Trash2, MessageSquare, ChefHat, Printer, CreditCard, UtensilsCrossed, ShoppingBag, Truck } from 'lucide-react'
import { useSettingsStore } from '@pos/core'
import { toastHelpers } from '@/lib/toast-helpers'
import { SettingsPageLayout } from '@/components/admin/settings/SettingsPageLayout'
import type { CartSettings } from '@pos/types'

export const Route = createFileRoute('/admin/settings/cart')({
  component: CartSettingsPage,
})

// ── Toggle options ───────────────────────────────────────────────────────────

const toggleOptions: { key: keyof CartSettings; label: string; description: string }[] = [
  { key: 'showSpecialInstructions', label: 'Special Instructions', description: 'Allow adding notes to individual cart items' },
  { key: 'showOrderNotes', label: 'Order Notes', description: 'Show a field for order-level notes and requests' },
  { key: 'confirmBeforeClear', label: 'Confirm Before Clear', description: 'Show confirmation dialog before clearing the cart' },
  { key: 'autoClearAfterOrder', label: 'Auto-Clear After Order', description: 'Automatically clear the cart after placing an order' },
]

const orderTypeOptions: { key: keyof CartSettings; label: string; description: string; icon: string }[] = [
  { key: 'showDineIn', label: 'Dine-In', description: 'Allow dine-in orders with table selection', icon: 'utensils' },
  { key: 'showTakeout', label: 'Takeout', description: 'Allow takeout / parcel orders', icon: 'bag' },
  { key: 'showDelivery', label: 'Delivery', description: 'Allow delivery orders', icon: 'truck' },
]

const actionButtonKeys: { key: keyof import('@pos/types').OrderTypeButtons; label: string; description: string; icon: string }[] = [
  { key: 'showSave', label: 'Save', description: 'Save order without printing KOT', icon: 'chef' },
  { key: 'showKot', label: 'KOT', description: 'Send Kitchen Order Ticket to printer', icon: 'printer' },
  { key: 'showPay', label: 'Pay', description: 'Open payment dialog for active orders', icon: 'card' },
]

const orderTypeButtonSections = [
  { settingsKey: 'dineInButtons' as const, label: 'Dine-In', visibilityKey: 'showDineIn' as const, color: 'sky' },
  { settingsKey: 'takeoutButtons' as const, label: 'Takeout', visibilityKey: 'showTakeout' as const, color: 'amber' },
  { settingsKey: 'deliveryButtons' as const, label: 'Delivery', visibilityKey: 'showDelivery' as const, color: 'violet' },
]

// ── Sample cart items for preview ────────────────────────────────────────────

const sampleItems = [
  { name: 'Chicken Biryani', qty: 2, price: 299, instruction: 'Extra spicy, no onions' },
  { name: 'Butter Naan', qty: 3, price: 60, instruction: '' },
  { name: 'Masala Chai', qty: 1, price: 40, instruction: '' },
]

const orderTypeLabels: Record<string, { label: string; color: string; badgeColor: string }> = {
  dine_in: { label: 'Dine In', color: 'bg-sky-500/15 text-sky-400 border-sky-500/20', badgeColor: 'bg-blue-700 text-white' },
  takeout: { label: 'Takeout', color: 'bg-amber-500/15 text-amber-400 border-amber-500/20', badgeColor: 'bg-orange-500 text-white' },
  delivery: { label: 'Delivery', color: 'bg-violet-500/15 text-violet-400 border-violet-500/20', badgeColor: 'bg-green-500 text-white' },
}

// ── Live Cart Preview (matching actual CartPanel.tsx) ─────────────────────────

function CartPreview({
  cartSettings,
  currencySymbol,
  taxRate,
}: {
  cartSettings: CartSettings
  currencySymbol: string
  taxRate: number
}) {
  const [previewType, setPreviewType] = useState<'dine_in' | 'takeout' | 'delivery'>(cartSettings.defaultOrderType)
  const fmt = (n: number) => `${currencySymbol}${n.toFixed(2)}`

  const subtotal = sampleItems.reduce((s, i) => s + i.qty * i.price, 0)
  const tax = subtotal * (taxRate / 100)
  const total = subtotal + tax

  // Get buttons for the selected preview type
  const buttons = previewType === 'dine_in' ? cartSettings.dineInButtons
    : previewType === 'takeout' ? cartSettings.takeoutButtons
    : cartSettings.deliveryButtons

  // Available preview types (only show enabled ones)
  const availableTypes = [
    cartSettings.showDineIn && 'dine_in',
    cartSettings.showTakeout && 'takeout',
    cartSettings.showDelivery && 'delivery',
  ].filter(Boolean) as ('dine_in' | 'takeout' | 'delivery')[]

  // Reset preview type if current one gets disabled
  useEffect(() => {
    if (!availableTypes.includes(previewType) && availableTypes.length > 0) {
      setPreviewType(availableTypes[0])
    }
  }, [availableTypes.join(',')])

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 lg:sticky lg:top-4">
      <div className="px-5 pt-5 pb-2">
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-zinc-300">Live Preview</h3>
            <p className="text-xs text-zinc-600">Matches your actual POS cart</p>
          </div>
          <span className="text-[10px] text-zinc-600 tabular-nums">Cart panel</span>
        </div>
        {availableTypes.length > 1 && (
          <div className="flex gap-1.5">
            {availableTypes.map((type) => {
              const info = orderTypeLabels[type]
              const active = previewType === type
              return (
                <button
                  key={type}
                  onClick={() => setPreviewType(type)}
                  className={cn(
                    'flex-1 py-1.5 rounded-md text-xs font-medium border transition-colors',
                    active
                      ? info.color
                      : 'bg-zinc-800/50 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                  )}
                >
                  {info.label}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Cart panel mock - matches CartPanel.tsx structure */}
      <div className="mx-5 mb-5 bg-card rounded-lg border border-border overflow-hidden flex flex-col">

        {/* New Items header + Clear button - matches CartPanel lines 357-372 */}
        <div className="flex justify-between items-center px-4 pt-3 pb-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            Order Items
          </p>
          <button className="h-8 px-2 flex items-center gap-1 text-destructive text-sm hover:bg-destructive/10 rounded-md">
            <Trash2 className="w-4 h-4" />
            Clear
          </button>
        </div>

        {/* Cart items - bordered grid matching CartPanel lines 377-506 */}
        <div className="px-4 pb-4">
          <div className="border-l border-t border-border">
            {sampleItems.map((item, i) => (
              <div key={i} className="border-r border-b border-border bg-card">
                <div className="flex items-center p-3 gap-3 hover:bg-muted/50">
                  {/* Delete button */}
                  <button className="h-10 w-10 p-0 flex items-center justify-center text-muted-foreground hover:text-destructive flex-shrink-0">
                    <Trash2 className="h-4 w-4" />
                  </button>
                  {/* Item info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{item.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {fmt(item.price)} &times; {item.qty} = <span className="font-semibold text-foreground">{fmt(item.price * item.qty)}</span>
                    </div>
                  </div>
                  {/* Special instructions icon */}
                  {cartSettings.showSpecialInstructions && (
                    <button className={cn(
                      'h-10 w-10 p-0 flex items-center justify-center flex-shrink-0',
                      item.instruction ? 'text-primary' : 'text-muted-foreground'
                    )}>
                      <MessageSquare className="h-4 w-4" />
                    </button>
                  )}
                  {/* Quantity controls */}
                  <div className="flex items-center flex-shrink-0">
                    <button className="h-10 w-10 p-0 flex items-center justify-center border border-border border-r-0">
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="h-10 w-10 flex items-center justify-center text-base font-semibold border border-border">
                      {item.qty}
                    </span>
                    <button className="h-10 w-10 p-0 flex items-center justify-center border border-border border-l-0">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {/* Special instructions text - matches CartPanel lines 493-503 */}
                {cartSettings.showSpecialInstructions && item.instruction && (
                  <div className="px-3 pb-2 pt-0 text-xs text-muted-foreground">
                    <span className="italic">Note: {item.instruction}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Order Notes - matches CartPanel lines 508-522 */}
          {cartSettings.showOrderNotes && (
            <div className="mt-4">
              <label className="text-sm font-medium">Order Notes</label>
              <div className="mt-1 flex min-h-[40px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm cursor-pointer hover:bg-muted/50">
                <span className="text-muted-foreground">Special requests or notes...</span>
              </div>
            </div>
          )}
        </div>

        {/* Order Summary - matches CartPanel lines 537-559 */}
        <div className="border-t border-border bg-card flex-shrink-0">
          <div className="border-b border-border">
            <div className="flex justify-between text-sm text-muted-foreground px-4 py-2 border-b border-border">
              <span>New Items:</span>
              <span>{fmt(subtotal)}</span>
            </div>
            {taxRate > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground px-4 py-2 border-b border-border">
                <span>Tax ({taxRate}%):</span>
                <span>{fmt(tax)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-semibold px-4 py-3">
              <span>Total:</span>
              <span>{fmt(total)}</span>
            </div>
          </div>

          {/* Action Buttons — dynamic layout based on count */}
          {(() => {
            const btns = [
              buttons?.showSave && 'save',
              buttons?.showKot && 'kot',
              buttons?.showPay && 'pay',
            ].filter(Boolean) as string[]
            const count = btns.length

            const primaryClass = 'flex-1 h-12 text-sm flex items-center justify-center gap-2 bg-blue-600 text-white font-medium'
            const secondaryClass = 'flex-1 h-12 text-sm flex items-center justify-center gap-2 bg-card hover:bg-muted/50 text-foreground font-medium border-r border-border'

            if (count === 0) {
              return (
                <div className="h-12 text-sm flex items-center justify-center text-muted-foreground">
                  No action buttons enabled
                </div>
              )
            }

            const renderBtn = (btn: string, isPrimary: boolean) => {
              const cls = isPrimary ? primaryClass : secondaryClass
              if (btn === 'save') return (
                <button key="save" className={cls}><ChefHat className="w-4 h-4" />Save</button>
              )
              if (btn === 'kot') return (
                <button key="kot" className={cls}><Printer className="w-4 h-4" />KOT</button>
              )
              return (
                <button key="pay" className={cls}><CreditCard className="w-4 h-4" />Pay</button>
              )
            }

            if (count === 3) {
              // 2 up (secondary) + 1 down (blue)
              return (
                <div>
                  <div className="flex">
                    {renderBtn('save', false)}
                    {renderBtn('kot', false)}
                  </div>
                  <div className="flex border-t border-border">
                    {renderBtn('pay', true)}
                  </div>
                </div>
              )
            }

            if (count === 2) {
              // Side by side, last one is blue
              const topBtns = btns.filter(b => b === 'save' || b === 'kot')
              if (topBtns.length === 2) {
                // Save + KOT, last (KOT) is blue
                return (
                  <div className="flex">
                    {renderBtn('save', false)}
                    {renderBtn('kot', true)}
                  </div>
                )
              }
              // One top + pay, or two side by side
              return (
                <div className="flex">
                  {btns.map((btn, i) => renderBtn(btn, i === btns.length - 1))}
                </div>
              )
            }

            // count === 1, full width blue
            return (
              <div className="flex">
                {renderBtn(btns[0], true)}
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

function CartSettingsPage() {
  const { settings, isLoading, saveSettings } = useSettingsStore()
  const [localSettings, setLocalSettings] = useState<CartSettings>(
    settings.cartSettings || {
      defaultOrderType: 'dine_in',
      showDineIn: true,
      showTakeout: true,
      showDelivery: true,
      showSpecialInstructions: true,
      showOrderNotes: true,
      confirmBeforeClear: true,
      autoClearAfterOrder: true,
      dineInButtons: { showSave: true, showKot: true, showPay: true },
      takeoutButtons: { showSave: false, showKot: false, showPay: true },
      deliveryButtons: { showSave: false, showKot: false, showPay: true },
    }
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (settings.cartSettings) {
      setLocalSettings(settings.cartSettings)
    }
  }, [settings.cartSettings])

  useEffect(() => {
    const current = settings.cartSettings || {}
    setHasChanges(JSON.stringify(localSettings) !== JSON.stringify(current))
  }, [localSettings, settings.cartSettings])

  const handleToggle = (key: keyof CartSettings) => {
    const val = localSettings[key]
    if (typeof val === 'boolean') {
      setLocalSettings((prev) => {
        const next = { ...prev, [key]: !prev[key] }
        // If an order type was disabled and it was the default, switch default to first enabled type
        const orderTypeMap: Record<string, keyof CartSettings> = {
          dine_in: 'showDineIn',
          takeout: 'showTakeout',
          delivery: 'showDelivery',
        }
        const settingKey = orderTypeMap[next.defaultOrderType]
        if (settingKey && !next[settingKey]) {
          const firstEnabled = (['dine_in', 'takeout', 'delivery'] as const).find(
            (t) => next[orderTypeMap[t]] as boolean
          )
          if (firstEnabled) next.defaultOrderType = firstEnabled
        }
        return next
      })
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await saveSettings({ ...settings, cartSettings: localSettings })
      toastHelpers.success('Settings saved', 'Cart settings have been updated.')
    } catch (err: any) {
      setError(err.message || 'Failed to save settings')
      toastHelpers.error('Failed to save', err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    if (settings.cartSettings) {
      setLocalSettings(settings.cartSettings)
    }
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
      title="Cart Settings"
      description="Configure order cart behavior and requirements"
      icon={<ShoppingCart className="w-5 h-5" />}
      hasChanges={hasChanges}
      saving={saving}
      error={error}
      onSave={handleSave}
      onReset={handleReset}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

        {/* ── Left: Settings controls ──────────────────────────────────── */}
        <div className="space-y-5">

          {/* Order Types */}
          <div className="bg-zinc-900 rounded-lg border border-zinc-800">
            <div className="px-5 pt-5 pb-3">
              <h3 className="text-base font-bold text-zinc-200">Order Types</h3>
              <p className="text-sm text-zinc-500">Choose which order types are available at the counter</p>
            </div>
            <div className="px-5 pb-5 space-y-2">
              {orderTypeOptions.map((option) => {
                const icon = option.icon === 'utensils' ? <UtensilsCrossed className="w-4 h-4" />
                  : option.icon === 'bag' ? <ShoppingBag className="w-4 h-4" />
                  : <Truck className="w-4 h-4" />
                const enabledCount = [localSettings.showDineIn, localSettings.showTakeout, localSettings.showDelivery].filter(Boolean).length
                const isEnabled = localSettings[option.key] as boolean
                const isLastEnabled = isEnabled && enabledCount === 1
                return (
                  <button
                    key={option.key}
                    onClick={() => {
                      if (isLastEnabled) return
                      handleToggle(option.key)
                    }}
                    className={cn(
                      'flex items-center justify-between w-full p-3 rounded-lg border transition-colors text-left',
                      isLastEnabled
                        ? 'bg-emerald-500/10 border-emerald-500/20 opacity-60 cursor-not-allowed'
                        : isEnabled
                          ? 'bg-emerald-500/10 border-emerald-500/20'
                          : 'bg-zinc-800/50 border-zinc-800 hover:bg-zinc-800'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center',
                        isEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-500'
                      )}>
                        {icon}
                      </div>
                      <div className="space-y-0.5">
                        <span className="block text-sm font-medium text-zinc-200">{option.label}</span>
                        <span className="block text-xs text-zinc-500">
                          {isLastEnabled ? 'At least one order type must be enabled' : option.description}
                        </span>
                      </div>
                    </div>
                    <div
                      className={cn(
                        'w-10 h-6 rounded-full relative transition-colors flex-shrink-0 ml-4',
                        isEnabled ? 'bg-emerald-500' : 'bg-zinc-700'
                      )}
                    >
                      <div
                        className={cn(
                          'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
                          isEnabled ? 'translate-x-5' : 'translate-x-1'
                        )}
                      />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Default Order Type */}
          <div className="bg-zinc-900 rounded-lg border border-zinc-800">
            <div className="px-5 pt-5 pb-3">
              <h3 className="text-base font-bold text-zinc-200">Default Order Type</h3>
              <p className="text-sm text-zinc-500">Set the default order type when starting a new order</p>
            </div>
            <div className="px-5 pb-5">
              <div className="flex gap-2">
                {(['dine_in', 'takeout', 'delivery'] as const).filter((type) => {
                  if (type === 'dine_in') return localSettings.showDineIn
                  if (type === 'takeout') return localSettings.showTakeout
                  return localSettings.showDelivery
                }).map((type) => {
                  const info = orderTypeLabels[type]
                  const active = localSettings.defaultOrderType === type
                  return (
                    <button
                      key={type}
                      onClick={() => setLocalSettings((prev) => ({ ...prev, defaultOrderType: type }))}
                      className={cn(
                        'flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors',
                        active
                          ? info.color
                          : 'bg-zinc-800/50 border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
                      )}
                    >
                      {info.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Toggle options */}
          <div className="bg-zinc-900 rounded-lg border border-zinc-800">
            <div className="px-5 pt-5 pb-3">
              <h3 className="text-base font-bold text-zinc-200">Cart Behavior</h3>
              <p className="text-sm text-zinc-500">Control requirements and features for the order cart</p>
            </div>
            <div className="px-5 pb-5 space-y-2">
              {toggleOptions.map((option) => (
                <div key={option.key}>
                  <button
                    onClick={() => handleToggle(option.key)}
                    className={cn(
                      'flex items-center justify-between w-full p-3 rounded-lg border transition-colors text-left',
                      localSettings[option.key]
                        ? 'bg-emerald-500/10 border-emerald-500/20'
                        : 'bg-zinc-800/50 border-zinc-800 hover:bg-zinc-800'
                    )}
                  >
                    <div className="space-y-0.5">
                      <span className="block text-sm font-medium text-zinc-200">{option.label}</span>
                      <span className="block text-xs text-zinc-500">{option.description}</span>
                    </div>
                    <div
                      className={cn(
                        'w-10 h-6 rounded-full relative transition-colors flex-shrink-0 ml-4',
                        localSettings[option.key] ? 'bg-emerald-500' : 'bg-zinc-700'
                      )}
                    >
                      <div
                        className={cn(
                          'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
                          localSettings[option.key] ? 'translate-x-5' : 'translate-x-1'
                        )}
                      />
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons — per order type */}
          <div className="bg-zinc-900 rounded-lg border border-zinc-800">
            <div className="px-5 pt-5 pb-3">
              <h3 className="text-base font-bold text-zinc-200">Action Buttons</h3>
              <p className="text-sm text-zinc-500">Choose which buttons appear for each order type</p>
            </div>
            <div className="px-5 pb-5 space-y-4">
              {orderTypeButtonSections
                .filter((section) => localSettings[section.visibilityKey] !== false)
                .map((section) => {
                  const buttons = localSettings[section.settingsKey] || { showSave: true, showKot: true, showPay: true }
                  return (
                    <div key={section.settingsKey}>
                      <div className={cn(
                        'text-xs font-semibold uppercase tracking-wider mb-2 px-1',
                        section.color === 'sky' ? 'text-sky-400' :
                        section.color === 'amber' ? 'text-amber-400' : 'text-violet-400'
                      )}>
                        {section.label}
                      </div>
                      <div className="space-y-1.5">
                        {actionButtonKeys.map((btn) => {
                          const isEnabled = buttons[btn.key]
                          const icon = btn.icon === 'chef' ? <ChefHat className="w-4 h-4" />
                            : btn.icon === 'printer' ? <Printer className="w-4 h-4" />
                            : <CreditCard className="w-4 h-4" />
                          return (
                            <button
                              key={btn.key}
                              onClick={() => {
                                setLocalSettings((prev) => ({
                                  ...prev,
                                  [section.settingsKey]: {
                                    ...prev[section.settingsKey],
                                    [btn.key]: !prev[section.settingsKey][btn.key],
                                  },
                                }))
                              }}
                              className={cn(
                                'flex items-center justify-between w-full p-2.5 rounded-lg border transition-colors text-left',
                                isEnabled
                                  ? 'bg-emerald-500/10 border-emerald-500/20'
                                  : 'bg-zinc-800/50 border-zinc-800 hover:bg-zinc-800'
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  'w-7 h-7 rounded-md flex items-center justify-center',
                                  isEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-500'
                                )}>
                                  {icon}
                                </div>
                                <div className="space-y-0">
                                  <span className="block text-sm font-medium text-zinc-200">{btn.label}</span>
                                  <span className="block text-[11px] text-zinc-500">{btn.description}</span>
                                </div>
                              </div>
                              <div className={cn(
                                'w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ml-4',
                                isEnabled ? 'bg-emerald-500' : 'bg-zinc-700'
                              )}>
                                <div className={cn(
                                  'absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform',
                                  isEnabled ? 'translate-x-4' : 'translate-x-0.5'
                                )} />
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        </div>

        {/* ── Right: Live Preview (sticky) ─────────────────────────────── */}
        <CartPreview
          cartSettings={localSettings}
          currencySymbol={settings.currencySymbol || '\u20B9'}
          taxRate={settings.taxRate || 0}
        />
      </div>
    </SettingsPageLayout>
  )
}
