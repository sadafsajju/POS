import { useCallback } from 'react'
import { Delete } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface NumberPadProps {
  value: string
  onValueChange: (value: string) => void
  /** Maximum number of digits (excluding decimal point) */
  maxDigits?: number
  /** Maximum decimal places allowed */
  maxDecimals?: number
  /** Allow decimal point input */
  allowDecimal?: boolean
  /** Additional className for the container */
  className?: string
}

type PadKey = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '0' | '.' | 'backspace' | 'clear'

export function NumberPad({
  value,
  onValueChange,
  maxDigits = 10,
  maxDecimals = 2,
  allowDecimal = true,
  className,
}: NumberPadProps) {

  const handleKey = useCallback(
    (key: PadKey) => {
      switch (key) {
        case 'backspace':
          onValueChange(value.slice(0, -1))
          break

        case 'clear':
          onValueChange('')
          break

        case '.': {
          if (!allowDecimal) break
          if (value.includes('.')) break
          onValueChange(value === '' ? '0.' : value + '.')
          break
        }

        default: {
          let next = value
          // Don't allow leading zeros
          if (next === '0') {
            next = key
          } else {
            // Enforce max decimal places
            const dotIdx = next.indexOf('.')
            if (dotIdx !== -1 && next.length - dotIdx > maxDecimals) break

            // Enforce max digits (count only digits, not the decimal point)
            const digitCount = next.replace('.', '').length
            if (digitCount >= maxDigits) break

            next = next + key
          }
          onValueChange(next)
          break
        }
      }
    },
    [value, maxDigits, maxDecimals, allowDecimal, onValueChange]
  )

  const padKeys: PadKey[][] = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    [allowDecimal ? '.' : 'clear', '0', 'backspace'],
  ]

  return (
    <div className={cn('space-y-2', className)}>
      {padKeys.map((row, rowIdx) => (
        <div key={rowIdx} className="flex gap-2">
          {row.map((key) => (
            <Button
              key={key}
              variant="outline"
              className="h-16 flex-1 text-2xl font-medium touch-manipulation select-none active:scale-95 transition-transform bg-zinc-800 border-zinc-700 text-zinc-100 hover:bg-zinc-700"
              onClick={() => handleKey(key)}
            >
              {key === 'backspace' ? (
                <Delete className="w-6 h-6" />
              ) : key === 'clear' ? (
                'C'
              ) : (
                key
              )}
            </Button>
          ))}
        </div>
      ))}

      {/* Clear row — only if decimal is enabled (since 'clear' takes the bottom-left spot otherwise) */}
      {allowDecimal && (
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="h-16 flex-1 text-lg font-medium touch-manipulation select-none active:scale-95 transition-transform bg-zinc-700 text-zinc-300 hover:bg-zinc-600 border-zinc-700"
            onClick={() => handleKey('clear')}
          >
            Clear
          </Button>
        </div>
      )}
    </div>
  )
}
