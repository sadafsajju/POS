import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PinInput } from '@/components/ui/pin-input'
import {
  Check,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Cloud,
  HardDrive,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { setupApi, type CreateAdminRequest } from '@pos/api-client'
import { markSetupComplete } from '@pos/core'
import { cn } from '@/lib/utils'

const isTauri = typeof window !== 'undefined' && '__TAURI__' in window

type Step = 'mode' | 'admin' | 'store' | 'pin' | 'complete'

interface SetupWizardProps {
  mode?: string
}

interface FormData {
  username: string
  email: string
  password: string
  confirmPassword: string
  firstName: string
  lastName: string
  pin: string
  confirmPin: string
  storeName: string
  locationName: string
  locationCode: string
  currency: string
  currencySymbol: string
  taxRate: string
}

const initialFormData: FormData = {
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  firstName: '',
  lastName: '',
  pin: '',
  confirmPin: '',
  storeName: '',
  locationName: '',
  locationCode: '',
  currency: 'INR',
  currencySymbol: '₹',
  taxRate: '0',
}

const currencyOptions = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
]

export function SetupWizard({ mode: _mode }: SetupWizardProps = {}) {
  // In Tauri, start with mode selection; in browser, skip straight to online setup
  const [step, setStep] = useState<Step>(isTauri ? 'mode' : 'admin')
  const [isOffline, setIsOffline] = useState(false)
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})

  // Steps depend on online vs offline — offline skips 'admin' (no account needed)
  const stepKeys: readonly Step[] = isOffline
    ? ['mode', 'store', 'pin', 'complete']
    : isTauri
      ? ['mode', 'admin', 'store', 'pin', 'complete']
      : ['admin', 'store', 'pin', 'complete']

  const currentIdx = stepKeys.indexOf(step)

  const setupMutation = useMutation({
    mutationFn: async (data: CreateAdminRequest) => {
      const response = await setupApi.createAdmin(data)
      if (!response.success) throw new Error(response.message || 'Setup failed')
      return response
    },
    onSuccess: () => {
      markSetupComplete()
      setStep('complete')
    },
    onError: (error: Error) => {
      setErrors({ username: error.message || 'Setup failed. Please try again.' })
    },
  })

  const updateField = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  const validateAdminStep = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {}
    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required'
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required'
    if (!formData.email.trim()) newErrors.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Please enter a valid email'
    if (!formData.password) newErrors.password = 'Password is required'
    else if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters'
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const validatePinStep = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {}
    if (!formData.pin) newErrors.pin = 'PIN is required'
    else if (formData.pin.length !== 4) newErrors.pin = 'PIN must be exactly 4 digits'
    else if (!/^\d{4}$/.test(formData.pin)) newErrors.pin = 'PIN must contain only digits'
    if (formData.pin && formData.pin !== formData.confirmPin) newErrors.confirmPin = 'PINs do not match'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const validateStoreStep = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {}
    if (!formData.storeName.trim()) newErrors.storeName = 'Store name is required'
    if (!formData.locationName.trim()) newErrors.locationName = 'Branch name is required'
    if (!formData.locationCode.trim()) newErrors.locationCode = 'Branch code is required'
    else if (!/^[A-Z0-9-]+$/.test(formData.locationCode)) newErrors.locationCode = 'Use uppercase letters, numbers, and dashes only'
    const taxRate = parseFloat(formData.taxRate)
    if (isNaN(taxRate) || taxRate < 0 || taxRate > 100) newErrors.taxRate = 'Tax rate must be between 0 and 100'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const submitOnlineSetup = () => {
    const payload: CreateAdminRequest = {
      username: formData.email.split('@')[0],
      email: formData.email,
      password: formData.password,
      first_name: formData.firstName,
      last_name: formData.lastName,
      pin: formData.pin,
      store_name: formData.storeName,
      location_name: formData.locationName,
      location_code: formData.locationCode,
      currency: formData.currency,
      currency_symbol: formData.currencySymbol,
      tax_rate: formData.taxRate,
    }
    setupMutation.mutate(payload)
  }

  const submitOfflineSetup = () => {
    try {
      localStorage.setItem('pos_setup_complete', 'true')
      localStorage.setItem('pos_offline_mode', 'true')
      localStorage.setItem('pos_store_settings', JSON.stringify({
        storeName: formData.storeName,
        locationName: formData.locationName,
        locationCode: formData.locationCode,
        currency: formData.currency,
        currencySymbol: formData.currencySymbol,
        taxRate: formData.taxRate,
        pin: formData.pin,
      }))
      markSetupComplete()
      setStep('complete')
    } catch {
      setErrors({ storeName: 'Failed to save settings locally. Please try again.' })
    }
  }

  const handleModeSelect = (offline: boolean) => {
    setIsOffline(offline)
    if (offline) {
      setStep('store')
    } else {
      setStep('admin')
    }
  }

  const handleNext = () => {
    if (step === 'admin') {
      if (validateAdminStep()) setStep('store')
    } else if (step === 'store') {
      if (validateStoreStep()) setStep('pin')
    } else if (step === 'pin') {
      if (validatePinStep()) {
        if (isOffline) {
          submitOfflineSetup()
        } else {
          submitOnlineSetup()
        }
      }
    }
  }

  const handleBack = () => {
    if (step === 'admin') {
      if (isTauri) {
        setStep('mode')
      } else {
        window.location.href = '/landing'
      }
    } else if (step === 'store') setStep(isOffline ? 'mode' : 'admin')
    else if (step === 'pin') setStep('store')
  }

  const handleCurrencyChange = (currencyCode: string) => {
    const currency = currencyOptions.find(c => c.code === currencyCode)
    if (currency) {
      setFormData(prev => ({ ...prev, currency: currency.code, currencySymbol: currency.symbol }))
    }
  }

  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-zinc-100 select-none overflow-hidden">
      {/* Header strip */}
      <header className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-zinc-800/50">
        <div className="flex items-center gap-3">
          <a href="/landing" className="p-1.5 -ml-1 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </a>
          <div className="flex items-center gap-2">
            {stepKeys.map((s, i) => {
              const isActive = i === currentIdx
              const isDone = i < currentIdx
              return (
                <div key={s} className={cn(
                  'h-1 rounded-full transition-all',
                  isActive ? 'w-8 bg-zinc-100' : isDone ? 'w-8 bg-zinc-600' : 'w-8 bg-zinc-800'
                )} />
              )
            })}
          </div>
        </div>
        <span className="text-xs text-zinc-600 tabular-nums">
          Step {currentIdx + 1} of {stepKeys.length}
        </span>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-6 overflow-y-auto">
        <div className="w-full max-w-md py-8">

          {step === 'mode' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-black tracking-tight text-zinc-100">How do you want to use POS?</h2>
                <p className="text-sm text-zinc-400 mt-1">You can always change this later</p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => handleModeSelect(false)}
                  className="w-full text-left px-4 py-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/80 active:bg-zinc-800 transition-colors group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-sky-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Cloud className="w-5 h-5 text-sky-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-100">Online</span>
                        <span className="text-[10px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400">Recommended</span>
                      </div>
                      <p className="text-sm text-zinc-400 mt-1 leading-relaxed">
                        Create an account to sync data across devices, access reports from anywhere, and get automatic backups.
                      </p>
                      <div className="flex items-center gap-1.5 mt-2 text-xs text-zinc-500">
                        <Wifi className="w-3 h-3" />
                        <span>Requires internet for setup</span>
                      </div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => handleModeSelect(true)}
                  className="w-full text-left px-4 py-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/80 active:bg-zinc-800 transition-colors group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-zinc-700/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <HardDrive className="w-5 h-5 text-zinc-400" />
                    </div>
                    <div>
                      <span className="font-bold text-zinc-100">Offline Only</span>
                      <p className="text-sm text-zinc-400 mt-1 leading-relaxed">
                        Run completely offline on this device. No account needed.
                      </p>
                      <div className="flex items-center gap-1.5 mt-2 text-xs text-zinc-500">
                        <WifiOff className="w-3 h-3" />
                        <span>No internet required</span>
                      </div>
                      <p className="text-xs text-amber-500/80 mt-1.5">
                        Your data will only exist on this device. No cloud access, no cross-device sync, no remote reports.
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {step === 'admin' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-black tracking-tight text-zinc-100">Create Admin Account</h2>
                <p className="text-sm text-zinc-400 mt-1">Sign up with your email to enable cloud sync</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FieldGroup label="First Name" error={errors.firstName}>
                  <Input placeholder="John" value={formData.firstName} onChange={(e) => updateField('firstName', e.target.value)} className={cn('bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600', errors.firstName && 'border-red-500')} />
                </FieldGroup>
                <FieldGroup label="Last Name" error={errors.lastName}>
                  <Input placeholder="Doe" value={formData.lastName} onChange={(e) => updateField('lastName', e.target.value)} className={cn('bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600', errors.lastName && 'border-red-500')} />
                </FieldGroup>
              </div>

              <FieldGroup label="Email" error={errors.email}>
                <Input type="email" placeholder="admin@example.com" value={formData.email} onChange={(e) => updateField('email', e.target.value)} className={cn('bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600', errors.email && 'border-red-500')} />
              </FieldGroup>

              <div className="grid grid-cols-2 gap-3">
                <FieldGroup label="Password" error={errors.password}>
                  <Input type="password" placeholder="********" value={formData.password} onChange={(e) => updateField('password', e.target.value)} className={cn('bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600', errors.password && 'border-red-500')} />
                </FieldGroup>
                <FieldGroup label="Confirm Password" error={errors.confirmPassword}>
                  <Input type="password" placeholder="********" value={formData.confirmPassword} onChange={(e) => updateField('confirmPassword', e.target.value)} className={cn('bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600', errors.confirmPassword && 'border-red-500')} />
                </FieldGroup>
              </div>

            </div>
          )}

          {step === 'store' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-black tracking-tight text-zinc-100">Store Settings</h2>
                <p className="text-sm text-zinc-400 mt-1">Configure your brand and first branch location</p>
              </div>

              <FieldGroup label="Brand / Store Name" error={errors.storeName}>
                <Input placeholder="My Restaurant" value={formData.storeName} onChange={(e) => {
                  updateField('storeName', e.target.value)
                  if (!formData.locationName || formData.locationName === formData.storeName) {
                    setFormData(prev => ({ ...prev, storeName: e.target.value, locationName: e.target.value }))
                  }
                }} className={cn('bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600', errors.storeName && 'border-red-500')} />
              </FieldGroup>

              <div className="grid grid-cols-2 gap-3">
                <FieldGroup label="Branch Name" error={errors.locationName}>
                  <Input placeholder="Main Branch" value={formData.locationName} onChange={(e) => updateField('locationName', e.target.value)} className={cn('bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600', errors.locationName && 'border-red-500')} />
                </FieldGroup>
                <FieldGroup label="Branch Code" error={errors.locationCode}>
                  <Input placeholder="MAIN" value={formData.locationCode} onChange={(e) => updateField('locationCode', e.target.value.toUpperCase())} className={cn('bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600', errors.locationCode && 'border-red-500')} />
                </FieldGroup>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FieldGroup label="Currency">
                  <Select value={formData.currency} onValueChange={handleCurrencyChange}>
                    <SelectTrigger className="bg-zinc-900 border-zinc-700 text-zinc-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-700">
                      {currencyOptions.map(opt => (
                        <SelectItem key={opt.code} value={opt.code} className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">
                          {opt.symbol} - {opt.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldGroup>
                <FieldGroup label="Tax Rate (%)" error={errors.taxRate}>
                  <Input type="number" step="0.1" min="0" max="100" placeholder="10" value={formData.taxRate} onChange={(e) => updateField('taxRate', e.target.value)} className={cn('bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600', errors.taxRate && 'border-red-500')} />
                </FieldGroup>
              </div>

            </div>
          )}

          {step === 'pin' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-black tracking-tight text-zinc-100">Set Your PIN</h2>
                <p className="text-sm text-zinc-400 mt-1">
                  Used for quick login and confirming actions like delete, cancel, etc.
                </p>
              </div>

              <div className="space-y-3">
                <FieldGroup label="PIN" error={errors.pin}>
                  <PinInput value={formData.pin} onChange={(v) => updateField('pin', v)} autoFocus={false} error={!!errors.pin} mask />
                </FieldGroup>
                <FieldGroup label="Confirm PIN" error={errors.confirmPin}>
                  <PinInput value={formData.confirmPin} onChange={(v) => updateField('confirmPin', v)} autoFocus={false} error={!!errors.confirmPin} mask />
                </FieldGroup>
              </div>
            </div>
          )}

          {step === 'complete' && (
            <div className="space-y-6">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Check className="w-7 h-7 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight text-zinc-100">Setup Complete</h2>
                <p className="text-sm text-zinc-400 mt-1">
                  {isOffline
                    ? 'Your offline POS system is ready. All data will be stored locally on this device.'
                    : 'Your cloud POS system is ready. Sign in to get started.'}
                </p>
              </div>
              <div className="px-4 py-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-zinc-500">Store</span>
                  <span className="font-bold text-zinc-100">{formData.storeName}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-zinc-500">Mode</span>
                  <span className="font-bold text-zinc-100">{isOffline ? 'Offline' : 'Online'}</span>
                </div>
                {!isOffline && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-zinc-500">Email</span>
                    <span className="font-bold text-zinc-100">{formData.email}</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => { window.location.href = isOffline ? '/admin/pos' : '/login' }}
                className="w-full py-4 text-base font-black tracking-wider text-zinc-950 bg-zinc-100 rounded-xl hover:bg-white active:bg-zinc-200 transition-colors"
              >
                {isOffline ? 'START USING POS' : 'GO TO LOGIN'}
              </button>
            </div>
          )}

          {/* Error display */}
          {setupMutation.isError && (
            <div className="mt-4 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-red-300">{setupMutation.error?.message || 'Setup failed. Please try again.'}</span>
            </div>
          )}

          {/* Navigation */}
          {step !== 'complete' && step !== 'mode' && (
            <div className="flex items-center gap-3 mt-8">
              <button
                onClick={handleBack}
                className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-zinc-400 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 active:bg-zinc-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                BACK
              </button>
              <button
                onClick={handleNext}
                disabled={setupMutation.isPending}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black tracking-wider transition-colors',
                  step === 'pin'
                    ? 'bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white'
                    : 'bg-zinc-100 hover:bg-white active:bg-zinc-200 text-zinc-950',
                  setupMutation.isPending && 'opacity-60 cursor-not-allowed',
                )}
              >
                {setupMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> SAVING...</>
                ) : step === 'pin' ? (
                  <><Check className="w-4 h-4" /> COMPLETE SETUP</>
                ) : (
                  <>NEXT <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FieldGroup({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-bold tracking-wide text-zinc-500 uppercase mb-1.5 block">{label}</label>
      {children}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  )
}
