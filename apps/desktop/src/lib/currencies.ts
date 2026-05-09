// Shared currency list. Single source of truth for the setup wizard and
// settings pages — keep these in sync with the choices users see at signup.

export interface CurrencyOption {
  code: string
  symbol: string
  name: string
}

export const currencyOptions: readonly CurrencyOption[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
]

export function findCurrency(code: string | undefined | null): CurrencyOption | undefined {
  if (!code) return undefined
  const upper = code.toUpperCase()
  return currencyOptions.find((c) => c.code === upper)
}

export function formatCurrencyLabel(
  code: string | undefined | null,
  symbol?: string | undefined | null,
): string {
  const match = findCurrency(code)
  if (match) return `${match.code} (${match.symbol}) - ${match.name}`
  if (code && symbol) return `${code} (${symbol})`
  if (code) return code
  return ''
}
