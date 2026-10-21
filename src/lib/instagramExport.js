/**
 * Read an Instagram "Download your information" export in JSON form.
 * Accepts the current posts_1.json shape and the older media.json photos list.
 * HTML exports are ignored. Stories, reels, and messages are not posts.
 */

import { hashString } from './utils.js';
import { plainText } from './text.js';
import { MAX_ALBUM_PHOTOS, MAX_CAPTION_LENGTH, MAX_TEXT_LENGTH } from './vocab.js';

const IMAGE_EXT = /\.(jpe?g|png|gif|webp)$/i;
const VIDEO_EXT = /\.(mp4|mov|m4v|webm)$/i;
const POSTS_FILE = /^(posts_\d+|archived_posts|posts|media)\.json$/i;

export function yieldToMain() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/**
 * Instagram sometimes stores UTF-8 bytes as if they were Latin-1.
 * Text that is already Unicode is left alone.
 */
export function decodeInstagramText(value) {
  const text = String(value ?? '');
  if (!text) return '';
  for (const char of text) {
    if (char.codePointAt(0) > 255) return text;
  }
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) bytes[index] = text.charCodeAt(index);
  try {
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return decoded === text ? text : decoded;
  } catch {
    return text;
  }
}

export function instagramTime(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'number' || /^\d+$/.test(String(value))) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return '';
    const ms = number > 1e12 ? number : number * 1000;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString();
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

export function isInstagramPostsFile(path) {
  const name = String(path || '').split('/').pop() || '';
  return POSTS_FILE.test(name);
}

export function isImagePath(path) {
  return IMAGE_EXT.test(String(path || ''));
}

export function isVideoPath(path) {
  return VIDEO_EXT.test(String(path || ''));
}

export function instagramSourceKey(createdAt, images) {
  const basis = `${createdAt}|${[...images].sort().join('|')}`;
  return `instagram:${hashString(basis)}`;
}

function clip(value, max) {
  const text = plainText(decodeInstagramText(value));
  return { text: text.slice(0, max), shortened: text.length > max };
}

function mediaUri(entry) {
  if (!entry || typeof entry !== 'object') return '';
  return String(entry.uri || entry.path || '').replaceAll('\\', '/').replace(/^\/+/, '');
}

/**
 * One Instagram post can become more than one Podsta post when it has over ten photos.
 * The key stays stable across exports so a second import skips it.
 */
export function postsFromInstagramItem(item, sourceFile = '') {
  if (!item || typeof item !== 'object') return [];
  const media = Array.isArray(item.media) ? item.media : [];
  const images = [];
  let videos = 0;
  let other = 0;
  for (const entry of media) {
    const uri = mediaUri(entry);
    if (!uri) continue;
    if (isVideoPath(uri)) {
      videos += 1;
      continue;
    }
    if (isImagePath(uri)) images.push(uri);
    else other += 1;
  }
  if (!images.length && isImagePath(item.path)) images.push(String(item.path).replaceAll('\\', '/'));
  const rawCaption = item.title || item.caption || '';
  const createdAt =
    instagramTime(item.creation_timestamp) ||
    instagramTime(item.taken_at) ||
    instagramTime(media[0]?.creation_timestamp) ||
    '';
  if (!images.length) {
    if (videos || other || !String(rawCaption || '').trim()) return [];
    const body = clip(rawCaption, MAX_TEXT_LENGTH);
    return [
      {
        key: instagramSourceKey(createdAt, [plainText(decodeInstagramText(rawCaption)).slice(0, 80)]),
        createdAt,
        caption: body.text,
        images: [],
        archived: /archived/i.test(sourceFile),
        shortened: body.shortened,
        videos,
        parts: 1,
        part: 1,
      },
    ];
  }
  const caption = clip(rawCaption, MAX_CAPTION_LENGTH);
  const base = instagramSourceKey(createdAt, images);
  const parts = [];
  for (let index = 0; index < images.length; index += MAX_ALBUM_PHOTOS) {
    parts.push(images.slice(index, index + MAX_ALBUM_PHOTOS));
  }
  return parts.map((group, index) => ({
    key: index === 0 ? base : `${base}#${index + 1}`,
    createdAt,
    caption: caption.text,
    images: group,
    archived: /archived/i.test(sourceFile),
    shortened: caption.shortened,
    videos,
    parts: parts.length,
    part: index + 1,
  }));
}

