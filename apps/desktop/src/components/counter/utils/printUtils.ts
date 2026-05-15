import type { Order, KOTItem, PaidPaymentDetails } from '../types'
import type { StoreSettings } from '@pos/types'
import { EscPosBuilder } from '@/lib/escpos'
import { loadThermalPrinterConfig, printRawBytes } from '@/lib/thermal-printer'

// Minimal settings shape used by the receipt template — keeps the function
// usable from contexts that don't have the full StoreSettings handy.
export type ReceiptSettings = Partial<Pick<StoreSettings,
  | 'restaurantName' | 'storeAddress' | 'storePhone' | 'receiptHeader' | 'receiptFooter'
  | 'taxRegime' | 'vatNumber' | 'showAllergens' | 'showCalories' | 'tippingEnabled' | 'timezone'
  | 'autoPrintReceipt' | 'receiptCopies'
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
 * Two paths:
 *  - **Native ESC/POS** (preferred): when the user has configured a thermal
 *    printer in Settings → General → Thermal printer, we build ESC/POS bytes
 *    directly and send them to the printer's RAW queue via the Tauri
 *    `print_raw_bytes` command. Instant print, crisp text, automatic cut.
 *  - **OS print dialog** (fallback): in the browser, or when no thermal
 *    printer is configured, the receipt renders as HTML in a hidden iframe
 *    and goes through `window.print()`. Works with any installed printer.
 *
 * `settings` carries the org-level branding + UK fields (VAT regime + number,
 * allergen surfacing, tipping). The native path collapses some of the rich
 * formatting (VAT breakdown becomes compact text, allergen statements are
 * uppercased instead of bolded) to fit the printer's character grid.
 */
export async function printThermalReceipt(
  order: Order,
  paidPaymentDetails: PaidPaymentDetails | null,
  formatCurrency: (amount: number) => string,
  settings?: ReceiptSettings,
  onSuccess?: () => void,
  onError?: (error: Error) => void
): Promise<void> {
  // Clamp copies to [1, 5] — a typo of `50` shouldn't unleash a paper-roll
  // disaster. Default to 1 when unset.
  const copies = Math.min(5, Math.max(1, settings?.receiptCopies ?? 1))
  try {
    const cfg = loadThermalPrinterConfig()
    if (cfg.enabled && isTauriEnvironment()) {
      const bytes = generateReceiptEscPos(order, paidPaymentDetails, formatCurrency, settings, {
        width: cfg.width,
        drawerKick: cfg.drawerKickOnReceipt && (paidPaymentDetails?.cash ?? 0) > 0,
      })
      // Each copy is its own RAW print job — keeps the printer's auto-cut
      // happening between copies so they tear off cleanly.
      for (let i = 0; i < copies; i++) {
        const res = await printRawBytes(bytes, cfg.receiptPrinter)
        if (!res.ok) throw new Error(res.error || 'print_raw_bytes failed')
      }
      onSuccess?.()
      return
    }
    // Browser / OS-print fallback: kick the dialog `copies` times. The user
    // can choose Save-as-PDF on the first one and we'll still loop through
    // the remaining copies the same way.
    const html = generateReceiptHtml(order, paidPaymentDetails, formatCurrency, settings)
    for (let i = 0; i < copies; i++) {
      await printViaIframe(html)
    }
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
    const cfg = loadThermalPrinterConfig()
    if (cfg.enabled && isTauriEnvironment()) {
      const bytes = generateKotEscPos({
        orderNumber, tableNumber, customerName, orderType, items, notes, isNewItems, tokenNumber, staffName,
      }, { width: cfg.width })
      // Prefer the dedicated KOT printer if one is configured; else send to
      // the receipt printer.
      const target = cfg.kotPrinter || cfg.receiptPrinter
      const res = await printRawBytes(bytes, target)
      if (!res.ok) throw new Error(res.error || 'print_raw_bytes failed')
      onSuccess?.()
      return
    }
    await printViaIframe(generateKOTHtml(orderNumber, tableNumber, customerName, orderType, items, notes, isNewItems, tokenNumber, staffName))
    onSuccess?.()
  } catch (error) {
    console.error('Failed to print KOT:', error)
    onError?.(error as Error)
  }
}

// ─── ESC/POS byte builders (used by the thermal-printer path) ────────────

