// Cash drawer integration.
//
// Drawers are wired to the thermal receipt printer's RJ11 jack and pop open
// when the printer receives the ESC/POS pulse [0x1B 0x70 0x00 0x19 0xFA].
// Because our receipt prints go through the OS print dialog (which
// rasterizes HTML and strips ESC/POS), the kick must be sent separately
// over a RAW print queue. That's what the Tauri `open_cash_drawer` command
// does — it sends the bytes directly to the configured printer with no
// driver filtering.
//
// Settings are stored in localStorage rather than the org settings table
// because they're per-device — the printer queue name on this register
// won't match the queue name on another register.

const STORAGE_KEY = 'pos:hardware:cash-drawer'

export interface CashDrawerConfig {
  enabled: boolean
  printerName: string
  pin: 2 | 5
  autoOpenOnCash: boolean
}

const DEFAULT_CONFIG: CashDrawerConfig = {
  enabled: false,
  printerName: '',
  pin: 2,
  autoOpenOnCash: true,
}

export function loadCashDrawerConfig(): CashDrawerConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_CONFIG
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_CONFIG
  }
}

export function saveCashDrawerConfig(cfg: Partial<CashDrawerConfig>) {
  try {
    const next = { ...loadCashDrawerConfig(), ...cfg }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    return next
  } catch {
    return loadCashDrawerConfig()
  }
}

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window
}

/**
 * Send the ESC/POS kick pulse to the configured printer. Silent no-op when
 * the drawer is disabled or we're running in a plain browser (no Tauri).
 */
export async function openCashDrawer(opts?: { force?: boolean }): Promise<{ ok: boolean; error?: string }> {
  const cfg = loadCashDrawerConfig()
  if (!opts?.force && !cfg.enabled) {
    return { ok: false, error: 'Cash drawer disabled' }
  }
  if (!isTauri()) {
    return { ok: false, error: 'Cash drawer only works in the desktop app' }
  }
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke<boolean>('open_cash_drawer', {
      printerName: cfg.printerName || null,
      pin: cfg.pin,
    })
    return { ok: true }
  } catch (e: any) {
    console.error('Cash drawer kick failed:', e)
    return { ok: false, error: String(e?.message ?? e) }
  }
}

/** List system print queues (Tauri only) for the settings UI. */
export async function listSystemPrinters(): Promise<string[]> {
  if (!isTauri()) return []
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    return await invoke<string[]>('list_system_printers')
  } catch (e) {
    console.warn('list_system_printers failed:', e)
    return []
  }
}
