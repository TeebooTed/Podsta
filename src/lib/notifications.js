import { displayHandle } from './handles.js';
import { samePerson } from './webId.js';
import { loadFriendFeed } from './feed.js';
import { loadComments } from './comments.js';
import { personPath, postPath } from './navigation.js';
import { resolveProfile } from './friends.js';
import {
  readContactRequests,
  readGroupMembers,
  readInboxNotices,
  serverInboxUrl,
} from './contactRequest.js';
import { sourceOutcome } from './pollSchedule.js';

/**
 * Notifications Podsta can see without a server of its own:
 *   - new posts in the feeds of people you follow
 *   - comments on your posts, when one exists from someone else
 *   - contact requests written on a followed Pod, or posted to your inbox
 *   - approvals, when their contacts group lists you or their inbox notice arrived
 *
 * Other people still cannot comment: the comments file is owner-only.
 * A request from someone you do not follow is visible only if their inbox post landed.
 */

export const NOTIFICATION_LIMITS = {
  posts: 30,
  comments: 15,
  friends: 40,
  inbox: 15,
};

export function badgeLabel(count) {
  const n = Number(count) || 0;
  if (n <= 0) return 'Notifications';
  if (n === 1) return 'Notifications, 1 new';
  return `Notifications, ${n} new`;
}

export function badgeText(count) {
  const n = Number(count) || 0;
  if (n <= 0) return '';
  if (n > 9) return '9+';
  return String(n);
}

function actorName(webId, fallback) {
  if (fallback && fallback !== webId) return fallback;
  return displayHandle(webId).handle || 'Someone';
}

function dedupeAndSort(items) {
  const map = new Map();
  for (const item of items) {
    if (!item?.id) continue;
    const previous = map.get(item.id);
    if (!previous || (item.created || '') > (previous.created || '')) map.set(item.id, item);
  }
  return [...map.values()].sort((a, b) => (b.created || '').localeCompare(a.created || ''));
}

export function buildNotifications({
  webId,
  feedEntries = [],
  commentThreads = [],
  requests = [],
  approvals = [],
}) {
  const items = [];

  for (const entry of feedEntries) {
    if (!entry?.url || samePerson(entry.ownerWebId, webId)) continue;
    const name = actorName(entry.ownerWebId, entry.ownerName);
    items.push({
      id: `post:${entry.url}`,
      kind: 'post',
      created: entry.dateCreated || '',
      actorWebId: entry.ownerWebId || '',
      actorName: name,
      title: `${name} posted`,
      detail: entry.caption || entry.title || '',
      href: postPath(entry.url),
    });
  }

  for (const thread of commentThreads) {
    for (const comment of thread.comments || []) {
      if (!comment?.text || samePerson(comment.author, webId)) continue;
      const name = actorName(comment.author, comment.authorName);
      items.push({
        id: `comment:${thread.postUrl}:${comment.author}:${comment.date || ''}`,
        kind: 'comment',
        created: comment.date || '',
        actorWebId: comment.author || '',
        actorName: name,
        title: `${name} commented on your post`,
        detail: comment.text,
        href: thread.postUrl ? postPath(thread.postUrl) : '',
      });
    }
  }

  for (const request of requests) {
    if (!request?.authorWebId || samePerson(request.authorWebId, webId)) continue;
    if (request.recipientWebId && !samePerson(request.recipientWebId, webId)) continue;
    const name = actorName(request.authorWebId, request.authorName);
    items.push({
      id: `contact-request:${request.authorWebId}`,
      kind: 'contact-request',
      created: request.created || '',
      actorWebId: request.authorWebId,
      actorName: name,
      title: `${name} asked to be a contact`,
      detail: '',
      href: personPath(request.authorWebId),
    });
  }

  for (const approval of approvals) {
    const who = approval.webId || approval.authorWebId;
    if (!who || samePerson(who, webId)) continue;
    const name = actorName(who, approval.name || approval.authorName);
    items.push({
      id: `contact-approval:${who}`,
      kind: 'contact-approval',
      created: approval.created || '',
      actorWebId: who,
      actorName: name,
      title: `${name} approved you as a contact`,
      detail: '',
      href: personPath(who),
    });
  }

  return dedupeAndSort(items).slice(0, NOTIFICATION_LIMITS.posts);
}

