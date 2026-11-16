// Offline data cache: stores the last successful API response per key so the
// app can cold-start and keep working without internet.

import { getKV } from './kv-store';

const CACHE_PREFIX = 'cache:';

export async function cacheData(key: string, data: unknown): Promise<void> {
  try {
    const kv = await getKV();
    await kv.set(CACHE_PREFIX + key, JSON.stringify(data));
  } catch (e) {
    console.warn('[offline] Failed to cache data for', key, e);
  }
}

export async function getCachedData<T>(key: string): Promise<T | null> {
  try {
    const kv = await getKV();
    const raw = await kv.get(CACHE_PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

const isNetworkError = (msg?: string): boolean =>
  !!msg && /fetch|network|connection|timeout|abort|offline/i.test(msg);

export interface CacheableResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export const isOnlineNow = (): boolean =>
  typeof navigator === 'undefined' ? true : navigator.onLine;

/**
 * Read-through offline cache.
 * Online: run the fetcher; on success, cache the full response.
 * Offline (or network failure): return the last cached response for this key.
 */
export async function withOfflineCache<T extends CacheableResponse>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  if (isOnlineNow()) {
    try {
      const res = await fetcher();
      if (res && res.success) {
        // Don't clobber a good cache with a success that carries no payload
        // (empty arrays are legitimate — e.g. no discounts — but null/undefined
        // data means the fetch didn't really produce anything).
        if ((res as { data?: unknown }).data != null) {
          void cacheData(key, res);
        }
        return res;
      }
      // Supabase returns network failures as { success: false } without throwing
      if (res && isNetworkError(res.message)) {
        const cached = await getCachedData<T>(key);
        if (cached) return cached;
      }
      return res;
    } catch (e) {
      const cached = await getCachedData<T>(key);
      if (cached) return cached;
      throw e;
    }
  }

  const cached = await getCachedData<T>(key);
  if (cached) return cached;
  return {
    success: false,
    message: 'You are offline and no cached data is available yet.',
    error: 'offline_no_cache',
  } as T;
}
