import { useState } from 'react';
import Composer from '../components/Composer.jsx';

/**
 * Opens the real composer without a pod, and reports the baked file
 * so a test can check the crop, the look, and that camera notes are gone.
 */
export default function ComposerPreview() {
  const [baked, setBaked] = useState(null);

  return (
    <div className="min-h-screen bg-ink-950 p-4">
      <h1 className="display-serif text-3xl mb-2">Composer preview</h1>
      <p className="text-sm text-ink-200 mb-4">Nothing on this page is uploaded.</p>
      <Composer
        open
        onClose={() => {}}
        discoverability="public"
        onSubmit={async (draft) => {
          const file = draft.files[0];
          const bytes = new Uint8Array(await file.arrayBuffer());
          const bitmap = await createImageBitmap(file);
          const canvas = document.createElement('canvas');
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(bitmap, 0, 0);
          const pixel = ctx.getImageData(
            Math.floor(bitmap.width / 2),
            Math.floor(bitmap.height / 2),
            1,
            1,
          ).data;
          const width = bitmap.width;
          const height = bitmap.height;
          bitmap.close?.();
          let gps = false;
          const text = new TextDecoder().decode(bytes);
          if (text.includes('GPSLatitude')) gps = true;
          setBaked({
            size: `${width}×${height}`,
            pixel: `${pixel[0]},${pixel[1]},${pixel[2]}`,
            gps: gps ? 'kept' : 'stripped',
            type: file.type,
          });
        }}
      />
      {baked && (
        <output data-testid="baked" className="block mt-4 text-sm text-ink-50">
          <span data-testid="baked-size">{baked.size}</span>
          <span data-testid="baked-pixel">{baked.pixel}</span>
          <span data-testid="baked-gps">{baked.gps}</span>
          <span data-testid="baked-type">{baked.type}</span>
        </output>
      )}
    </div>
  );
}
