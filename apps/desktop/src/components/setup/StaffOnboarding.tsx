import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { PinInput } from '@/components/ui/pin-input'
import {
  ShoppingCart,
  Check,
  ArrowRight,
  Loader2,
  AlertCircle,
  Shield,
  UserCheck,
} from 'lucide-react'
import { getSupabase } from '@pos/supabase'
import { cn } from '@/lib/utils'

type Step = 'loading' | 'error' | 'profile' | 'pin' | 'complete'

interface FormData {
  firstName: string
  lastName: string
  password: string
  confirmPassword: string
  pin: string
  confirmPin: string
}

const initialFormData: FormData = {
  firstName: '',
  lastName: '',
  password: '',
  confirmPassword: '',
  pin: '',
  confirmPin: '',
}

export function StaffOnboarding() {
  const [step, setStep] = useState<Step>('loading')
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [globalError, setGlobalError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [userRole, setUserRole] = useState('')

  // On mount, check if the user arrived via magic link (session should exist)
  useEffect(() => {
    async function checkSession() {
      const sb = getSupabase()

      // Supabase auto-exchanges the magic link token for a session
      const { data: { session }, error } = await sb.auth.getSession()

      if (error || !session) {
        setGlobalError('Invalid or expired invitation link. Please ask your admin to resend the invite.')
        setStep('error')
        return
      }

      const meta = session.user.app_metadata || {}
      const userMeta = session.user.user_metadata || {}

      setUserEmail(session.user.email || '')
      setUserRole(meta.invited_role || meta.role || '')

      // Pre-fill name if available
      setFormData(prev => ({
        ...prev,
        firstName: userMeta.first_name || '',
        lastName: userMeta.last_name || '',
      }))

      setStep('profile')
    }

    checkSession()
  }, [])

  const updateField = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  const validateProfile = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {}
    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required'
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required'
    if (!formData.password) newErrors.password = 'Password is required'
    else if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters'
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const validatePin = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {}
    if (!formData.pin) newErrors.pin = 'PIN is required'
    else if (formData.pin.length !== 4) newErrors.pin = 'PIN must be exactly 4 digits'
    else if (!/^\d{4}$/.test(formData.pin)) newErrors.pin = 'PIN must contain only digits'
    if (formData.pin && formData.pin !== formData.confirmPin) newErrors.confirmPin = 'PINs do not match'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validatePin()) return

    setIsSubmitting(true)
    setGlobalError('')

    try {
      const sb = getSupabase()

      // 1. Update the auth user's password
      const { error: pwError } = await sb.auth.updateUser({
        password: formData.password,
        data: {
          first_name: formData.firstName,
          last_name: formData.lastName,
        },
      })

      if (pwError) {
        setGlobalError(pwError.message)
        setIsSubmitting(false)
        return
      }

      // 2. Get the session to find the user's public record
      const { data: { session } } = await sb.auth.getSession()
      if (!session) {
        setGlobalError('Session expired. Please use the invitation link again.')
        setIsSubmitting(false)
        return
      }

      const meta = session.user.app_metadata || {}
      const userId = meta.user_id

      // 3. Update the public.users record with name, PIN, and activate
      if (userId) {
        const { error: updateError } = await sb
          .from('users')
          .update({
            first_name: formData.firstName,
            last_name: formData.lastName,
            username: `${formData.firstName.toLowerCase()}.${formData.lastName.toLowerCase()}`,
            pin_hash: formData.pin, // In production, hash this server-side
            is_active: true,
          })
          .eq('id', userId)

        if (updateError) {
          setGlobalError(updateError.message)
          setIsSubmitting(false)
          return
        }
      }

      setStep('complete')
    } catch (err: any) {
      setGlobalError(err.message || 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleNext = () => {
    if (step === 'profile') {
      if (validateProfile()) setStep('pin')
    } else if (step === 'pin') {
      handleSubmit()
    }
  }

  const handleBack = () => {
    if (step === 'pin') setStep('profile')
  }

  const roleLabel: Record<string, string> = {
    admin: 'Admin',
    manager: 'Manager',
    server: 'Server',
    counter: 'Counter',
    kitchen: 'Kitchen',
  }

  // Loading state
  if (step === 'loading') {
    return (
      <div className="h-screen flex flex-col bg-white select-none overflow-hidden">
        <OnboardingHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-400 mx-auto mb-4" />
            <p className="text-sm text-zinc-500">Verifying your invitation...</p>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (step === 'error') {
    return (
      <div className="h-screen flex flex-col bg-white select-none overflow-hidden">
        <OnboardingHeader />
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-zinc-900 mb-2">
              Invalid Invitation
            </h1>
            <p className="text-base text-zinc-500 mb-6">{globalError}</p>
            <a
              href="/login"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white bg-zinc-900 hover:bg-zinc-800 transition-colors"
            >
              Go to Login
            </a>
          </div>
        </div>
      </div>
    )
  }

  // Complete state
  if (step === 'complete') {
    return (
      <div className="h-screen flex flex-col bg-white select-none overflow-hidden">
        <OnboardingHeader />
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Check className="w-8 h-8 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-zinc-900 mb-2">
              Welcome, {formData.firstName}!
            </h1>
            <p className="text-base text-zinc-500 mb-6">
              Your account is set up. You can now sign in with your email and password.
            </p>
            <div className="px-4 py-3 rounded-lg bg-zinc-50 border border-zinc-200 space-y-1 mb-6 text-left">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-zinc-500">Email</span>
                <span className="font-bold text-zinc-900">{userEmail}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-zinc-500">Role</span>
                <span className="font-bold text-zinc-900">{roleLabel[userRole] || userRole}</span>
              </div>
            </div>
            <button
              onClick={() => { window.location.href = '/login' }}
              className="w-full py-4 text-base font-black tracking-wider text-white bg-zinc-900 rounded-xl hover:bg-zinc-800 active:bg-zinc-950 transition-colors"
            >
              GO TO LOGIN
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Profile + PIN steps
  return (
    <div className="h-screen flex flex-col bg-white select-none overflow-hidden">
      <header className="flex-shrink-0 flex items-center justify-between px-6 py-3 bg-zinc-50 border-b border-zinc-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
            <ShoppingCart className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-bold tracking-tight text-zinc-800">STAFF ONBOARDING</span>
          <div className="h-4 w-px bg-zinc-300" />
          {(['profile', 'pin'] as const).map((s, i) => {
            const labels = { profile: 'PROFILE', pin: 'PIN' }
            const colors = { profile: 'bg-amber-500', pin: 'bg-violet-500' }
            const textColors = { profile: 'text-amber-600', pin: 'text-violet-600' }
            const isActive = s === step
            const isDone = (step === 'pin' && s === 'profile')
            return (
              <div key={s} className="flex items-center gap-1.5">
                <span className={cn('w-2 h-2 rounded-full', isDone ? colors[s] : isActive ? colors[s] : 'bg-zinc-300', isActive && 'animate-pulse')} />
                <span className={cn('text-xs font-bold tracking-wider', isDone ? 'text-zinc-400' : isActive ? textColors[s] : 'text-zinc-300')}>
                  {labels[s]}
                </span>
              </div>
            )
          })}
        </div>
        <span className="text-xs text-zinc-400 tabular-nums">
          {step === 'profile' ? '1' : '2'} / 2
        </span>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 overflow-y-auto">
        <div className="w-full max-w-md py-8">
          {/* Role badge */}
          <div className="flex items-center gap-2 mb-6">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200">
              <UserCheck className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-xs font-bold text-blue-700">{roleLabel[userRole] || userRole}</span>
            </div>
            <span className="text-xs text-zinc-400">{userEmail}</span>
          </div>

          {step === 'profile' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-black tracking-tight text-zinc-900">Complete Your Profile</h2>
                <p className="text-sm text-zinc-500 mt-1">
                  Set up your name and password to get started.
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

              <div className="grid grid-cols-2 gap-3">
                <FieldGroup label="Password" error={errors.password}>
                  <Input type="password" placeholder="********" value={formData.password} onChange={(e) => updateField('password', e.target.value)} className={cn('bg-zinc-50 border-zinc-200', errors.password && 'border-red-400')} />
                </FieldGroup>
                <FieldGroup label="Confirm Password" error={errors.confirmPassword}>
                  <Input type="password" placeholder="********" value={formData.confirmPassword} onChange={(e) => updateField('confirmPassword', e.target.value)} className={cn('bg-zinc-50 border-zinc-200', errors.confirmPassword && 'border-red-400')} />
                </FieldGroup>
              </div>
            </div>
          )}

          {step === 'pin' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-black tracking-tight text-zinc-900">Set Your PIN</h2>
                <p className="text-sm text-zinc-500 mt-1">
                  Used for quick login and confirming actions.
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

          {/* Error display */}
          {globalError && (
            <div className="mt-4 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-red-700">{globalError}</span>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center gap-3 mt-8">
            {step === 'pin' && (
              <button
                onClick={handleBack}
                className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-zinc-500 bg-zinc-100 hover:bg-zinc-200 active:bg-zinc-300 transition-colors"
              >
                BACK
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={isSubmitting}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black tracking-wider text-white transition-colors',
                step === 'pin'
                  ? 'bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600'
                  : 'bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-950',
                isSubmitting && 'opacity-60 cursor-not-allowed',
              )}
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> SAVING...</>
              ) : step === 'pin' ? (
                <><Check className="w-4 h-4" /> COMPLETE SETUP</>
              ) : (
                <>NEXT <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function OnboardingHeader() {
  return (
    <header className="flex-shrink-0 flex items-center justify-between px-6 py-3 bg-zinc-50 border-b border-zinc-200">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
          <ShoppingCart className="w-4 h-4 text-white" />
        </div>
        <span className="text-sm font-bold tracking-tight text-zinc-800">STAFF ONBOARDING</span>
      </div>
    </header>
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
