import { getSupabase } from '../client'
import { type ApiResponse } from '../helpers'
import { getStorageUrl } from '../storage'

const BUCKET = 'media'

export interface MediaItem {
  id: string
  filename: string
  original_name: string
  file_url: string
  file_size: number
  mime_type?: string
  created_at: string | null
}

/**
 * List every file in the media bucket. Returned items are shaped like the
 * legacy API (id/original_name/file_url/file_size/created_at) so the existing
 * Media settings page renders them without changes.
 */
export async function listMedia(): Promise<ApiResponse<MediaItem[]>> {
  const sb = getSupabase()
  const { data, error } = await sb.storage.from(BUCKET).list('', {
    limit: 1000,
    sortBy: { column: 'created_at', order: 'desc' },
  })
  if (error) return { success: false, message: error.message }

  const items: MediaItem[] = (data ?? [])
    // Supabase returns a phantom ".emptyFolderPlaceholder" entry — skip it.
    .filter((f) => f.name && !f.name.startsWith('.'))
    .map((f) => ({
      id: f.name,
      filename: f.name,
      original_name: f.name,
      file_url: getStorageUrl(BUCKET, f.name),
      file_size: (f.metadata as any)?.size ?? 0,
      mime_type: (f.metadata as any)?.mimetype,
      created_at: f.created_at ?? null,
    }))

  return { success: true, message: 'Success', data: items }
}

/**
 * Upload a single file to the media bucket. The file's original name is
 * preserved, prefixed with a timestamp so multiple uploads of the same name
 * don't collide.
 */
export async function uploadMediaFile(file: File): Promise<ApiResponse<MediaItem>> {
  const sb = getSupabase()
  const safeName = file.name.replace(/[^\w.\-]+/g, '_')
  const path = `${Date.now()}-${safeName}`

  const { error } = await sb.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  })
  if (error) return { success: false, message: error.message }

  return {
    success: true,
    message: 'Uploaded',
    data: {
      id: path,
      filename: path,
      original_name: file.name,
      file_url: getStorageUrl(BUCKET, path),
      file_size: file.size,
      mime_type: file.type,
      created_at: new Date().toISOString(),
    },
  }
}

/**
 * Delete a media file. `id` is the storage path (we use it as the id when
 * listing).
 */
export async function deleteMediaFile(id: string): Promise<ApiResponse<null>> {
  const sb = getSupabase()
  const { error } = await sb.storage.from(BUCKET).remove([id])
  if (error) return { success: false, message: error.message }
  return { success: true, message: 'Deleted', data: null }
}
