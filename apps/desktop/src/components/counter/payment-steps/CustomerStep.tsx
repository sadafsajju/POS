import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { NumberPad } from '@/components/ui/number-pad'
import { OnScreenKeyboard } from '@/components/ui/on-screen-keyboard'
import apiClient from '@/api/client'
import { useSettingsStore } from '@pos/core'
import {
  Phone,
  Search,
  SkipForward,
  CheckCircle2,
  ArrowLeft,
  MapPin,
  Pencil,
} from 'lucide-react'
import type { Customer } from '@/types'

interface CustomerStepProps {
  formatCurrency: (amount: number) => string
  onCustomerLinked: (id: string | null, name: string, address?: string) => void
  onSkip: () => void
  isDelivery?: boolean
}

export function CustomerStep({ formatCurrency, onCustomerLinked, onSkip, isDelivery }: CustomerStepProps) {
  const [phoneNumber, setPhoneNumber] = useState('')
  const [isLookingUp, setIsLookingUp] = useState(false)
  const [foundCustomer, setFoundCustomer] = useState<Customer | null>(null)
  const [customerNotFound, setCustomerNotFound] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [editingAddress, setEditingAddress] = useState(false)
  const [showNameKeyboard, setShowNameKeyboard] = useState(false)
  const [showAddressKeyboard, setShowAddressKeyboard] = useState(false)
  const { settings } = useSettingsStore()
  const touchMode = settings.touchMode

  const handlePhoneLookup = async () => {
    if (!phoneNumber || isLookingUp) return
    setIsLookingUp(true)
    setFoundCustomer(null)
    setCustomerNotFound(false)
    try {
      const response = await apiClient.getCustomerByPhone(phoneNumber)
      if (response.success && response.data) {
        const customer = response.data as Customer
        setFoundCustomer(customer)
        // Pre-fill address from customer record
        if (customer.address) {
          setDeliveryAddress(customer.address)
        }
      } else {
        setCustomerNotFound(true)
      }
    } catch {
      setCustomerNotFound(true)
    } finally {
      setIsLookingUp(false)
    }
  }

  const handleUseCustomer = async (customer: Customer) => {
    // If delivery and address changed, update the customer record
    if (isDelivery && deliveryAddress && deliveryAddress !== customer.address) {
      try {
        await apiClient.updateCustomer(customer.id, { address: deliveryAddress })
      } catch {
        // Non-blocking — proceed even if update fails
      }
    }
    onCustomerLinked(customer.id, customer.name || customer.phone || '', isDelivery ? deliveryAddress : undefined)
  }

  const handleCreateAndProceed = async () => {
    if (!phoneNumber) return
    try {
      const response = await apiClient.createCustomer({
        phone: phoneNumber,
        name: newCustomerName || undefined,
        address: isDelivery ? deliveryAddress || undefined : undefined,
      })
      if (response.success && response.data) {
        const customer = response.data as Customer
        onCustomerLinked(customer.id, customer.name || customer.phone || '', isDelivery ? deliveryAddress : undefined)
      } else {
        onCustomerLinked(null, newCustomerName || phoneNumber, isDelivery ? deliveryAddress : undefined)
      }
    } catch {
      onCustomerLinked(null, newCustomerName || phoneNumber, isDelivery ? deliveryAddress : undefined)
    }
  }

  // Allow physical keyboard input for phone number
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (foundCustomer || customerNotFound) return
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault()
        setPhoneNumber(prev => prev.length < 15 ? prev + e.key : prev)
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        setPhoneNumber(prev => prev.slice(0, -1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        // Trigger lookup via button click to avoid stale closure
        const submitBtn = document.querySelector('[data-phone-submit]') as HTMLButtonElement
        submitBtn?.click()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [foundCustomer, customerNotFound])

  const hasResult = foundCustomer || customerNotFound

  const handleReset = () => {
    setPhoneNumber('')
    setFoundCustomer(null)
    setCustomerNotFound(false)
    setNewCustomerName('')
    setDeliveryAddress('')
    setEditingAddress(false)
  }

  // Address input field (reused for both found customer and new customer)
  const renderAddressField = () => {
    if (!isDelivery) return null

    return (
      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-400 flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5" />
          Delivery Address
        </label>
        {touchMode ? (
          <button
            type="button"
            onClick={() => setShowAddressKeyboard(true)}
            className="w-full min-h-14 px-5 py-3 rounded-lg border-2 border-zinc-700 bg-zinc-900 flex items-center gap-3 text-left hover:border-amber-500 active:scale-[0.98] transition-all"
          >
            <span className={`text-base flex-1 ${deliveryAddress ? 'text-zinc-100' : 'text-zinc-500'}`}>
              {deliveryAddress || 'Enter delivery address...'}
            </span>
          </button>
        ) : (
          <textarea
            value={deliveryAddress}
            onChange={(e) => setDeliveryAddress(e.target.value)}
            placeholder="Enter delivery address..."
            rows={2}
            className="w-full px-4 py-3 rounded-lg border-2 border-zinc-700 bg-zinc-900 text-base text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500 transition-all resize-none"
          />
        )}
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm flex flex-col gap-4">
      {!hasResult ? (
        <>
          <div className="text-center">
            <h3 className="text-2xl font-black tracking-tight text-zinc-100">Customer Phone Number</h3>
            <p className="text-zinc-400 mt-2">Enter phone to link this bill to a customer</p>
          </div>

          {/* Phone display */}
          <div className="w-full h-16 px-6 rounded-lg border-2 border-amber-500 ring-2 ring-amber-500/20 bg-zinc-900 flex items-center justify-center gap-2">
            <Phone className="w-5 h-5 text-zinc-400" />
            <span className={`text-3xl font-bold ${phoneNumber ? 'text-zinc-100' : 'text-zinc-500'}`}>
              {phoneNumber || 'Phone number'}
            </span>
          </div>

          {/* Number pad for phone */}
          <NumberPad
            value={phoneNumber}
            onValueChange={setPhoneNumber}
            maxDigits={15}
            allowDecimal={false}
          />

          {/* Submit button */}
          <Button
            className="w-full h-14 text-lg"
            size="lg"
            data-phone-submit
            onClick={handlePhoneLookup}
            disabled={!phoneNumber || isLookingUp}
          >
            {isLookingUp ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Looking up...
              </>
            ) : (
              <>
                <Search className="w-5 h-5 mr-2" />
                Submit
              </>
            )}
          </Button>

          {/* Skip link */}
          <button
            onClick={onSkip}
            className="text-sm text-zinc-400 hover:text-zinc-100 underline-offset-4 hover:underline flex items-center justify-center gap-1 pt-2"
          >
            <SkipForward className="w-4 h-4" />
            Skip — No customer
          </button>
        </>
      ) : (
        <>
          {/* Back button */}
          <button
            onClick={handleReset}
            className="w-12 h-12 rounded-full border border-zinc-700 bg-zinc-800 flex items-center justify-center hover:bg-zinc-700 active:scale-95 transition-all"
          >
            <ArrowLeft className="w-6 h-6 text-zinc-100" />
          </button>

          {/* Found customer */}
          {foundCustomer && (
            <div className="border border-zinc-700 bg-zinc-800 rounded-lg p-4 space-y-3">
              <div>
                <p className="font-semibold text-lg text-zinc-100">{foundCustomer.name || 'No name'}</p>
                <p className="text-sm text-zinc-400">{foundCustomer.phone}</p>
              </div>
              <div className="flex gap-4 text-sm text-zinc-400">
                <span>{foundCustomer.total_orders ?? 0} orders</span>
                <span>{formatCurrency(foundCustomer.total_spent ?? 0)} spent</span>
              </div>

              {/* Delivery address for found customer */}
              {isDelivery && (
                <>
                  {foundCustomer.address && !editingAddress ? (
                    <div className="border border-zinc-600 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-zinc-400 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5" />
                          Delivery Address
                        </span>
                        <button
                          onClick={() => setEditingAddress(true)}
                          className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
                        >
                          <Pencil className="w-3 h-3" />
                          Change
                        </button>
                      </div>
                      <p className="text-sm text-zinc-100">{deliveryAddress || foundCustomer.address}</p>
                    </div>
                  ) : (
                    renderAddressField()
                  )}
                </>
              )}

              <Button
                className="w-full h-12 text-base bg-amber-500 hover:bg-amber-400 font-black tracking-wider text-white"
                size="lg"
                onClick={() => handleUseCustomer(foundCustomer)}
                disabled={isDelivery && !deliveryAddress}
              >
                <CheckCircle2 className="w-5 h-5 mr-2" />
                {isDelivery ? 'Confirm & Continue' : 'Use This Customer'}
              </Button>
            </div>
          )}

          {/* Customer not found — offer to create */}
          {customerNotFound && (
            <div className="border border-zinc-700 rounded-lg p-5 space-y-4">
              <p className="text-base text-zinc-400">Create a new customer record.</p>
              {touchMode ? (
                <button
                  type="button"
                  onClick={() => setShowNameKeyboard(true)}
                  className="w-full h-14 px-5 rounded-lg border-2 border-zinc-700 bg-zinc-900 flex items-center gap-3 text-left hover:border-amber-500 active:scale-[0.98] transition-all"
                >
                  <span className={`text-lg flex-1 ${newCustomerName ? 'text-zinc-100' : 'text-zinc-500'}`}>
                    {newCustomerName || 'Customer name'}
                  </span>
                </button>
              ) : (
                <input
                  type="text"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  placeholder="Customer name"
                  className="w-full h-14 px-5 rounded-lg border-2 border-zinc-700 bg-zinc-900 text-lg text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500 transition-all"
                />
              )}

              {/* Delivery address for new customer */}
              {renderAddressField()}

              <Button
                className="w-full h-14 text-lg active:scale-[0.98] transition-all"
                size="lg"
                onClick={handleCreateAndProceed}
                disabled={isDelivery && !deliveryAddress}
              >
                Save & Continue
              </Button>
            </div>
          )}

          {/* Skip link */}
          <button
            onClick={onSkip}
            className="text-sm text-zinc-400 hover:text-zinc-100 underline-offset-4 hover:underline flex items-center justify-center gap-1"
          >
            <SkipForward className="w-4 h-4" />
            Skip — No customer
          </button>
        </>
      )}

      {/* Name keyboard (touch mode only) */}
      {touchMode && (
        <>
          <OnScreenKeyboard
            open={showNameKeyboard}
            onOpenChange={setShowNameKeyboard}
            value={newCustomerName}
            onValueChange={setNewCustomerName}
            title="Customer Name"
            placeholder="Enter customer name..."
            maxLength={100}
          />
          <OnScreenKeyboard
            open={showAddressKeyboard}
            onOpenChange={setShowAddressKeyboard}
            value={deliveryAddress}
            onValueChange={setDeliveryAddress}
            title="Delivery Address"
            placeholder="Enter delivery address..."
            maxLength={500}
          />
        </>
      )}
    </div>
  )
}
