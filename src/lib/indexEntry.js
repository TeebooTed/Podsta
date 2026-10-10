import { photoUrls } from './album.js';

/**
 * Denormalized public-index fields. Empty caption and title are kept so an edit
 * can clear a value that friends would otherwise keep seeing.
 * Image URLs are repeated so a multi-photo post can render without a second fetch.
 */
export function publicIndexEntryFromPost(post, changes = {}) {
  const title = changes.title !== undefined ? changes.title : post.title || '';
  const caption = changes.caption !== undefined ? changes.caption : post.caption || '';
  const body = changes.body !== undefined ? changes.body : post.body || '';
  return {
    url: post.url,
    type: post.type,
    dateCreated: post.dateCreated || new Date(0).toISOString(),
    title: post.type === 'text' ? String(title || '') : '',
    caption: post.type === 'photo' ? String(caption || '') : String(body || '').slice(0, 200),
    images: post.type === 'photo' ? photoUrls(post) : [],
  };
}
