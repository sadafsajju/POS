import { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { DollarSign, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@pos/core'
import { toastHelpers } from '@/lib/toast-helpers'
import { SettingsPageLayout } from '@/components/admin/settings/SettingsPageLayout'
import type { StoreSettings, TipAllocationMethod, VatRates } from '@pos/types'

export const Route = createFileRoute('/admin/more/financial')({
  component: FinancialSettingsPage,
})

const inputClass =
  'w-full h-10 px-3 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder:text-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 transition-colors'

const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: 'Europe/London',     label: 'London — GMT/BST' },
  { value: 'Europe/Dublin',     label: 'Dublin — GMT/IST' },
  { value: 'Europe/Paris',      label: 'Paris — CET/CEST' },
  { value: 'Europe/Berlin',     label: 'Berlin — CET/CEST' },
  { value: 'Europe/Madrid',     label: 'Madrid — CET/CEST' },
  { value: 'Asia/Kolkata',      label: 'India — IST' },
  { value: 'Asia/Dubai',        label: 'Dubai — GST' },
  { value: 'Asia/Singapore',    label: 'Singapore — SGT' },
  { value: 'Asia/Hong_Kong',    label: 'Hong Kong — HKT' },
  { value: 'Asia/Tokyo',        label: 'Tokyo — JST' },
  { value: 'Australia/Sydney',  label: 'Sydney — AEST/AEDT' },
  { value: 'America/New_York',  label: 'New York — EST/EDT' },
  { value: 'America/Los_Angeles', label: 'Los Angeles — PST/PDT' },
  { value: 'UTC',               label: 'UTC' },
]

type FinancialDraft = Pick<
  StoreSettings,
  | 'taxRegime'
  | 'taxRate'
  | 'serviceCharge'
  | 'vatRates'
  | 'vatNumber'
  | 'showAllergens'
  | 'showCalories'
  | 'tippingEnabled'
  | 'tippingPolicyUrl'
  | 'tipDefaultAllocationMethod'
  | 'privacyPolicyUrl'
  | 'customerRetentionMonths'
  | 'timezone'
>

function pick(s: StoreSettings): FinancialDraft {
  return {
    taxRegime: s.taxRegime,
    taxRate: s.taxRate,
    serviceCharge: s.serviceCharge,
    vatRates: s.vatRates,
    vatNumber: s.vatNumber,
    showAllergens: s.showAllergens,
    showCalories: s.showCalories,
    tippingEnabled: s.tippingEnabled,
    tippingPolicyUrl: s.tippingPolicyUrl,
    tipDefaultAllocationMethod: s.tipDefaultAllocationMethod,
    privacyPolicyUrl: s.privacyPolicyUrl,
    customerRetentionMonths: s.customerRetentionMonths,
    timezone: s.timezone,
  }
}

