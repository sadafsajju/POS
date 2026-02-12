import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import apiClient from '@/api/client'
import {
  ArrowLeft,
  AlertCircle,
  X,
  User,
} from 'lucide-react'
import { useCustomerDisplayBroadcast } from '@pos/core'
import type { DiningTable, Order, BillSummary } from './types'
import type { PaidPaymentDetails } from './types'
import { consolidateItems } from './utils/orderUtils'
import { printThermalReceipt } from './utils/printUtils'
import { CustomerStep } from './payment-steps/CustomerStep'
import { MethodStep } from './payment-steps/MethodStep'
import { CashAmountStep } from './payment-steps/CashAmountStep'
import { CompleteStep } from './payment-steps/CompleteStep'

type PaymentStep = 'customer' | 'method' | 'cash-amount' | 'complete'
type SelectedMethod = 'cash' | 'card' | 'digital'

interface PaymentOverlayProps {
  activeBill: BillSummary
  selectedTable?: DiningTable | null
  isAdmin: boolean
  formatCurrency: (amount: number) => string
  onClose: () => void
  onPaymentComplete: () => void
}

export function PaymentOverlay({
  activeBill,
  selectedTable,
  isAdmin,
  formatCurrency,
  onClose,
  onPaymentComplete
}: PaymentOverlayProps) {
  const [step, setStep] = useState<PaymentStep>('customer')
  const [selectedMethod, setSelectedMethod] = useState<SelectedMethod | null>(null)
  const [cashReceived, setCashReceived] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [linkedCustomerId, setLinkedCustomerId] = useState<string | null>(null)
  const [linkedCustomerName, setLinkedCustomerName] = useState<string | null>(null)
  const { broadcastPaymentStart, broadcastPaymentComplete } = useCustomerDisplayBroadcast()

  const total = activeBill.aggregated_total

  // Consolidate all items from all KOTs + parent bill
  const allItems = [
    ...(activeBill.bill?.items || []),
    ...(activeBill.kots || []).flatMap(kot => kot.items || [])
  ]
  const consolidatedItems = consolidateItems(allItems)

  const cashReceivedNum = parseFloat(cashReceived) || 0
  const changeAmount = cashReceivedNum > total ? cashReceivedNum - total : 0

  // Payment API call
  const processPayment = async (method: 'cash' | 'credit_card' | 'digital_wallet') => {
    setIsProcessing(true)
    setPaymentError(null)
    try {
      const paymentData: {
        payment_method: string
        amount: number
        customer_id?: string
        customer_name?: string
      } = {
        payment_method: method,
        amount: total,
      }
      if (linkedCustomerId) {
        paymentData.customer_id = linkedCustomerId
      }
      if (linkedCustomerName) {
        paymentData.customer_name = linkedCustomerName
      }
      if (isAdmin) {
        await apiClient.processAdminPayment(activeBill.bill.id, paymentData)
      } else {
        await apiClient.processCounterPayment(activeBill.bill.id, paymentData)
      }
      const change = selectedMethod === 'cash' && cashReceivedNum > total ? cashReceivedNum - total : undefined
      broadcastPaymentComplete(total, change)
      setStep('complete')
    } catch (error: any) {
      setPaymentError(error.message || 'Payment failed. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  // Handle method selection
  const handleMethodSelect = (method: SelectedMethod) => {
    setSelectedMethod(method)
    setPaymentError(null)
    broadcastPaymentStart(total, method)

    if (method === 'cash') {
      setStep('cash-amount')
    } else if (method === 'card') {
      processPayment('credit_card')
    } else {
      processPayment('digital_wallet')
    }
  }

  // Handle cash continue
  const handleCashContinue = () => {
    if (cashReceivedNum < total) return
    processPayment('cash')
  }

  // Handle print
  const handlePrint = async () => {
    const paidDetails: PaidPaymentDetails = {
      cash: selectedMethod === 'cash' ? total : 0,
      card: selectedMethod === 'card' ? total : 0,
      digital: selectedMethod === 'digital' ? total : 0,
    }

    const orderForPrint: Order = {
      ...activeBill.bill,
      items: allItems,
      total_amount: total,
    }

    await printThermalReceipt(orderForPrint, paidDetails, formatCurrency)
    onPaymentComplete()
  }

  // Handle customer linked from CustomerStep
  const handleCustomerLinked = (id: string | null, name: string) => {
    setLinkedCustomerId(id)
    setLinkedCustomerName(name)
    setStep('method')
  }

  // Handle back navigation from MethodStep
  const handleMethodBack = () => {
    setStep('customer')
    setPaymentError(null)
  }

  // Handle back navigation from CashAmountStep
  const handleCashBack = () => {
    setStep('method')
    setCashReceived('')
    setSelectedMethod(null)
    setPaymentError(null)
  }

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 text-zinc-100 flex">
      {/* LEFT PANEL — Bill Summary */}
      <div className="w-[420px] border-r border-zinc-800 flex flex-col bg-zinc-900">
        {/* Header */}
        <div className="p-6 border-b border-zinc-800">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="mb-4 -ml-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black tracking-tight text-zinc-100">
              {selectedTable ? `Table ${selectedTable.table_number}` : activeBill.bill?.order_type === 'takeout' ? 'Takeout Order' : activeBill.bill?.order_type === 'delivery' ? 'Delivery Order' : 'Order'}
            </h2>
            {selectedTable?.floor && (
              <Badge variant="outline" className="text-sm border-zinc-700 text-zinc-400">
                {selectedTable.floor}
              </Badge>
            )}
          </div>
          <p className="text-sm text-zinc-500 mt-1">
            Bill #{activeBill.bill?.order_number}
          </p>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-3">
            {consolidatedItems.map((item, idx) => (
              <div key={item.product_id || idx} className="flex justify-between items-center">
                <div className="flex-1 min-w-0">
                  <span className="text-base">{item.name}</span>
                  <span className="text-zinc-400 ml-2">x{item.quantity}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Total */}
        <div className="p-6 border-t border-zinc-800">
          {linkedCustomerName && (
            <div className="flex items-center gap-2 mb-3 text-sm text-zinc-400">
              <User className="w-4 h-4" />
              <span>{linkedCustomerName}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-lg text-zinc-400">Total</span>
            <span className="text-3xl font-black text-zinc-100">{formatCurrency(total)}</span>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL — Payment Steps */}
      <div className="flex-1 flex flex-col">
        {/* Error Banner */}
        {paymentError && (
          <div className="mx-8 mt-8 p-4 bg-red-500/15 border border-red-500/20 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-400 text-sm flex-1">{paymentError}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPaymentError(null)}
              className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}

        <div className="flex-1 flex items-center justify-center p-8">
          {step === 'customer' && (
            <CustomerStep
              formatCurrency={formatCurrency}
              onCustomerLinked={handleCustomerLinked}
              onSkip={() => setStep('method')}
            />
          )}

          {step === 'method' && (
            <MethodStep
              formatCurrency={formatCurrency}
              total={total}
              isProcessing={isProcessing}
              selectedMethod={selectedMethod}
              onMethodSelect={handleMethodSelect}
              onBack={handleMethodBack}
            />
          )}

          {step === 'cash-amount' && (
            <CashAmountStep
              formatCurrency={formatCurrency}
              total={total}
              isProcessing={isProcessing}
              cashReceived={cashReceived}
              onCashReceivedChange={setCashReceived}
              onPay={handleCashContinue}
              onBack={handleCashBack}
            />
          )}

          {step === 'complete' && (
            <CompleteStep
              formatCurrency={formatCurrency}
              total={total}
              selectedMethod={selectedMethod}
              cashReceivedNum={cashReceivedNum}
              changeAmount={changeAmount}
              onPrint={handlePrint}
              onSkipClose={onPaymentComplete}
            />
          )}
        </div>
      </div>
    </div>
  )
}
