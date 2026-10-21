/**
 * Crop, rotate, and looks happen in the browser, before the bytes are uploaded.
 * The canvas result is what the Pod stores. Redrawing also drops camera location.
 */

import { cssFilterFor, isNeutralLook, shapeRatio } from './photoFilters.js';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeRotation(rotation) {
  const turns = Number(rotation) || 0;
  return ((turns % 360) + 360) % 360;
}

export function isIdentityFraming(adjust) {
  if (!adjust) return true;
  return (
    normalizeRotation(adjust.rotation) === 0 &&
    (Number(adjust.zoom) || 1) <= 1 &&
    !Number(adjust.panX) &&
    !Number(adjust.panY) &&
    shapeRatio(adjust.shape) == null
  );
}

export function isIdentityAdjust(adjust) {
  return isIdentityFraming(adjust) && isNeutralLook(adjust);
}

export function rotatedSize(width, height, rotation) {
  const turns = normalizeRotation(rotation);
  if (turns % 180 === 0) return { width, height };
  return { width: height, height: width };
}

/**
 * Crop rectangle in the rotated image, in pixels.
 * Zoom 1 is the whole frame, or the largest square or 4:5 that fits.
 * Pan is -1 to 1 across the spare margin.
 */
export function cropRect({ width, height, rotation = 0, zoom = 1, panX = 0, panY = 0, shape = 'original' }) {
  const size = rotatedSize(width, height, rotation);
  const ratio = shapeRatio(shape);
  let baseWidth = size.width;
  let baseHeight = size.height;
  if (ratio) {
    const imageRatio = size.width / size.height;
    if (imageRatio > ratio) {
      baseHeight = size.height;
      baseWidth = size.height * ratio;
    } else {
      baseWidth = size.width;
      baseHeight = size.width / ratio;
    }
  }
  const z = clamp(Number(zoom) || 1, 1, 4);
  const sw = baseWidth / z;
  const sh = baseHeight / z;
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

function drawRotated(ctx, source, width, height, rotation) {
  const size = rotatedSize(width, height, rotation);
  ctx.save();
  ctx.translate(size.width / 2, size.height / 2);
  ctx.rotate((normalizeRotation(rotation) * Math.PI) / 180);
  ctx.drawImage(source, -width / 2, -height / 2);
  ctx.restore();
}

/**
 * JPEG/WebP/PNG orientation, 1–8. Missing or unreadable tags are 1 (upright).
 * The stored file is redrawn, so this value is baked into pixels and the
 * original EXIF, including GPS, is not uploaded.
 */
export function readImageOrientation(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  const jpeg = jpegOrientation(data);
  if (jpeg) return jpeg;
  return exifOrientationNear(data) || 1;
}

export function uprightSize(width, height, orientation) {
  const value = Number(orientation) || 1;
  if (value >= 5 && value <= 8) return { width: height, height: width };
  return { width, height };
}

function jpegOrientation(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return 0;
  let offset = 2;
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) return 0;
    const marker = bytes[offset + 1];
    if (marker === 0xda || marker === 0xd9) return 0;
    const size = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (size < 2) return 0;
    if (marker === 0xe1) {
      const start = offset + 4;
      const found = orientationFromExif(bytes, start, start + size - 2);
      if (found) return found;
    }
    offset += 2 + size;
  }
  return 0;
}

function exifOrientationNear(bytes) {
  const limit = Math.min(bytes.length - 6, 65536);
  for (let index = 0; index < limit; index += 1) {
    if (bytes[index] !== 0x45 || bytes[index + 1] !== 0x78) continue;
    if (bytes[index + 2] !== 0x69 || bytes[index + 3] !== 0x66) continue;
    const found = orientationFromExif(bytes, index, Math.min(bytes.length, index + 65536));
    if (found) return found;
  }
  return 0;
}

