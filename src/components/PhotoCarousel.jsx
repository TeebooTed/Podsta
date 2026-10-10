import { useEffect, useState } from 'react';
import { getFile } from '@inrupt/solid-client';
import { safeHttpUrl } from '../lib/urls.js';
import { withTimeout } from '../lib/timeoutFetch.js';

/**
 * One photo, or a row of them. Arrows stay on the photo set.
 * A public photo uses its URL. A private photo is fetched with the session.
 */
export default function PhotoCarousel({
  urls = [],
  alt = 'Photo',
  session,
  isPublic = false,
  onOpen,
  fit = 'cover',
}) {
  const photos = urls.filter((url) => safeHttpUrl(url));
  const photoKey = photos.join('|');
  const [frame, setFrame] = useState(0);
  const [src, setSrc] = useState('');
  const index = photos.length ? Math.min(frame, photos.length - 1) : 0;
  const current = photos[index] || '';

  useEffect(() => {
    setFrame(0);
  }, [photoKey]);

  useEffect(() => {
    if (!current) {
      setSrc('');
      return undefined;
    }
    if (isPublic) {
      setSrc(current);
      return undefined;
    }
    let cancelled = false;
    let objectUrl = '';
    (async () => {
      try {
        if (!session?.fetch) return;
        const file = await getFile(current, { fetch: withTimeout(session.fetch, 30000) });
        if (cancelled) return;
        objectUrl = URL.createObjectURL(file);
        setSrc(objectUrl);
      } catch {
        if (!cancelled) setSrc('');
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [current, isPublic, session]);

  const imageClass = fit === 'contain' ? 'max-h-[80vh] max-w-full object-contain' : 'w-full max-h-[600px] object-cover';
  const image = src ? (
    <img src={src} alt={photos.length > 1 ? `${alt}, photo ${index + 1} of ${photos.length}` : alt} className={imageClass} />
  ) : (
    <div className="w-full aspect-[4/3] skeleton" />
  );

  return (
    <div className="relative bg-ink-900">
      {onOpen ? (
        <button type="button" className="block w-full cursor-zoom-in" onClick={onOpen}>
          {image}
        </button>
      ) : (
        image
      )}
      {photos.length > 1 && (
        <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-2 px-2">
          <button
            type="button"
            className="min-h-11 px-3 rounded-lg bg-ink-950/80 text-ink-50 text-sm disabled:opacity-40"
            onClick={() => setFrame((value) => Math.max(0, value - 1))}
            disabled={index === 0}
          >
            Previous photo
          </button>
          <span className="text-xs text-ink-50 bg-ink-950/80 px-2 py-1 rounded" aria-live="polite">
            {index + 1} of {photos.length}
          </span>
          <button
            type="button"
            className="min-h-11 px-3 rounded-lg bg-ink-950/80 text-ink-50 text-sm disabled:opacity-40"
            onClick={() => setFrame((value) => Math.min(photos.length - 1, value + 1))}
            disabled={index === photos.length - 1}
          >
            Next photo
          </button>
        </div>
      )}
    </div>
  );
}
