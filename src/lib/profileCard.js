import QRCode from 'qrcode';
import markUrl from '../assets/podsta-mark.svg';
import { wrapLines } from './wrapLines.js';

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

const PLUM = '#2B1B3D';
const CREAM = '#FFF7EE';
const BERRY = '#E8457A';
const CORAL = '#FF6B57';
const CORAL_LIGHT = '#FF8A73';
const SUNSHINE = '#FFC547';
const MINT_SOFT = '#C9F4E6';
const PEACH = '#FFE9D9';
const DISPLAY = '"Fredoka Variable", Fredoka, ui-rounded, system-ui, sans-serif';
const TEXT = '"Nunito Variable", Nunito, ui-rounded, system-ui, sans-serif';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image did not load'));
    img.src = src;
  });
}

/** Pod images go through the session fetch, so the canvas stays exportable. */
async function loadPodImage(url, fetchFn) {
  if (!url) return null;
  try {
    const res = await (fetchFn || fetch)(url);
    if (!res.ok) return null;
    const objectUrl = URL.createObjectURL(await res.blob());
    try {
      return await loadImage(objectUrl);
    } finally {
      setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    }
  } catch {
    return null;
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function circle(ctx, x, y, r, color) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawCover(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
}

function initialsOf(name) {
  const parts = String(name || '?')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return (
    parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] || '?').slice(0, 2)
  ).toUpperCase();
}

async function ensureFonts(sample) {
  if (typeof document === 'undefined' || !document.fonts?.load) return;
  await Promise.all([
    document.fonts.load(`600 64px ${DISPLAY}`, sample),
    document.fonts.load(`800 30px ${TEXT}`, sample),
    document.fonts.load(`600 26px ${TEXT}`, sample),
  ]).catch(() => {});
}

/**
 * Draws a 1200×630 profile card in the brand style: cover, avatar, name, short name,
 * bio and a QR code that opens the invite link. Resolves to a PNG blob.
 */
