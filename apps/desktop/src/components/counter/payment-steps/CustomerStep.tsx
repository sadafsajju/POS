import { useState } from 'react'
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
} from 'lucide-react'
import type { Customer } from '@/types'

interface CustomerStepProps {
  formatCurrency: (amount: number) => string
  onCustomerLinked: (id: string | null, name: string) => void
  onSkip: () => void
}

export function CustomerStep({ formatCurrency, onCustomerLinked, onSkip }: CustomerStepProps) {
  const [phoneNumber, setPhoneNumber] = useState('')
  const [isLookingUp, setIsLookingUp] = useState(false)
  const [foundCustomer, setFoundCustomer] = useState<Customer | null>(null)
  const [customerNotFound, setCustomerNotFound] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [showNameKeyboard, setShowNameKeyboard] = useState(false)
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
        setFoundCustomer(response.data as Customer)
      } else {
        setCustomerNotFound(true)
      }
    } catch {
      setCustomerNotFound(true)
    } finally {
      setIsLookingUp(false)
    }
  }

  const handleUseCustomer = (customer: Customer) => {
    onCustomerLinked(customer.id, customer.name || customer.phone)
  }

  const handleCreateAndProceed = async () => {
    if (!phoneNumber) return
    try {
      const response = await apiClient.createCustomer({
        phone: phoneNumber,
        name: newCustomerName || undefined,
      })
      if (response.success && response.data) {
        const customer = response.data as Customer
        onCustomerLinked(customer.id, customer.name || customer.phone)
      } else {
        onCustomerLinked(null, newCustomerName || phoneNumber)
      }
    } catch {
      onCustomerLinked(null, newCustomerName || phoneNumber)
    }
  }

  const hasResult = foundCustomer || customerNotFound

  const handleReset = () => {
    setPhoneNumber('')
    setFoundCustomer(null)
    setCustomerNotFound(false)
    setNewCustomerName('')
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
                <span>{foundCustomer.total_orders} orders</span>
                <span>{formatCurrency(foundCustomer.total_spent)} spent</span>
              </div>
              <Button
                className="w-full h-12 text-base bg-amber-500 hover:bg-amber-400 font-black tracking-wider text-white"
                size="lg"
                onClick={() => handleUseCustomer(foundCustomer)}
              >
                <CheckCircle2 className="w-5 h-5 mr-2" />
                Use This Customer
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
              <Button
                className="w-full h-14 text-lg active:scale-[0.98] transition-all"
                size="lg"
                onClick={handleCreateAndProceed}
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
        <OnScreenKeyboard
          open={showNameKeyboard}
          onOpenChange={setShowNameKeyboard}
          value={newCustomerName}
          onValueChange={setNewCustomerName}
          title="Customer Name"
          placeholder="Enter customer name..."
          maxLength={100}
        />
      )}
    </div>
  )
}
