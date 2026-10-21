import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import { copyToClipboard } from '../lib/utils.js';

function fileName(handle) {
  const slug = String(handle || 'profile')
    .replace(/^@/, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `podsta-${slug || 'profile'}.png`;
}

/**
 * A picture of your profile to post anywhere: cover, avatar, name, bio and a QR code
 * for your invite link. Drawn on this device; nothing is uploaded.
 */
export default function ProfileShareCard({
  open,
  onClose,
  name,
  handle,
  bio,
  avatarUrl,
  coverUrl,
  inviteUrl,
  fetchFn,
  showToast,
}) {
  const [card, setCard] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open || !inviteUrl) return undefined;
    let cancelled = false;
    let objectUrl = '';
    setCard(null);
    setFailed(false);
    import('../lib/profileCard.js')
      .then(({ drawProfileCard }) =>
        drawProfileCard({ name, handle, bio, avatarUrl, coverUrl, inviteUrl, fetchFn }),
      )
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setCard({
          blob,
          url: objectUrl,
          file: new File([blob], fileName(handle), { type: 'image/png' }),
        });
      })
      .catch((err) => {
        console.error('Profile card failed:', err);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, name, handle, bio, avatarUrl, coverUrl, inviteUrl, fetchFn]);

  const canShareFile =
    Boolean(card) &&
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    navigator.canShare?.({ files: [card.file] });

  const share = async () => {
    try {
      await navigator.share({
        files: [card.file],
        title: name || handle || 'My Podsta profile',
        text: `Follow me on Podsta: ${inviteUrl}`,
      });
    } catch (err) {
      if (err?.name !== 'AbortError')
        showToast?.("Couldn't open the share sheet. Try Download instead.", 'error');
    }
  };

  const copyLink = async () => {
    const ok = await copyToClipboard(inviteUrl);
    showToast?.(
      ok ? 'Invite link copied' : "Couldn't copy that. Try selecting it instead.",
      ok ? 'success' : 'error',
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Your profile card" maxWidth="max-w-2xl">
      <p className="text-sm text-ink-100 leading-relaxed">
        Post it anywhere. The QR code opens your invite link, so people can follow you in one scan.
        It shows what's on your profile, and it's drawn on this device.
      </p>
      <div className="mt-4 relative aspect-[1200/630] w-full overflow-hidden rounded-2xl ring-1 ring-ink-700 bg-ink-900">
        {card ? (
          <img
            src={card.url}
            alt={`Profile card: ${name || handle}${handle && name ? `, ${handle}` : ''}, with a QR code for your invite link.`}
            className="absolute inset-0 w-full h-full object-contain motion-safe:animate-pop-in"
          />
        ) : failed ? (
          <p className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-ink-100">
            We couldn't draw your card. Copy your invite link instead.
          </p>
        ) : (
          <span className="absolute inset-0 skeleton" aria-hidden="true" />
        )}
        <span className="sr-only" role="status">
          {card ? 'Your card is ready.' : failed ? '' : 'Drawing your card…'}
        </span>
      </div>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={copyLink} className="btn-ghost">
          Copy invite link
        </button>
        {card && (
          <a href={card.url} download={card.file.name} className="btn-secondary">
            Download image
          </a>
        )}
        {canShareFile && (
          <button type="button" onClick={share} className="btn-primary">
            Share…
          </button>
        )}
      </div>
    </Modal>
  );
}
