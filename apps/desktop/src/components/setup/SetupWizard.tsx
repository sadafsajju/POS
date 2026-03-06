import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PinInput } from '@/components/ui/pin-input'
import {
  ShoppingCart,
  Building,
  Check,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Shield,
  Zap,
  Cloud,
  HardDrive,
  Wifi,
  WifiOff,
  Download,
  Monitor,
  Apple,
} from 'lucide-react'
import { setupApi, type CreateAdminRequest } from '@pos/api-client'
import { markSetupComplete } from '@pos/core'
import { cn } from '@/lib/utils'

// Detect if running inside Tauri (native desktop app)
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window

type SetupMode = 'online' | 'offline' | null
type Step = 'welcome' | 'download' | 'admin' | 'store' | 'pin' | 'complete'

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
  currency: 'USD',
  currencySymbol: '$',
  taxRate: '10',
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

const STEP_META = {
  admin: { label: 'ACCOUNT', accent: 'bg-amber-500', text: 'text-amber-600', bg: 'bg-amber-50' },
  store: { label: 'STORE', accent: 'bg-sky-500', text: 'text-sky-600', bg: 'bg-sky-50' },
  pin: { label: 'PIN', accent: 'bg-violet-500', text: 'text-violet-600', bg: 'bg-violet-50' },
  complete: { label: 'DONE', accent: 'bg-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50' },
} as const