function FinancialSettingsPage() {
  const { settings, isLoading, saveSettings } = useSettingsStore()
  const [draft, setDraft] = useState<FinancialDraft>(() => pick(settings))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { setDraft(pick(settings)) }, [settings])

  const hasChanges = JSON.stringify(draft) !== JSON.stringify(pick(settings))

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await saveSettings(draft)
      toastHelpers.success('Settings saved', 'Financial settings updated.')
    } catch (err: any) {
      setError(err.message || 'Failed to save')
      toastHelpers.error('Failed to save', err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setDraft(pick(settings))
    toastHelpers.info('Changes discarded', 'Settings reset to last saved values.')
  }

  if (isLoading && !settings.restaurantName) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
      </div>
    )
  }

  const isUkVat = draft.taxRegime === 'uk_vat'

  return (
    <SettingsPageLayout
      title="Financial Settings"
      description="Tax regime, allergens, tipping, privacy & timezone"
      icon={<DollarSign className="w-5 h-5" />}
      hasChanges={hasChanges}
      saving={saving}
      error={error}
      onSave={handleSave}
      onReset={handleReset}
    >
      <SectionHeading title="Tax regime" />
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-5 space-y-5 mt-3">
        <FieldGroup
          label="Regime"
          hint="Flat applies one rate to subtotal. UK VAT uses per-product VAT category and the eat-in/takeaway rule."
        >
          <select
            value={draft.taxRegime}
            onChange={(e) => setDraft({ ...draft, taxRegime: e.target.value as 'flat' | 'uk_vat' })}
            className={inputClass}
          >
            <option value="flat">Flat tax (single rate)</option>
            <option value="uk_vat">UK VAT (multi-rate, eat-in/takeaway)</option>
          </select>
        </FieldGroup>

        {!isUkVat ? (
          <div className="grid grid-cols-2 gap-4">
            <FieldGroup label="Tax rate (%)">
              <input
                type="number" step="0.01" min="0" max="100"
                value={draft.taxRate}
                onChange={(e) => setDraft({ ...draft, taxRate: parseFloat(e.target.value) || 0 })}
                className={inputClass}
              />
            </FieldGroup>
            <FieldGroup label="Service charge (%)">
              <input
                type="number" step="0.01" min="0" max="100"
                value={draft.serviceCharge}
                onChange={(e) => setDraft({ ...draft, serviceCharge: parseFloat(e.target.value) || 0 })}
                className={inputClass}
              />
            </FieldGroup>
          </div>
        ) : (
          <>
            <FieldGroup label="VAT registration number" hint="Printed on every VAT invoice / receipt.">
              <input
                value={draft.vatNumber ?? ''}
                onChange={(e) => setDraft({ ...draft, vatNumber: e.target.value })}
                placeholder="GB123456789"
                className={inputClass}
              />
            </FieldGroup>
            <div className="grid grid-cols-3 gap-4">
              {(['standard', 'reduced', 'zero'] as const).map((rate) => (
                <FieldGroup key={rate} label={`${rate.charAt(0).toUpperCase()}${rate.slice(1)} (%)`}>
                  <input
                    type="number" step="0.01" min="0" max="100"
                    value={draft.vatRates?.[rate] ?? 0}
                    onChange={(e) => setDraft({
                      ...draft,
                      vatRates: { ...(draft.vatRates as VatRates), [rate]: parseFloat(e.target.value) || 0 },
                    })}
                    className={inputClass}
                  />
                </FieldGroup>
              ))}
            </div>
            <p className="text-xs text-zinc-500">
              Per-product VAT category and "Hot food" toggle live on each product. Hot food and eat-in cold food
              are always standard-rated; cold takeaway uses the product's VAT category.
            </p>
          </>
        )}
      </div>

      <SectionHeading title="Allergens" />
      <Toggle
        label="Allergen surfacing & staff confirmation"
        description="Shows allergen warnings on cart, KOT and receipts. Staff must confirm allergens with the customer before any flagged order can be sent (UK Natasha's Law / FIC Regs)."
        on={draft.showAllergens}
        onChange={(v) => setDraft({ ...draft, showAllergens: v })}
        accent="red"
      />

      <SectionHeading title="Calorie labelling" />
      <Toggle
        label="Show kcal on menu, cart & receipts"
        description="Mandatory in England for businesses with 250+ employees (Calorie Labelling Regs 2021). Set kcal per product in Products → edit. Receipts gain the statutory 'Adults need around 2000 kcal a day' note."
        on={draft.showCalories}
        onChange={(v) => setDraft({ ...draft, showCalories: v })}
        accent="amber"
      />

      <SectionHeading title="Tipping (Employment (Allocation of Tips) Act 2023)" />
      <Toggle
        label="Enable tipping"
        description="Shows tip controls on each bill, totals on the day-end report, and unlocks the staff allocation page."
        on={draft.tippingEnabled}
        onChange={(v) => setDraft({ ...draft, tippingEnabled: v })}
        accent="emerald"
      />
      {draft.tippingEnabled && (
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-5 space-y-5">
          <FieldGroup
            label="Tipping policy URL"
            hint="The Act requires a written tipping policy. Linked from the cart and the staff allocation page."
          >
            <input
              type="url"
              value={draft.tippingPolicyUrl ?? ''}
              onChange={(e) => setDraft({ ...draft, tippingPolicyUrl: e.target.value })}
              placeholder="https://example.com/tipping-policy"
              className={inputClass}
            />
          </FieldGroup>
          <FieldGroup label="Default allocation method">
            <select
              value={draft.tipDefaultAllocationMethod ?? 'equal'}
              onChange={(e) => setDraft({ ...draft, tipDefaultAllocationMethod: e.target.value as TipAllocationMethod })}
              className={inputClass}
            >
              <option value="equal">Equal — split evenly across all staff</option>
              <option value="hours_weighted">Hours-weighted — by hours worked</option>
              <option value="manual">Manual — enter amounts directly</option>
            </select>
          </FieldGroup>
        </div>
      )}

      <SectionHeading title="Privacy & retention (UK GDPR)" />
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-5 space-y-5">
        <FieldGroup label="Privacy policy URL" hint="Printed on receipts and the customer-web cookie banner.">
          <input
            type="url"
            value={draft.privacyPolicyUrl ?? ''}
            onChange={(e) => setDraft({ ...draft, privacyPolicyUrl: e.target.value })}
            placeholder="https://example.com/privacy"
            className={inputClass}
          />
        </FieldGroup>
        <FieldGroup
          label="Customer retention (months)"
          hint="Customers inactive longer than this are flagged for anonymisation by Apply Retention Policy. Leave empty for no auto-policy. UK tax law independently requires order/payment records to be kept 6 years."
        >
          <input
            type="number"
            min="0"
            value={draft.customerRetentionMonths ?? ''}
            onChange={(e) =>
              setDraft({ ...draft, customerRetentionMonths: e.target.value === '' ? undefined : parseInt(e.target.value, 10) })
            }
            placeholder="e.g. 24"
            className={inputClass}
          />
        </FieldGroup>
      </div>

      <SectionHeading title="Timezone" />
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-5 space-y-5">
        <FieldGroup
          label="Business timezone"
          hint="Defines the business day for order numbering, dashboard, EOD, tip pool, sales reports and VAT export. Crosses midnight here, not UTC."
        >
          <select
            value={draft.timezone || 'Europe/London'}
            onChange={(e) => setDraft({ ...draft, timezone: e.target.value })}
            className={inputClass}
          >
            {TIMEZONE_OPTIONS.map((tz) => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>
        </FieldGroup>
      </div>
    </SettingsPageLayout>
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

function Toggle({
  label,
  description,
  on,
  onChange,
  accent,
}: {
  label: string
  description: string
  on: boolean
  onChange: (next: boolean) => void
  accent: 'red' | 'amber' | 'emerald'
}) {
  const accentClass =
    accent === 'red' ? 'border-red-500/60 bg-red-500/10 text-red-300'
    : accent === 'amber' ? 'border-amber-500/60 bg-amber-500/10 text-amber-300'
    : 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300'

  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-zinc-100">{label}</div>
        <div className="text-xs text-zinc-500 mt-1">{description}</div>
      </div>
      <button
        type="button"
        onClick={() => onChange(!on)}
        className={cn(
          'shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all',
          on ? accentClass : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
        )}
      >
        {on ? 'On' : 'Off'}
      </button>
    </div>
  )
}
