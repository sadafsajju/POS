// Validation utilities

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 15;
}

export function isValidBarcode(barcode: string): boolean {
  // EAN-13, UPC-A, or custom formats
  const cleaned = barcode.replace(/\D/g, '');
  return cleaned.length >= 8 && cleaned.length <= 14;
}

export function isValidSKU(sku: string): boolean {
  // Alphanumeric, 3-20 characters
  const skuRegex = /^[A-Za-z0-9-_]{3,20}$/;
  return skuRegex.test(sku);
}

export function isPositiveNumber(value: number): boolean {
  return typeof value === 'number' && !isNaN(value) && value > 0;
}

export function isNonNegativeNumber(value: number): boolean {
  return typeof value === 'number' && !isNaN(value) && value >= 0;
}

export function isValidPercentage(value: number): boolean {
  return isNonNegativeNumber(value) && value <= 100;
}

export function sanitizeString(str: string): string {
  return str
    .trim()
    .replace(/[<>]/g, '') // Remove potential XSS characters
    .replace(/\s+/g, ' '); // Normalize whitespace
}
