import type { Order, KOTItem, PaidPaymentDetails } from '../types'
import type { StoreSettings } from '@pos/types'

// Minimal settings shape used by the receipt template — keeps the function
// usable from contexts that don't have the full StoreSettings handy.
export type ReceiptSettings = Partial<Pick<StoreSettings,
  | 'restaurantName' | 'storeAddress' | 'storePhone' | 'receiptHeader' | 'receiptFooter'
  | 'taxRegime' | 'vatNumber' | 'showAllergens' | 'showCalories' | 'tippingEnabled' | 'timezone'
>>

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
 * Print via a hidden iframe. Works in both browsers and Tauri's WebView —
 * `window.print()` triggers the OS print dialog on macOS (WKWebView) and
 * Windows (WebView2), so any installed printer (USB receipt, network, or
 * "Save as PDF") is reachable.
 *
 * Uses `srcdoc` rather than `document.write` because Tauri's WebView is
 * stricter about cross-frame document writes and the `load` event firing.
 */
function printViaIframe(html: string): Promise<void> {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    iframe.style.visibility = 'hidden'
    iframe.srcdoc = html
    document.body.appendChild(iframe)

    let printed = false
    let cleanupTimer: ReturnType<typeof setTimeout> | null = null

    const cleanup = () => {
      if (cleanupTimer) clearTimeout(cleanupTimer)
      try { iframe.remove() } catch { /* ignore */ }
      resolve()
    }

    const triggerPrint = () => {
      if (printed) return
      printed = true
      try {
        const cw = iframe.contentWindow
        if (!cw) {
          console.error('Print failed: no iframe window')
          cleanup()
          return
        }
        // Block briefly to ensure the document has laid out before printing.
        // Some WebViews fire `load` before stylesheets have applied.
        requestAnimationFrame(() => {
          try {
            cw.focus()
            cw.print()
          } catch (e) {
            console.error('window.print() failed:', e)
          }
          // Keep iframe alive briefly so the print dialog can capture the doc.
          cleanupTimer = setTimeout(cleanup, 1500)
        })
      } catch (e) {
        console.error('Print failed:', e)
        cleanup()
      }
    }

    iframe.addEventListener('load', triggerPrint, { once: true })
    // Safety fallback in case `load` never fires.
    cleanupTimer = setTimeout(triggerPrint, 1500)
  })
}

/**
 * Print thermal receipt for an order.
 *
 * `settings` carries the org-level branding + UK fields (VAT regime + number,
 * allergen surfacing, tipping). When omitted (or the relevant flag is off)
 * the receipt renders in its pre-UK shape — no behaviour change for non-UK
 * customers.
 *
 * Routes through the OS print dialog via a hidden iframe (`window.print()`)
 * in both Tauri and browser. The Rust `print_receipt` invoke is intentionally
 * not used: it expects a different payload shape and its current
 * implementation is a stub that never actually drives a printer. Direct
 * ESC/POS thermal-printer support is a TODO; once wired up, gate it behind a
 * setting and fall through to the iframe path for any printer not on the
 * thermal driver.
 */
export async function printThermalReceipt(
  order: Order,
  paidPaymentDetails: PaidPaymentDetails | null,
  formatCurrency: (amount: number) => string,
  settings?: ReceiptSettings,
  onSuccess?: () => void,
  onError?: (error: Error) => void
): Promise<void> {
  try {
    await printViaIframe(generateReceiptHtml(order, paidPaymentDetails, formatCurrency, settings))
    onSuccess?.()
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
    await printViaIframe(generateKOTHtml(orderNumber, tableNumber, customerName, orderType, items, notes, isNewItems, tokenNumber, staffName))
    onSuccess?.()
  } catch (error) {
    console.error('Failed to print KOT:', error)
    onError?.(error as Error)
  }
}

