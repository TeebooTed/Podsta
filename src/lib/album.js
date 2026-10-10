/**
 * A multi-photo post is one Turtle file in the author's Pod.
 * Each image is a separate file. The audience rules apply to the Turtle and every image.
 * Other people do not write into this Pod.
 */

const IMAGE_EXT = /\.(jpe?g|png|gif|webp)(\?|#|$)/i;

export function isAlbumPost(post) {
  return post?.type === 'photo' && typeof post.url === 'string' && post.url.endsWith('.ttl');
}

export function photoUrls(post) {
  if (!post || post.type !== 'photo') return [];
  if (Array.isArray(post.images) && post.images.length) return post.images.filter(Boolean);
  const direct = post.mediaUrl || post.url || '';
  if (IMAGE_EXT.test(direct)) return [direct];
  return [];
}

export function primaryPhotoUrl(post) {
  return photoUrls(post)[0] || '';
}

/** Files the audience change must cover. An older single photo also has a caption sidecar. */
export function audienceResourceUrls(post) {
  if (!post?.url) return [];
  if (post.type !== 'photo') return [post.url];
  if (isAlbumPost(post)) return [post.url, ...photoUrls(post)];
  return [post.url, `${post.url}.meta`];
}
