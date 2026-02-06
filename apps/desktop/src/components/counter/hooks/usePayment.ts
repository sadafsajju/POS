import { useState, useCallback } from 'react'
import type { Order, PaymentAmounts, PaymentMethodType, PaidPaymentDetails } from '../types'

export interface UsePaymentReturn {
  // Amounts
  paymentAmounts: PaymentAmounts
  setPaymentAmount: (method: PaymentMethodType, amount: string) => void

  // Methods
  activePaymentMethods: Set<PaymentMethodType>
  togglePaymentMethod: (method: PaymentMethodType) => void

  // Reference
  referenceNumber: string
  setReferenceNumber: (ref: string) => void

  // Calculations
  getTotalPaidAmount: () => number
  getRemainingAmount: (orderTotal: number) => number
  getChangeAmount: (orderTotal: number) => number
  getPrimaryPaymentMethod: () => 'cash' | 'credit_card' | 'debit_card' | 'digital_wallet'

  // Post-payment state
  isOrderPaid: boolean
  setIsOrderPaid: (paid: boolean) => void
  paidOrderDetails: Order | null
  setPaidOrderDetails: (order: Order | null) => void
  paidPaymentDetails: PaidPaymentDetails | null
  setPaidPaymentDetails: (details: PaidPaymentDetails | null) => void

  // Get current payment details for saving
  getCurrentPaymentDetails: () => PaidPaymentDetails

  // Reset
  resetPaymentState: () => void
}

/**
 * Hook for managing payment state and calculations
 * Supports split payments across cash, card, and digital methods
 */
export function usePayment(): UsePaymentReturn {
  // Payment amounts for each method
  const [paymentAmounts, setPaymentAmounts] = useState<PaymentAmounts>({
    cash: '',
    card: '',
    digital: ''
  })

  // Active payment methods (can have multiple for split payments)
  const [activePaymentMethods, setActivePaymentMethods] = useState<Set<PaymentMethodType>>(
    new Set(['cash'])
  )

  // Reference number for card/digital payments
  const [referenceNumber, setReferenceNumber] = useState('')

  // Post-payment state
  const [isOrderPaid, setIsOrderPaid] = useState(false)
  const [paidOrderDetails, setPaidOrderDetails] = useState<Order | null>(null)
  const [paidPaymentDetails, setPaidPaymentDetails] = useState<PaidPaymentDetails | null>(null)

  // Set amount for a specific payment method
  const setPaymentAmount = useCallback((method: PaymentMethodType, amount: string) => {
    setPaymentAmounts(prev => ({ ...prev, [method]: amount }))
  }, [])

  // Toggle a payment method on/off
  const togglePaymentMethod = useCallback((method: PaymentMethodType) => {
    setActivePaymentMethods(prev => {
      const newMethods = new Set(prev)
      if (newMethods.has(method)) {
        // Don't allow removing the last method
        if (newMethods.size > 1) {
          newMethods.delete(method)
          // Clear the amount for this method
          setPaymentAmounts(prevAmounts => ({ ...prevAmounts, [method]: '' }))
        }
      } else {
        newMethods.add(method)
      }
      return newMethods
    })
  }, [])

  // Calculate total paid amount from all methods
  const getTotalPaidAmount = useCallback(() => {
    const cash = parseFloat(paymentAmounts.cash) || 0
    const card = parseFloat(paymentAmounts.card) || 0
    const digital = parseFloat(paymentAmounts.digital) || 0
    return cash + card + digital
  }, [paymentAmounts])

  // Get remaining amount to be paid
  const getRemainingAmount = useCallback((orderTotal: number) => {
    return Math.max(0, orderTotal - getTotalPaidAmount())
  }, [getTotalPaidAmount])

  // Get change to return (if overpaid)
  const getChangeAmount = useCallback((orderTotal: number) => {
    const overpayment = getTotalPaidAmount() - orderTotal
    return overpayment > 0 ? overpayment : 0
  }, [getTotalPaidAmount])

  // Determine primary payment method (the one with highest amount, or first active)
  const getPrimaryPaymentMethod = useCallback((): 'cash' | 'credit_card' | 'debit_card' | 'digital_wallet' => {
    const cashAmount = parseFloat(paymentAmounts.cash) || 0
    const cardAmount = parseFloat(paymentAmounts.card) || 0
    const digitalAmount = parseFloat(paymentAmounts.digital) || 0

    if (cardAmount >= cashAmount && cardAmount >= digitalAmount) {
      return 'credit_card'
    } else if (digitalAmount >= cashAmount && digitalAmount >= cardAmount) {
      return 'digital_wallet'
    }
    return 'cash'
  }, [paymentAmounts])

  // Get current payment details for saving
  const getCurrentPaymentDetails = useCallback((): PaidPaymentDetails => {
    return {
      cash: parseFloat(paymentAmounts.cash) || 0,
      card: parseFloat(paymentAmounts.card) || 0,
      digital: parseFloat(paymentAmounts.digital) || 0
    }
  }, [paymentAmounts])

  // Reset all payment state
  const resetPaymentState = useCallback(() => {
    setPaymentAmounts({ cash: '', card: '', digital: '' })
    setActivePaymentMethods(new Set(['cash']))
    setReferenceNumber('')
    setIsOrderPaid(false)
    setPaidOrderDetails(null)
    setPaidPaymentDetails(null)
  }, [])

  return {
    // Amounts
    paymentAmounts,
    setPaymentAmount,

    // Methods
    activePaymentMethods,
    togglePaymentMethod,

    // Reference
    referenceNumber,
    setReferenceNumber,

    // Calculations
    getTotalPaidAmount,
    getRemainingAmount,
    getChangeAmount,
    getPrimaryPaymentMethod,

    // Post-payment state
    isOrderPaid,
    setIsOrderPaid,
    paidOrderDetails,
    setPaidOrderDetails,
    paidPaymentDetails,
    setPaidPaymentDetails,

    // Get current payment details
    getCurrentPaymentDetails,

    // Reset
    resetPaymentState
  }
}