export async function drawProfileCard({
  name,
  handle,
  bio,
  avatarUrl,
  coverUrl,
  inviteUrl,
  fetchFn,
}) {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  const title = name || handle || 'On Podsta';

  const [cover, avatar, mark, qr] = await Promise.all([
    loadPodImage(coverUrl, fetchFn),
    loadPodImage(avatarUrl, fetchFn),
    loadImage(markUrl).catch(() => null),
    QRCode.toDataURL(inviteUrl, {
      margin: 0,
      width: 560,
      color: { dark: PLUM, light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    }).then(loadImage),
    ensureFonts(`${title}${handle}${bio}podsta`),
  ]);

  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  circle(ctx, -40, -60, 240, PEACH);
  circle(ctx, 1180, 690, 230, MINT_SOFT);
  circle(ctx, 1132, 74, 40, SUNSHINE);

  const coverBox = { x: 56, y: 56, w: 688, h: 236, r: 36 };
  ctx.save();
  roundRect(ctx, coverBox.x, coverBox.y, coverBox.w, coverBox.h, coverBox.r);
  ctx.clip();
  if (cover) {
    drawCover(ctx, cover, coverBox.x, coverBox.y, coverBox.w, coverBox.h);
  } else {
    const g = ctx.createLinearGradient(
      coverBox.x,
      coverBox.y,
      coverBox.x + coverBox.w,
      coverBox.y + coverBox.h,
    );
    g.addColorStop(0, CORAL_LIGHT);
    g.addColorStop(0.5, CORAL);
    g.addColorStop(1, BERRY);
    ctx.fillStyle = g;
    ctx.fillRect(coverBox.x, coverBox.y, coverBox.w, coverBox.h);
    circle(ctx, coverBox.x + 30, coverBox.y - 10, 120, 'rgba(255, 197, 71, 0.4)');
    circle(ctx, coverBox.x + 560, coverBox.y + 52, 14, SUNSHINE);
    circle(ctx, coverBox.x + 470, coverBox.y + 190, 9, '#3DD9A8');
    circle(ctx, coverBox.x + 300, coverBox.y + 44, 7, 'rgba(255, 247, 238, 0.85)');
    circle(ctx, coverBox.x + 690, coverBox.y + 250, 150, 'rgba(43, 27, 61, 0.12)');
  }
  ctx.restore();

  const av = { x: 136, y: 292, r: 84 };
  circle(ctx, av.x, av.y, av.r + 10, CREAM);
  ctx.save();
  ctx.beginPath();
  ctx.arc(av.x, av.y, av.r, 0, Math.PI * 2);
  ctx.clip();
  if (avatar) {
    drawCover(ctx, avatar, av.x - av.r, av.y - av.r, av.r * 2, av.r * 2);
  } else {
    const g = ctx.createLinearGradient(av.x - av.r, av.y - av.r, av.x + av.r, av.y + av.r);
    g.addColorStop(0, '#FF8A4C');
    g.addColorStop(1, CORAL);
    ctx.fillStyle = g;
    ctx.fillRect(av.x - av.r, av.y - av.r, av.r * 2, av.r * 2);
    ctx.fillStyle = PLUM;
    ctx.font = `600 64px ${DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initialsOf(title), av.x, av.y + 4);
  }
  ctx.restore();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const left = 64;
  const textWidth = 680;
  let size = 64;
  ctx.font = `600 ${size}px ${DISPLAY}`;
  while (size > 40 && ctx.measureText(title).width > textWidth) {
    size -= 4;
    ctx.font = `600 ${size}px ${DISPLAY}`;
  }
  ctx.fillStyle = PLUM;
  ctx.fillText(wrapLines(title, textWidth, 1, (t) => ctx.measureText(t).width)[0], left, 448);

  if (handle) {
    ctx.font = `800 30px ${TEXT}`;
    ctx.fillStyle = BERRY;
    ctx.fillText(wrapLines(handle, textWidth, 1, (t) => ctx.measureText(t).width)[0], left, 494);
  }
  if (bio) {
    ctx.font = `600 26px ${TEXT}`;
    ctx.fillStyle = 'rgba(43, 27, 61, 0.78)';
    wrapLines(bio, textWidth, 2, (t) => ctx.measureText(t).width).forEach((line, i) => {
      ctx.fillText(line, left, 540 + i * 34);
    });
  }

  const panel = { x: 800, y: 56, w: 344, h: 518, r: 40 };
  ctx.save();
  ctx.shadowColor = 'rgba(43, 27, 61, 0.18)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 16;
  roundRect(ctx, panel.x, panel.y, panel.w, panel.h, panel.r);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.restore();
  const qrSize = 264;
  const qrX = panel.x + (panel.w - qrSize) / 2;
  const qrY = panel.y + 40;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(qr, qrX, qrY, qrSize, qrSize);
  ctx.imageSmoothingEnabled = true;
  if (mark) {
    const m = 60;
    roundRect(ctx, qrX + (qrSize - m) / 2 - 6, qrY + (qrSize - m) / 2 - 6, m + 12, m + 12, 18);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.drawImage(mark, qrX + (qrSize - m) / 2, qrY + (qrSize - m) / 2, m, m);
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = PLUM;
  ctx.font = `600 36px ${DISPLAY}`;
  ctx.fillText('Scan to follow', panel.x + panel.w / 2, qrY + qrSize + 66);
  ctx.font = `800 22px ${TEXT}`;
  ctx.fillStyle = BERRY;
  ctx.fillText('Your photos. Your Pod.', panel.x + panel.w / 2, qrY + qrSize + 104);

  ctx.textAlign = 'left';
  if (mark) ctx.drawImage(mark, panel.x + 84, panel.y + panel.h - 72, 40, 40);
  ctx.font = `600 38px ${DISPLAY}`;
  ctx.fillStyle = PLUM;
  ctx.fillText('podsta', panel.x + 134, panel.y + panel.h - 40);

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Card did not draw'))),
      'image/png',
    ),
  );
}
