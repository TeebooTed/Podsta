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

/** Longest side of a photo stored on the Pod. Larger camera files are scaled down. */
export const MAX_IMAGE_EDGE = 2048;
/** Feed and profile tiles use this derivative. The viewer still opens the full photo. */
export const THUMB_EDGE = 640;

export function fittedSize(width, height, maxEdge) {
  const w = Math.max(1, Math.round(Number(width) || 1));
  const h = Math.max(1, Math.round(Number(height) || 1));
  const edge = Math.max(w, h);
  const limit = Math.max(1, Number(maxEdge) || edge);
  if (edge <= limit) return { width: w, height: h };
  const scale = limit / edge;
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error('Could not prepare that photo'));
      },
      type,
      quality,
    );
  });
}

function drawPrepared(bitmap, adjust, maxEdge) {
  const rotation = adjust?.rotation || 0;
  const size = rotatedSize(bitmap.width, bitmap.height, rotation);
  const rotated = document.createElement('canvas');
  rotated.width = size.width;
  rotated.height = size.height;
  drawRotated(rotated.getContext('2d'), bitmap, rotation);

  const frame = cropRect({
    width: bitmap.width,
    height: bitmap.height,
    rotation,
    zoom: adjust?.zoom,
    panX: adjust?.panX,
    panY: adjust?.panY,
  });
  const fitted = fittedSize(frame.destWidth, frame.destHeight, maxEdge);
  const canvas = document.createElement('canvas');
  canvas.width = fitted.width;
  canvas.height = fitted.height;
  canvas.getContext('2d').drawImage(
    rotated,
    frame.sx,
    frame.sy,
    frame.sw,
    frame.sh,
    0,
    0,
    fitted.width,
    fitted.height,
  );
  return canvas;
}

function outputType(file) {
  if (file?.type === 'image/png') return 'image/png';
  if (file?.type === 'image/webp') return 'image/webp';
  return 'image/jpeg';
}

function extensionFor(type) {
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  return 'jpg';
}

/**
 * Resize, strip camera metadata by re-encoding, and build a JPEG thumbnail.
 * An untouched GIF that already fits stays a GIF so the animation survives.
 * The thumbnail is still a JPEG, so the feed does not need the original bytes.
 */
export async function preparePhoto(file, adjust) {
  if (!file) throw new Error('Choose a photo first');
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') {
    return { file, thumbnail: null };
  }
  const bitmap = await createImageBitmap(file);
  try {
    const identity = isIdentityAdjust(adjust);
    const gif = file.type === 'image/gif';
    const oriented = rotatedSize(bitmap.width, bitmap.height, adjust?.rotation);
    const fits = Math.max(oriented.width, oriented.height) <= MAX_IMAGE_EDGE;
    const base = (file.name || 'photo').replace(/\.[^.]+$/, '') || 'photo';
    let full = file;
    if (!(gif && identity && fits)) {
      const fullCanvas = drawPrepared(bitmap, adjust, MAX_IMAGE_EDGE);
      const type = outputType(file);
      const blob = await canvasToBlob(fullCanvas, type, type === 'image/png' ? undefined : 0.85);
      full = new File([blob], `${base}.${extensionFor(type)}`, { type, lastModified: Date.now() });
    }
    const thumbCanvas = drawPrepared(bitmap, adjust, THUMB_EDGE);
    const thumbBlob = await canvasToBlob(thumbCanvas, 'image/jpeg', 0.8);
    const thumbnail = new File([thumbBlob], `${base}.thumb.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
    return { file: full, thumbnail };
  } finally {
    bitmap.close?.();
  }
}
