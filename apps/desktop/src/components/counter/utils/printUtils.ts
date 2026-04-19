import type { Order, KOTItem, PaidPaymentDetails } from '../types'

// Extend Window interface for Tauri
declare global {
  interface Window {
    __TAURI__?: unknown
  }
}

/**
 * Check if running in Tauri desktop environment
 */
export function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && !!window.__TAURI__
}

/**
 * Browser-fallback print via a hidden iframe. Avoids popup windows
 * (which get blocked or close before the document renders).
 */
function printViaIframe(html: string): void {
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument || iframe.contentWindow?.document
  if (!doc) {
    iframe.remove()
    return
  }
  doc.open()
  doc.write(html)
  doc.close()

  let printed = false
  const triggerPrint = () => {
    if (printed) return
    printed = true
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } catch (e) {
      console.error('Print failed:', e)
    } finally {
      setTimeout(() => iframe.remove(), 1000)
    }
  }

  iframe.addEventListener('load', triggerPrint, { once: true })
  // Safety fallback: document.write can skip the load event.
  setTimeout(triggerPrint, 500)
}

/**
 * Print thermal receipt for an order
 */
export async function printThermalReceipt(
  order: Order,
  paidPaymentDetails: PaidPaymentDetails | null,
  formatCurrency: (amount: number) => string,
  onSuccess?: () => void,
  onError?: (error: Error) => void
): Promise<void> {
  // Build payment method string from active methods
  const paymentMethodStr = paidPaymentDetails
    ? [
        paidPaymentDetails.cash > 0 ? `Cash: ${formatCurrency(paidPaymentDetails.cash)}` : '',
        paidPaymentDetails.card > 0 ? `Card: ${formatCurrency(paidPaymentDetails.card)}` : '',
        paidPaymentDetails.digital > 0 ? `Digital: ${formatCurrency(paidPaymentDetails.digital)}` : ''
      ].filter(Boolean).join(', ') || 'Cash'
    : 'Cash'

  try {
    if (isTauriEnvironment()) {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('print_receipt', {
        orderNumber: order.order_number,
        items: order.items?.map(item => ({
          name: item.product?.name || 'Unknown',
          quantity: item.quantity,
          price: item.unit_price || 0,
          total: (item.unit_price || 0) * item.quantity
        })) || [],
        total: order.total_amount,
        paymentMethod: paymentMethodStr,
        customerName: order.customer_name,
        tableNumber: order.table?.table_number
      })
      onSuccess?.()
    } else {
      // Fallback: browser print via hidden iframe
      printViaIframe(generateReceiptHtml(order, paidPaymentDetails, formatCurrency))
      onSuccess?.()
    }
  } catch (error) {
    console.error('Failed to print receipt:', error)
    onError?.(error as Error)
  }
}

/**
 * Print Kitchen Order Ticket (KOT)
 */
export async function printKOT(
  orderNumber: string,
  tableNumber: string | undefined,
  customerName: string | undefined,
  orderType: string,
  items: KOTItem[],
  notes?: string,
  isNewItems: boolean = false,
  onSuccess?: () => void,
  onError?: (error: Error) => void,
  tokenNumber?: number,
  staffName?: string
): Promise<void> {
  try {
    if (isTauriEnvironment()) {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('print_kot', {
        kot: {
          order_number: orderNumber,
          table_number: tableNumber,
          customer_name: customerName,
          order_type: orderType,
          items: items.map(item => ({
            name: item.name,
            quantity: item.quantity,
            special_instructions: item.special_instructions
          })),
          notes: notes,
          is_new_items: isNewItems,
          token_number: tokenNumber,
          staff_name: staffName
        }
      })
      console.log('KOT printed successfully!')
      onSuccess?.()
    } else {
      // Fallback: browser print via hidden iframe
      printViaIframe(generateKOTHtml(orderNumber, tableNumber, customerName, orderType, items, notes, isNewItems, tokenNumber, staffName))
      onSuccess?.()
    }
  } catch (error) {
    console.error('Failed to print KOT:', error)
    onError?.(error as Error)
  }
}

/**
 * Generate HTML receipt for web printing fallback
 */
