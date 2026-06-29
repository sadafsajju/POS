const CACHE_NAME = 'pos-images-v1';

function cacheAvailable(): boolean {
  return typeof caches !== 'undefined';
}

/**
 * Resolve a displayable src for a remote image URL, served from a persistent
 * on-disk cache (Cache Storage API) when available.
 *
 * The first time an image is requested it's fetched once and stored; every
 * subsequent load (this session or after an app restart) is served from the
 * local cache — so each image is downloaded from Supabase at most once per
 * device. Repeat egress drops to zero and cached images render offline.
 *
 * Returns a `blob:` object URL on a cache hit / after caching, or the original
 * URL as a fallback. Callers MUST revoke a returned `blob:` URL with
 * URL.revokeObjectURL() when it's no longer displayed.
 */
export async function getCachedImageSrc(url: string): Promise<string> {
  if (!url || !cacheAvailable()) return url;
  try {
    const cache = await caches.open(CACHE_NAME);
    let res = await cache.match(url);
    if (!res) {
      const net = await fetch(url, { mode: 'cors' });
      if (!net.ok) return url;
      await cache.put(url, net.clone());
      res = net;
    }
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch {
    // Any failure (offline first-load, CORS, quota) falls back to the network URL.
    return url;
  }
}
