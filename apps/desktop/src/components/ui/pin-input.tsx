import { useRef, useCallback, type KeyboardEvent, type ClipboardEvent } from 'react'
import { cn } from '@/lib/utils'

interface PinInputProps {
  value: string
  onChange: (value: string) => void
  length?: number
  disabled?: boolean
  error?: boolean
  autoFocus?: boolean
  mask?: boolean
}

export function PinInput({
  value,
  onChange,
  length = 4,
  disabled = false,
  error = false,
  autoFocus = true,
  mask = false,
}: PinInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const digits = value.split('').concat(Array(length).fill('')).slice(0, length)

  const focusInput = useCallback((index: number) => {
    if (index >= 0 && index < length) {
      inputRefs.current[index]?.focus()
    }
  }, [length])

  const handleChange = useCallback((index: number, digit: string) => {
    if (!/^\d?$/.test(digit)) return

    const newDigits = [...digits]
    newDigits[index] = digit
    const newValue = newDigits.join('').replace(/\s/g, '')
    onChange(newValue)

    if (digit && index < length - 1) {
      focusInput(index + 1)
    }
  }, [digits, onChange, length, focusInput])

  const handleKeyDown = useCallback((index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        focusInput(index - 1)
        const newDigits = [...digits]
        newDigits[index - 1] = ''
        onChange(newDigits.join('').replace(/\s/g, ''))
      } else {
        const newDigits = [...digits]
        newDigits[index] = ''
        onChange(newDigits.join('').replace(/\s/g, ''))
      }
      e.preventDefault()
    } else if (e.key === 'ArrowLeft' && index > 0) {
      focusInput(index - 1)
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      focusInput(index + 1)
    }
  }, [digits, onChange, length, focusInput])

  const handlePaste = useCallback((e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (pasted) {
      onChange(pasted)
      focusInput(Math.min(pasted.length, length - 1))
    }
  }, [onChange, length, focusInput])

  return (
    <div className="flex items-center gap-3 justify-center">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => { inputRefs.current[index] = el }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={mask && digit ? '●' : digit}
          disabled={disabled}
          autoFocus={autoFocus && index === 0}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className={cn(
            'w-14 h-16 text-center text-2xl font-bold rounded-xl border-2 bg-zinc-50 outline-none transition-all',
            'focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:bg-white',
            error
              ? 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-500/10'
              : 'border-zinc-200',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
          aria-label={`PIN digit ${index + 1}`}
        />
      ))}
    </div>
  )
}
