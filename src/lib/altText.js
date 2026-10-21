import { MAX_ALT_LENGTH } from './vocab.js';

/**
 * Alt text describes one photo for someone who cannot see it.
 * It is stored with the photo and uses the same audience. It is not a copy
 * in a more open file. An empty description is omitted.
 */

const SEP = '\u001f';

export function cleanAlt(value) {
  return String(value || '')
    .replace(/[\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_ALT_LENGTH);
}

export function packImageAlt(url, alt) {
  const text = cleanAlt(alt);
  if (!url || !text) return '';
  return `${url}${SEP}${text}`;
}

export function unpackImageAlts(values) {
  const alts = [];
  for (const value of values || []) {
    const raw = String(value || '');
    const at = raw.indexOf(SEP);
    if (at < 1) continue;
    const url = raw.slice(0, at);
    const alt = cleanAlt(raw.slice(at + SEP.length));
    if (!alt) continue;
    alts.push({ url, alt });
  }
  return alts;
}

export function altForPhoto(post, url, index = 0) {
  const list = Array.isArray(post?.alts) ? post.alts : [];
  const found = list.find((item) => item?.url === url && item.alt);
  if (found) return found.alt;
  const sameIndex = list[index];
  if (sameIndex && !sameIndex.url && sameIndex.alt) return sameIndex.alt;
  return '';
}

export function altList(post, urls) {
  return (urls || []).map((url, index) => altForPhoto(post, url, index));
}

export function altsForImages(urls, texts) {
  return (urls || [])
    .map((url, index) => {
      const alt = cleanAlt(Array.isArray(texts) ? texts[index] : '');
      return alt ? { url, alt } : null;
    })
    .filter(Boolean);
}

/** Keep descriptions that belong to the photos still on the post, in photo order. */
export function altsAligned(urls, alts) {
  return (urls || [])
    .map((url) => {
      const found = (alts || []).find((item) => item?.url === url);
      const alt = cleanAlt(found?.alt || '');
      return alt ? { url, alt } : null;
    })
    .filter(Boolean);
}
