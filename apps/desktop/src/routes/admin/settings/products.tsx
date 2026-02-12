import { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { Package, Loader2, Clock, Barcode, ImageOff, Settings2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useSettingsStore } from '@pos/core'
import { toastHelpers } from '@/lib/toast-helpers'
import { SettingsPageLayout } from '@/components/admin/settings/SettingsPageLayout'
import type { ProductDisplaySettings } from '@pos/types'

export const Route = createFileRoute('/admin/settings/products')({
  component: ProductsSettingsPage,
})

// Sample products matching the real POS data shape
const sampleProducts = [
  {
    id: 'p1',
    name: 'Chicken Biryani',
    description: 'Aromatic basmati rice layered with tender chicken and spices',
    price: 299,
    sku: 'BIR-001',
    barcode: '8901234567890',
    dietary_type: 'non_veg' as const,
    preparation_time: 25,
    is_available: true,
    has_option_groups: false,
    product_type: 'simple' as const,
    image_url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=300&h=300&fit=crop',
    cartQty: 2,
  },
  {
    id: 'p2',
    name: 'Butter Naan',
    description: 'Soft tandoori bread brushed with butter',
    price: 60,
    sku: 'NAN-002',
    barcode: '8901234567891',
    dietary_type: 'veg' as const,
    preparation_time: 8,
    is_available: true,
    has_option_groups: false,
    product_type: 'simple' as const,
    image_url: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=300&h=300&fit=crop',
    cartQty: 0,
  },
  {
    id: 'p3',
    name: 'Masala Chai',
    description: 'Spiced Indian tea with milk',
    price: 40,
    sku: 'CHI-003',
    barcode: '8901234567892',
    dietary_type: 'veg' as const,
    preparation_time: 5,
    is_available: true,
    has_option_groups: false,
    product_type: 'simple' as const,
    image_url: '',
    cartQty: 0,
  },
  {
    id: 'p4',
    name: 'Combo Thali',
    description: 'Dal, rice, roti, sabzi, raita, salad',
    price: 349,
    sku: 'CMB-004',
    barcode: '8901234567893',
    dietary_type: 'veg' as const,
    preparation_time: 20,
    is_available: false,
    has_option_groups: true,
    product_type: 'combo' as const,
    image_url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=300&h=300&fit=crop',
    cartQty: 0,
  },
]

const dietaryColors: Record<string, string> = {
  veg: '#22c55e',
  non_veg: '#ef4444',
  vegan: '#16a34a',
  egg: '#eab308',
}

const displayOptions: { key: keyof ProductDisplaySettings; label: string; description: string }[] = [
  { key: 'showImage', label: 'Product Image', description: 'Display product images in the POS grid' },
  { key: 'showDescription', label: 'Description', description: 'Show product descriptions below the name' },
  { key: 'showPrice', label: 'Price', description: 'Display the product price on cards' },
  { key: 'showCategory', label: 'Category', description: 'Show which category the product belongs to' },
  { key: 'showDietaryType', label: 'Dietary Type', description: 'Display veg/non-veg/vegan indicators' },
  { key: 'showAvailability', label: 'Availability Status', description: 'Show if product is available or out of stock' },
  { key: 'showSku', label: 'SKU', description: 'Display the product SKU code' },
  { key: 'showBarcode', label: 'Barcode', description: 'Show the product barcode number' },
  { key: 'showPreparationTime', label: 'Preparation Time', description: 'Display estimated preparation time' },
]

// ── Preview card matching CreateOrderView exactly ─────────────────────────────

function PreviewCard({
  product,
  displaySettings,
  formatCurrency,
}: {
  product: typeof sampleProducts[0]
  displaySettings: ProductDisplaySettings
  formatCurrency: (amount: number) => string
}) {
  const isUnavailable = !product.is_available
  const hasOptions = !!product.has_option_groups
  const isCombo = product.product_type === 'combo'

  return (
    <div
      className={cn(
        'relative overflow-hidden cursor-pointer transition-all flex flex-col bg-card',
        displaySettings.showImage && 'aspect-square',
        isUnavailable
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:bg-muted/50 active:scale-[0.98]',
        product.cartQty > 0 && 'ring-2 ring-primary z-10',
      )}
    >
      {/* Product Image */}
      {displaySettings.showImage && (
        <div className="relative h-2/3 bg-muted overflow-hidden">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <ImageOff className="w-12 h-12 text-muted-foreground/30" />
            </div>
          )}

          {/* Quantity Badge */}
          {product.cartQty > 0 && (
            <div className="absolute top-2 right-2 bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-lg">
              {product.cartQty}
            </div>
          )}

          {/* Prep Time */}
          {displaySettings.showPreparationTime && product.preparation_time > 0 && (
            <div className="absolute bottom-2 right-2">
              <Badge variant="secondary" className="text-xs bg-black/60 text-white border-0 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {product.preparation_time}m
              </Badge>
            </div>
          )}

          {/* Unavailable Overlay */}
          {displaySettings.showAvailability && isUnavailable && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <Badge variant="secondary" className="text-xs">
                Unavailable
              </Badge>
            </div>
          )}
        </div>
      )}

      {/* Quantity badge when image hidden */}
      {!displaySettings.showImage && product.cartQty > 0 && (
        <div className="absolute top-2 right-2 bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shadow-lg">
          {product.cartQty}
        </div>
      )}

      {/* Product Info */}
      <div className={cn('flex-1 p-2 flex flex-col justify-between', !displaySettings.showImage && 'py-3')}>
        <div>
          <h3 className="font-bold text-md leading-tight line-clamp-1 flex items-center gap-1">
            {displaySettings.showDietaryType && product.dietary_type && (
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: dietaryColors[product.dietary_type] || '#888' }}
              />
            )}
            {product.name}
            {(hasOptions || isCombo) && (
              <Settings2 className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            )}
          </h3>
          {displaySettings.showDescription && product.description && (
            <p className="text-xs text-muted-foreground truncate">
              {product.description}
            </p>
          )}
          {displaySettings.showSku && product.sku && (
            <p className="text-xs text-muted-foreground">
              SKU: {product.sku}
            </p>
          )}
          {displaySettings.showBarcode && product.barcode && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Barcode className="w-3 h-3" />
              {product.barcode}
            </p>
          )}
          {!displaySettings.showImage && displaySettings.showPreparationTime && product.preparation_time > 0 && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {product.preparation_time} min
            </p>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          {displaySettings.showPrice && (
            <span className="text-base font-bold text-primary">
              {formatCurrency(product.price)}
            </span>
          )}
          {displaySettings.showAvailability && !displaySettings.showImage && isUnavailable && (
            <Badge variant="secondary" className="text-xs">
              Unavailable
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

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
    setLocalSettings((prev) => ({ ...prev, [key]: !prev[key] }))
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
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
      </div>
    )
  }

  const formatCurrency = (amount: number) => `${settings.currencySymbol || '\u20B9'}${amount}`

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
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* ── Left: Settings toggles ───────────────────────────────────── */}
        <div className="bg-zinc-900 rounded-lg border border-zinc-800">
          <div className="px-5 pt-5 pb-3">
            <h3 className="text-base font-bold text-zinc-200">Display Options</h3>
            <p className="text-sm text-zinc-500">Toggle which fields appear on product cards in the POS interface</p>
          </div>
          <div className="px-5 pb-5 space-y-2">
            {displayOptions.map((option) => (
              <button
                key={option.key}
                onClick={() => handleToggle(option.key)}
                className={cn(
                  'flex items-center justify-between w-full p-3 rounded-lg border transition-colors text-left',
                  localSettings[option.key]
                    ? 'bg-emerald-500/10 border-emerald-500/20'
                    : 'bg-zinc-800/50 border-zinc-800 hover:bg-zinc-800'
                )}
              >
                <div className="space-y-0.5">
                  <span className="block text-sm font-medium text-zinc-200">{option.label}</span>
                  <span className="block text-xs text-zinc-500">{option.description}</span>
                </div>
                <div
                  className={cn(
                    'w-10 h-6 rounded-full relative transition-colors flex-shrink-0 ml-4',
                    localSettings[option.key] ? 'bg-emerald-500' : 'bg-zinc-700'
                  )}
                >
                  <div
                    className={cn(
                      'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
                      localSettings[option.key] ? 'translate-x-5' : 'translate-x-1'
                    )}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Right: Live Preview (sticky) ─────────────────────────────── */}
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 lg:sticky lg:top-4">
          <div className="px-5 pt-5 pb-2 flex items-baseline justify-between">
            <div>
              <h3 className="text-sm font-bold text-zinc-300">Live Preview</h3>
              <p className="text-xs text-zinc-600">Matches your actual POS grid</p>
            </div>
            <span className="text-[10px] text-zinc-600 tabular-nums">2 &times; 2 grid</span>
          </div>

          {/* Category header - matching real POS */}
          <div className="mx-5 mb-2 bg-card border-b border-border px-3 py-2 text-sm font-semibold flex items-center justify-between rounded-t-lg">
            <span>Main Course</span>
            <span className="text-muted-foreground text-xs">4 items</span>
          </div>

          {/* 2x2 product grid - matching real POS layout */}
          <div className="mx-5 mb-5 grid grid-cols-2 gap-2">
            {sampleProducts.map((product) => (
              <PreviewCard
                key={product.id}
                product={product}
                displaySettings={localSettings}
                formatCurrency={formatCurrency}
              />
            ))}
          </div>
        </div>
      </div>
    </SettingsPageLayout>
  )
}
