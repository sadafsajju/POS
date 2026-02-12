import { useState, useEffect } from 'react'
import type { CustomerDisplayState, CustomerDisplayMessage } from './types'
import { CUSTOMER_DISPLAY_CHANNEL } from './types'

const initialState: CustomerDisplayState = {
  mode: 'idle',
  items: [],
  subtotal: 0,
  tax: 0,
  total: 0,
}

/**
 * Receiver hook — used in the customer-facing display window.
 * Listens on BroadcastChannel and returns the current display state.
 */
export function useCustomerDisplayReceiver(): CustomerDisplayState {
  const [state, setState] = useState<CustomerDisplayState>(initialState)

  useEffect(() => {
    const channel = new BroadcastChannel(CUSTOMER_DISPLAY_CHANNEL)

    channel.onmessage = (event: MessageEvent<CustomerDisplayMessage>) => {
      const msg = event.data

      switch (msg.type) {
        case 'idle':
          setState(initialState)
          break

        case 'cart-update':
          setState({
            mode: 'cart',
            items: msg.items,
            subtotal: msg.subtotal,
            tax: msg.tax,
            total: msg.total,
          })
          break

        case 'payment-start':
          setState(prev => ({
            ...prev,
            mode: 'payment-processing',
            total: msg.total,
            paymentMethod: msg.method,
          }))
          break

        case 'payment-complete':
          setState(prev => ({
            ...prev,
            mode: 'payment-complete',
            total: msg.total,
            changeAmount: msg.changeAmount,
          }))
          break
      }
    }

    return () => {
      channel.close()
    }
  }, [])

  return state
}