function itemsFromJson(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  if (Array.isArray(data.photos)) {
    return data.photos.map((photo) => ({
      caption: photo?.caption,
      taken_at: photo?.taken_at,
      creation_timestamp: photo?.creation_timestamp,
      path: photo?.path,
      media: photo?.path ? [{ uri: photo.path }] : photo?.media,
    }));
  }
  if (Array.isArray(data.posts)) return data.posts;
  return [];
}

export function extractInstagramPosts(data, sourceFile = '') {
  return itemsFromJson(data).flatMap((item) => postsFromInstagramItem(item, sourceFile));
}

export function resolveExportPath(paths, uri) {
  const needle = String(uri || '').replaceAll('\\', '/').replace(/^\/+/, '');
  if (!needle || needle.split('/').includes('..')) return '';
  if (paths.has(needle)) return needle;
  let best = '';
  for (const path of paths) {
    if (path === needle || path.endsWith(`/${needle}`)) {
      if (!best || path.length < best.length) best = path;
    }
  }
  return best;
}

export function dedupeInstagramPosts(posts) {
  const seen = new Set();
  const out = [];
  for (const post of posts) {
    if (!post?.key || seen.has(post.key)) continue;
    seen.add(post.key);
    out.push(post);
  }
  return out;
}

/**
 * List post metadata. Photo bytes are not read here.
 * `pause` runs every few posts so a long export can paint and take input.
 */
export async function scanInstagramExport(fs, { pause = yieldToMain, yieldEvery = 20 } = {}) {
  const listing = await fs.list();
  const jsonPaths = listing.map((entry) => entry.path).filter(isInstagramPostsFile).sort();
  const posts = [];
  for (const path of jsonPaths) {
    await pause();
    let data;
    try {
      const bytes = await fs.read(path);
      data = JSON.parse(new TextDecoder('utf-8').decode(bytes));
    } catch {
      continue;
    }
    const found = extractInstagramPosts(data, path);
    for (let index = 0; index < found.length; index += 1) {
      posts.push(found[index]);
      if ((index + 1) % yieldEvery === 0) await pause();
    }
  }
  const unique = dedupeInstagramPosts(posts);
  const paths = new Set(listing.map((entry) => entry.path));
  return unique.map((post) => {
    const images = post.images.map((uri) => ({ uri, path: resolveExportPath(paths, uri) }));
    const found = images.filter((image) => image.path);
    return {
      ...post,
      images: found,
      missing: images.length - found.length,
      importable: found.length > 0 || (post.images.length === 0 && Boolean(post.caption)),
    };
  });
}

export function openFileList(fileList) {
  const files = [];
  for (const file of fileList || []) {
    const path = String(file.webkitRelativePath || file.name || '').replaceAll('\\', '/');
    if (!path || path.split('/').includes('..')) continue;
    files.push({ path, file });
  }
  return {
    kind: 'folder',
    async list() {
      return files.map((entry) => ({ path: entry.path, size: entry.file.size }));
    },
    async read(path) {
      const found = files.find((entry) => entry.path === path);
      if (!found) throw new Error('That file is not in the folder.');
      return new Uint8Array(await found.file.arrayBuffer());
    },
  };
}

export function fileFromExportBytes(path, bytes) {
  const name = String(path || 'photo.jpg').split('/').pop() || 'photo.jpg';
  const lower = name.toLowerCase();
  let type = 'application/octet-stream';
  if (lower.endsWith('.png')) type = 'image/png';
  else if (lower.endsWith('.gif')) type = 'image/gif';
  else if (lower.endsWith('.webp')) type = 'image/webp';
  else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) type = 'image/jpeg';
  return new File([bytes], name, { type });
}