export function SetupWizard({ mode: _mode }: SetupWizardProps = {}) {
  const [setupMode, setSetupMode] = useState<SetupMode>(null)
  const [step, setStep] = useState<Step>('welcome')
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})

  const stepKeys = ['admin', 'store', 'pin', 'complete'] as const

  // Online setup: Supabase signUp + initial_setup RPC
  const onlineSetupMutation = useMutation({
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

  // Offline setup: store everything in localStorage
  const offlineSetupMutation = useMutation({
    mutationFn: async (data: CreateAdminRequest) => {
      // Store admin + store config in localStorage for offline use
      const offlineConfig = {
        admin: {
          username: data.username,
          first_name: data.first_name,
          last_name: data.last_name,
          pin: data.pin,
          role: 'admin',
        },
        store: {
          store_name: data.store_name,
          location_name: data.location_name,
          location_code: data.location_code,
          currency: data.currency,
          currency_symbol: data.currency_symbol,
          tax_rate: data.tax_rate,
        },
        setup_completed: true,
        setup_mode: 'offline',
        created_at: new Date().toISOString(),
      }
      localStorage.setItem('pos_offline_config', JSON.stringify(offlineConfig))
      localStorage.setItem('pos_setup_complete', 'true')
      return { success: true, message: 'Offline setup complete' }
    },
    onSuccess: () => {
      markSetupComplete()
      setStep('complete')
    },
    onError: (error: Error) => {
      setErrors({ username: error.message || 'Setup failed.' })
    },
  })

  const activeMutation = setupMode === 'online' ? onlineSetupMutation : offlineSetupMutation

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
    if (!formData.username.trim()) newErrors.username = 'Username is required'
    else if (formData.username.length < 3) newErrors.username = 'Username must be at least 3 characters'

    if (setupMode === 'online') {
      if (!formData.email.trim()) newErrors.email = 'Email is required'
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Please enter a valid email'
      if (!formData.password) newErrors.password = 'Password is required'
      else if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters'
      if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match'
    }

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

  const submitSetup = () => {
    const payload: CreateAdminRequest = {
      username: formData.username,
      email: formData.email || `${formData.username}@local`,
      password: formData.password || formData.pin,
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

    if (setupMode === 'online') {
      onlineSetupMutation.mutate(payload)
    } else {
      offlineSetupMutation.mutate(payload)
    }
  }

  const handleNext = () => {
    if (step === 'admin') {
      if (validateAdminStep()) setStep('store')
    } else if (step === 'store') {
      if (validateStoreStep()) setStep('pin')
    } else if (step === 'pin') {
      if (validatePinStep()) submitSetup()
    }
  }

  const handleBack = () => {
    if (step === 'admin') { setStep('welcome'); setSetupMode(null) }
    else if (step === 'store') setStep('admin')
    else if (step === 'pin') setStep('store')
  }

  const handleCurrencyChange = (currencyCode: string) => {
    const currency = currencyOptions.find(c => c.code === currencyCode)
    if (currency) {
      setFormData(prev => ({ ...prev, currency: currency.code, currencySymbol: currency.symbol }))
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WELCOME — choose Online or Offline
  // ═══════════════════════════════════════════════════════════════════════════

  if (step === 'welcome') {
    return (
      <div className="h-screen flex flex-col bg-white select-none overflow-hidden">
        <header className="flex-shrink-0 flex items-center justify-between px-6 py-3 bg-zinc-50 border-b border-zinc-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
              <ShoppingCart className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold tracking-tight text-zinc-800">POS SYSTEM</span>
          </div>
          <span className="text-xs font-mono text-zinc-400 tabular-nums">v0.1.0</span>
        </header>

        <div className="flex-1 flex items-center justify-center px-6">
          <div className="flex flex-col items-center text-center max-w-lg">
            <div className="w-20 h-20 bg-zinc-900 rounded-2xl flex items-center justify-center mb-8">
              <ShoppingCart className="w-10 h-10 text-white" />
            </div>

            <h1 className="text-3xl font-black tracking-tight text-zinc-900 mb-2">
              Welcome
            </h1>
            <p className="text-base text-zinc-500 mb-10 leading-relaxed">
              Choose how you want to run your POS system.
            </p>

            <div className="grid grid-cols-2 gap-4 w-full max-w-md mb-8">
              {/* Online / Cloud */}
              <button
                onClick={() => { setSetupMode('online'); setStep('admin') }}
                className="group flex flex-col items-center gap-4 p-6 rounded-2xl border-2 border-zinc-200 bg-white hover:border-blue-400 hover:bg-blue-50/50 transition-all text-left"
              >
                <div className="w-14 h-14 rounded-xl bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center transition-colors">
                  <Cloud className="w-7 h-7 text-blue-600" />
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <Wifi className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-sm font-black tracking-tight text-zinc-900">ONLINE</span>
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    Cloud sync, multi-device, sign up with email
                  </p>
                </div>
              </button>

              {/* Offline / Local */}
              <button
                onClick={() => {
                  setSetupMode('offline')
                  if (isTauri) {
                    setStep('admin')
                  } else {
                    setStep('download')
                  }
                }}
                className="group flex flex-col items-center gap-4 p-6 rounded-2xl border-2 border-zinc-200 bg-white hover:border-amber-400 hover:bg-amber-50/50 transition-all text-left"
              >
                <div className="w-14 h-14 rounded-xl bg-amber-100 group-hover:bg-amber-200 flex items-center justify-center transition-colors">
                  <HardDrive className="w-7 h-7 text-amber-600" />
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <WifiOff className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-sm font-black tracking-tight text-zinc-900">OFFLINE</span>
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    Local only, no internet needed, data on this device
                  </p>
                </div>
              </button>
            </div>

            <div className="flex items-center gap-4">
              <FeaturePill icon={<Zap className="w-4 h-4" />} label="Fast Checkout" color="bg-amber-500" />
              <FeaturePill icon={<Shield className="w-4 h-4" />} label="Offline Ready" color="bg-emerald-500" />
              <FeaturePill icon={<Building className="w-4 h-4" />} label="Multi-Platform" color="bg-sky-500" />
            </div>

            <p className="text-xs text-zinc-400 mt-6">Takes less than a minute</p>
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DOWNLOAD — prompt browser users to download the desktop app for offline
  // ═══════════════════════════════════════════════════════════════════════════

  if (step === 'download') {
    return (
      <div className="h-screen flex flex-col bg-white select-none overflow-hidden">
        <header className="flex-shrink-0 flex items-center justify-between px-6 py-3 bg-zinc-50 border-b border-zinc-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
              <ShoppingCart className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold tracking-tight text-zinc-800">POS SYSTEM</span>
          </div>
          <span className="text-xs font-mono text-zinc-400 tabular-nums">v0.1.0</span>
        </header>

        <div className="flex-1 flex items-center justify-center px-6">
          <div className="flex flex-col items-center text-center max-w-lg">
            <div className="w-20 h-20 bg-amber-100 rounded-2xl flex items-center justify-center mb-8">
              <Download className="w-10 h-10 text-amber-600" />
            </div>

            <h1 className="text-3xl font-black tracking-tight text-zinc-900 mb-2">
              Download Desktop App
            </h1>
            <p className="text-base text-zinc-500 mb-8 leading-relaxed">
              Offline mode requires the desktop app. Download it for your platform to use POS without an internet connection.
            </p>

            <div className="grid grid-cols-2 gap-4 w-full max-w-sm mb-8">
              <a
                href="https://github.com/your-org/pos/releases/latest/download/POS.dmg"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-zinc-200 bg-white hover:border-zinc-400 hover:bg-zinc-50 transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-zinc-100 group-hover:bg-zinc-200 flex items-center justify-center transition-colors">
                  <Apple className="w-6 h-6 text-zinc-700" />
                </div>
                <div className="text-center">
                  <span className="text-sm font-black tracking-tight text-zinc-900 block">macOS</span>
                  <span className="text-xs text-zinc-400">.dmg</span>
                </div>
              </a>

              <a
                href="https://github.com/your-org/pos/releases/latest/download/POS.exe"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-zinc-200 bg-white hover:border-blue-400 hover:bg-blue-50/50 transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center transition-colors">
                  <Monitor className="w-6 h-6 text-blue-600" />
                </div>
                <div className="text-center">
                  <span className="text-sm font-black tracking-tight text-zinc-900 block">Windows</span>
                  <span className="text-xs text-zinc-400">.exe</span>
                </div>
              </a>
            </div>

            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 mb-6">
              <HardDrive className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <span className="text-xs text-amber-700">
                The desktop app stores data locally using SQLite — no internet needed after install.
              </span>
            </div>

            <button
              onClick={() => { setStep('welcome'); setSetupMode(null) }}
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-zinc-500 bg-zinc-100 hover:bg-zinc-200 active:bg-zinc-300 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              BACK
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WIZARD STEPS
  // ═══════════════════════════════════════════════════════════════════════════

  const meta = STEP_META[step as keyof typeof STEP_META]
  const currentIdx = stepKeys.indexOf(step as keyof typeof STEP_META)
  const modeLabel = setupMode === 'online' ? 'CLOUD' : 'LOCAL'
  const modeColor = setupMode === 'online' ? 'text-blue-500' : 'text-amber-500'

  return (
    <div className="h-screen flex flex-col bg-white select-none overflow-hidden">
      {/* Header strip */}
      <header className="flex-shrink-0 flex items-center justify-between px-6 py-3 bg-zinc-50 border-b border-zinc-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
            <ShoppingCart className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-bold tracking-tight text-zinc-800">SETUP</span>
          <span className={cn('text-xs font-bold tracking-wider', modeColor)}>{modeLabel}</span>
          <div className="h-4 w-px bg-zinc-300" />
          {stepKeys.map((s, i) => {
            const m = STEP_META[s]
            const isActive = i === currentIdx
            const isDone = i < currentIdx
            return (
              <div key={s} className="flex items-center gap-1.5">
                <span className={cn(
                  'w-2 h-2 rounded-full',
                  isDone ? m.accent : isActive ? m.accent : 'bg-zinc-300',
                  isActive && 'animate-pulse'
                )} />
                <span className={cn(
                  'text-xs font-bold tracking-wider',
                  isDone ? 'text-zinc-400' : isActive ? m.text : 'text-zinc-300'
                )}>
                  {m.label}
                </span>
              </div>
            )
          })}
        </div>
        <span className="text-xs text-zinc-400 tabular-nums">
          {currentIdx + 1} / {stepKeys.length}
        </span>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-6 overflow-y-auto">
        <div className="w-full max-w-md py-8">
          {/* Step accent bar */}
          <div className={cn('h-1 w-16 rounded-full mb-6', meta.accent)} />

          {step === 'admin' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-black tracking-tight text-zinc-900">Create Admin Account</h2>
                <p className="text-sm text-zinc-500 mt-1">
                  {setupMode === 'online'
                    ? 'Sign up with your email to enable cloud sync'
                    : 'Create a local admin account for this device'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FieldGroup label="First Name" error={errors.firstName}>
                  <Input placeholder="John" value={formData.firstName} onChange={(e) => updateField('firstName', e.target.value)} className={cn('bg-zinc-50 border-zinc-200', errors.firstName && 'border-red-400')} />
                </FieldGroup>
                <FieldGroup label="Last Name" error={errors.lastName}>
                  <Input placeholder="Doe" value={formData.lastName} onChange={(e) => updateField('lastName', e.target.value)} className={cn('bg-zinc-50 border-zinc-200', errors.lastName && 'border-red-400')} />
                </FieldGroup>
              </div>

              <FieldGroup label="Username" error={errors.username}>
                <Input placeholder="admin" value={formData.username} onChange={(e) => updateField('username', e.target.value)} className={cn('bg-zinc-50 border-zinc-200', errors.username && 'border-red-400')} />
              </FieldGroup>

              {setupMode === 'online' && (
                <>
                  <FieldGroup label="Email" error={errors.email}>
                    <Input type="email" placeholder="admin@example.com" value={formData.email} onChange={(e) => updateField('email', e.target.value)} className={cn('bg-zinc-50 border-zinc-200', errors.email && 'border-red-400')} />
                  </FieldGroup>

                  <div className="grid grid-cols-2 gap-3">
                    <FieldGroup label="Password" error={errors.password}>
                      <Input type="password" placeholder="********" value={formData.password} onChange={(e) => updateField('password', e.target.value)} className={cn('bg-zinc-50 border-zinc-200', errors.password && 'border-red-400')} />
                    </FieldGroup>
                    <FieldGroup label="Confirm Password" error={errors.confirmPassword}>
                      <Input type="password" placeholder="********" value={formData.confirmPassword} onChange={(e) => updateField('confirmPassword', e.target.value)} className={cn('bg-zinc-50 border-zinc-200', errors.confirmPassword && 'border-red-400')} />
                    </FieldGroup>
                  </div>

                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-blue-50 border border-blue-200">
                    <Cloud className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <span className="text-xs text-blue-700">Your account will be synced to the cloud. You can sign in from any device.</span>
                  </div>
                </>
              )}

              {setupMode === 'offline' && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200">
                  <HardDrive className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <span className="text-xs text-amber-700">Data is stored locally on this device only. No internet connection required.</span>
                </div>
              )}
            </div>
          )}

          {step === 'store' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-black tracking-tight text-zinc-900">Store Settings</h2>
                <p className="text-sm text-zinc-500 mt-1">Configure your brand and first branch location</p>
              </div>

              <FieldGroup label="Brand / Store Name" error={errors.storeName}>
                <Input placeholder="My Restaurant" value={formData.storeName} onChange={(e) => {
                  updateField('storeName', e.target.value)
                  if (!formData.locationName || formData.locationName === formData.storeName) {
                    setFormData(prev => ({ ...prev, storeName: e.target.value, locationName: e.target.value }))
                  }
                }} className={cn('bg-zinc-50 border-zinc-200', errors.storeName && 'border-red-400')} />
              </FieldGroup>

              <div className="grid grid-cols-2 gap-3">
                <FieldGroup label="Branch Name" error={errors.locationName}>
                  <Input placeholder="Main Branch" value={formData.locationName} onChange={(e) => updateField('locationName', e.target.value)} className={cn('bg-zinc-50 border-zinc-200', errors.locationName && 'border-red-400')} />
                </FieldGroup>
                <FieldGroup label="Branch Code" error={errors.locationCode}>
                  <Input placeholder="MAIN" value={formData.locationCode} onChange={(e) => updateField('locationCode', e.target.value.toUpperCase())} className={cn('bg-zinc-50 border-zinc-200', errors.locationCode && 'border-red-400')} />
                </FieldGroup>
              </div>

              <div className="px-3 py-2.5 rounded-lg bg-sky-50 border border-sky-200 flex items-start gap-2">
                <Building className="w-4 h-4 text-sky-500 mt-0.5 flex-shrink-0" />
                <span className="text-xs text-sky-700">This is your first branch. You can add more locations later in Settings.</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FieldGroup label="Currency">
                  <Select value={formData.currency} onValueChange={handleCurrencyChange}>
                    <SelectTrigger className="bg-zinc-50 border-zinc-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencyOptions.map(opt => (
                        <SelectItem key={opt.code} value={opt.code}>
                          {opt.symbol} - {opt.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldGroup>
                <FieldGroup label="Tax Rate (%)" error={errors.taxRate}>
                  <Input type="number" step="0.1" min="0" max="100" placeholder="10" value={formData.taxRate} onChange={(e) => updateField('taxRate', e.target.value)} className={cn('bg-zinc-50 border-zinc-200', errors.taxRate && 'border-red-400')} />
                </FieldGroup>
              </div>

              <div className="px-3 py-2.5 rounded-lg bg-zinc-50 border border-zinc-200">
                <span className="text-xs text-zinc-500">You can change these settings later in the admin dashboard.</span>
              </div>
            </div>
          )}

          {step === 'pin' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-black tracking-tight text-zinc-900">Set Your PIN</h2>
                <p className="text-sm text-zinc-500 mt-1">
                  Used for quick login and confirming actions like delete, cancel, etc.
                </p>
              </div>

              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-violet-50 border border-violet-200">
                <Shield className="w-4 h-4 text-violet-500 flex-shrink-0" />
                <span className="text-xs text-violet-700">
                  Choose a 4-digit PIN you'll remember. You'll use it daily.
                </span>
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
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                <Check className="w-7 h-7 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight text-zinc-900">Setup Complete</h2>
                <p className="text-sm text-zinc-500 mt-1">
                  {setupMode === 'online'
                    ? 'Your cloud POS system is ready. Sign in to get started.'
                    : 'Your local POS system is ready to use.'}
                </p>
              </div>
              <div className="px-4 py-3 rounded-lg bg-zinc-50 border border-zinc-200 space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-zinc-500">Mode</span>
                  <span className="font-bold text-zinc-900">{setupMode === 'online' ? 'Cloud' : 'Offline'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-zinc-500">Store</span>
                  <span className="font-bold text-zinc-900">{formData.storeName}</span>
                </div>
                {setupMode === 'online' && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-zinc-500">Email</span>
                    <span className="font-bold text-zinc-900">{formData.email}</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => { window.location.href = '/login' }}
                className="w-full py-4 text-base font-black tracking-wider text-white bg-zinc-900 rounded-xl hover:bg-zinc-800 active:bg-zinc-950 transition-colors"
              >
                GO TO LOGIN
              </button>
            </div>
          )}

          {/* Error display */}
          {activeMutation.isError && (
            <div className="mt-4 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-red-700">{activeMutation.error?.message || 'Setup failed. Please try again.'}</span>
            </div>
          )}

          {/* Navigation */}
          {step !== 'complete' && (
            <div className="flex items-center gap-3 mt-8">
              <button
                onClick={handleBack}
                className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-zinc-500 bg-zinc-100 hover:bg-zinc-200 active:bg-zinc-300 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                BACK
              </button>
              <button
                onClick={handleNext}
                disabled={activeMutation.isPending}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black tracking-wider text-white transition-colors',
                  step === 'pin'
                    ? 'bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600'
                    : 'bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-950',
                  activeMutation.isPending && 'opacity-60 cursor-not-allowed',
                )}
              >
                {activeMutation.isPending ? (
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function FeaturePill({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-50 border border-zinc-200">
      <span className={cn('w-6 h-6 rounded-md flex items-center justify-center text-white', color)}>
        {icon}
      </span>
      <span className="text-xs font-bold text-zinc-700 tracking-wide">{label}</span>
    </div>
  )
}

function FieldGroup({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-bold tracking-wide text-zinc-500 uppercase mb-1.5 block">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
