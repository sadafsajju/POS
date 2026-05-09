import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Save,
  Loader2,
  Eye,
  EyeOff,
  Power,
  PowerOff,
  Trash2,
} from 'lucide-react'
import { adminApi } from '@pos/api-client'
import { useRequirePin } from '@pos/core'
import type { PlatformConfig, CreatePlatformConfigRequest } from '@pos/types'
import { PLATFORMS, type PlatformDescriptor } from '@/lib/platforms'

export function PlatformSettings() {
  const queryClient = useQueryClient()

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['platform-configs'],
    queryFn: async () => {
      const res = await adminApi.getPlatformConfigs()
      return (Array.isArray(res?.data) ? res.data : []) as PlatformConfig[]
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Platform Integrations</h2>
        <p className="text-sm text-muted-foreground">
          Configure delivery aggregator integrations. Orders from enabled platforms will appear in your POS
          and kitchen display automatically.
        </p>
      </div>

      {PLATFORMS.map((platform) => {
        const config = configs.find((c) => c.platform === platform.code)
        return (
          <PlatformCard
            key={platform.code}
            platform={platform}
            config={config}
            queryClient={queryClient}
          />
        )
      })}

      {/* Webhook URL Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Webhook Configuration</CardTitle>
          <CardDescription>
            After vendor approval, configure these webhook URLs in each platform's dashboard.
            All platforms route through a single Supabase Edge Function with platform-specific HMAC verification.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm space-y-2">
            {PLATFORMS.map((p) => (
              <div key={p.code} className="flex items-center gap-2">
                <Badge variant="outline" className={p.badgeClass}>{p.label}</Badge>
                <code className="text-xs bg-muted px-2 py-1 rounded flex-1">
                  {`<supabase-url>/functions/v1/aggregator-webhook?platform=${p.code}`}
                </code>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Replace <code>{'<supabase-url>'}</code> with your project URL.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

interface PlatformCardProps {
  platform: PlatformDescriptor
  config?: PlatformConfig
  queryClient: ReturnType<typeof useQueryClient>
}

function PlatformCard({ platform, config, queryClient }: PlatformCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [showSecrets, setShowSecrets] = useState(false)
  const requirePin = useRequirePin()
  const [formData, setFormData] = useState<CreatePlatformConfigRequest>({
    platform: platform.code as any,
    is_enabled: config?.is_enabled ?? false,
    api_key: '',
    api_secret: '',
    webhook_secret: '',
    restaurant_id: config?.restaurant_id ?? '',
  })

  const saveMutation = useMutation({
    mutationFn: (data: CreatePlatformConfigRequest) =>
      adminApi.upsertPlatformConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-configs'] })
      setIsEditing(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => adminApi.deletePlatformConfig(platform.code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-configs'] })
    },
  })

  const toggleEnabled = () => {
    saveMutation.mutate({
      platform: platform.code as any,
      is_enabled: !config?.is_enabled,
    })
  }

  const handleSave = () => {
    // Only send non-empty credential fields
    const data: CreatePlatformConfigRequest = {
      platform: platform.code as any,
      is_enabled: formData.is_enabled,
    }
    if (formData.api_key) data.api_key = formData.api_key
    if (formData.api_secret) data.api_secret = formData.api_secret
    if (formData.webhook_secret) data.webhook_secret = formData.webhook_secret
    if (formData.restaurant_id) data.restaurant_id = formData.restaurant_id

    saveMutation.mutate(data)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className={`${platform.badgeClass} font-bold text-sm px-3 py-1`}>
              {platform.label}
            </Badge>
            <Badge variant="outline" className="text-xs text-muted-foreground">
              {platform.region}
            </Badge>
            {config ? (
              <Badge variant={config.is_enabled ? 'default' : 'secondary'}>
                {config.is_enabled ? 'Active' : 'Disabled'}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                Not Configured
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {config && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleEnabled}
                disabled={saveMutation.isPending}
              >
                {config.is_enabled ? (
                  <PowerOff className="h-4 w-4 text-red-500" />
                ) : (
                  <Power className="h-4 w-4 text-green-500" />
                )}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? 'Cancel' : 'Configure'}
            </Button>
          </div>
        </div>
        <CardDescription>{platform.description}</CardDescription>
      </CardHeader>

      {isEditing && (
        <CardContent className="space-y-4">
          {/* Restaurant ID */}
          <div>
            <label className="text-sm font-medium">
              Platform Restaurant ID
            </label>
            <Input
              placeholder={`Your ${platform.label} restaurant ID`}
              value={formData.restaurant_id || ''}
              onChange={(e) =>
                setFormData({ ...formData, restaurant_id: e.target.value })
              }
            />
            <p className="text-xs text-muted-foreground mt-1">
              The restaurant ID assigned by {platform.label}
            </p>
          </div>

          {/* Credentials */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">API Credentials</label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSecrets(!showSecrets)}
                className="h-7"
              >
                {showSecrets ? (
                  <EyeOff className="h-3.5 w-3.5 mr-1" />
                ) : (
                  <Eye className="h-3.5 w-3.5 mr-1" />
                )}
                {showSecrets ? 'Hide' : 'Show'}
              </Button>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">API Key</label>
              <Input
                type={showSecrets ? 'text' : 'password'}
                placeholder={config?.api_key || 'Enter API key'}
                value={formData.api_key || ''}
                onChange={(e) =>
                  setFormData({ ...formData, api_key: e.target.value })
                }
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground">
                API Secret
              </label>
              <Input
                type={showSecrets ? 'text' : 'password'}
                placeholder={config?.api_secret || 'Enter API secret'}
                value={formData.api_secret || ''}
                onChange={(e) =>
                  setFormData({ ...formData, api_secret: e.target.value })
                }
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground">
                Webhook Secret
              </label>
              <Input
                type={showSecrets ? 'text' : 'password'}
                placeholder={config?.webhook_secret || 'Enter webhook secret'}
                value={formData.webhook_secret || ''}
                onChange={(e) =>
                  setFormData({ ...formData, webhook_secret: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground mt-1">
                Used to verify webhook signatures from the cloud relay
              </p>
            </div>
          </div>

          {/* Enable/Disable */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium">Enable Integration</label>
            <Button
              variant={formData.is_enabled ? 'default' : 'outline'}
              size="sm"
              onClick={() =>
                setFormData({ ...formData, is_enabled: !formData.is_enabled })
              }
            >
              {formData.is_enabled ? 'Enabled' : 'Disabled'}
            </Button>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t">
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="flex-1"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Save Configuration
            </Button>
            {config && (
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  const verified = await requirePin('Remove Platform', `Enter PIN to remove ${platform.label} configuration`)
                  if (verified) {
                    deleteMutation.mutate()
                  }
                }}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          {saveMutation.isError && (
            <p className="text-sm text-red-600">
              Failed to save. Please try again.
            </p>
          )}
        </CardContent>
      )}
    </Card>
  )
}
