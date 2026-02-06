import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Use shared packages
import { authApi } from '@pos/api-client'
import { useAuthStore } from '@pos/core'
import type { LoginRequest } from '@pos/types'

import { Eye, EyeOff, Store, Users, CreditCard, BarChart3, ChefHat, UserCheck, Settings, Command, Loader2 } from 'lucide-react'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  console.log('LoginPage: Component rendering...')

  const [formData, setFormData] = useState<LoginRequest>({ username: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  // Use auth store - check _hasHydrated to know when localStorage data is loaded
  const { isAuthenticated, isLoading, _hasHydrated, login: authLogin } = useAuthStore()

  console.log('LoginPage auth state:', { isAuthenticated, isLoading, _hasHydrated })

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginRequest) => {
      const response = await authApi.login(credentials)
      return response
    },
    onSuccess: (data) => {
      console.log('Login response:', data)
      if (data.success && data.data) {
        // Use auth store to save auth state
        authLogin(data.data.user, data.data.token)
        console.log('Auth state saved, redirecting...')
        // Redirect admin directly to POS, others to home
        const role = data.data.user.role
        window.location.href = role === 'admin' ? '/admin/pos' : '/'
      } else {
        console.error('Login failed:', data)
        setError(data.message || 'Login failed')
      }
    },
    onError: (error: Error) => {
      setError(error.message || 'Login failed')
    },
  })

  // Show loading while auth store is hydrating
  if (!_hasHydrated || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // If already authenticated, redirect to home (use window.location for clean navigation)
  if (isAuthenticated) {
    // Prevent redirect loop by checking current URL
    if (window.location.pathname === '/login') {
      window.location.href = '/'
    }
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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

    loginMutation.mutate(formData)
  }

  const fillDemoCredentials = (username: string, password: string) => {
    setFormData({ username, password })
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

          {/* Feature Grid */}
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
            <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
            <p className="text-sm text-muted-foreground">
              Enter your credentials to access the POS system
            </p>
          </div>

          {/* Login Form */}
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
            {/* Featured Roles */}
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  username: 'server1',
                  role: 'Server',
                  icon: UserCheck,
                  desc: 'Table service',
                  password: 'admin123',
                },
                {
                  username: 'counter1',
                  role: 'Counter',
                  icon: CreditCard,
                  desc: 'Payments',
                  password: 'admin123',
                },
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

            {/* Other Roles */}
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

        </div>
      </div>
    </div>
  )
}