/**
 * Build the ESC/POS byte stream for a customer receipt. Mirrors the same
 * fields the HTML version emits, but adapted to a thermal printer's
 * monospace character grid.
 *
 * `width` defaults to 48 (80 mm paper at Font A). Pass 32 for 58 mm paper.
 */
export function generateReceiptEscPos(
  order: Order,
  paidPaymentDetails: PaidPaymentDetails | null,
  formatCurrency: (amount: number) => string,
  settings?: ReceiptSettings,
  opts?: { width?: 32 | 48; drawerKick?: boolean },
): Uint8Array {
  const width = opts?.width ?? 48
  const isUkVat = settings?.taxRegime === 'uk_vat'
  const tippingEnabled = !!settings?.tippingEnabled
  const showAllergens = !!settings?.showAllergens

  const p = new EscPosBuilder(width)

  // ─ Header
  p.align('center').size({ doubleHeight: true, doubleWidth: true }).bold(true)
  p.textln(settings?.restaurantName || 'Receipt')
  p.size().bold(false)
  if (settings?.storeAddress) p.textln(settings.storeAddress)
  if (settings?.storePhone) p.textln(settings.storePhone)
  if (isUkVat && settings?.vatNumber) p.textln(`VAT No: ${settings.vatNumber}`)
  if (settings?.receiptHeader) p.textln(settings.receiptHeader)
  p.hr()

  // ─ Order meta
  p.align('left')
  p.text(`Order:  `).textln(order.order_number || '')
  if ((order as any).order_type) p.text(`Type:   `).textln(String((order as any).order_type).toUpperCase())
  if ((order as any).table_id_display || (order as any).table_number) {
    p.text(`Table:  `).textln(String((order as any).table_number ?? (order as any).table_id_display))
  }
  if ((order as any).customer_name) p.text(`Cust:   `).textln(String((order as any).customer_name))
  const ts = (order as any).created_at ? new Date((order as any).created_at) : new Date()
  p.text(`Time:   `).textln(ts.toLocaleString())
  p.hr()

  // ─ Items
  for (const item of (order.items ?? []) as any[]) {
    const name = item.product?.name || 'Unknown'
    const lineTotal = (item.unit_price || 0) * item.quantity
    const rateBadge = isUkVat && item.vat_rate_applied != null ? ` (${item.vat_rate_applied}%)` : ''
    p.item(item.quantity, `${name}${rateBadge}`, formatCurrency(lineTotal))
    const mods: string[] = Array.isArray(item.modifiers) ? item.modifiers.map((m: any) => m?.name ?? String(m)) : []
    for (const m of mods) p.modifier(m)
    if (settings?.showCalories) {
      const kcal = Number(item.product?.calorie_count ?? 0)
      if (kcal > 0) p.text(`     ${kcal} kcal${item.quantity > 1 ? ` x ${item.quantity}` : ''}`).lf()
    }
  }
  p.hr()

  // ─ Totals
  const subtotal = Number((order as any).subtotal ?? order.total_amount ?? 0)
  const tax = Number((order as any).tax_amount ?? 0)
  const discount = Number((order as any).discount_amount ?? 0)
  const tipAmount = Number((order as any).tip_amount ?? 0)
  p.twoCol('Subtotal', formatCurrency(subtotal))
  if (tax > 0) p.twoCol(isUkVat ? 'VAT' : 'Tax', formatCurrency(tax))
  if (discount > 0) p.twoCol('Discount', `-${formatCurrency(discount)}`)
  if (tippingEnabled && tipAmount > 0) p.twoCol('Tip', formatCurrency(tipAmount))

  // ─ UK VAT breakdown (compact two-line summary per rate)
  if (isUkVat) {
    const byRate = new Map<number, { net: number; vat: number }>()
    for (const item of (order.items ?? []) as any[]) {
      const rate = Number(item.vat_rate_applied ?? 0)
      const lineNet = (item.unit_price || 0) * item.quantity
      const lineVat = Number(item.vat_amount ?? 0)
      const b = byRate.get(rate) ?? { net: 0, vat: 0 }
      b.net += lineNet
      b.vat += lineVat
      byRate.set(rate, b)
    }
    const rows = Array.from(byRate.entries()).sort(([a], [b]) => b - a)
    if (rows.length) {
      p.hr()
      for (const [rate, v] of rows) {
        p.twoCol(`Net @ ${rate}%`, formatCurrency(v.net))
        p.twoCol(`VAT @ ${rate}%`, formatCurrency(v.vat))
      }
    }
  }

  // ─ Grand total — emphasized
  p.hr()
  const grand = Number(order.total_amount ?? 0) + (tipAmount > 0 ? tipAmount : 0)
  p.size({ doubleHeight: true }).bold(true)
  p.twoCol('TOTAL', formatCurrency(grand))
  p.size().bold(false)

  // ─ Payment breakdown
  if (paidPaymentDetails) {
    p.hr()
    if (paidPaymentDetails.cash > 0) p.twoCol('Cash', formatCurrency(paidPaymentDetails.cash))
    if (paidPaymentDetails.card > 0) p.twoCol('Card', formatCurrency(paidPaymentDetails.card))
    if (paidPaymentDetails.digital > 0) p.twoCol('Digital', formatCurrency(paidPaymentDetails.digital))
  }

  // ─ Allergen footer (text-only, conservative)
  if (showAllergens) {
    const lines: string[] = []
    for (const item of (order.items ?? []) as any[]) {
      const product = item.product
      if (!product) continue
      const allergens: string[] = Array.isArray(product.food_allergens) ? product.food_allergens : []
      if (!allergens.length) continue
      lines.push(`${product.name}: ${allergens.map((a) => a.toUpperCase()).join(', ')}`)
    }
    if (lines.length) {
      p.hr()
      p.bold(true).textln('Allergens').bold(false)
      for (const l of lines) p.textln(l)
    }
  }

  // ─ Footer text
  if (settings?.receiptFooter) {
    p.feed(1).align('center').textln(settings.receiptFooter).align('left')
  } else {
    p.feed(1).align('center').textln('Thank you!').align('left')
  }

  // ─ Optional drawer kick + cut
  if (opts?.drawerKick) p.drawerKick()
  p.cut()

  return p.build()
}

