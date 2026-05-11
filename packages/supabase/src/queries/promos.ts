import { getSupabase } from '../client'
import { type ApiResponse, wrapMany, wrapOne } from '../helpers'
import { getStorageUrl } from '../storage'
import type { Database } from '../types'

const BUCKET = 'promos'

type Promo = Database['public']['Tables']['promos']['Row']
type PromoInsert = Database['public']['Tables']['promos']['Insert']

/** List promos for the current org, ordered by display_order. */
export async function listPromos(): Promise<ApiResponse<Promo[]>> {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('promos')
    .select('*')
    .order('display_order', { ascending: true })
  return wrapMany<Promo>((data as any) ?? null, error)
}

/** List only active promos (used by the customer-display loop). */
export async function listActivePromos(): Promise<ApiResponse<Promo[]>> {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('promos')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true })
  return wrapMany<Promo>((data as any) ?? null, error)
}

function mediaTypeFor(mime: string | undefined): 'image' | 'video' {
  return mime?.startsWith('video/') ? 'video' : 'image'
}

async function nextDisplayOrder(orgId: string): Promise<number> {
  const sb = getSupabase()
  const { data } = await sb
    .from('promos')
    .select('display_order')
    .eq('org_id', orgId)
    .order('display_order', { ascending: false })
    .limit(1)
    .single()
  return ((data as any)?.display_order ?? -1) + 1
}

async function getOrgIdFromSession(): Promise<string | null> {
  const sb = getSupabase()
  const { data } = await sb.auth.getSession()
  const claims = data.session?.user?.app_metadata as { org_id?: string } | undefined
  return claims?.org_id ?? null
}

/** Upload a file to the `promos` bucket and create a row pointing at it. */
export async function uploadPromoFile(
  file: File,
  title?: string,
): Promise<ApiResponse<Promo>> {
  const sb = getSupabase()
  const orgId = await getOrgIdFromSession()
  if (!orgId) return { success: false, message: 'Not signed in' }

  const safeName = file.name.replace(/[^\w.\-]+/g, '_')
  const path = `${orgId}/${Date.now()}-${safeName}`

  const { error: uploadError } = await sb.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  })
  if (uploadError) return { success: false, message: uploadError.message }

  const fileUrl = getStorageUrl(BUCKET, path)
  const insertRow: PromoInsert = {
    org_id: orgId,
    title: title ?? file.name.replace(/\.[^.]+$/, ''),
    media_type: mediaTypeFor(file.type),
    file_url: fileUrl,
    display_order: await nextDisplayOrder(orgId),
  }

  const { data, error } = await sb
    .from('promos')
    .insert(insertRow as any)
    .select('*')
    .single()
  return wrapOne<Promo>(data as any, error, 'Promo')
}

/**
 * Create a promo entry that references an existing media-library URL —
 * "Choose from library" path. Skips the file upload entirely.
 */
export async function createPromoFromMedia(
  fileUrl: string,
  title?: string,
): Promise<ApiResponse<Promo>> {
  const sb = getSupabase()
  const orgId = await getOrgIdFromSession()
  if (!orgId) return { success: false, message: 'Not signed in' }

  const insertRow: PromoInsert = {
    org_id: orgId,
    title: title ?? null,
    media_type: 'image', // media library is image-only by convention
    file_url: fileUrl,
    display_order: await nextDisplayOrder(orgId),
  }
  const { data, error } = await sb
    .from('promos')
    .insert(insertRow as any)
    .select('*')
    .single()
  return wrapOne<Promo>(data as any, error, 'Promo')
}

/** Hard-delete a promo row. The storage object stays — same file may be in
 *  the media library or referenced elsewhere. */
export async function deletePromo(id: string): Promise<ApiResponse<null>> {
  const sb = getSupabase()
  const { error } = await sb.from('promos').delete().eq('id', id)
  if (error) return { success: false, message: error.message }
  return { success: true, message: 'Deleted', data: null }
}

/** Apply new display_order values for several promos at once. */
export async function reorderPromos(
  items: { id: string; display_order: number }[],
): Promise<ApiResponse<null>> {
  const sb = getSupabase()
  const errors: string[] = []
  for (const item of items) {
    const { error } = await sb
      .from('promos')
      .update({ display_order: item.display_order } as any)
      .eq('id', item.id)
    if (error) errors.push(error.message)
  }
  if (errors.length) {
    return { success: false, message: errors.join('; ') }
  }
  return { success: true, message: 'Reordered', data: null }
}

/** Flip is_active. Reads the current row, then writes the inverted value. */
export async function togglePromo(id: string): Promise<ApiResponse<Promo>> {
  const sb = getSupabase()
  const { data: current, error: readError } = await sb
    .from('promos')
    .select('is_active')
    .eq('id', id)
    .single()
  if (readError) return { success: false, message: readError.message }

  const { data, error } = await sb
    .from('promos')
    .update({ is_active: !(current as any).is_active } as any)
    .eq('id', id)
    .select('*')
    .single()
  return wrapOne<Promo>(data as any, error, 'Promo')
}

/** Update how long this promo shows on screen. */
export async function updatePromoDuration(
  id: string,
  durationSeconds: number,
): Promise<ApiResponse<Promo>> {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('promos')
    .update({ duration_seconds: durationSeconds } as any)
    .eq('id', id)
    .select('*')
    .single()
  return wrapOne<Promo>(data as any, error, 'Promo')
}
