import { photoUrls } from './album.js';
import { plainText } from './text.js';
import { hashtagsIn } from './hashtags.js';
import { altsAligned } from './altText.js';

/**
 * Denormalized public-index fields. Empty caption and title are kept so an edit
 * can clear a value that friends would otherwise keep seeing.
 * Image URLs are repeated so a multi-photo post can render without a second fetch.
 */
export function publicIndexEntryFromPost(post, changes = {}) {
  const title = changes.title !== undefined ? changes.title : post.title || '';
  const caption = changes.caption !== undefined ? changes.caption : post.caption || '';
  const body = changes.body !== undefined ? changes.body : post.body || '';
  const tagSource = post.type === 'photo' ? String(caption || '') : `${title}\n${body}`;
  return {
    url: post.url,
    type: post.type,
    dateCreated: post.dateCreated || new Date(0).toISOString(),
    title: post.type === 'text' ? plainText(title || '') : '',
    caption: post.type === 'photo' ? plainText(caption || '') : plainText(body || '').slice(0, 200),
    images: post.type === 'photo' ? photoUrls(post) : [],
    thumbnails: post.type === 'photo' ? (Array.isArray(post.thumbnails) ? post.thumbnails.filter(Boolean) : []) : [],
    tags: hashtagsIn(tagSource),
    alts: post.type === 'photo' ? altsAligned(photoUrls(post), post.alts) : [],
  };
}