/**
 * Build the ESC/POS byte stream for a Kitchen Order Ticket. Larger text,
 * fewer details, more aggressive emphasis on table number and quantities.
 */
export function generateKotEscPos(
  args: {
    orderNumber: string
    tableNumber?: string
    customerName?: string
    orderType: string
    items: KOTItem[]
    notes?: string
    isNewItems?: boolean
    tokenNumber?: number
    staffName?: string
  },
  opts?: { width?: 32 | 48 },
): Uint8Array {
  const width = opts?.width ?? 48
  const p = new EscPosBuilder(width)

  p.align('center').size({ doubleHeight: true, doubleWidth: true }).bold(true)
  p.textln(args.isNewItems ? '** NEW ITEMS **' : 'KITCHEN ORDER')
  p.size().bold(false).align('left')
  p.text('='.repeat(width)).lf()

  if (args.tableNumber) {
    p.scale(2).bold(true).textln(`TABLE ${args.tableNumber}`).scale(0).bold(false)
  } else if (args.tokenNumber != null) {
    p.scale(2).bold(true).textln(`TOKEN ${args.tokenNumber}`).scale(0).bold(false)
  }

  p.bold(true).textln(`Order: ${args.orderNumber}`).bold(false)
  p.textln(`Type:  ${args.orderType.replace(/_/g, ' ').toUpperCase()}`)
  if (args.customerName) p.textln(`Cust:  ${args.customerName}`)
  if (args.staffName) p.textln(`Staff: ${args.staffName}`)
  p.textln(`Time:  ${new Date().toLocaleTimeString()}`)
  p.text('='.repeat(width)).lf()

  for (const it of args.items) {
    p.size({ doubleHeight: true }).bold(true)
    p.text(`${it.quantity}x ${it.name}`).lf()
    p.size().bold(false)
    const special = (it as any).special_instructions || (it as any).notes
    if (special) {
      p.bold(true).text(`   >> ${special}`).lf().bold(false)
    }
  }

  if (args.notes) {
    p.text('-'.repeat(width)).lf()
    p.bold(true).text(`NOTES: ${args.notes}`).lf().bold(false)
  }
  p.text('='.repeat(width)).lf()
  p.cut()
  return p.build()
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
