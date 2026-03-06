import { getSupabase } from './client'

/**
 * Get a public URL for a file in Supabase Storage.
 */
export function getStorageUrl(bucket: string, path: string): string {
  const sb = getSupabase()
  const { data } = sb.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

/**
 * Resolve an image URL. Handles:
 * - Full URLs (https://...) — returned as-is
 * - Supabase storage paths (bucket/path) — resolved via getStorageUrl
 * - Legacy relative paths (/uploads/...) — resolved against VITE_SUPABASE_URL
 */
export function resolveImageUrl(url: string | null | undefined): string {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/')) {
    // Legacy path from old backend — try to resolve via Supabase storage
    // e.g., /uploads/products/image.jpg → products bucket, image.jpg path
    const match = url.match(/\/uploads\/(\w+)\/(.+)/)
    if (match) {
      return getStorageUrl(match[1], match[2])
    }
    // Fallback: return as-is (will 404 but won't crash)
    return url
  }
  // Assume it's a bucket/path format
  const slashIdx = url.indexOf('/')
  if (slashIdx > 0) {
    const bucket = url.substring(0, slashIdx)
    const path = url.substring(slashIdx + 1)
    return getStorageUrl(bucket, path)
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
    cacheControl: '3600',
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
