// Formatting utilities

/**
 * Map a currency code to a sensible locale for Intl formatting.
 * Defaults to en-GB so anyone outside the explicit list still gets
 * thousands separators and a leading currency prefix.
 */
export function localeForCurrency(currency: string | undefined | null): string {
  switch ((currency ?? '').toUpperCase()) {
    case 'INR': return 'en-IN';
    case 'USD': return 'en-US';
    case 'GBP': return 'en-GB';
    case 'EUR': return 'en-IE';
    case 'AUD': return 'en-AU';
    case 'CAD': return 'en-CA';
    case 'JPY': return 'ja-JP';
    default:    return 'en-GB';
  }
}

export function formatCurrency(
  amount: number,
  currency: string = 'GBP',
  locale?: string
): string {
  const resolvedLocale = locale ?? localeForCurrency(currency);
  try {
    return new Intl.NumberFormat(resolvedLocale, {
      style: 'currency',
      currency,
    }).format(amount);
  } catch {
    // Currency code unrecognised — fall back to manual format with thousands separators.
    const numeric = new Intl.NumberFormat(resolvedLocale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
    return `${currency} ${numeric}`;
  }
}

export function formatDate(
  date: Date | string,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  },
  locale: string = 'en-GB'
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, options).format(d);
}

export function formatTime(
  date: Date | string,
  options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
  },
  locale: string = 'en-GB'
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, options).format(d);
}

export function formatDateTime(
  date: Date | string,
  locale: string = 'en-GB'
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatOrderNumber(num: number, prefix: string = 'ORD'): string {
  return `${prefix}-${num.toString().padStart(6, '0')}`;
}

export function formatPhoneNumber(phone: string, countryCode: string = 'US'): string {
  const cleaned = phone.replace(/\D/g, '');

  if (countryCode === 'US' && cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }

  return phone;
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength - 3)}...`;
}
