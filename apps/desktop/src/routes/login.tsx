import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PinInput } from '@/components/ui/pin-input'

// Use shared packages
import { authApi } from '@pos/api-client'
import type { StaffMember } from '@pos/api-client'
import { useAuthStore } from '@pos/core'
import type { LoginRequest } from '@pos/types'

import { Eye, EyeOff, Store, Users, CreditCard, BarChart3, ChefHat, UserCheck, Settings, Command, Loader2, KeyRound, User, ArrowLeft } from 'lucide-react'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

const roleColors: Record<string, string> = {
  admin: 'from-red-400 to-red-600',
  manager: 'from-purple-400 to-purple-600',
  server: 'from-blue-400 to-blue-600',
  counter: 'from-emerald-400 to-emerald-600',
  kitchen: 'from-orange-400 to-orange-600',
}

function LoginPage() {
  const [loginMode, setLoginMode] = useState<'password' | 'pin'>('password')
  const [formData, setFormData] = useState<LoginRequest>({ username: '', password: '' })
  const [pinValue, setPinValue] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null)
  const [loggedInUser, setLoggedInUser] = useState<{ first_name: string; last_name: string; role: string } | null>(null)

  // Use auth store
  const { isAuthenticated, isLoading, _hasHydrated, login: authLogin } = useAuthStore()

  // Fetch staff members for PIN login
  const { data: staffResponse } = useQuery({
    queryKey: ['staff-for-pin'],
    queryFn: () => authApi.getStaffForPin(),
    enabled: loginMode === 'pin',
  })

  const staffList: StaffMember[] = Array.isArray(staffResponse)
    ? staffResponse
    : (staffResponse as any)?.data || []

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginRequest) => {
      const response = await authApi.login(credentials)
      return response
    },
    onSuccess: (data) => {
      if (data.success && data.data) {
        authLogin(data.data.user, data.data.token, data.data.organization, data.data.location, data.data.locations)
        setLoggedInUser(data.data.user)
        const role = data.data.user.role
        setTimeout(() => {
          window.location.href = role === 'admin' ? '/admin/pos' : '/'
        }, 1200)
      } else {
        setError(data.message || 'Login failed')
        setPinValue('')
      }
    },
    onError: (error: Error) => {
      setError(error.message || 'Login failed')
      setPinValue('')
    },
  })

  const handlePinChange = useCallback((value: string) => {
    setPinValue(value)
    setError('')
    if (value.length === 4) {
      loginMutation.mutate({ pin: value })
    }
  }, [loginMutation])

  // Auto-focus PIN input when staff is selected
  useEffect(() => {
    if (selectedStaff) {
      setPinValue('')
      setError('')
    }
  }, [selectedStaff])

  // Show loading while auth store is hydrating
  if (!_hasHydrated || isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-600" />
      </div>
    )
  }

  // If already authenticated, redirect
  if (isAuthenticated) {
    if (window.location.pathname === '/login') {
      window.location.href = '/'
    }
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-600" />
      </div>
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!formData.username || !formData.password) {
      setError('Username and password are required')
      return
    }
    loginMutation.mutate({ username: formData.username, password: formData.password })
  }

  const fillDemoCredentials = (username: string, password: string) => {
    setLoginMode('password')
    setFormData({ username, password })
  }

  const switchMode = (mode: 'password' | 'pin') => {
    setLoginMode(mode)
    setError('')
    setPinValue('')
    setSelectedStaff(null)
  }

  const handleBackToStaffPicker = () => {
    setSelectedStaff(null)
    setPinValue('')
    setError('')
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex flex-col justify-between bg-zinc-900 p-10 text-white">
        <div className="flex items-center gap-2 text-lg font-medium">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Command className="h-4 w-4" />
          </div>
          <span>POS System</span>
        </div>

        <div className="space-y-6">
          <blockquote className="space-y-2">
            <p className="text-lg">
              "Streamline your operations with our complete POS solution. Manage orders, track inventory, and grow your business."
            </p>
            <footer className="text-sm text-zinc-400">Modern Point of Sale for Your Business</footer>
          </blockquote>

          <div className="grid grid-cols-2 gap-4 pt-4">
            {[
              { icon: Users, title: 'Staff Management', desc: 'Role-based access' },
              { icon: CreditCard, title: 'Payments', desc: 'Multiple methods' },
              { icon: BarChart3, title: 'Analytics', desc: 'Real-time insights' },
              { icon: Store, title: 'Orders', desc: 'Kitchen workflow' },
            ].map((feature, idx) => (
              <div key={idx} className="flex items-center gap-3 rounded-lg border border-zinc-800 p-3">
                <feature.icon className="h-5 w-5 text-zinc-400" />
                <div>
                  <p className="text-sm font-medium">{feature.title}</p>
                  <p className="text-xs text-zinc-500">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-[400px] space-y-6">
          {/* Mobile Logo */}
          <div className="flex flex-col items-center gap-2 lg:hidden">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Store className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-semibold">POS System</h1>
          </div>

          {/* Header */}
          <div className="flex flex-col space-y-2 text-center lg:text-left">
            <h1 className="text-2xl font-semibold tracking-tight">
              {loggedInUser
                ? 'Signed in'
                : selectedStaff
                  ? `Hi, ${selectedStaff.first_name}`
                  : 'Welcome back'}
            </h1>
            {!loggedInUser && (
              <p className="text-sm text-muted-foreground">
                {selectedStaff
                  ? 'Enter your 4-digit PIN to sign in'
                  : loginMode === 'pin'
                    ? 'Select your name to sign in'
                    : 'Enter your credentials to access the POS system'}
              </p>
            )}
          </div>

          {/* Login Mode Toggle */}
          {!loggedInUser && !selectedStaff && (
            <div className="flex rounded-lg border bg-muted p-1">
              <button
                onClick={() => switchMode('pin')}
                className={`flex-1 flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors ${
                  loginMode === 'pin'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <KeyRound className="h-4 w-4" />
                PIN
              </button>
              <button
                onClick={() => switchMode('password')}
                className={`flex-1 flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors ${
                  loginMode === 'password'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <User className="h-4 w-4" />
                Password
              </button>
            </div>
          )}

          {/* PIN Login Mode */}
          {loginMode === 'pin' && (
            <div className="space-y-4">
              {loggedInUser ? (
                /* Success state */
                <div className="py-6 flex flex-col items-center gap-3 animate-in fade-in zoom-in-95 duration-300">
                  <div className={`h-14 w-14 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg`}>
                    <span className="text-lg font-bold text-white">
                      {loggedInUser.first_name[0]}{loggedInUser.last_name[0]}
                    </span>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold">
                      Welcome, {loggedInUser.first_name}!
                    </p>
                    <p className="text-sm text-muted-foreground capitalize">{loggedInUser.role}</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Redirecting...
                  </div>
                </div>
              ) : selectedStaff ? (
                /* PIN entry for selected staff */
                <div className="space-y-4">
                  <div className="flex flex-col items-center gap-3 py-2">
                    <div className={`h-16 w-16 rounded-full bg-gradient-to-br ${roleColors[selectedStaff.role] || 'from-zinc-400 to-zinc-600'} flex items-center justify-center shadow-lg`}>
                      <span className="text-xl font-bold text-white">
                        {selectedStaff.first_name[0]}{selectedStaff.last_name[0]}
                      </span>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold">
                        {selectedStaff.first_name} {selectedStaff.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">{selectedStaff.role}</p>
                    </div>
                  </div>

                  <PinInput
                    value={pinValue}
                    onChange={handlePinChange}
                    disabled={loginMutation.isPending}
                    error={!!error}
                    autoFocus
                  />

                  {error && (
                    <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive text-center">
                      {error}
                    </div>
                  )}

                  {loginMutation.isPending && (
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Signing in...
                    </div>
                  )}

                  <button
                    onClick={handleBackToStaffPicker}
                    className="flex items-center gap-2 mx-auto text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to staff list
                  </button>
                </div>
              ) : (
                /* Staff picker grid */
                <div className="space-y-3">
                  {staffList.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No staff with PIN set up.</p>
                      <p className="text-xs mt-1">Use password login or ask admin to set PINs.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {staffList.map((staff) => (
                        <button
                          key={staff.id}
                          onClick={() => setSelectedStaff(staff)}
                          className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent hover:border-primary/30 transition-colors text-left"
                        >
                          <div className={`h-10 w-10 rounded-full bg-gradient-to-br ${roleColors[staff.role] || 'from-zinc-400 to-zinc-600'} flex items-center justify-center flex-shrink-0`}>
                            <span className="text-sm font-bold text-white">
                              {staff.first_name[0]}{staff.last_name[0]}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {staff.first_name} {staff.last_name}
                            </p>
                            <p className="text-xs text-muted-foreground capitalize">{staff.role}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Password Login Mode */}
          {loginMode === 'password' && (
            <>
              {loggedInUser ? (
                <div className="py-6 flex flex-col items-center gap-3 animate-in fade-in zoom-in-95 duration-300">
                  <div className="h-14 w-14 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg">
                    <span className="text-lg font-bold text-white">
                      {loggedInUser.first_name[0]}{loggedInUser.last_name[0]}
                    </span>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold">
                      Welcome, {loggedInUser.first_name}!
                    </p>
                    <p className="text-sm text-muted-foreground capitalize">{loggedInUser.role}</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Redirecting...
                  </div>
                </div>
              ) : (
              <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter your username"
                    value={formData.username}
                    onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                    autoComplete="username"
                    disabled={loginMutation.isPending}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      className="pr-10"
                      autoComplete="current-password"
                      disabled={loginMutation.isPending}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                {error && (
                  <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign in'
                  )}
                </Button>
              </form>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Quick access demo accounts
                  </span>
                </div>
              </div>

              {/* Demo Accounts */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { username: 'server1', role: 'Server', icon: UserCheck, desc: 'Table service', password: 'admin123' },
                    { username: 'counter1', role: 'Counter', icon: CreditCard, desc: 'Payments', password: 'admin123' },
                  ].map((account) => (
                    <Button
                      key={account.username}
                      variant="outline"
                      className="h-auto flex-col items-start gap-1 p-3"
                      onClick={() => fillDemoCredentials(account.username, account.password)}
                      disabled={loginMutation.isPending}
                    >
                      <div className="flex items-center gap-2">
                        <account.icon className="h-4 w-4" />
                        <span className="font-medium">{account.role}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{account.desc}</span>
                    </Button>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { username: 'admin', role: 'Admin', icon: Settings, password: 'admin123' },
                    { username: 'manager1', role: 'Manager', icon: BarChart3, password: 'admin123' },
                    { username: 'kitchen1', role: 'Kitchen', icon: ChefHat, password: 'admin123' },
                  ].map((account) => (
                    <Button
                      key={account.username}
                      variant="ghost"
                      size="sm"
                      className="h-auto flex-col gap-1 py-2"
                      onClick={() => fillDemoCredentials(account.username, account.password)}
                      disabled={loginMutation.isPending}
                    >
                      <account.icon className="h-4 w-4" />
                      <span className="text-xs">{account.role}</span>
                    </Button>
                  ))}
                </div>
              </div>
              </>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  )
}
