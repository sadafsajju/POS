import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { NumberPad } from '@/components/ui/number-pad'
import { OnScreenKeyboard } from '@/components/ui/on-screen-keyboard'
import apiClient from '@/api/client'
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
            <h3 className="text-2xl font-semibold">Customer Phone Number</h3>
            <p className="text-muted-foreground mt-2">Enter phone to link this bill to a customer</p>
          </div>

          {/* Phone display */}
          <div className="w-full h-16 px-6 rounded-lg border-2 border-blue-500 ring-2 ring-blue-500/20 bg-background flex items-center justify-center gap-2">
            <Phone className="w-5 h-5 text-muted-foreground" />
            <span className={`text-3xl font-bold ${phoneNumber ? 'text-foreground' : 'text-muted-foreground'}`}>
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
            className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline flex items-center justify-center gap-1 pt-2"
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
            className="w-12 h-12 rounded-full border border-border bg-background flex items-center justify-center hover:bg-accent active:scale-95 transition-all"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>

          {/* Found customer */}
          {foundCustomer && (
            <div className="border border-muted bg-muted/50 rounded-lg p-4 space-y-3">
              <div>
                <p className="font-semibold text-lg">{foundCustomer.name || 'No name'}</p>
                <p className="text-sm text-muted-foreground">{foundCustomer.phone}</p>
              </div>
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span>{foundCustomer.total_orders} orders</span>
                <span>{formatCurrency(foundCustomer.total_spent)} spent</span>
              </div>
              <Button
                className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700 text-white"
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
            <div className="border border-border rounded-lg p-5 space-y-4">
              <p className="text-base text-muted-foreground">Create a new customer record.</p>
              <button
                type="button"
                onClick={() => setShowNameKeyboard(true)}
                className="w-full h-14 px-5 rounded-lg border-2 border-input bg-background flex items-center gap-3 text-left hover:border-primary active:scale-[0.98] transition-all"
              >
                <span className={`text-lg flex-1 ${newCustomerName ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {newCustomerName || 'Customer name'}
                </span>
              </button>
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
            className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline flex items-center justify-center gap-1"
          >
            <SkipForward className="w-4 h-4" />
            Skip — No customer
          </button>
        </>
      )}

      {/* Name keyboard */}
      <OnScreenKeyboard
        open={showNameKeyboard}
        onOpenChange={setShowNameKeyboard}
        value={newCustomerName}
        onValueChange={setNewCustomerName}
        title="Customer Name"
        placeholder="Enter customer name..."
        maxLength={100}
      />
    </div>
  )
}
