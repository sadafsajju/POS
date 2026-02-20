import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { OnScreenKeyboard } from '@/components/ui/on-screen-keyboard'

import { authApi } from '@pos/api-client'
import { useAuthStore, useSettingsStore } from '@pos/core'
import type { LoginRequest } from '@pos/types'

import { Eye, EyeOff, Loader2, LogIn, User, Lock } from 'lucide-react'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

type ActiveField = 'username' | 'password' | null

function LoginPage() {
  const [formData, setFormData] = useState<LoginRequest>({ username: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [activeField, setActiveField] = useState<ActiveField>(null)

  const { isAuthenticated, isLoading, _hasHydrated, login: authLogin } = useAuthStore()
  const { settings } = useSettingsStore()
  const touchMode = settings.touchMode

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginRequest) => {
      const response = await authApi.login(credentials)
      return response
    },
    onSuccess: (data) => {
      if (data.success && data.data) {
        authLogin(data.data.user, data.data.token, data.data.organization, data.data.location, data.data.locations)
        const role = data.data.user.role
        setTimeout(() => {
          window.location.href = role === 'admin' ? '/admin/pos' : '/'
        }, 800)
      } else {
        setError(data.message || 'Login failed')
      }
    },
    onError: (error: Error) => {
      setError(error.message || 'Login failed')
    },
  })

  if (!_hasHydrated || isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-600" />
      </div>
    )
  }

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

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    setError('')
    if (!formData.username || !formData.password) {
      setError('Username and password are required')
      return
    }
    loginMutation.mutate({ username: formData.username, password: formData.password })
  }

  const maskedPassword = formData.password ? '●'.repeat(formData.password.length) : ''

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
            <LogIn className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-white">Sign in</h1>
          <p className="text-sm text-zinc-500">
            {touchMode ? 'Tap a field to enter your credentials' : 'Enter your credentials to continue'}
          </p>
        </div>

        <div className="space-y-4">
          {touchMode ? (
            <>
              {/* Touch mode: tappable fields */}
              <button
                type="button"
                onClick={() => setActiveField('username')}
                disabled={loginMutation.isPending}
                className="w-full h-14 px-4 flex items-center gap-3 rounded-xl bg-zinc-900 border border-zinc-800 text-left transition-colors active:bg-zinc-800 disabled:opacity-50"
              >
                <User className="h-5 w-5 text-zinc-500 flex-shrink-0" />
                <span className={formData.username ? 'text-base text-white' : 'text-base text-zinc-600'}>
                  {formData.username || 'Username'}
                </span>
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setActiveField('password')}
                  disabled={loginMutation.isPending}
                  className="w-full h-14 px-4 pr-14 flex items-center gap-3 rounded-xl bg-zinc-900 border border-zinc-800 text-left transition-colors active:bg-zinc-800 disabled:opacity-50"
                >
                  <Lock className="h-5 w-5 text-zinc-500 flex-shrink-0" />
                  <span className={formData.password ? 'text-base text-white' : 'text-base text-zinc-600'}>
                    {formData.password
                      ? (showPassword ? formData.password : maskedPassword)
                      : 'Password'}
                  </span>
                </button>
                {formData.password && (
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-0 top-0 h-14 w-14 flex items-center justify-center text-zinc-500 active:text-zinc-300"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Keyboard mode: regular inputs */}
              <form onSubmit={handleSubmit} id="login-form" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-zinc-400 text-sm">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Username"
                    value={formData.username}
                    onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                    autoComplete="username"
                    disabled={loginMutation.isPending}
                    className="h-13 text-base rounded-xl bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-zinc-600 focus:ring-zinc-600"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-zinc-400 text-sm">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Password"
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      autoComplete="current-password"
                      disabled={loginMutation.isPending}
                      className="h-13 text-base rounded-xl bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 pr-13 focus:border-zinc-600 focus:ring-zinc-600"
                    />
                    <button
                      type="button"
                      className="absolute right-0 top-0 h-full px-4 flex items-center justify-center text-zinc-500 active:text-zinc-300"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              </form>
            </>
          )}

          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 text-center">
              {error}
            </div>
          )}

          <Button
            type={touchMode ? 'button' : 'submit'}
            form={touchMode ? undefined : 'login-form'}
            onClick={touchMode ? handleSubmit : undefined}
            disabled={loginMutation.isPending || !formData.username || !formData.password}
            className="w-full h-14 text-base font-medium rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 active:bg-zinc-300 transition-colors disabled:opacity-40"
          >
            {loginMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              'Sign in'
            )}
          </Button>
        </div>
      </div>

      {/* On-screen keyboard (only in touch mode) */}
      {touchMode && (
        <OnScreenKeyboard
          open={activeField !== null}
          onOpenChange={(open) => {
            if (!open) setActiveField(null)
          }}
          value={activeField ? (formData[activeField] || '') : ''}
          onValueChange={(val) => {
            if (activeField) {
              setFormData(prev => ({ ...prev, [activeField]: val }))
            }
          }}
          onSubmit={(val) => {
            if (activeField === 'username') {
              setFormData(prev => ({ ...prev, username: val }))
              setTimeout(() => setActiveField('password'), 150)
            } else if (activeField === 'password') {
              setFormData(prev => ({ ...prev, password: val }))
              setActiveField(null)
              setError('')
              const credentials = { username: formData.username, password: val }
              if (credentials.username && credentials.password) {
                loginMutation.mutate(credentials)
              } else {
                setError('Username and password are required')
              }
            }
          }}
          title={activeField === 'username' ? 'Enter Username' : 'Enter Password'}
          placeholder={activeField === 'username' ? 'Username' : 'Password'}
          maxLength={100}
        />
      )}
    </div>
  )
}
