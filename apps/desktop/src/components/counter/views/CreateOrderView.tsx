import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { ImageOff, Clock, Barcode, Settings2 } from 'lucide-react'
import { useSettingsStore } from '@pos/core'
import type { Product, CartItem, Category } from '../types'
import { imageUrl } from '@/lib/utils'

const dietaryColors: Record<string, string> = {
  veg: '#22c55e',
  non_veg: '#ef4444',
  vegan: '#16a34a',
  egg: '#eab308',
}

interface CreateOrderViewProps {
  products: Product[]
  categories: Category[]
  cart: CartItem[]
  onAddToCart: (product: Product) => void
  onRemoveFromCart: (productId: string) => void
  onRemoveItem?: (productId: string) => void
  onConfigureProduct?: (product: Product) => void
  formatCurrency: (amount: number) => string
}

/**
 * Touch-friendly product grid view for creating orders
 * Products are grouped by category with sticky headers
 */
export function CreateOrderView({
  products,
  categories,
  cart,
  onAddToCart,
  onRemoveFromCart: _onRemoveFromCart,
  onRemoveItem,
  onConfigureProduct,
  formatCurrency
}: CreateOrderViewProps) {
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null)
  const [longPressProductId, setLongPressProductId] = useState<string | null>(null)
  const { settings } = useSettingsStore()
  const displaySettings = settings.productDisplay ?? {
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

  const safeProducts = Array.isArray(products) ? products : []
  const safeCategories = Array.isArray(categories) ? categories : []

  // Get total quantity in cart for a product (sums across all variants)
  const getCartQty = (productId: string) => {
    return cart.filter(item => item.product.id === productId).reduce((sum, item) => sum + item.quantity, 0)
  }

  // Group products by category
  const productsByCategory = safeCategories.map(category => ({
    category,
    products: safeProducts.filter(p => p.category_id === category.id)
  })).filter(group => group.products.length > 0)

  // Products without a category
  const uncategorizedProducts = safeProducts.filter(
    p => !safeCategories.some(c => c.id === p.category_id)
  )

  const handleProductClick = (product: Product) => {
    if ((product.has_option_groups || product.product_type === 'combo') && onConfigureProduct) {
      onConfigureProduct(product)
    } else {
      onAddToCart(product)
    }
  }

  const handleLongPressStart = (productId: string) => {
    const timer = setTimeout(() => {
      // Long press triggered - remove the entire item
      if (onRemoveItem) {
        onRemoveItem(productId)
      }
      setLongPressProductId(null)
    }, 800) // 800ms for long press
    setLongPressTimer(timer)
    setLongPressProductId(productId)
  }

  const handleLongPressEnd = (product: Product) => {
    if (longPressTimer) {
      clearTimeout(longPressTimer)
      setLongPressTimer(null)
    }
    // If it wasn't a long press, do regular click
    if (longPressProductId === product.id) {
      handleProductClick(product)
    }
    setLongPressProductId(null)
  }

  const handleLongPressCancel = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer)
      setLongPressTimer(null)
    }
    setLongPressProductId(null)
  }

  const renderProductCard = (product: Product) => {
    const cartQty = getCartQty(product.id)
    const isUnavailable = !product.is_available
    const hasOptions = !!product.has_option_groups
    const isCombo = product.product_type === 'combo'

    return (
      <div
        key={product.id}
        onPointerDown={() => !isUnavailable && handleLongPressStart(product.id)}
        onPointerUp={() => !isUnavailable && handleLongPressEnd(product)}
        onPointerLeave={handleLongPressCancel}
        onPointerCancel={handleLongPressCancel}
        className={`
          relative overflow-hidden cursor-pointer transition-all rounded-xl
          ${displaySettings.showImage && product.image_url ? 'aspect-square' : ''} flex flex-col bg-zinc-900
          ${isUnavailable
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:bg-zinc-800 active:scale-[0.98]'
          }
          ${cartQty > 0 ? 'ring-2 ring-amber-500 z-10' : ''}
          ${longPressProductId === product.id ? 'ring-4 ring-red-500 scale-[0.95]' : ''}
        `}
      >
        {/* Product Image - only show when image exists */}
        {displaySettings.showImage && product.image_url && (
          <div className="relative h-2/3 bg-zinc-800 overflow-hidden">
            <img
              src={imageUrl(product.image_url)}
              alt={product.name}
              className="w-full h-full object-cover"
            />

            {/* Top Right: Quantity Badge */}
            {cartQty > 0 && (
              <div className="absolute top-1 sm:top-2 right-1 sm:right-2 bg-amber-500 text-white w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm shadow-lg">
                {cartQty}
              </div>
            )}

            {/* Bottom Right: Prep Time */}
            {displaySettings.showPreparationTime && product.preparation_time > 0 && (
              <div className="absolute bottom-1 sm:bottom-2 right-1 sm:right-2">
                <Badge variant="secondary" className="text-[10px] sm:text-xs bg-black/60 text-white border-0 flex items-center gap-0.5 sm:gap-1 px-1 sm:px-2 py-0.5">
                  <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  {product.preparation_time}m
                </Badge>
              </div>
            )}

            {/* Unavailable Overlay */}
            {displaySettings.showAvailability && isUnavailable && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <Badge variant="secondary" className="text-[10px] sm:text-xs">
                  Unavailable
                </Badge>
              </div>
            )}
          </div>
        )}

        {/* Quantity badge when image is hidden */}
        {(!displaySettings.showImage || !product.image_url) && cartQty > 0 && (
          <div className="absolute top-1 sm:top-2 right-1 sm:right-2 bg-amber-500 text-white w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center font-bold text-[10px] sm:text-xs shadow-lg">
            {cartQty}
          </div>
        )}

        {/* Product Info */}
        <div className={`flex-1 p-1.5 sm:p-2 md:p-2.5 flex flex-col justify-between ${!displaySettings.showImage || !product.image_url ? 'py-2 sm:py-3' : ''}`}>
          <div>
            <h3 className="font-bold text-xs sm:text-sm md:text-base lg:text-md leading-tight line-clamp-1 flex items-center gap-0.5 sm:gap-1 text-zinc-100">
              {displaySettings.showDietaryType && product.dietary_type && (
                <span
                  className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: dietaryColors[product.dietary_type] || '#888' }}
                />
              )}
              {product.name}
              {(hasOptions || isCombo) && (
                <Settings2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-zinc-500 flex-shrink-0" />
              )}
            </h3>
            {displaySettings.showDescription && product.description && (
              <p className="text-xs text-zinc-500 truncate">
                {product.description}
              </p>
            )}
            {displaySettings.showSku && product.sku && (
              <p className="text-xs text-zinc-500">
                SKU: {product.sku}
              </p>
            )}
            {displaySettings.showBarcode && product.barcode && (
              <p className="text-xs text-zinc-500 flex items-center gap-1">
                <Barcode className="w-3 h-3" />
                {product.barcode}
              </p>
            )}
            {(!displaySettings.showImage || !product.image_url) && displaySettings.showPreparationTime && product.preparation_time > 0 && (
              <p className="text-xs text-zinc-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {product.preparation_time} min
              </p>
            )}
          </div>
          <div className="flex items-center justify-between gap-1 sm:gap-2">
            {displaySettings.showPrice && (
              <span className="text-sm sm:text-base md:text-lg lg:text-xl font-normal tabular-nums font-mono">
                {(() => {
                  const renderPrice = (str: string) => {
                    const match = str.match(/^([^\d]*)(.+)$/)
                    if (!match) return <span className="text-emerald-600">{str}</span>
                    return <><span className="text-emerald-600/40">{match[1]}</span><span className="text-emerald-600">{match[2]}</span></>
                  }
                  if (product.min_variation_price != null) {
                    return product.min_variation_price === product.max_variation_price
                      ? renderPrice(formatCurrency(product.min_variation_price))
                      : <>{renderPrice(formatCurrency(product.min_variation_price))} <span className="text-emerald-600">-</span> {renderPrice(formatCurrency(product.max_variation_price!))}</>
                  }
                  return renderPrice(formatCurrency(product.price))
                })()}
              </span>
            )}
            {displaySettings.showAvailability && (!displaySettings.showImage || !product.image_url) && isUnavailable && (
              <Badge variant="secondary" className="text-xs">
                Unavailable
              </Badge>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {productsByCategory.map(({ category, products: categoryProducts }) => (
        <div key={category.id}>
          {/* Category Header */}
          <div className="sticky top-0 z-10 bg-zinc-900 border-b border-zinc-800 px-3 sm:px-4 py-2 sm:py-3 text-base sm:text-lg md:text-xl font-black tracking-tight text-zinc-100 flex items-center justify-between">
            <span>{category.name}</span>
            <span className="text-zinc-500 text-xs sm:text-sm">{categoryProducts.length} items</span>
          </div>
          {/* Products Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-1.5 sm:gap-2 md:gap-2.5 p-1.5 sm:p-2 md:p-3">
            {categoryProducts.map(renderProductCard)}
          </div>
        </div>
      ))}

      {/* Uncategorized Products */}
      {uncategorizedProducts.length > 0 && (
        <div>
          <div className="sticky top-0 z-10 bg-zinc-900 border-b border-zinc-800 px-3 sm:px-4 py-2 sm:py-3 text-base sm:text-lg md:text-xl font-black tracking-tight text-zinc-100 flex items-center justify-between">
            <span>Other Items</span>
            <span className="text-zinc-500 text-xs sm:text-sm">{uncategorizedProducts.length} items</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-1.5 sm:gap-2 md:gap-2.5 p-1.5 sm:p-2 md:p-3">
            {uncategorizedProducts.map(renderProductCard)}
          </div>
        </div>
      )}

      {/* Empty state */}
      {safeProducts.length === 0 && (
        <div className="text-center py-12 text-zinc-500">
          <p className="text-lg">No products available</p>
        </div>
      )}
    </div>
  )
}
