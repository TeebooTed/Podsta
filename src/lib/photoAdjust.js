/**
 * Crop and rotate happen in the browser, before the bytes are uploaded.
 * The controls are buttons and a slider. The canvas result is what the Pod stores.
 */

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeRotation(rotation) {
  const turns = Number(rotation) || 0;
  return ((turns % 360) + 360) % 360;
}

export function isIdentityAdjust(adjust) {
  if (!adjust) return true;
  return (
    normalizeRotation(adjust.rotation) === 0 &&
    (Number(adjust.zoom) || 1) <= 1 &&
    !Number(adjust.panX) &&
    !Number(adjust.panY)
  );
}

export function rotatedSize(width, height, rotation) {
  const turns = normalizeRotation(rotation);
  if (turns % 180 === 0) return { width, height };
  return { width: height, height: width };
}

/**
 * Crop rectangle in the rotated image, in pixels.
 * Zoom 1 is the whole frame. Pan is -1 to 1 across the spare margin.
 */
export function cropRect({ width, height, rotation = 0, zoom = 1, panX = 0, panY = 0 }) {
  const size = rotatedSize(width, height, rotation);
  const z = clamp(Number(zoom) || 1, 1, 4);
  const sw = size.width / z;
  const sh = size.height / z;
  const spareX = (size.width - sw) / 2;
  const spareY = (size.height - sh) / 2;
  const sx = spareX + clamp(Number(panX) || 0, -1, 1) * spareX;
  const sy = spareY + clamp(Number(panY) || 0, -1, 1) * spareY;
  return {
    sx,
    sy,
    sw,
    sh,
    destWidth: Math.max(1, Math.round(sw)),
    destHeight: Math.max(1, Math.round(sh)),
  };
}

function drawRotated(ctx, bitmap, rotation) {
  const size = rotatedSize(bitmap.width, bitmap.height, rotation);
  ctx.save();
  ctx.translate(size.width / 2, size.height / 2);
  ctx.rotate((normalizeRotation(rotation) * Math.PI) / 180);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  ctx.restore();
}

export async function renderAdjustedPhoto(file, adjust) {
  if (!file) throw new Error('Choose a photo first');
  if (isIdentityAdjust(adjust)) return file;
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') {
    throw new Error('Crop needs a browser');
  }

  const bitmap = await createImageBitmap(file);
  try {
    const size = rotatedSize(bitmap.width, bitmap.height, adjust.rotation);
    const rotated = document.createElement('canvas');
    rotated.width = size.width;
    rotated.height = size.height;
    drawRotated(rotated.getContext('2d'), bitmap, adjust.rotation);

    const frame = cropRect({
      width: bitmap.width,
      height: bitmap.height,
      rotation: adjust.rotation,
      zoom: adjust.zoom,
      panX: adjust.panX,
      panY: adjust.panY,
    });
    const canvas = document.createElement('canvas');
    canvas.width = frame.destWidth;
    canvas.height = frame.destHeight;
    canvas.getContext('2d').drawImage(
      rotated,
      frame.sx,
      frame.sy,
      frame.sw,
      frame.sh,
      0,
      0,
      frame.destWidth,
      frame.destHeight,
    );

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) resolve(result);
        else reject(new Error('Could not prepare that photo'));
      }, 'image/jpeg', 0.92);
    });
    const base = (file.name || 'photo').replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } finally {
    bitmap.close?.();
  }
}
