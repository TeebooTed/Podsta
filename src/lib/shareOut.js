import { appPostUrl } from './navigation.js';

/**
 * Sharing sends a Podsta link to another app on this device.
 * Nothing is uploaded to a Podsta server.
 * A private post is not offered: the link would not open for anyone else,
 * and the caption must not leave the Pod through the share sheet.
 * A contacts post shares the link only. The caption stays out of the sheet,
 * because the other app may not be one of the contacts.
 * A public post can include a short excerpt. That text is already world-readable.
 */

export function shareAudience(post) {
  if (post?.audience === 'public' || post?.audience === 'contacts' || post?.audience === 'private') {
    return post.audience;
  }
  return post?.isPublic ? 'public' : 'private';
}

export function sharePayload({ origin, post, authorName = '' }) {
  if (!post?.url) return null;
  const audience = shareAudience(post);
  if (audience === 'private') return null;
  const url = appPostUrl(origin, post.url);
  if (!url.startsWith('https://') && !url.startsWith('http://localhost')) return null;
  const who = String(authorName || '').trim();
  const title = post.title?.trim() || (who ? `${who} on Podsta` : 'A post on Podsta');
  const excerpt =
    audience === 'public' ? String(post.caption || post.title || '').trim().slice(0, 180) : '';
  return { title, text: excerpt, url, audience };
}

export async function shareOrCopy(payload, { share, copy }) {
  if (!payload?.url) return { ok: false, reason: 'private' };
  if (typeof share === 'function') {
    try {
      const data = { title: payload.title, url: payload.url };
      if (payload.text) data.text = payload.text;
      await share(data);
      return { ok: true, method: 'share' };
    } catch (err) {
      if (err?.name === 'AbortError') return { ok: false, reason: 'dismissed' };
    }
  }
  const ok = typeof copy === 'function' ? await copy(payload.url) : false;
  return { ok: Boolean(ok), method: 'copy' };
}
