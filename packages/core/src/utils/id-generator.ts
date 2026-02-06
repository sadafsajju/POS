// ID generation utilities for offline-first operations

/**
 * Generate a unique ID that works offline
 * Format: {prefix}_{timestamp}_{random}
 */
export function generateId(prefix: string = 'id'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 9);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Generate a UUID v4
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generate an order number based on timestamp
 */
export function generateOrderNumber(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(2, 10).replace(/-/g, '');
  const timePart = now.getTime().toString().slice(-6);
  return `ORD${datePart}${timePart}`;
}

/**
 * Generate a receipt number
 */
export function generateReceiptNumber(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RCP-${datePart}-${random}`;
}

/**
 * Check if an ID is a temporary/offline ID
 */
export function isTemporaryId(id: string): boolean {
  return id.startsWith('temp_') || id.startsWith('local_');
}

/**
 * Convert a temporary ID to indicate it needs syncing
 */
export function markForSync(id: string): string {
  if (isTemporaryId(id)) {
    return id;
  }
  return `sync_${id}`;
}
