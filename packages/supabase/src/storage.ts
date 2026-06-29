import { getSupabase } from './client'

/**
 * On-the-fly image transformation options (Supabase Pro feature). Requesting a
 * width/quality serves a resized, recompressed image (auto-WebP via Accept header)
 * instead of the full-resolution original — typically 15–40× smaller, which is the
 * single biggest lever on storage egress for image-heavy screens.
 */
export interface ImageTransform {
  width?: number
  height?: number
  /** 20–100; lower = smaller file. ~70 is visually indistinguishable for photos. */
  quality?: number
  resize?: 'cover' | 'contain' | 'fill'
}

function transformQuery(t: ImageTransform): string {
  const p = new URLSearchParams()
  if (t.width) p.set('width', String(t.width))
  if (t.height) p.set('height', String(t.height))
  if (t.quality) p.set('quality', String(t.quality))
  if (t.resize) p.set('resize', t.resize)
  return p.toString()
}

/**
 * Get a public URL for a file in Supabase Storage, optionally transformed.
 */
export function getStorageUrl(bucket: string, path: string, transform?: ImageTransform): string {
  const sb = getSupabase()
  const { data } = sb.storage
    .from(bucket)
    .getPublicUrl(path, transform ? { transform } : undefined)
  return data.publicUrl
}

/**
 * Rewrite an existing Supabase Storage *object* public URL to the image-render
 * (transformation) endpoint. No-ops for non-Supabase URLs or when no transform is given.
 */
function applyTransformToUrl(url: string, transform?: ImageTransform): string {
  if (!transform) return url
  const query = transformQuery(transform)
  if (!query) return url
  const marker = '/storage/v1/object/public/'
  const idx = url.indexOf(marker)
  if (idx === -1) return url // not a Supabase storage object URL — leave untouched
  const base = url.slice(0, idx)
  const objectPath = url.slice(idx + marker.length).split('?')[0]
  return `${base}/storage/v1/render/image/public/${objectPath}?${query}`
}

/**
 * Resolve an image URL. Handles:
 * - Full URLs (https://...) — returned as-is (Supabase URLs get transform rewriting)
 * - Supabase storage paths (bucket/path) — resolved via getStorageUrl
 * - Legacy relative paths (/uploads/...) — resolved against VITE_SUPABASE_URL
 *
 * Pass `transform` to request a resized/compressed variant.
 */
export function resolveImageUrl(url: string | null | undefined, transform?: ImageTransform): string {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return applyTransformToUrl(url, transform)
  }
  if (url.startsWith('/')) {
    // Legacy path from old backend — try to resolve via Supabase storage
    // e.g., /uploads/products/image.jpg → products bucket, image.jpg path
    const match = url.match(/\/uploads\/(\w+)\/(.+)/)
    if (match) {
      return getStorageUrl(match[1], match[2], transform)
    }
    // Fallback: return as-is (will 404 but won't crash)
    return url
  }
  // Assume it's a bucket/path format
  const slashIdx = url.indexOf('/')
  if (slashIdx > 0) {
    const bucket = url.substring(0, slashIdx)
    const path = url.substring(slashIdx + 1)
    return getStorageUrl(bucket, path, transform)
  }
  return url
}

/**
 * Upload a file to Supabase Storage.
 */
export async function uploadFile(
  bucket: string,
  path: string,
  file: File
): Promise<{ url: string; error?: string }> {
  const sb = getSupabase()
  const { error } = await sb.storage.from(bucket).upload(path, file, {
    // 30 days — image filenames are timestamped/immutable, so long-lived CDN+browser
    // caching is safe and cuts repeat storage egress dramatically.
    cacheControl: '2592000',
    upsert: true,
  })
  if (error) return { url: '', error: error.message }
  return { url: getStorageUrl(bucket, path) }
}

/**
 * Delete a file from Supabase Storage.
 */
export async function deleteFile(
  bucket: string,
  path: string
): Promise<{ error?: string }> {
  const sb = getSupabase()
  const { error } = await sb.storage.from(bucket).remove([path])
  if (error) return { error: error.message }
  return {}
}
