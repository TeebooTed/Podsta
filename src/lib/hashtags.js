/**
 * Hashtags are words inside a caption or a note.
 * A tag page only lists posts the viewer can already read: their own posts,
 * and index entries from people they follow. There is no central tag directory.
 * A tag on a private post is not written into a shared index.
 */

export const MAX_HASHTAGS = 8;
const TAG_PATTERN = /(^|[^\p{L}\p{N}_])#([\p{L}\p{N}_]{1,40})(?![\p{L}\p{N}_])/gu;

export function normalizeTag(value) {
  const raw = String(value || '').trim().replace(/^#+/, '');
  if (!/^[\p{L}\p{N}_]{1,40}$/u.test(raw)) return '';
  return raw.toLocaleLowerCase();
}

export function hashtagsIn(text) {
  const found = [];
  const source = String(text || '');
  for (const match of source.matchAll(TAG_PATTERN)) {
    const tag = normalizeTag(match[2]);
    if (!tag || found.includes(tag)) continue;
    found.push(tag);
    if (found.length >= MAX_HASHTAGS) break;
  }
  return found;
}

/** Stored keywords plus any tags still written in the text. Order is first-seen, capped. */
export function postTags(post) {
  const stored = Array.isArray(post?.tags) ? post.tags : [];
  const fromText = hashtagsIn([post?.title, post?.caption, post?.body].filter(Boolean).join('\n'));
  const tags = [];
  for (const value of [...stored, ...fromText]) {
    const tag = normalizeTag(value);
    if (!tag || tags.includes(tag)) continue;
    tags.push(tag);
    if (tags.length >= MAX_HASHTAGS) break;
  }
  return tags;
}

export function captionParts(text) {
  const source = String(text || '');
  const parts = [];
  let last = 0;
  for (const match of source.matchAll(TAG_PATTERN)) {
    const hashAt = match.index + match[1].length;
    const end = match.index + match[0].length;
    if (hashAt > last) parts.push({ type: 'text', value: source.slice(last, hashAt) });
    const tag = normalizeTag(match[2]);
    if (tag) parts.push({ type: 'tag', value: source.slice(hashAt, end), tag });
    else parts.push({ type: 'text', value: source.slice(hashAt, end) });
    last = end;
  }
  if (last < source.length) parts.push({ type: 'text', value: source.slice(last) });
  return parts;
}

/**
 * Posts for one tag. `own` is the viewer's library, including private posts.
 * `followed` must already be limited to index entries this viewer can read.
 */
export function postsForTag(tag, { own = [], followed = [] } = {}) {
  const name = normalizeTag(tag);
  if (!name) return [];
  const rows = [];
  const seen = new Set();
  for (const post of [...own, ...followed]) {
    if (!post?.url || seen.has(post.url)) continue;
    if (!postTags(post).includes(name)) continue;
    seen.add(post.url);
    rows.push(post);
  }
  rows.sort((a, b) => (b.dateCreated || '').localeCompare(a.dateCreated || ''));
  return rows;
}