async function mark(results, run) {
  try {
    const value = await run();
    results.push('ok');
    return { ok: true, value };
  } catch {
    results.push('failed');
    return { ok: false, value: null };
  }
}

export async function collectNotifications({
  webId,
  podUrl,
  friends = [],
  posts = [],
  session,
  fetchFn,
  loadFeed = loadFriendFeed,
  loadCommentsForPost = loadComments,
  readRequests = readContactRequests,
  readMembers = readGroupMembers,
  readInbox = readInboxNotices,
  podUrlForWebId = async (id, fetchImpl) => (await resolveProfile(id, fetchImpl)).podUrl,
  limits = NOTIFICATION_LIMITS,
}) {
  const fetchImpl = fetchFn || session?.fetch;
  const results = [];
  const cappedFriends = (friends || []).slice(0, limits.friends);

  const feedResult = await mark(results, () => loadFeed({ friends: cappedFriends, session }));
  const feedEntries = (feedResult.value?.entries || []).slice(0, limits.posts);

  const newestPosts = [...(posts || [])]
    .filter((post) => post?.url)
    .sort((a, b) => (b.dateCreated || '').localeCompare(a.dateCreated || ''))
    .slice(0, limits.comments);
  const commentThreads = [];
  for (const post of newestPosts) {
    const loaded = await mark(results, () =>
      loadCommentsForPost({ ownerPodUrl: podUrl, postUrl: post.url, fetchFn: fetchImpl }),
    );
    if (!loaded.ok) continue;
    if (loaded.value?.error === 'unavailable') {
      results[results.length - 1] = 'failed';
      continue;
    }
    commentThreads.push({
      postUrl: post.url,
      comments: loaded.value?.comments || [],
    });
  }

  const requests = [];
  for (const friend of cappedFriends) {
    const located = await mark(results, async () => {
      if (friend.podUrl) return friend.podUrl;
      return podUrlForWebId(friend.webId, fetchImpl);
    });
    if (!located.ok || !located.value) continue;
    const file = await mark(results, () => readRequests(located.value, fetchImpl));
    if (!file.ok) continue;
    for (const entry of file.value || []) {
      if (!samePerson(entry.recipientWebId, webId)) continue;
      requests.push({
        ...entry,
        authorWebId: entry.authorWebId || friend.webId,
        authorName: friend.name || entry.authorName || '',
      });
    }
  }

  const inbox = await mark(results, () => readInbox(serverInboxUrl(podUrl), fetchImpl, limits.inbox));
  const approvals = [];
  if (inbox.ok) {
    for (const notice of inbox.value || []) {
      if (notice.kind === 'contact-request') requests.push(notice);
      if (notice.kind === 'contact-approval') {
        approvals.push({
          webId: notice.authorWebId,
          created: notice.created,
          name: notice.authorName || '',
        });
      }
    }
  }

  const outgoingResult = await mark(results, () => readRequests(podUrl, fetchImpl));
  const outgoing = outgoingResult.ok ? outgoingResult.value || [] : [];
  const outgoingTargets = [];
  for (const entry of outgoing) {
    if (!samePerson(entry.authorWebId, webId) || !entry.recipientWebId) continue;
    outgoingTargets.push(entry.recipientWebId);
    const located = await mark(results, () => podUrlForWebId(entry.recipientWebId, fetchImpl));
    if (!located.ok || !located.value) continue;
    const members = await mark(results, () => readMembers(located.value, fetchImpl));
    if (!members.ok) continue;
    if ((members.value || []).some((member) => samePerson(member, webId))) {
      approvals.push({ webId: entry.recipientWebId, created: entry.created || '' });
    }
  }

  return {
    items: buildNotifications({ webId, feedEntries, commentThreads, requests, approvals }),
    outgoingTargets,
    ...sourceOutcome(results),
  };
}