export function generateReceiptHtml(
  order: Order,
  paidPaymentDetails: PaidPaymentDetails | null,
  formatCurrency: (amount: number) => string
): string {
  const items = order.items?.map(item => `
    <tr>
      <td>${item.product?.name || 'Unknown'}</td>
      <td style="text-align:center">${item.quantity}</td>
      <td style="text-align:right">${formatCurrency((item.unit_price || 0) * item.quantity)}</td>
    </tr>
  `).join('') || ''

  // Build payment breakdown HTML
  const paymentRows = paidPaymentDetails
    ? [
        paidPaymentDetails.cash > 0 ? `<tr><td>Cash</td><td style="text-align:right">${formatCurrency(paidPaymentDetails.cash)}</td></tr>` : '',
        paidPaymentDetails.card > 0 ? `<tr><td>Card</td><td style="text-align:right">${formatCurrency(paidPaymentDetails.card)}</td></tr>` : '',
        paidPaymentDetails.digital > 0 ? `<tr><td>Digital</td><td style="text-align:right">${formatCurrency(paidPaymentDetails.digital)}</td></tr>` : ''
      ].filter(Boolean).join('')
    : '<tr><td>Cash</td><td style="text-align:right">-</td></tr>'

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Receipt #${order.order_number}</title>
      <style>
        body { font-family: monospace; font-size: 12px; width: 280px; margin: 0 auto; padding: 10px; }
        .header { text-align: center; margin-bottom: 10px; }
        .token { text-align: center; font-size: 28px; font-weight: bold; margin: 8px 0; letter-spacing: 4px; }
        .divider { border-top: 1px dashed #000; margin: 10px 0; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 2px 0; }
        .total { font-weight: bold; font-size: 14px; }
        .footer { text-align: center; margin-top: 10px; font-size: 10px; }
      </style>
    </head>
    <body>
      ${order.token_number ? `<div class="token">TOKEN: ${String(order.token_number).padStart(4, '0')}</div>` : ''}
      <div class="header">
        <strong>POS RECEIPT</strong><br>
        Order #${order.order_number}<br>
        ${new Date().toLocaleString()}
      </div>
      <div class="divider"></div>
      ${order.customer_name ? `<div>Customer: ${order.customer_name}</div>` : ''}
      ${order.table?.table_number ? `<div>Table: ${order.table.table_number}</div>` : ''}
      <div class="divider"></div>
      <table>
        <thead>
          <tr>
            <td><strong>Item</strong></td>
            <td style="text-align:center"><strong>Qty</strong></td>
            <td style="text-align:right"><strong>Price</strong></td>
          </tr>
        </thead>
        <tbody>${items}</tbody>
      </table>
      <div class="divider"></div>
      <table>
        <tr class="total">
          <td>TOTAL</td>
          <td style="text-align:right">${formatCurrency(order.total_amount)}</td>
        </tr>
      </table>
      <div class="divider"></div>
      <div><strong>Payment:</strong></div>
      <table>${paymentRows}</table>
      ${paidPaymentDetails?.cash_received ? `
        <div class="divider"></div>
        <table>
          <tr><td>Cash Received</td><td style="text-align:right">${formatCurrency(paidPaymentDetails.cash_received)}</td></tr>
          ${paidPaymentDetails.change_amount ? `<tr><td>Change</td><td style="text-align:right">${formatCurrency(paidPaymentDetails.change_amount)}</td></tr>` : ''}
        </table>
      ` : ''}
      <div class="divider"></div>
      <div class="footer">Thank you for your visit!</div>
    </body>
    </html>
  `
}

/**
 * Generate HTML KOT for web printing fallback
 */
export function generateKOTHtml(
  orderNumber: string,
  tableNumber: string | undefined,
  customerName: string | undefined,
  orderType: string,
  items: KOTItem[],
  notes?: string,
  isNewItems: boolean = false,
  tokenNumber?: number,
  staffName?: string
): string {
  const orderTypeDisplay = {
    dine_in: 'DINE-IN',
    takeout: 'TAKEOUT',
    delivery: 'DELIVERY'
  }[orderType] || orderType.toUpperCase()

  const itemsHtml = items.map(item => `
    <div style="margin: 8px 0; font-size: 16px; font-weight: bold;">
      ${item.quantity}x ${item.name}
      ${item.special_instructions ? `<div style="font-size: 12px; font-weight: normal; margin-left: 20px; color: #666;">>> ${item.special_instructions}</div>` : ''}
    </div>
  `).join('')

  const tokenDisplay = tokenNumber
    ? `<div style="text-align: center; font-size: 28px; font-weight: bold; margin: 8px 0; letter-spacing: 4px;">TOKEN: ${String(tokenNumber).padStart(4, '0')}</div>`
    : ''

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>KOT #${orderNumber}</title>
      <style>
        body { font-family: monospace; font-size: 12px; width: 280px; margin: 0 auto; padding: 10px; }
        .header { text-align: center; margin-bottom: 10px; font-size: 18px; font-weight: bold; }
        .new-items { background: #ffeb3b; padding: 5px; text-align: center; font-weight: bold; }
        .divider { border-top: 2px dashed #000; margin: 10px 0; }
        .table-number { font-size: 24px; font-weight: bold; text-align: center; margin: 10px 0; }
        .info { margin: 5px 0; }
        .items { margin: 10px 0; }
        .notes { background: #f5f5f5; padding: 8px; margin-top: 10px; font-weight: bold; }
      </style>
    </head>
    <body>
      ${tokenDisplay}
      ${isNewItems ? '<div class="new-items">** NEW ITEMS **</div>' : '<div class="header">KITCHEN ORDER</div>'}
      <div class="divider"></div>
      <div class="info"><strong>Order:</strong> ${orderNumber}</div>
      ${tableNumber ? `<div class="table-number">TABLE: ${tableNumber}</div>` : ''}
      <div class="info"><strong>Type:</strong> ${orderTypeDisplay}</div>
      ${customerName ? `<div class="info"><strong>Customer:</strong> ${customerName}</div>` : ''}
      ${staffName ? `<div class="info"><strong>Staff:</strong> ${staffName}</div>` : ''}
      <div class="info"><strong>Time:</strong> ${new Date().toLocaleTimeString()}</div>
      <div class="divider"></div>
      <div style="font-weight: bold; margin-bottom: 5px;">ITEMS:</div>
      <div class="items">${itemsHtml}</div>
      ${notes ? `<div class="notes">NOTES: ${notes}</div>` : ''}
      <div class="divider"></div>
    </body>
    </html>
  `
}
