import { useEffect, useRef, useState } from 'react';
import { safeHttpUrl } from '../lib/urls.js';
import { ALLOWED_IMAGE_TYPES } from '../lib/vocab.js';

/**
 * Reads a pod image with the owner's session when a plain <img> can't
 * (Contacts and Hidden profiles), and falls back to the URL otherwise.
 */
export function usePodImage(url, fetchFn) {
  const safe = safeHttpUrl(url) || '';
  const [src, setSrc] = useState(fetchFn ? '' : safe);
  useEffect(() => {
    if (!safe || !fetchFn) {
      setSrc(safe);
      return undefined;
    }
    let objectUrl = '';
    let cancelled = false;
    fetchFn(safe)
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(String(res.status)))))
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => !cancelled && setSrc(safe));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [safe, fetchFn]);
  return src;
}

/**
 * The banner across the top of a profile. Without a photo it shows a soft brand
 * gradient with a few confetti dots, so an empty cover still feels finished.
 * Owners get "Add cover" / "Change cover" and "Remove" over the bottom corner.
 */
export default function ProfileCover({
  url,
  fetchFn,
  editable = false,
  busy = false,
  onPick,
  onRemove,
  className = '',
}) {
  const src = usePodImage(url, fetchFn);
  const [loaded, setLoaded] = useState(false);
  const fileRef = useRef(null);
  useEffect(() => setLoaded(false), [src]);

  return (
    <div
      className={`relative h-32 sm:h-44 overflow-hidden bg-gradient-to-br from-accent-light via-accent to-berry ${className}`}
    >
      <span aria-hidden="true" className="absolute inset-0">
        <span className="absolute -left-10 -top-16 w-48 h-48 rounded-full bg-sunshine/40" />
        <span className="absolute right-[12%] top-5 w-5 h-5 rounded-full bg-sunshine" />
        <span className="absolute right-[24%] bottom-8 w-3 h-3 rounded-full bg-mint" />
        <span className="absolute -right-12 -bottom-20 w-56 h-56 rounded-full bg-plum/15" />
        <span className="absolute left-[38%] top-8 w-2.5 h-2.5 rounded-full bg-cream/80" />
      </span>
      {src && (
        <img
          src={src}
          alt=""
          decoding="async"
          onLoad={() => setLoaded(true)}
          ref={(el) => {
            if (el?.complete && el.naturalWidth && !loaded) setLoaded(true);
          }}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
      {editable && (
        <div className="absolute right-3 bottom-3 flex gap-2">
          {url && (
            <button
              type="button"
              onClick={onRemove}
              disabled={busy}
              className="min-h-9 rounded-full bg-cream/90 px-3 text-xs font-extrabold text-plum shadow-lift hover:bg-cream disabled:opacity-60"
            >
              Remove
            </button>
          )}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="min-h-9 rounded-full bg-cream/90 px-3 text-xs font-extrabold text-plum shadow-lift hover:bg-cream disabled:opacity-60"
          >
            {busy ? 'Uploading…' : url ? 'Change cover' : 'Add cover'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept={ALLOWED_IMAGE_TYPES.join(',')}
            className="hidden"
            onChange={(e) => {
              onPick?.(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
      )}
    </div>
  );
}
