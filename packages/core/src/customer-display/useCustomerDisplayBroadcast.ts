import { useRef, useCallback } from 'react'
import type { DisplayCartItem, CustomerDisplayMessage } from './types'
import { CUSTOMER_DISPLAY_CHANNEL } from './types'

/**
 * Sender hook — used in the POS counter to broadcast cart/payment state
 * to the customer-facing display window.
 */
export function useCustomerDisplayBroadcast() {
  const channelRef = useRef<BroadcastChannel | null>(null)

  const getChannel = useCallback(() => {
    if (!channelRef.current) {
      channelRef.current = new BroadcastChannel(CUSTOMER_DISPLAY_CHANNEL)
    }
    return channelRef.current
  }, [])

  const broadcastCartUpdate = useCallback((
    items: DisplayCartItem[],
    subtotal: number,
    tax: number,
    total: number,
  ) => {
    const msg: CustomerDisplayMessage = { type: 'cart-update', items, subtotal, tax, total }
    getChannel().postMessage(msg)
  }, [getChannel])

  const broadcastPaymentStart = useCallback((total: number, method?: string) => {
    const msg: CustomerDisplayMessage = { type: 'payment-start', total, method }
    getChannel().postMessage(msg)
  }, [getChannel])

  const broadcastPaymentComplete = useCallback((total: number, changeAmount?: number) => {
    const msg: CustomerDisplayMessage = { type: 'payment-complete', total, changeAmount }
    getChannel().postMessage(msg)
  }, [getChannel])

  const broadcastIdle = useCallback(() => {
    const msg: CustomerDisplayMessage = { type: 'idle' }
    getChannel().postMessage(msg)
  }, [getChannel])

  return {
    broadcastCartUpdate,
    broadcastPaymentStart,
    broadcastPaymentComplete,
    broadcastIdle,
  }
}