/** Minimal HTML escape for user-controlled fields rendered into the receipt */
function escapeHtml(s: string | null | undefined): string {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Renders allergens within an ingredient string by uppercasing them inline.
 * UK FIC Regulations / Natasha's Law require allergens to be emphasised
 * within the ingredient list of PPDS items. Uppercase is the standard
 * convention for thermal-printer-friendly output.
 */
function emphasiseAllergens(ingredients: string, allergens: string[]): string {
  if (!ingredients) return ''
  let out = escapeHtml(ingredients)
  for (const code of allergens) {
    // Match common natural-language equivalents for each statutory allergen.
    // We're conservative — we only uppercase whole-word matches.
    const candidates: Record<string, string[]> = {
      gluten:      ['gluten', 'wheat', 'rye', 'barley', 'oats', 'spelt'],
      milk:        ['milk', 'dairy', 'butter', 'cheese', 'yoghurt', 'cream'],
      eggs:        ['eggs', 'egg'],
      fish:        ['fish'],
      crustaceans: ['crustaceans', 'prawns', 'crab', 'lobster', 'shrimp', 'langoustine'],
      molluscs:    ['molluscs', 'mussels', 'oysters', 'clams', 'squid', 'octopus'],
      peanuts:     ['peanuts', 'peanut'],
      nuts:        ['almond', 'almonds', 'hazelnut', 'hazelnuts', 'walnut', 'walnuts',
                    'cashew', 'cashews', 'pecan', 'pecans', 'pistachio', 'pistachios',
                    'macadamia', 'brazil'],
      soya:        ['soya', 'soy'],
      celery:      ['celery'],
      mustard:     ['mustard'],
      sesame:      ['sesame'],
      sulphites:   ['sulphites', 'sulphite', 'sulfite', 'sulfites'],
      lupin:       ['lupin'],
    }
    const words = candidates[code] ?? [code]
    for (const w of words) {
      const re = new RegExp(`\\b(${w})\\b`, 'gi')
      out = out.replace(re, (m) => `<strong>${m.toUpperCase()}</strong>`)
    }
  }
  return out
}

const ALLERGEN_LABELS: Record<string, string> = {
  celery: 'celery', crustaceans: 'crustaceans', eggs: 'eggs', fish: 'fish',
  gluten: 'gluten', lupin: 'lupin', milk: 'milk', molluscs: 'molluscs',
  mustard: 'mustard', nuts: 'nuts', peanuts: 'peanuts', sesame: 'sesame',
  soya: 'soya', sulphites: 'sulphites',
}

/**
 * Generate HTML receipt for web printing fallback.
 *
 * UK VAT compliance: when settings.taxRegime === 'uk_vat', renders trader
 * details + VAT registration number + per-rate VAT breakdown.
 *
 * Allergens (Natasha's Law): when settings.showAllergens, renders allergen
 * info per item (with full PPDS ingredient statement when product.is_ppds).
 *
 * Tipping: when settings.tippingEnabled and order.tip_amount > 0, shows the
 * tip on a separate line below the total. UK voluntary tips are outside the
 * scope of VAT — never folded into the VAT-able total.
 */
export function generateReceiptHtml(
  order: Order,
  paidPaymentDetails: PaidPaymentDetails | null,
  formatCurrency: (amount: number) => string,
  settings?: ReceiptSettings
): string {
  const isUkVat = settings?.taxRegime === 'uk_vat'
  const showAllergens = !!settings?.showAllergens
  const showCalories = !!settings?.showCalories
  const tippingEnabled = !!settings?.tippingEnabled

  // ─── Items rows ─────────────────────────────────────────────────────────
  const itemRows = (order.items ?? []).map((item: any) => {
    const name = escapeHtml(item.product?.name || 'Unknown')
    const lineTotal = (item.unit_price || 0) * item.quantity
    const rateBadge = isUkVat && item.vat_rate_applied != null
      ? `<span style="color:#444">@${Number(item.vat_rate_applied)}%</span>`
      : ''
    // UK Calorie Labelling Regs 2021 — show kcal per item; absent values are
    // omitted (the regs apply only to non-prepacked food where calories are known).
    const kcal = Number(item.product?.calorie_count ?? 0)
    const kcalRow = (showCalories && kcal > 0) ? `
      <tr>
        <td colspan="3" style="color:#555;font-size:11px;padding-top:0">${kcal} kcal${item.quantity > 1 ? ` × ${item.quantity} = ${kcal * item.quantity} kcal` : ''}</td>
      </tr>
    ` : ''
    return `
      <tr>
        <td>${name} ${rateBadge}</td>
        <td style="text-align:center">${item.quantity}</td>
        <td style="text-align:right">${escapeHtml(formatCurrency(lineTotal))}</td>
      </tr>
      ${kcalRow}
    `
  }).join('')

  // ─── VAT breakdown by rate (UK regime only) ────────────────────────────
  let vatBreakdownHtml = ''
  let netTotal = 0
  let vatTotal = 0
  if (isUkVat) {
    const byRate = new Map<number, { net: number; vat: number }>()
    for (const item of (order.items ?? []) as any[]) {
      const rate = Number(item.vat_rate_applied ?? 0)
      const lineTotal = (item.unit_price || 0) * item.quantity
      const lineVat = Number(item.vat_amount ?? 0)
      const lineNet = lineTotal // we treat menu prices as net + VAT on top
      const bucket = byRate.get(rate) ?? { net: 0, vat: 0 }
      bucket.net += lineNet
      bucket.vat += lineVat
      byRate.set(rate, bucket)
      netTotal += lineNet
      vatTotal += lineVat
    }
    const rows = Array.from(byRate.entries())
      .sort(([a], [b]) => b - a)
      .map(([rate, v]) => `
        <tr>
          <td>Net @ ${rate}%</td>
          <td style="text-align:right">${escapeHtml(formatCurrency(v.net))}</td>
          <td style="text-align:right">VAT ${escapeHtml(formatCurrency(v.vat))}</td>
        </tr>
      `).join('')
    if (rows) {
      vatBreakdownHtml = `
        <div class="divider"></div>
        <table>${rows}</table>
        <table>
          <tr><td>Net total</td><td style="text-align:right">${escapeHtml(formatCurrency(netTotal))}</td></tr>
          <tr><td>VAT total</td><td style="text-align:right">${escapeHtml(formatCurrency(vatTotal))}</td></tr>
        </table>
      `
    }
  }

  // ─── Tip line (kept separate; not part of VAT-able total) ──────────────
  const tipAmount = (order as any).tip_amount ?? 0
  const tipMethod = (order as any).tip_method as string | undefined
  const tipHtml = (tippingEnabled && tipAmount > 0) ? `
    <table>
      <tr>
        <td>Tip${tipMethod ? ` (${escapeHtml(tipMethod)})` : ''}</td>
        <td style="text-align:right">${escapeHtml(formatCurrency(tipAmount))}</td>
      </tr>
    </table>
  ` : ''

  // Total inc VAT — total_amount on the order is already inclusive of VAT.
  // We do NOT add the tip into the VAT-able total; it shows on its own line
  // and is included in "Amount paid" if the customer paid it through us.
  const grandTotalInc = Number(order.total_amount) + (tipAmount > 0 ? tipAmount : 0)

  // ─── Payment breakdown ─────────────────────────────────────────────────
  const paymentRows = paidPaymentDetails
    ? [
        paidPaymentDetails.cash > 0 ? `<tr><td>Cash</td><td style="text-align:right">${escapeHtml(formatCurrency(paidPaymentDetails.cash))}</td></tr>` : '',
        paidPaymentDetails.card > 0 ? `<tr><td>Card</td><td style="text-align:right">${escapeHtml(formatCurrency(paidPaymentDetails.card))}</td></tr>` : '',
        paidPaymentDetails.digital > 0 ? `<tr><td>Digital</td><td style="text-align:right">${escapeHtml(formatCurrency(paidPaymentDetails.digital))}</td></tr>` : ''
      ].filter(Boolean).join('')
    : '<tr><td>Cash</td><td style="text-align:right">-</td></tr>'

  // ─── Allergen footer (per item) ────────────────────────────────────────
  let allergenHtml = ''
  if (showAllergens) {
    const allergenLines = (order.items ?? []).map((item: any) => {
      const product = item.product
      if (!product) return ''
      const allergens: string[] = Array.isArray(product.food_allergens) ? product.food_allergens : []
      const mayContain: string[] = Array.isArray(product.may_contain_allergens) ? product.may_contain_allergens : []
      const ingredients: string | undefined = product.ingredients
      const isPpds: boolean = !!product.is_ppds

      if (!allergens.length && !mayContain.length && !ingredients) return ''

      const name = escapeHtml(product.name)
      const allergenList = allergens.map(a => ALLERGEN_LABELS[a] ?? a).join(', ')
      const mayContainList = mayContain.map(a => ALLERGEN_LABELS[a] ?? a).join(', ')

      const ingredientsBlock = isPpds && ingredients
        ? `<div style="margin-left:8px"><em>Ingredients:</em> ${emphasiseAllergens(ingredients, allergens)}</div>`
        : ''
      const containsBlock = allergenList
        ? `<div style="margin-left:8px"><em>Contains:</em> ${escapeHtml(allergenList)}</div>`
        : ''
      const mayContainBlock = mayContainList
        ? `<div style="margin-left:8px"><em>May contain:</em> ${escapeHtml(mayContainList)}</div>`
        : ''

      return `
        <div style="margin-top:4px">
          <strong>${name}</strong>
          ${ingredientsBlock || containsBlock}
          ${mayContainBlock}
        </div>
      `
    }).filter(Boolean).join('')

    if (allergenLines) {
      allergenHtml = `
        <div class="divider"></div>
        <div style="font-size:11px"><strong>Allergens</strong></div>
        ${allergenLines}
        <div style="font-size:10px; margin-top:4px; color:#444">
          Full allergen information available on request.
        </div>
      `
    }
  }

  // ─── Header (trader info) ──────────────────────────────────────────────
  const businessName = escapeHtml(settings?.restaurantName || 'Receipt')
  const address = escapeHtml(settings?.storeAddress || '')
  const phone = escapeHtml(settings?.storePhone || '')
  const vatNumberHtml = isUkVat && settings?.vatNumber
    ? `<div>VAT No: ${escapeHtml(settings.vatNumber)}</div>`
    : ''
  const headerCustomCopy = escapeHtml(settings?.receiptHeader || '')
  const footerCustomCopy = escapeHtml(settings?.receiptFooter || 'Thank you for your visit!')
  // Receipt time printed in the org's configured timezone — UTC defaults are
  // wrong for HMRC audits and confuse customers who see "yesterday's" timestamp.
  const tz = settings?.timezone || 'Europe/London'
  const dateStr = new Date().toLocaleString('en-GB', { timeZone: tz })

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Receipt #${escapeHtml(order.order_number)}</title>
      <style>
        @page { size: 80mm auto; margin: 0; }
        @media print {
          html, body { margin: 0; padding: 0; width: 80mm; }
        }
        body { font-family: monospace; font-size: 12px; width: 280px; margin: 0 auto; padding: 10px; color: #000; }
        .header { text-align: center; margin-bottom: 10px; }
        .token { text-align: center; font-size: 28px; font-weight: bold; margin: 8px 0; letter-spacing: 4px; }
        .divider { border-top: 1px dashed #000; margin: 10px 0; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 2px 0; vertical-align: top; }
        .total { font-weight: bold; font-size: 14px; }
        .footer { text-align: center; margin-top: 10px; font-size: 10px; }
        em { font-style: italic; color: #555; }
      </style>
    </head>
    <body>
      ${order.token_number ? `<div class="token">TOKEN: ${String(order.token_number).padStart(4, '0')}</div>` : ''}
      <div class="header">
        <strong>${businessName}</strong>
        ${address ? `<div>${address}</div>` : ''}
        ${phone ? `<div>Tel: ${phone}</div>` : ''}
        ${vatNumberHtml}
        ${headerCustomCopy ? `<div style="margin-top:6px">${headerCustomCopy}</div>` : ''}
      </div>
      <div class="divider"></div>
      <div>Receipt no: ${escapeHtml(order.order_number)}</div>
      <div>${dateStr}</div>
      ${order.customer_name ? `<div>Customer: ${escapeHtml(order.customer_name)}</div>` : ''}
      ${order.table?.table_number ? `<div>Table: ${escapeHtml(String(order.table.table_number))}</div>` : ''}
      <div class="divider"></div>
      <table>
        <thead>
          <tr>
            <td><strong>Item</strong></td>
            <td style="text-align:center"><strong>Qty</strong></td>
            <td style="text-align:right"><strong>Price</strong></td>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      ${vatBreakdownHtml}
      <div class="divider"></div>
      <table>
        <tr class="total">
          <td>TOTAL${isUkVat ? ' (inc VAT)' : ''}</td>
          <td style="text-align:right">${escapeHtml(formatCurrency(Number(order.total_amount)))}</td>
        </tr>
      </table>
      ${tipHtml}
      ${tipAmount > 0 && tippingEnabled ? `
        <table>
          <tr class="total">
            <td>AMOUNT PAID</td>
            <td style="text-align:right">${escapeHtml(formatCurrency(grandTotalInc))}</td>
          </tr>
        </table>
      ` : ''}
      <div class="divider"></div>
      <div><strong>Payment:</strong></div>
      <table>${paymentRows}</table>
      ${paidPaymentDetails?.cash_received ? `
        <div class="divider"></div>
        <table>
          <tr><td>Cash Received</td><td style="text-align:right">${escapeHtml(formatCurrency(paidPaymentDetails.cash_received))}</td></tr>
          ${paidPaymentDetails.change_amount ? `<tr><td>Change</td><td style="text-align:right">${escapeHtml(formatCurrency(paidPaymentDetails.change_amount))}</td></tr>` : ''}
        </table>
      ` : ''}
      ${allergenHtml}
      ${showCalories ? '<div class="footer" style="font-style:italic">Adults need around 2000 kcal a day.</div>' : ''}
      <div class="divider"></div>
      <div class="footer">${footerCustomCopy}</div>
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
        @page { size: 80mm auto; margin: 0; }
        @media print {
          html, body { margin: 0; padding: 0; width: 80mm; }
        }
        body { font-family: monospace; font-size: 12px; width: 280px; margin: 0 auto; padding: 10px; color: #000; }
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
