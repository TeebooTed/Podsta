import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/**
 * A QR code for an invite link, drawn in the browser. The link is also
 * written next to it, so the code is not the only way to read the address.
 */
export default function InviteQr({ url, label = 'Invite link' }) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    if (!url) {
      setSrc('');
      return undefined;
    }
    let cancelled = false;
    QRCode.toDataURL(url, {
      margin: 1,
      width: 240,
      color: { dark: '#1c140e', light: '#f4efe6' },
      errorCorrectionLevel: 'M',
    })
      .then((dataUrl) => {
        if (!cancelled) setSrc(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setSrc('');
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <figure className="inline-flex flex-col items-center gap-2">
      {src ? (
        <img
          src={src}
          width={160}
          height={160}
          alt=""
          className="rounded-lg bg-[#f4efe6] p-2"
        />
      ) : (
        <div className="w-40 h-40 rounded-lg skeleton" />
      )}
      <figcaption className="sr-only">{label}. The address is written beside this code.</figcaption>
    </figure>
  );
}
