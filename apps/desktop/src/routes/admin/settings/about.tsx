import { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Info, Database, Server, RefreshCw, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSettingsStore } from '@pos/core'

export const Route = createFileRoute('/admin/settings/about')({
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

  const StatusIcon = ({ status }: { status: 'connected' | 'disconnected' | 'checking' }) => {
    if (status === 'checking') {
      return <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
    }
    if (status === 'connected') {
      return <CheckCircle2 className="w-4 h-4 text-green-500" />
    }
    return <XCircle className="w-4 h-4 text-red-500" />
  }

  const StatusText = ({ status }: { status: 'connected' | 'disconnected' | 'checking' }) => {
    if (status === 'checking') return 'Checking...'
    if (status === 'connected') return 'Connected'
    return 'Disconnected'
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">About</h2>
              <p className="text-sm text-muted-foreground">System status and version information</p>
            </div>
          </div>
        </div>

        {/* System Status */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">System Status</CardTitle>
                <CardDescription>Current health of system services</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={checkStatus}
                disabled={checking}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${checking ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Server className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">API Server</p>
                  <p className="text-xs text-muted-foreground">Backend REST API</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusIcon status={apiStatus} />
                <span className={`text-sm ${
                  apiStatus === 'connected' ? 'text-green-600' :
                  apiStatus === 'disconnected' ? 'text-red-600' : 'text-muted-foreground'
                }`}>
                  <StatusText status={apiStatus} />
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Database className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Database</p>
                  <p className="text-xs text-muted-foreground">PostgreSQL connection</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusIcon status={dbStatus} />
                <span className={`text-sm ${
                  dbStatus === 'connected' ? 'text-green-600' :
                  dbStatus === 'disconnected' ? 'text-red-600' : 'text-muted-foreground'
                }`}>
                  <StatusText status={dbStatus} />
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current Configuration */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Current Configuration</CardTitle>
            <CardDescription>Active system settings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Currency</p>
                <p className="font-medium">{settings.currency} ({settings.currencySymbol})</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Language</p>
                <p className="font-medium capitalize">{settings.language || 'English'}</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Theme</p>
                <p className="font-medium capitalize">{settings.theme || 'System'}</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Tax Rate</p>
                <p className="font-medium">{settings.taxRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Version Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Version Information</CardTitle>
            <CardDescription>Application version and build info</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Application Version</span>
                <Badge variant="secondary">v1.0.0</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Environment</span>
                <Badge variant="outline">Development</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Frontend</span>
                <Badge variant="outline">React + Vite</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Backend</span>
                <Badge variant="outline">Go + Gin</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
