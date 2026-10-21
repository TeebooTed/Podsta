/**
 * A multi-photo post is one Turtle file in the author's Pod.
 * Each image is a separate file. The audience rules apply to the Turtle and every image.
 * Other people do not write into this Pod.
 */

import { safeHttpUrl } from './urls.js';

const IMAGE_EXT = /\.(jpe?g|png|gif|webp)(\?|#|$)/i;

function httpUrls(values) {
  if (!Array.isArray(values)) return [];
  return values.map((value) => safeHttpUrl(value)).filter(Boolean);
}

export function isAlbumPost(post) {
  return post?.type === 'photo' && typeof post.url === 'string' && post.url.endsWith('.ttl');
}

export function photoUrls(post) {
  if (!post || post.type !== 'photo') return [];
  if (Array.isArray(post.images) && post.images.length) return httpUrls(post.images);
  const direct = safeHttpUrl(post.mediaUrl || post.url || '');
  if (direct && IMAGE_EXT.test(direct)) return [direct];
  return [];
}

/** Feed and grid tiles. Falls back to the full photo when no thumbnail was stored. */
export function cardPhotoUrls(post) {
  const thumbs = httpUrls(post?.thumbnails);
  if (thumbs.length) return thumbs;
  return photoUrls(post);
}

export function primaryPhotoUrl(post) {
  return photoUrls(post)[0] || '';
}

/** Files the audience change must cover. An older single photo also has a caption sidecar. */
export function audienceResourceUrls(post) {
  if (!post?.url) return [];
  if (post.type !== 'photo') return [post.url];
  if (isAlbumPost(post)) return [post.url, ...photoUrls(post), ...httpUrls(post.thumbnails)];
  return [post.url, `${post.url}.meta`];
}
