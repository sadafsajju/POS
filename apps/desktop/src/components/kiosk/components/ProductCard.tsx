import { useState } from 'react'
import { ImageOff, Settings2, Check } from 'lucide-react'
import type { Product } from '@/types'
import { imageUrl } from '@/lib/utils'

const dietaryColors: Record<string, string> = {
  veg: '#22c55e',
  non_veg: '#ef4444',
  vegan: '#16a34a',
  egg: '#eab308',
}

interface ProductCardProps {
  product: Product
  cartQty: number
  onTap: (product: Product) => void
  formatCurrency: (amount: number) => string
}

export function ProductCard({ product, cartQty, onTap, formatCurrency }: ProductCardProps) {
  const [showAdded, setShowAdded] = useState(false)
  const isUnavailable = !product.is_available
  const hasOptions = !!product.has_option_groups
  const isCombo = product.product_type === 'combo'
  const isConfigurable = hasOptions || isCombo

  const handleTap = () => {
    if (isUnavailable) return
    onTap(product)

    // Show brief "Added!" flash for simple products
    if (!isConfigurable) {
      setShowAdded(true)
      setTimeout(() => setShowAdded(false), 600)
    }
  }

  return (
    <button
      onClick={handleTap}
      disabled={isUnavailable}
      className={`
        relative overflow-hidden rounded-2xl flex flex-col bg-zinc-900 text-left transition-all duration-150
        ${isUnavailable ? 'opacity-40 cursor-not-allowed' : 'hover:bg-zinc-800/80 active:scale-[0.97]'}
        ${cartQty > 0 ? 'ring-2 ring-amber-500' : ''}
      `}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] bg-zinc-800 overflow-hidden">
        {product.image_url ? (
          <img
            src={imageUrl(product.image_url)}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageOff className="w-10 h-10 text-zinc-700" />
          </div>
        )}

        {/* Quantity badge */}
        {cartQty > 0 && (
          <div className="absolute top-2 right-2 bg-amber-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-lg">
            {cartQty}
          </div>
        )}

        {/* Unavailable overlay */}
        {isUnavailable && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-sm font-semibold text-zinc-300 bg-zinc-800 px-3 py-1 rounded-lg">
              Unavailable
            </span>
          </div>
        )}

        {/* Added flash */}
        {showAdded && (
          <div className="absolute inset-0 bg-emerald-500/80 flex items-center justify-center animate-in fade-in duration-150">
            <Check className="w-10 h-10 text-white" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex-1 flex flex-col justify-between gap-1">
        <div className="flex items-start gap-1.5">
          {product.dietary_type && (
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1"
              style={{ backgroundColor: dietaryColors[product.dietary_type] || '#888' }}
            />
          )}
          <h3 className="font-semibold text-sm leading-tight line-clamp-2 text-zinc-100">
            {product.name}
          </h3>
          {isConfigurable && (
            <Settings2 className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0 mt-0.5" />
          )}
        </div>

        <div className="text-base font-bold text-emerald-500">
          {product.min_variation_price != null ? (
            product.min_variation_price === product.max_variation_price
              ? formatCurrency(product.min_variation_price)
              : `${formatCurrency(product.min_variation_price)} - ${formatCurrency(product.max_variation_price!)}`
          ) : (
            formatCurrency(product.price)
          )}
        </div>
      </div>
    </button>
  )
}
