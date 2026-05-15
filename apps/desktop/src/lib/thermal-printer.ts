// Thermal receipt printer integration.
//
// When enabled, the app skips the OS print dialog (which rasterises HTML)
// and sends ESC/POS bytes directly to the configured printer queue via
// Tauri's `print_raw_bytes` command. That yields the proper thermal-printer
// experience: instant print, crisp text, automatic cut.
//
// Config lives in localStorage rather than the org `settings` table — the
// printer queue name is per-device (one register might call the printer
// "TM-T20III", another "ePOS Now Receipt"). Mirrors the cash-drawer
// integration in `cash-drawer.ts`.

const STORAGE_KEY = 'pos:hardware:thermal-printer'

export interface ThermalPrinterConfig {
  enabled: boolean
  /** OS print-queue name. Empty falls back to system default on macOS/Linux;
   *  required on Windows. */
  receiptPrinter: string
  /** Optional second printer for kitchen tickets. If empty, KOTs go to the
   *  receipt printer. */
  kotPrinter: string
  /** Column width — 48 for 80 mm paper, 32 for 58 mm. */
  width: 32 | 48
  /** If true, append a drawer-kick pulse to every cash-paid receipt so the
   *  drawer pops as part of the same print impulse instead of via a second
   *  call to the cash-drawer command. Useful when the dedicated kick races
   *  with the print job and the drawer fails to open. */
  drawerKickOnReceipt: boolean
}

const DEFAULT_CONFIG: ThermalPrinterConfig = {
  enabled: false,
  receiptPrinter: '',
  kotPrinter: '',
  width: 48,
  drawerKickOnReceipt: false,
}

export function loadThermalPrinterConfig(): ThermalPrinterConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_CONFIG
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_CONFIG
  }
}

export function saveThermalPrinterConfig(cfg: Partial<ThermalPrinterConfig>) {
  try {
    const next = { ...loadThermalPrinterConfig(), ...cfg }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    return next
  } catch {
    return loadThermalPrinterConfig()
  }
}

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window
}

/**
 * Send raw ESC/POS bytes to a system print queue. Silent no-op when the
 * thermal path is disabled or we're not running under Tauri (no native
 * print transport in the browser).
 */
export async function printRawBytes(
  bytes: Uint8Array,
  printerName?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isTauri()) {
    return { ok: false, error: 'Thermal print only works in the desktop app' }
  }
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke<boolean>('print_raw_bytes', {
      printerName: printerName ?? '',
      bytes: Array.from(bytes),
    })
    return { ok: true }
  } catch (e: any) {
    console.error('Thermal print failed:', e)
    return { ok: false, error: String(e?.message ?? e) }
  }
}

/** List system print queues for the settings UI (Tauri only). */
export async function listThermalPrinters(): Promise<string[]> {
  if (!isTauri()) return []
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    // list_thermal_printers and list_system_printers return the same set —
    // every OS print queue. Prefer the thermal-named one for clarity.
    return await invoke<string[]>('list_thermal_printers')
  } catch (e) {
    console.warn('list_thermal_printers failed:', e)
    return []
  }
}
