import { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Package, Loader2, Clock, Barcode } from 'lucide-react'
import { useSettingsStore } from '@pos/core'
import { toastHelpers } from '@/lib/toast-helpers'
import { SettingsPageLayout } from '@/components/admin/settings/SettingsPageLayout'
import type { ProductDisplaySettings } from '@pos/types'

export const Route = createFileRoute('/admin/settings/products')({
  component: ProductsSettingsPage,
})

// Dummy product for preview (matches Product type from CreateOrderView)
const dummyProduct = {
  id: 'preview-1',
  name: 'Chicken Biryani',
  description: 'Aromatic basmati rice layered with tender chicken and spices',
  price: 299,
  category_id: 'cat-1',
  sku: 'BIR-001',
  barcode: '8901234567890',
  dietary_type: 'non_veg' as const, // matches backend format: veg, non_veg, vegan, egg
  preparation_time: 25,
  is_available: true,
  image_url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=200&h=200&fit=crop',
}

// Dietary colors matching CreateOrderView
const dietaryColors: Record<string, string> = {
  veg: '#22c55e',
  non_veg: '#ef4444',
  vegan: '#16a34a',
  egg: '#eab308',
}

// Preview card component - matches CreateOrderView exactly
function ProductPreviewCard({ settings, formatCurrency }: { settings: ProductDisplaySettings; formatCurrency: (amount: number) => string }) {
  const isUnavailable = !dummyProduct.is_available

  return (
    <div
      className={`
        relative overflow-hidden cursor-pointer transition-all w-[180px] h-[180px]
        flex flex-col bg-card border rounded-lg
        ${isUnavailable ? 'opacity-50' : 'hover:bg-muted/50'}
      `}
    >
      {/* Product Image */}
      {settings.showImage && (
        <div className="relative h-2/3 bg-muted overflow-hidden">
          <img
            src={dummyProduct.image_url}
            alt={dummyProduct.name}
            className="w-full h-full object-cover"
          />

          {/* Bottom Right: Prep Time */}
          {settings.showPreparationTime && dummyProduct.preparation_time > 0 && (
            <div className="absolute bottom-2 right-2">
              <Badge variant="secondary" className="text-xs bg-black/60 text-white border-0 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {dummyProduct.preparation_time}m
              </Badge>
            </div>
          )}

          {/* Unavailable Overlay */}
          {settings.showAvailability && isUnavailable && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <Badge variant="secondary" className="text-xs">
                Unavailable
              </Badge>
            </div>
          )}
        </div>
      )}

      {/* Product Info */}
      <div className={`flex-1 p-2 flex flex-col justify-between ${!settings.showImage ? 'py-3' : ''}`}>
        <div>
          <h3 className="font-bold text-md leading-tight line-clamp-1 flex items-center gap-1">
            {settings.showDietaryType && dummyProduct.dietary_type && (
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: dietaryColors[dummyProduct.dietary_type] || '#888' }}
              />
            )}
            {dummyProduct.name}
          </h3>
          {settings.showDescription && dummyProduct.description && (
            <p className="text-xs text-muted-foreground truncate">
              {dummyProduct.description}
            </p>
          )}
          {settings.showSku && dummyProduct.sku && (
            <p className="text-xs text-muted-foreground">
              SKU: {dummyProduct.sku}
            </p>
          )}
          {settings.showBarcode && dummyProduct.barcode && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Barcode className="w-3 h-3" />
              {dummyProduct.barcode}
            </p>
          )}
          {!settings.showImage && settings.showPreparationTime && dummyProduct.preparation_time > 0 && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {dummyProduct.preparation_time} min
            </p>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          {settings.showPrice && (
            <span className="text-base font-bold text-primary">
              {formatCurrency(dummyProduct.price)}
            </span>
          )}
          {settings.showAvailability && !settings.showImage && isUnavailable && (
            <Badge variant="secondary" className="text-xs">
              Unavailable
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}

const displayOptions: { key: keyof ProductDisplaySettings; label: string; description: string }[] = [
  {
    key: 'showImage',
    label: 'Product Image',
    description: 'Display product images in the POS grid',
  },
  {
    key: 'showDescription',
    label: 'Description',
    description: 'Show product descriptions below the name',
  },
  {
    key: 'showPrice',
    label: 'Price',
    description: 'Display the product price on cards',
  },
  {
    key: 'showCategory',
    label: 'Category',
    description: 'Show which category the product belongs to',
  },
  {
    key: 'showDietaryType',
    label: 'Dietary Type',
    description: 'Display veg/non-veg/vegan indicators',
  },
  {
    key: 'showAvailability',
    label: 'Availability Status',
    description: 'Show if product is available or out of stock',
  },
  {
    key: 'showSku',
    label: 'SKU',
    description: 'Display the product SKU code',
  },
  {
    key: 'showBarcode',
    label: 'Barcode',
    description: 'Show the product barcode number',
  },
  {
    key: 'showPreparationTime',
    label: 'Preparation Time',
    description: 'Display estimated preparation time',
  },
]

function ProductsSettingsPage() {
  const { settings, isLoading, saveSettings } = useSettingsStore()
  const [localSettings, setLocalSettings] = useState<ProductDisplaySettings>(
    settings.productDisplay || {
      showImage: true,
      showDescription: false,
      showPrice: true,
      showSku: false,
      showBarcode: false,
      showDietaryType: true,
      showPreparationTime: false,
      showCategory: true,
      showAvailability: true,
    }
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (settings.productDisplay) {
      setLocalSettings(settings.productDisplay)
    }
  }, [settings.productDisplay])

  useEffect(() => {
    const current = settings.productDisplay || {}
    const changed = Object.keys(localSettings).some(
      (key) => localSettings[key as keyof ProductDisplaySettings] !== current[key as keyof ProductDisplaySettings]
    )
    setHasChanges(changed)
  }, [localSettings, settings.productDisplay])

  const handleToggle = (key: keyof ProductDisplaySettings) => {
    setLocalSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await saveSettings({ ...settings, productDisplay: localSettings })
      toastHelpers.success('Settings saved', 'Product display settings have been updated.')
    } catch (err: any) {
      setError(err.message || 'Failed to save settings')
      toastHelpers.error('Failed to save', err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    if (settings.productDisplay) {
      setLocalSettings(settings.productDisplay)
    }
    toastHelpers.info('Changes discarded', 'Settings reset to last saved values.')
  }

  if (isLoading && !settings.restaurantName) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <SettingsPageLayout
      title="Product Display"
      description="Control what information is shown on product cards"
      icon={<Package className="w-5 h-5" />}
      hasChanges={hasChanges}
      saving={saving}
      error={error}
      onSave={handleSave}
      onReset={handleReset}
      maxWidth="4xl"
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1fr,auto] gap-6">
        {/* Settings toggles */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Display Options</CardTitle>
            <CardDescription>
              Toggle which fields appear on product cards in the POS interface
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {displayOptions.map((option) => (
              <div
                key={option.key}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="space-y-0.5">
                  <Label htmlFor={option.key} className="font-medium cursor-pointer">
                    {option.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">{option.description}</p>
                </div>
                <Switch
                  id={option.key}
                  checked={localSettings[option.key]}
                  onCheckedChange={() => handleToggle(option.key)}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Live Preview */}
        <Card className="lg:w-[280px] h-fit lg:sticky lg:top-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Live Preview</CardTitle>
            <CardDescription>
              See how product cards will appear
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <ProductPreviewCard
              settings={localSettings}
              formatCurrency={(amount) => `${settings.currencySymbol || '₹'}${amount}`}
            />
          </CardContent>
        </Card>
      </div>
    </SettingsPageLayout>
  )
}
