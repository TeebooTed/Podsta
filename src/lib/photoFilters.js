/**
 * One-tap looks for a photo, applied in the browser before upload.
 * The same CSS filter string is used for the live preview and the canvas bake,
 * so the thumbnail, the large preview, and the file in the pod match.
 * Names are the brand colours. "As shot" leaves the pixels alone.
 */

export const AS_SHOT = 'as-shot';

export const LOOKS = [
  { id: 'as-shot', name: 'As shot', css: '' },
  { id: 'cream', name: 'Cream', css: 'brightness(1.05) contrast(0.94) saturate(0.86) sepia(0.2)' },
  { id: 'sunshine', name: 'Sunshine', css: 'sepia(0.32) saturate(1.3) brightness(1.08) contrast(1.04) hue-rotate(-10deg)' },
  { id: 'coral', name: 'Coral', css: 'sepia(0.25) saturate(1.45) hue-rotate(-18deg) contrast(1.06) brightness(1.04)' },
  { id: 'berry', name: 'Berry', css: 'sepia(0.2) hue-rotate(-32deg) saturate(1.28) contrast(1.08) brightness(0.98)' },
  { id: 'plum', name: 'Plum', css: 'contrast(1.12) saturate(0.7) brightness(0.9) sepia(0.28) hue-rotate(-38deg)' },
  { id: 'mint', name: 'Mint', css: 'sepia(0.14) hue-rotate(78deg) saturate(0.92) brightness(1.06) contrast(0.96)' },
  { id: 'soft', name: 'Soft', css: 'contrast(0.84) brightness(1.1) saturate(0.75) sepia(0.08)' },
];

export const SHAPE_ORIGINAL = 'original';
export const SHAPE_SQUARE = 'square';
export const SHAPE_PORTRAIT = 'portrait';

export const SHAPES = [
  { id: SHAPE_ORIGINAL, name: 'Original' },
  { id: SHAPE_SQUARE, name: 'Square' },
  { id: SHAPE_PORTRAIT, name: '4:5' },
];

function clamp(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(max, Math.max(min, number));
}

function format(value) {
  return String(Math.round(value * 1000) / 1000);
}

export function lookById(id) {
  return LOOKS.find((look) => look.id === id) || LOOKS[0];
}

/** Width / height. Null keeps the photo's own shape. */
export function shapeRatio(shape) {
  if (shape === SHAPE_SQUARE) return 1;
  if (shape === SHAPE_PORTRAIT) return 4 / 5;
  return null;
}

/**
 * Brightness is -0.4 to 0.4 (the slider shows -40 to 40).
 * Warmth is -1 (cool) to 1 (warm).
 */
export function cssFilterFor(adjust) {
  const look = lookById(adjust?.filter);
  const parts = [];
  if (look.css) parts.push(look.css);
  const brightness = clamp(adjust?.brightness, -0.4, 0.4);
  const warmth = clamp(adjust?.warmth, -1, 1);
  if (Math.abs(brightness) >= 0.001) parts.push(`brightness(${format(1 + brightness)})`);
  if (warmth >= 0.001) {
    parts.push(`sepia(${format(0.35 * warmth)})`);
    parts.push(`hue-rotate(${format(-14 * warmth)}deg)`);
    parts.push(`saturate(${format(1 + 0.3 * warmth)})`);
  } else if (warmth <= -0.001) {
    const cool = -warmth;
    parts.push(`hue-rotate(${format(22 * cool)}deg)`);
    parts.push(`saturate(${format(Math.max(0, 1 - 0.18 * cool))})`);
  }
  return parts.join(' ');
}

export function isNeutralLook(adjust) {
  if (!adjust) return true;
  if ((adjust.filter || AS_SHOT) !== AS_SHOT) return false;
  return cssFilterFor({ filter: AS_SHOT, brightness: adjust.brightness, warmth: adjust.warmth }) === '';
}
