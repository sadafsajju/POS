import { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { Info, Database, Server, RefreshCw, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { useSettingsStore } from '@pos/core'
import { APP_VERSION } from '@/lib/version'

export const Route = createFileRoute('/admin/more/about')({
  component: AboutPage,
})

function AboutPage() {
  const { settings } = useSettingsStore()
  const [apiStatus, setApiStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking')
  const [dbStatus, setDbStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking')
  const [checking, setChecking] = useState(false)

  const checkStatus = async () => {
    setChecking(true)
    setApiStatus('checking')
    setDbStatus('checking')

    try {
      let token = null
      const storedAuth = localStorage.getItem('pos-auth')
      if (storedAuth) {
        const parsed = JSON.parse(storedAuth)
        token = parsed.state?.token
      }

      if (!token) {
        setApiStatus('disconnected')
        setDbStatus('disconnected')
        return
      }

      const response = await fetch('http://localhost:8080/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        setApiStatus('connected')
        setDbStatus('connected')
      } else {
        setApiStatus('disconnected')
        setDbStatus('disconnected')
      }
    } catch {
      setApiStatus('disconnected')
      setDbStatus('disconnected')
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    checkStatus()
  }, [])

  const StatusDot = ({ status }: { status: 'connected' | 'disconnected' | 'checking' }) => {
    if (status === 'checking') return <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
    if (status === 'connected') return <CheckCircle2 className="w-4 h-4 text-emerald-400" />
    return <XCircle className="w-4 h-4 text-red-400" />
  }

  const statusLabel = (status: 'connected' | 'disconnected' | 'checking') => {
    if (status === 'checking') return 'Checking...'
    if (status === 'connected') return 'Connected'
    return 'Disconnected'
  }

  const statusColor = (status: 'connected' | 'disconnected' | 'checking') => {
    if (status === 'connected') return 'text-emerald-400'
    if (status === 'disconnected') return 'text-red-400'
    return 'text-zinc-500'
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 px-6 py-4 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-zinc-800 rounded-lg text-zinc-300">
            <Info className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-100">About</h2>
            <p className="text-sm text-zinc-500">System status and version information</p>
          </div>
        </div>
      </header>

      {/* ── Scrollable Content ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* System Status */}
        <div className="bg-zinc-900 rounded-lg border border-zinc-800">
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-zinc-200">System Status</h3>
              <p className="text-sm text-zinc-500">Current health of system services</p>
            </div>
            <button
              onClick={checkStatus}
              disabled={checking}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700',
                'disabled:opacity-40 disabled:cursor-not-allowed'
              )}
            >
              <RefreshCw className={cn('w-3.5 h-3.5', checking && 'animate-spin')} />
              Refresh
            </button>
          </div>
          <div className="px-5 pb-5 space-y-3">
            <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Server className="w-5 h-5 text-zinc-500" />
                <div>
                  <p className="text-sm font-medium text-zinc-200">API Server</p>
                  <p className="text-xs text-zinc-500">Backend REST API</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusDot status={apiStatus} />
                <span className={cn('text-sm', statusColor(apiStatus))}>
                  {statusLabel(apiStatus)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Database className="w-5 h-5 text-zinc-500" />
                <div>
                  <p className="text-sm font-medium text-zinc-200">Database</p>
                  <p className="text-xs text-zinc-500">PostgreSQL connection</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusDot status={dbStatus} />
                <span className={cn('text-sm', statusColor(dbStatus))}>
                  {statusLabel(dbStatus)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Current Configuration */}
        <div className="bg-zinc-900 rounded-lg border border-zinc-800">
          <div className="px-5 pt-5 pb-3">
            <h3 className="text-base font-bold text-zinc-200">Current Configuration</h3>
            <p className="text-sm text-zinc-500">Active system settings</p>
          </div>
          <div className="px-5 pb-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-zinc-800/50 rounded-lg">
                <p className="text-xs text-zinc-500 mb-1">Currency</p>
                <p className="text-sm font-medium text-zinc-200">{settings.currency} ({settings.currencySymbol})</p>
              </div>
              <div className="p-3 bg-zinc-800/50 rounded-lg">
                <p className="text-xs text-zinc-500 mb-1">Language</p>
                <p className="text-sm font-medium text-zinc-200 capitalize">{settings.language || 'English'}</p>
              </div>
              <div className="p-3 bg-zinc-800/50 rounded-lg">
                <p className="text-xs text-zinc-500 mb-1">Theme</p>
                <p className="text-sm font-medium text-zinc-200 capitalize">{settings.theme || 'System'}</p>
              </div>
              <div className="p-3 bg-zinc-800/50 rounded-lg">
                <p className="text-xs text-zinc-500 mb-1">Tax Rate</p>
                <p className="text-sm font-medium text-zinc-200">{settings.taxRate}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Version Info */}
        <div className="bg-zinc-900 rounded-lg border border-zinc-800">
          <div className="px-5 pt-5 pb-3">
            <h3 className="text-base font-bold text-zinc-200">Version Information</h3>
            <p className="text-sm text-zinc-500">Application version and build info</p>
          </div>
          <div className="px-5 pb-5 space-y-3">
            {[
              { label: 'Application Version', value: `v${APP_VERSION}`, accent: 'bg-emerald-500/15 text-emerald-400' },
              { label: 'Environment', value: import.meta.env.PROD ? 'Production' : 'Development', accent: 'bg-amber-500/15 text-amber-400' },
              { label: 'Frontend', value: 'React + Vite + Tauri', accent: 'bg-sky-500/15 text-sky-400' },
              { label: 'Backend', value: 'Supabase', accent: 'bg-orange-500/15 text-orange-400' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">{item.label}</span>
                <span className={cn('text-xs font-bold px-2.5 py-1 rounded-md', item.accent)}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
