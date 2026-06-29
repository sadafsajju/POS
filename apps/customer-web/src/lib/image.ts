/**
 * Rewrite a Supabase Storage public *object* URL to the image-transformation
 * (render) endpoint so phones download a small, compressed WebP instead of the
 * full-resolution original. No-ops for non-Supabase URLs.
 *
 * customer-web is the highest-egress image surface because every diner's phone is
 * a cold cache — there's no way to pre-warm it, so shrinking the file is the only lever.
 */
// Image transformations are a separately-enabled Supabase tenant feature; when
// off, the /render/image endpoint 403s. Gate behind an env flag (default OFF) so
// images don't break — set VITE_IMAGE_TRANSFORMS=true once the feature is enabled.
const TRANSFORMS_ENABLED = import.meta.env.VITE_IMAGE_TRANSFORMS === 'true';

export function menuImageUrl(
  url: string | null | undefined,
  { width = 600, quality = 70 }: { width?: number; quality?: number } = {}
): string {
  if (!url) return '';
  if (!TRANSFORMS_ENABLED) return url;
  const marker = '/storage/v1/object/public/';
  const idx = url.indexOf(marker);
  if (idx === -1) return url;
  const base = url.slice(0, idx);
  const objectPath = url.slice(idx + marker.length).split('?')[0];
  const params = new URLSearchParams({ width: String(width), quality: String(quality) });
  return `${base}/storage/v1/render/image/public/${objectPath}?${params.toString()}`;
}
