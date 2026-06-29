import { useEffect, useMemo, useState, type ImgHTMLAttributes } from 'react';
import { imageUrl } from '@/lib/utils';
import type { ImageTransform } from '@pos/supabase';
import { getCachedImageSrc } from '@/lib/imageCache';

type CachedImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  /** Raw image_url (storage path or full URL). */
  src: string | null | undefined;
  /** Resize/compress the source before caching (e.g. `{ width: 400, quality: 70 }`). */
  transform?: ImageTransform;
};

/**
 * Drop-in <img> replacement that (1) serves a transformed/compressed variant and
 * (2) caches the bytes on disk via the Cache Storage API so each image is fetched
 * from Supabase at most once per device. See lib/imageCache.ts.
 *
 * Shows the remote (transformed) URL immediately, then swaps to the locally-cached
 * blob once available — so there's never a blank flash on first load.
 */
export function CachedImage({ src, transform, ...rest }: CachedImageProps) {
  const remote = useMemo(() => imageUrl(src, transform), [src, transform]);
  const [display, setDisplay] = useState<string>(remote);

  useEffect(() => {
    setDisplay(remote); // show the transformed remote URL right away
    if (!remote) return;
    let active = true;
    let objectUrl: string | null = null;
    getCachedImageSrc(remote)
      .then((resolved) => {
        if (!active) {
          if (resolved.startsWith('blob:')) URL.revokeObjectURL(resolved);
          return;
        }
        if (resolved !== remote) {
          objectUrl = resolved;
          setDisplay(resolved);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [remote]);

  if (!remote) return null;
  return <img src={display || undefined} {...rest} />;
}
