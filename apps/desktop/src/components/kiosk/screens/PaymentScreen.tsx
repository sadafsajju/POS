import { useState } from 'react'
import { ArrowLeft, Banknote, CreditCard, Smartphone, Loader2 } from 'lucide-react'
import { useSettingsStore } from '@pos/core'
import apiClient from '@/api/client'
import type { CreateOrderRequest, ProcessPaymentRequest } from '@/types'
import { useKioskStore } from '../store/kiosk-store'

type PaymentMethod = 'cash' | 'credit_card' | 'digital_wallet'
type PaymentStep = 'method' | 'processing'

export function PaymentScreen() {
  const { settings } = useSettingsStore()
  const cart = useKioskStore((s) => s.cart)
  const orderType = useKioskStore((s) => s.orderType)
  const setStep = useKioskStore((s) => s.setStep)
  const setCreatedOrder = useKioskStore((s) => s.setCreatedOrder)
  const getSubtotal = useKioskStore((s) => s.getSubtotal)
  const getItemPrice = useKioskStore((s) => s.getItemPrice)
  const clearCart = useKioskStore((s) => s.clearCart)

  const [paymentStep, setPaymentStep] = useState<PaymentStep>('method')
  const [error, setError] = useState<string | null>(null)

  const formatCurrency = (amount: number) => {
    const currency = settings.currency || 'INR'
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount)
  }

  const subtotal = getSubtotal()
  const taxRate = settings.taxRate || 0
  const taxAmount = subtotal * (taxRate / 100)
  const total = subtotal + taxAmount

  const handleSelectMethod = (method: PaymentMethod) => {
    processOrder(method, total)
  }

  const processOrder = async (method: PaymentMethod, amount: number) => {
    setPaymentStep('processing')
    setError(null)

    try {
      // Build order items
      const items = cart.map((item) => ({
        product_id: item.product.id,
        quantity: item.quantity,
        special_instructions: item.special_instructions,
        selected_options: item.selectedOptions?.map((opt) => ({
          option_group_name: opt.groupName,
          option_item_name: opt.itemName,
          price_adjustment: opt.priceAdjustment,
        })),
        combo_choices: item.selectedComboChoices?.map((choice) => ({
          slot_name: choice.slotName,
          product_id: choice.productId,
          product_name: choice.productName,
          price_adjustment: choice.priceAdjustment,
          selected_options: choice.selectedOptions.map((opt) => ({
            option_group_name: opt.groupName,
            option_item_name: opt.itemName,
            price_adjustment: opt.priceAdjustment,
          })),
        })),
      }))

      const orderRequest: CreateOrderRequest = {
        order_type: orderType || 'takeout',
        items,
        customer_name: 'Kiosk Customer',
        order_source: 'kiosk',
      }

      // Create order
      const orderResponse = await apiClient.createCounterOrder(orderRequest)
      if (!orderResponse.success || !orderResponse.data) {
        throw new Error(orderResponse.message || 'Failed to create order')
      }

      const order = orderResponse.data

      // Process payment
      const paymentRequest: ProcessPaymentRequest = {
        payment_method: method,
        amount,
      }

      await apiClient.processCounterPayment(order.id, paymentRequest)

      // Success!
      setCreatedOrder(order)
      clearCart()
      setStep('confirmation')
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
      setPaymentStep('method')
    }
  }

  // Processing screen
  if (paymentStep === 'processing') {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-6">
        <Loader2 className="w-16 h-16 text-amber-500 animate-spin" />
        <div className="text-center">
          <h2 className="text-2xl font-bold text-zinc-100">Placing your order...</h2>
          <p className="text-zinc-400 mt-2">Please wait</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center px-6 py-4 border-b border-zinc-800 flex-shrink-0">
        <button
          onClick={() => setStep('cart')}
          className="p-3 rounded-xl hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="flex-1 text-center text-2xl font-bold pr-12">
          Payment Method
        </h1>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mt-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Order summary */}
        <div className="w-80 border-r border-zinc-800 p-6 overflow-y-auto flex-shrink-0">
          <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Order Summary</h3>
          <div className="space-y-3">
            {cart.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-zinc-300">
                  {item.quantity}x {item.product.name}
                </span>
                <span className="text-zinc-400 font-medium">
                  {formatCurrency(getItemPrice(item) * item.quantity)}
                </span>
              </div>
            ))}
          </div>
          <div className="border-t border-zinc-800 mt-4 pt-4 space-y-2">
            <div className="flex justify-between text-sm text-zinc-400">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {taxRate > 0 && (
              <div className="flex justify-between text-sm text-zinc-400">
                <span>Tax ({taxRate}%)</span>
                <span>{formatCurrency(taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold text-zinc-100 pt-2 border-t border-zinc-800">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {/* Right: Method selection */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-lg space-y-4">
            <button
              onClick={() => handleSelectMethod('cash')}
              className="w-full flex items-center gap-6 p-6 rounded-2xl border-2 border-zinc-800 hover:border-amber-500 hover:bg-amber-500/5 transition-all active:scale-[0.98]"
            >
              <div className="w-16 h-16 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Banknote className="w-8 h-8 text-emerald-500" />
              </div>
              <div className="text-left">
                <h3 className="text-xl font-bold">Cash</h3>
                <p className="text-zinc-400 text-sm">Pay with cash at the counter</p>
              </div>
            </button>

            <button
              onClick={() => handleSelectMethod('credit_card')}
              className="w-full flex items-center gap-6 p-6 rounded-2xl border-2 border-zinc-800 hover:border-amber-500 hover:bg-amber-500/5 transition-all active:scale-[0.98]"
            >
              <div className="w-16 h-16 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <CreditCard className="w-8 h-8 text-blue-500" />
              </div>
              <div className="text-left">
                <h3 className="text-xl font-bold">Card</h3>
                <p className="text-zinc-400 text-sm">Credit or debit card</p>
              </div>
            </button>

            <button
              onClick={() => handleSelectMethod('digital_wallet')}
              className="w-full flex items-center gap-6 p-6 rounded-2xl border-2 border-zinc-800 hover:border-amber-500 hover:bg-amber-500/5 transition-all active:scale-[0.98]"
            >
              <div className="w-16 h-16 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Smartphone className="w-8 h-8 text-purple-500" />
              </div>
              <div className="text-left">
                <h3 className="text-xl font-bold">Digital Wallet</h3>
                <p className="text-zinc-400 text-sm">UPI, Google Pay, etc.</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
