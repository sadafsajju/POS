import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  ShoppingCart,
  User,
  Building,
  Check,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle
} from 'lucide-react'
import { setupApi, type CreateAdminRequest } from '@pos/api-client'

type Step = 'welcome' | 'admin' | 'store' | 'complete'

interface FormData {
  // Admin details
  username: string
  email: string
  password: string
  confirmPassword: string
  firstName: string
  lastName: string
  // Store settings
  storeName: string
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
  storeName: '',
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

export function SetupWizard() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('welcome')
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})

  const setupMutation = useMutation({
    mutationFn: async (data: CreateAdminRequest) => {
      const response = await setupApi.createAdmin(data)
      return response
    },
    onSuccess: () => {
      setStep('complete')
    },
    onError: (error: Error) => {
      setErrors({ username: error.message || 'Setup failed. Please try again.' })
    },
  })

  const updateField = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when field is updated
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  const validateAdminStep = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {}

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required'
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters'
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email'
    }

    if (!formData.password) {
      newErrors.password = 'Password is required'
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters'
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required'
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const validateStoreStep = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {}

    if (!formData.storeName.trim()) {
      newErrors.storeName = 'Store name is required'
    }

    const taxRate = parseFloat(formData.taxRate)
    if (isNaN(taxRate) || taxRate < 0 || taxRate > 100) {
      newErrors.taxRate = 'Tax rate must be between 0 and 100'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (step === 'welcome') {
      setStep('admin')
    } else if (step === 'admin') {
      if (validateAdminStep()) {
        setStep('store')
      }
    } else if (step === 'store') {
      if (validateStoreStep()) {
        // Submit the setup
        const request: CreateAdminRequest = {
          username: formData.username,
          email: formData.email,
          password: formData.password,
          first_name: formData.firstName,
          last_name: formData.lastName,
          store_name: formData.storeName,
          currency: formData.currency,
          currency_symbol: formData.currencySymbol,
          tax_rate: formData.taxRate,
        }
        setupMutation.mutate(request)
      }
    }
  }

  const handleBack = () => {
    if (step === 'admin') {
      setStep('welcome')
    } else if (step === 'store') {
      setStep('admin')
    }
  }

  const handleGoToLogin = () => {
    navigate({ to: '/login' })
  }

  const handleCurrencyChange = (currencyCode: string) => {
    const currency = currencyOptions.find(c => c.code === currencyCode)
    if (currency) {
      setFormData(prev => ({
        ...prev,
        currency: currency.code,
        currencySymbol: currency.symbol,
      }))
    }
  }

  const renderStepIndicator = () => {
    const steps = [
      { key: 'welcome', label: 'Welcome' },
      { key: 'admin', label: 'Admin Account' },
      { key: 'store', label: 'Store Settings' },
      { key: 'complete', label: 'Complete' },
    ]

    const currentIndex = steps.findIndex(s => s.key === step)

    return (
      <div className="flex items-center justify-center gap-2 mb-8">
        {steps.map((s, index) => (
          <div key={s.key} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                index <= currentIndex
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {index < currentIndex ? (
                <Check className="w-4 h-4" />
              ) : (
                index + 1
              )}
            </div>
            {index < steps.length - 1 && (
              <div
                className={`w-12 h-1 mx-2 rounded ${
                  index < currentIndex ? 'bg-primary' : 'bg-muted'
                }`}
              />
            )}
          </div>
        ))}
      </div>
    )
  }

  const renderWelcomeStep = () => (
    <div className="text-center space-y-6">
      <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
        <ShoppingCart className="w-10 h-10 text-primary" />
      </div>
      <div>
        <h2 className="text-2xl font-bold mb-2">Welcome to POS System</h2>
        <p className="text-muted-foreground">
          Let's get your point of sale system set up. This will only take a minute.
        </p>
      </div>
      <div className="bg-muted/50 rounded-lg p-4 text-left space-y-3">
        <h3 className="font-semibold">What we'll set up:</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            Create your admin account
          </li>
          <li className="flex items-center gap-2">
            <Building className="w-4 h-4 text-primary" />
            Configure your store settings
          </li>
        </ul>
      </div>
    </div>
  )

  const renderAdminStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <User className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold mb-1">Create Admin Account</h2>
        <p className="text-sm text-muted-foreground">
          This will be the main administrator account
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-1 block">First Name</label>
          <Input
            placeholder="John"
            value={formData.firstName}
            onChange={(e) => updateField('firstName', e.target.value)}
            className={errors.firstName ? 'border-red-500' : ''}
          />
          {errors.firstName && (
            <p className="text-xs text-red-500 mt-1">{errors.firstName}</p>
          )}
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Last Name</label>
          <Input
            placeholder="Doe"
            value={formData.lastName}
            onChange={(e) => updateField('lastName', e.target.value)}
            className={errors.lastName ? 'border-red-500' : ''}
          />
          {errors.lastName && (
            <p className="text-xs text-red-500 mt-1">{errors.lastName}</p>
          )}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium mb-1 block">Username</label>
        <Input
          placeholder="admin"
          value={formData.username}
          onChange={(e) => updateField('username', e.target.value)}
          className={errors.username ? 'border-red-500' : ''}
        />
        {errors.username && (
          <p className="text-xs text-red-500 mt-1">{errors.username}</p>
        )}
      </div>

      <div>
        <label className="text-sm font-medium mb-1 block">Email</label>
        <Input
          type="email"
          placeholder="admin@example.com"
          value={formData.email}
          onChange={(e) => updateField('email', e.target.value)}
          className={errors.email ? 'border-red-500' : ''}
        />
        {errors.email && (
          <p className="text-xs text-red-500 mt-1">{errors.email}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-1 block">Password</label>
          <Input
            type="password"
            placeholder="********"
            value={formData.password}
            onChange={(e) => updateField('password', e.target.value)}
            className={errors.password ? 'border-red-500' : ''}
          />
          {errors.password && (
            <p className="text-xs text-red-500 mt-1">{errors.password}</p>
          )}
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Confirm Password</label>
          <Input
            type="password"
            placeholder="********"
            value={formData.confirmPassword}
            onChange={(e) => updateField('confirmPassword', e.target.value)}
            className={errors.confirmPassword ? 'border-red-500' : ''}
          />
          {errors.confirmPassword && (
            <p className="text-xs text-red-500 mt-1">{errors.confirmPassword}</p>
          )}
        </div>
      </div>
    </div>
  )

  const renderStoreStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <Building className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold mb-1">Store Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure your store's basic information
        </p>
      </div>

      <div>
        <label className="text-sm font-medium mb-1 block">Store Name</label>
        <Input
          placeholder="My Restaurant"
          value={formData.storeName}
          onChange={(e) => updateField('storeName', e.target.value)}
          className={errors.storeName ? 'border-red-500' : ''}
        />
        {errors.storeName && (
          <p className="text-xs text-red-500 mt-1">{errors.storeName}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-1 block">Currency</label>
          <select
            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
            value={formData.currency}
            onChange={(e) => handleCurrencyChange(e.target.value)}
          >
            {currencyOptions.map(opt => (
              <option key={opt.code} value={opt.code}>
                {opt.symbol} - {opt.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Tax Rate (%)</label>
          <Input
            type="number"
            step="0.1"
            min="0"
            max="100"
            placeholder="10"
            value={formData.taxRate}
            onChange={(e) => updateField('taxRate', e.target.value)}
            className={errors.taxRate ? 'border-red-500' : ''}
          />
          {errors.taxRate && (
            <p className="text-xs text-red-500 mt-1">{errors.taxRate}</p>
          )}
        </div>
      </div>

      <div className="bg-muted/50 rounded-lg p-4 text-sm">
        <p className="text-muted-foreground">
          You can change these settings later in the admin dashboard.
        </p>
      </div>
    </div>
  )

  const renderCompleteStep = () => (
    <div className="text-center space-y-6">
      <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center">
        <Check className="w-10 h-10 text-green-600" />
      </div>
      <div>
        <h2 className="text-2xl font-bold mb-2">Setup Complete!</h2>
        <p className="text-muted-foreground">
          Your POS system is ready to use.
        </p>
      </div>
      <div className="bg-muted/50 rounded-lg p-4 text-left">
        <h3 className="font-semibold mb-2">Your admin account:</h3>
        <div className="space-y-1 text-sm">
          <p><span className="text-muted-foreground">Username:</span> <strong>{formData.username}</strong></p>
          <p><span className="text-muted-foreground">Store:</span> <strong>{formData.storeName}</strong></p>
        </div>
      </div>
      <Button size="lg" onClick={handleGoToLogin} className="w-full">
        Go to Login
        <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  )

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center pb-2">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold">POS System</span>
          </div>
          <Badge variant="secondary" className="mx-auto">First Time Setup</Badge>
        </CardHeader>

        <CardContent className="pt-4">
          {renderStepIndicator()}

          {step === 'welcome' && renderWelcomeStep()}
          {step === 'admin' && renderAdminStep()}
          {step === 'store' && renderStoreStep()}
          {step === 'complete' && renderCompleteStep()}

          {/* Navigation buttons */}
          {step !== 'complete' && (
            <div className="flex justify-between mt-8">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={step === 'welcome'}
                className={step === 'welcome' ? 'invisible' : ''}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleNext}
                disabled={setupMutation.isPending}
              >
                {setupMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : step === 'store' ? (
                  <>
                    Complete Setup
                    <Check className="w-4 h-4 ml-2" />
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Error display */}
          {setupMutation.isError && (
            <div className="mt-4 p-3 bg-red-100 border border-red-200 rounded-lg text-red-800 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{setupMutation.error?.message || 'Setup failed. Please try again.'}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