function orientationFromExif(bytes, start, end) {
  if (end - start < 14) return 0;
  if (bytes[start] !== 0x45 || bytes[start + 1] !== 0x78 || bytes[start + 2] !== 0x69 || bytes[start + 3] !== 0x66) {
    return 0;
  }
  const tiff = start + 6;
  if (tiff + 8 > end) return 0;
  const little = bytes[tiff] === 0x49 && bytes[tiff + 1] === 0x49;
  const big = bytes[tiff] === 0x4d && bytes[tiff + 1] === 0x4d;
  if (!little && !big) return 0;
  const u16 = (offset) => (little ? bytes[offset] | (bytes[offset + 1] << 8) : (bytes[offset] << 8) | bytes[offset + 1]);
  const u32 = (offset) => {
    const b0 = bytes[offset];
    const b1 = bytes[offset + 1];
    const b2 = bytes[offset + 2];
    const b3 = bytes[offset + 3];
    return little ? (b0 | (b1 << 8) | (b2 << 16) | (b3 << 24)) >>> 0 : ((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) >>> 0;
  };
  if (u16(tiff + 2) !== 42) return 0;
  const ifd = tiff + u32(tiff + 4);
  if (ifd < start || ifd + 2 > end) return 0;
  const count = u16(ifd);
  for (let index = 0; index < count; index += 1) {
    const entry = ifd + 2 + index * 12;
    if (entry + 12 > end) return 0;
    if (u16(entry) !== 0x0112) continue;
    const value = u16(entry + 8);
    return value >= 1 && value <= 8 ? value : 1;
  }
  return 0;
}

function applyOrientation(ctx, orientation, width, height) {
  switch (Number(orientation) || 1) {
    case 2:
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
      break;
    case 3:
      ctx.translate(width, height);
      ctx.rotate(Math.PI);
      break;
    case 4:
      ctx.translate(0, height);
      ctx.scale(1, -1);
      break;
    case 5:
      ctx.rotate(Math.PI / 2);
      ctx.scale(1, -1);
      break;
    case 6:
      ctx.rotate(Math.PI / 2);
      ctx.translate(0, -height);
      break;
    case 7:
      ctx.rotate(Math.PI / 2);
      ctx.translate(width, -height);
      ctx.scale(-1, 1);
      break;
    case 8:
      ctx.rotate(-Math.PI / 2);
      ctx.translate(-width, 0);
      break;
    default:
      break;
  }
}

async function decodeUpright(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const orientation = readImageOrientation(bytes);
  let bitmap;
  let honor = orientation;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'none' });
  } catch {
    bitmap = await createImageBitmap(file);
    honor = 1;
  }
  if ((Number(honor) || 1) <= 1) {
    return { source: bitmap, width: bitmap.width, height: bitmap.height, bitmap };
  }
  const size = uprightSize(bitmap.width, bitmap.height, honor);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  applyOrientation(ctx, honor, bitmap.width, bitmap.height);
  ctx.drawImage(bitmap, 0, 0);
  return { source: canvas, width: size.width, height: size.height, bitmap };
}

export async function renderAdjustedPhoto(file, adjust) {
  if (!file) throw new Error('Choose a photo first');
  if (isIdentityAdjust(adjust)) return file;
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') {
    throw new Error('Crop needs a browser');
  }

  const decoded = await decodeUpright(file);
  try {
    const canvas = drawPrepared(
      decoded.source,
      decoded.width,
      decoded.height,
      adjust,
      Math.max(decoded.width, decoded.height),
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
    decoded.bitmap.close?.();
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

function drawPrepared(source, width, height, adjust, maxEdge) {
  const rotation = adjust?.rotation || 0;
  const size = rotatedSize(width, height, rotation);
  const rotated = document.createElement('canvas');
  rotated.width = size.width;
  rotated.height = size.height;
  drawRotated(rotated.getContext('2d'), source, width, height, rotation);

  const frame = cropRect({
    width,
    height,
    rotation,
    zoom: adjust?.zoom,
    panX: adjust?.panX,
    panY: adjust?.panY,
    shape: adjust?.shape,
  });
  const fitted = fittedSize(frame.destWidth, frame.destHeight, maxEdge);
  const canvas = document.createElement('canvas');
  canvas.width = fitted.width;
  canvas.height = fitted.height;
  const ctx = canvas.getContext('2d');
  const filter = cssFilterFor(adjust);
  if (filter) ctx.filter = filter;
  ctx.drawImage(rotated, frame.sx, frame.sy, frame.sw, frame.sh, 0, 0, fitted.width, fitted.height);
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
 * Resize, bake the camera orientation into the pixels, and drop EXIF/GPS by
 * re-encoding. An untouched GIF that already fits stays a GIF so the animation
 * survives. The thumbnail is still a JPEG, so the feed does not need the original.
 */
export async function preparePhoto(file, adjust) {
  if (!file) throw new Error('Choose a photo first');
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') {
    return { file, thumbnail: null };
  }
  const decoded = await decodeUpright(file);
  try {
    const identity = isIdentityAdjust(adjust);
    const gif = file.type === 'image/gif';
    const oriented = rotatedSize(decoded.width, decoded.height, adjust?.rotation);
    const fits = Math.max(oriented.width, oriented.height) <= MAX_IMAGE_EDGE;
    const base = (file.name || 'photo').replace(/\.[^.]+$/, '') || 'photo';
    let full = file;
    if (!(gif && identity && fits)) {
      const fullCanvas = drawPrepared(decoded.source, decoded.width, decoded.height, adjust, MAX_IMAGE_EDGE);
      const type = outputType(file);
      const blob = await canvasToBlob(fullCanvas, type, type === 'image/png' ? undefined : 0.85);
      full = new File([blob], `${base}.${extensionFor(type)}`, { type, lastModified: Date.now() });
    }
    const thumbCanvas = drawPrepared(decoded.source, decoded.width, decoded.height, adjust, THUMB_EDGE);
    const thumbBlob = await canvasToBlob(thumbCanvas, 'image/jpeg', 0.8);
    const thumbnail = new File([thumbBlob], `${base}.thumb.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
    return { file: full, thumbnail };
  } finally {
    decoded.bitmap.close?.();
  }
}
