// Tiny ESC/POS byte-stream builder for 80 mm thermal receipt printers.
//
// Most ePOS Now / Epson / Star / Citizen / Bixolon receipt printers speak the
// same ESC/POS command subset, so we hand-roll the bytes here instead of
// pulling in a heavy npm dependency. The output is fed to the Tauri
// `print_raw_bytes` command, which writes the bytes verbatim to the OS print
// queue in RAW mode.
//
// Width is configurable but defaults to 48 columns (the canonical 80 mm
// width at Font A, 12×24 dots). Three-inch printers using 58 mm paper or
// Font B will need 32 columns — pass it in the constructor.

const ESC = 0x1b
const GS = 0x1d
const LF = 0x0a

export class EscPosBuilder {
  private parts: number[] = []
  readonly width: number

  constructor(width = 48) {
    this.width = width
    this.init()
  }

  /** ESC @ — initialize, reset all formatting. */
  init(): this {
    return this.raw([ESC, 0x40])
  }

  /** Raw bytes, escape hatch when callers need something unusual. */
  raw(bytes: number[] | Uint8Array): this {
    if (bytes instanceof Uint8Array) {
      for (let i = 0; i < bytes.length; i++) this.parts.push(bytes[i])
    } else {
      this.parts.push(...bytes)
    }
    return this
  }

  /** Plain text. UTF-8 only ASCII is safe on every ESC/POS printer; non-
   *  ASCII glyphs (£, €, …) get transliterated to ASCII so we don't print
   *  garbage when the device's code page differs from ours. */
  text(s: string): this {
    if (!s) return this
    const ascii = s
      .replace(/£/g, 'GBP ')
      .replace(/€/g, 'EUR ')
      .replace(/¥/g, 'JPY ')
      .replace(/₹/g, 'INR ')
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/—/g, '--')
      .replace(/–/g, '-')
      .replace(/•/g, '*')
      .replace(/[^\x20-\x7E\n]/g, '?')
    for (let i = 0; i < ascii.length; i++) this.parts.push(ascii.charCodeAt(i))
    return this
  }

  /** Append text + LF. */
  textln(s: string = ''): this {
    return this.text(s).lf()
  }

  lf(): this {
    this.parts.push(LF)
    return this
  }

  /** ESC a n — alignment (0 left, 1 centre, 2 right). */
  align(kind: 'left' | 'center' | 'right'): this {
    const n = kind === 'center' ? 1 : kind === 'right' ? 2 : 0
    return this.raw([ESC, 0x61, n])
  }

  /** ESC E n — bold on/off. */
  bold(on: boolean): this {
    return this.raw([ESC, 0x45, on ? 1 : 0])
  }

  /** ESC ! n — combined size & emphasis bits. 0 = normal, 0x10 = double
   *  height, 0x20 = double width, 0x30 = double both. */
  size(opts: { doubleHeight?: boolean; doubleWidth?: boolean } = {}): this {
    let n = 0
    if (opts.doubleHeight) n |= 0x10
    if (opts.doubleWidth) n |= 0x20
    return this.raw([ESC, 0x21, n])
  }

  /** GS ! n — character size multiplier (0..7). 0 = normal, higher widens
   *  AND tallens by (n+1)×. Useful for big "TABLE 7" badges on KOTs. */
  scale(n: number): this {
    const clamped = Math.max(0, Math.min(7, n))
    return this.raw([GS, 0x21, (clamped << 4) | clamped])
  }

  /** A full-width horizontal rule. */
  hr(char = '-'): this {
    return this.text(char.repeat(this.width)).lf()
  }

  /** Two-column line: left label + right value, right-justified to the
   *  column width. Used for "Subtotal" / "Total" / "Cash" rows. */
  twoCol(left: string, right: string): this {
    const pad = Math.max(1, this.width - left.length - right.length)
    return this.text(left + ' '.repeat(pad) + right).lf()
  }

  /** Item line: "qty x name           1.99". Handles long names by
   *  wrapping the name and right-justifying the price on the first line. */
  item(qty: number, name: string, lineTotal: string): this {
    const left = `${qty} x ${name}`
    const maxNameWidth = this.width - lineTotal.length - 1
    if (left.length <= maxNameWidth) {
      return this.twoCol(left, lineTotal)
    }
    // Wrap: first line carries the price; subsequent lines indent under the name.
    const head = left.slice(0, maxNameWidth)
    const tail = left.slice(maxNameWidth)
    this.twoCol(head, lineTotal)
    for (let i = 0; i < tail.length; i += this.width - 5) {
      this.text('     ' + tail.slice(i, i + (this.width - 5))).lf()
    }
    return this
  }

  /** Indented modifier line (printed under an item). */
  modifier(text: string): this {
    return this.text(`  + ${text}`).lf()
  }

  /** Feed n blank lines. */
  feed(n: number): this {
    for (let i = 0; i < n; i++) this.lf()
    return this
  }

  /** GS V 0 — full cut. Some printers need a few feeds first so the cut
   *  doesn't slice through the last line of text. */
  cut(): this {
    return this.feed(4).raw([GS, 0x56, 0x00])
  }

  /** ESC p 0 25 250 — pulse drawer pin 2 (Epson "Drawer 1"). Adds a
   *  drawer-kick to the receipt impulse so a single print also pops the
   *  drawer. Optional; the dedicated `open_cash_drawer` command is also
   *  available. */
  drawerKick(): this {
    return this.raw([ESC, 0x70, 0x00, 0x19, 0xfa])
  }

  build(): Uint8Array {
    return new Uint8Array(this.parts)
  }
}
