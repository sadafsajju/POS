import { ArrowLeft, Plus, Minus, Trash2, ShoppingBag } from 'lucide-react'
import { useSettingsStore } from '@pos/core'
import { useKioskStore } from '../store/kiosk-store'
import { imageUrl } from '@/lib/utils'

export function CartScreen() {
  const { settings } = useSettingsStore()
  const cart = useKioskStore((s) => s.cart)
  const setStep = useKioskStore((s) => s.setStep)
  const updateQuantity = useKioskStore((s) => s.updateQuantity)
  const removeFromCart = useKioskStore((s) => s.removeFromCart)
  const getSubtotal = useKioskStore((s) => s.getSubtotal)
  const getItemPrice = useKioskStore((s) => s.getItemPrice)
  const getItemCount = useKioskStore((s) => s.getItemCount)

  const formatCurrency = (amount: number) => {
    const currency = settings.currency || 'INR'
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount)
  }

  const subtotal = getSubtotal()
  const taxRate = settings.taxRate || 0
  const taxAmount = subtotal * (taxRate / 100)
  const total = subtotal + taxAmount

  if (cart.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-6 px-8">
        <div className="w-24 h-24 bg-zinc-800 rounded-full flex items-center justify-center">
          <ShoppingBag className="w-12 h-12 text-zinc-600" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-zinc-100">Your cart is empty</h2>
          <p className="text-zinc-400 mt-2">Add some items from the menu to get started</p>
        </div>
        <button
          onClick={() => setStep('menu')}
          className="px-8 py-4 bg-amber-500 hover:bg-amber-400 text-white text-lg font-bold rounded-xl transition-colors active:scale-[0.98]"
        >
          Browse Menu
        </button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center px-6 py-4 border-b border-zinc-800 flex-shrink-0">
        <button
          onClick={() => setStep('menu')}
          className="p-3 rounded-xl hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="flex-1 text-center text-2xl font-bold pr-12">
          Your Order ({getItemCount()} {getItemCount() === 1 ? 'item' : 'items'})
        </h1>
      </div>

      {/* Cart items */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {cart.map((item) => {
          const unitPrice = getItemPrice(item)
          const lineTotal = unitPrice * item.quantity

          return (
            <div key={item.id} className="flex gap-4 p-4 bg-zinc-900 rounded-2xl border border-zinc-800">
              {/* Product image */}
              <div className="w-20 h-20 rounded-xl bg-zinc-800 overflow-hidden flex-shrink-0">
                {item.product.image_url ? (
                  <img
                    src={imageUrl(item.product.image_url)}
                    alt={item.product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">
                    No img
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base text-zinc-100 truncate">{item.product.name}</h3>

                {/* Selected options */}
                {item.selectedOptions && item.selectedOptions.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {item.selectedOptions.map((opt, i) => (
                      <span key={i} className="text-xs text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full">
                        {opt.itemName}
                      </span>
                    ))}
                  </div>
                )}

                {/* Combo choices */}
                {item.selectedComboChoices && item.selectedComboChoices.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {item.selectedComboChoices.map((choice, i) => (
                      <span key={i} className="text-xs text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full">
                        {choice.productName}
                      </span>
                    ))}
                  </div>
                )}

                {/* Price per unit */}
                <p className="text-sm text-zinc-400 mt-1">
                  {formatCurrency(unitPrice)} each
                </p>
              </div>

              {/* Quantity + total */}
              <div className="flex flex-col items-end justify-between">
                <span className="text-base font-bold text-emerald-500">
                  {formatCurrency(lineTotal)}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="p-2 rounded-lg hover:bg-red-500/10 text-zinc-400 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    className="w-9 h-9 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center font-bold text-lg">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="w-9 h-9 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer - summary + actions */}
      <div className="border-t border-zinc-800 px-6 py-5 flex-shrink-0 bg-zinc-950/80 backdrop-blur-sm space-y-4">
        {/* Totals */}
        <div className="space-y-2">
          <div className="flex justify-between text-base text-zinc-400">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          {taxRate > 0 && (
            <div className="flex justify-between text-base text-zinc-400">
              <span>Tax ({taxRate}%)</span>
              <span>{formatCurrency(taxAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-xl font-bold text-zinc-100 pt-2 border-t border-zinc-800">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => setStep('menu')}
            className="flex-1 py-4 border-2 border-zinc-700 hover:border-zinc-500 text-zinc-300 text-lg font-semibold rounded-xl transition-colors active:scale-[0.98]"
          >
            Add More Items
          </button>
          <button
            onClick={() => setStep('payment')}
            className="flex-[2] py-4 bg-amber-500 hover:bg-amber-400 text-white text-lg font-bold rounded-xl transition-colors active:scale-[0.98]"
          >
            Proceed to Payment
          </button>
        </div>
      </div>
    </div>
  )
}
