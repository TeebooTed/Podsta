/**
 * Solid Notifications discovery.
 * A channel only wakes the next poll. The poll still decides what is new.
 *
 * Community Solid Server advertises a subscription service in a Link header,
 * for example updatesViaStreamingHttp2023. The client POSTs a subscription
 * and then reads receiveFrom. Unauthenticated calls are rejected.
 */

const STREAMING_TYPE = 'http://www.w3.org/ns/solid/notifications#StreamingHTTPChannel2023';
const WEBSOCKET_TYPE = 'http://www.w3.org/ns/solid/notifications#WebSocketChannel2023';

export function safeChannelUrl(value) {
  if (!value || typeof value !== 'string') return null;
  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch {
    return null;
  }
  if (parsed.protocol === 'https:' || parsed.protocol === 'wss:') return parsed.href;
  const local =
    (parsed.protocol === 'http:' || parsed.protocol === 'ws:') &&
    (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
  if (local) return parsed.href;
  return null;
}

function splitLinkHeader(header) {
  const parts = [];
  let current = '';
  let inAngle = false;
  let inQuote = false;
  for (const char of String(header || '')) {
    if (char === '<' && !inQuote) inAngle = true;
    else if (char === '>' && !inQuote) inAngle = false;
    else if (char === '"') inQuote = !inQuote;
    if (char === ',' && !inAngle && !inQuote) {
      if (current.trim()) parts.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function relMatches(rel, kind) {
  const value = rel.toLowerCase();
  if (kind === 'streaming') {
    return value.includes('streaminghttp') || value.includes('updatesviastreaming');
  }
  return value.includes('websocketchannel') || value.includes('updatesviawebsocket');
}

/** Pull streaming-HTTP and WebSocket subscription services out of a Link header. */
export function parseNotificationLinks(header) {
  const found = { streamingHttp: null, websocket: null };
  for (const part of splitLinkHeader(header)) {
    const target = part.match(/<([^>]+)>/);
    if (!target) continue;
    const rel = part.match(/rel=(?:"([^"]+)"|([^;,\s]+))/i);
    if (!rel) continue;
    const relation = rel[1] || rel[2] || '';
    const url = safeChannelUrl(target[1]);
    if (!url) continue;
    if (!found.streamingHttp && relMatches(relation, 'streaming')) found.streamingHttp = url;
    if (!found.websocket && relMatches(relation, 'websocket')) found.websocket = url;
  }
  return found;
}

export function subscriptionBody(type, topic) {
  const safeTopic = safeChannelUrl(topic);
  if (!safeTopic) throw new Error('The notification topic must be an https URL');
  return JSON.stringify({
    '@context': ['https://www.w3.org/ns/solid/notification/v1'],
    type,
    topic: safeTopic,
  });
}

export function receiveFromResponse(payload) {
  let data = payload;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      const match = data.match(/"receiveFrom"\s*:\s*"([^"]+)"/);
      return match ? safeChannelUrl(match[1]) : null;
    }
  }
  if (!data || typeof data !== 'object') return null;
  if (typeof data.receiveFrom === 'string') return safeChannelUrl(data.receiveFrom);
  if (Array.isArray(data['@graph'])) {
    for (const node of data['@graph']) {
      if (typeof node?.receiveFrom === 'string') return safeChannelUrl(node.receiveFrom);
    }
  }
  return null;
}

function headerValue(headers, name) {
  if (!headers) return '';
  if (typeof headers.get === 'function') return headers.get(name) || headers.get(name.toLowerCase()) || '';
  return headers[name] || headers[name.toLowerCase()] || '';
}

async function discover(fetchFn, resourceUrl, signal) {
  let link = '';
  try {
    const head = await fetchFn(resourceUrl, { method: 'HEAD', signal });
    link = headerValue(head?.headers, 'link');
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
  }
  if (!link) {
    const got = await fetchFn(resourceUrl, {
      method: 'GET',
      headers: { Accept: 'text/turtle' },
      signal,
    });
    link = headerValue(got?.headers, 'link');
    if (got?.body?.cancel) await got.body.cancel().catch(() => {});
  }
  return parseNotificationLinks(link);
}

async function subscribe(fetchFn, serviceUrl, topic, type, signal) {
  const response = await fetchFn(serviceUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/ld+json',
      Accept: 'application/ld+json',
    },
    body: subscriptionBody(type, topic),
    signal,
  });
  if (!response?.ok) {
    const status = response?.status || 0;
    throw new Error(`Notification subscription failed (${status})`);
  }
  const payload = typeof response.json === 'function' ? await response.json() : null;
  const receiveFrom = receiveFromResponse(payload);
  if (!receiveFrom) throw new Error('The notification channel did not return an address');
  return receiveFrom;
}

async function followStream(fetchFn, url, onWake, signal) {
  const response = await fetchFn(url, {
    headers: { Accept: 'application/ld+json, text/turtle' },
    signal,
  });
  if (!response?.ok || !response.body) {
    throw new Error(`Notification stream failed (${response?.status || 0})`);
  }
  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value?.byteLength) onWake();
  }
}

function disconnected(reason) {
  return {
    connected: false,
    kind: '',
    reason,
    close() {},
    done: Promise.resolve(),
  };
}

/**
 * Subscribe to one resource. Streaming HTTP is preferred because it can send
 * the session token. A WebSocket is used only when that is all the server offers.
 */
export async function openSolidChannel({ fetchFn, resourceUrl, onWake, signal }) {
  if (!fetchFn || !resourceUrl) return disconnected('missing');
  let links;
  try {
    links = await discover(fetchFn, resourceUrl, signal);
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    return disconnected('discover-failed');
  }

  if (links.streamingHttp) {
    try {
      const receiveFrom = await subscribe(fetchFn, links.streamingHttp, resourceUrl, STREAMING_TYPE, signal);
      const streamController = new AbortController();
      const onAbort = () => streamController.abort();
      if (signal) {
        if (signal.aborted) streamController.abort();
        else signal.addEventListener('abort', onAbort, { once: true });
      }
      const done = followStream(fetchFn, receiveFrom, onWake, streamController.signal).catch((err) => {
        if (err?.name === 'AbortError') return;
        throw err;
      });
      return {
        connected: true,
        kind: 'streaming-http',
        reason: '',
        close() {
          streamController.abort();
        },
        done,
      };
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      if (!links.websocket) return disconnected('subscribe-failed');
    }
  }

  if (links.websocket && typeof WebSocket === 'function') {
    try {
      const receiveFrom = await subscribe(fetchFn, links.websocket, resourceUrl, WEBSOCKET_TYPE, signal);
      if (!receiveFrom.startsWith('wss:') && !receiveFrom.startsWith('ws:')) return disconnected('not-a-socket');
      const socket = new WebSocket(receiveFrom);
      socket.onmessage = () => onWake?.();
      return {
        connected: true,
        kind: 'websocket',
        reason: '',
        close() {
          socket.close();
        },
        done: new Promise((resolve) => {
          socket.onclose = () => resolve();
        }),
      };
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      return disconnected('subscribe-failed');
    }
  }

  return disconnected(links.websocket ? 'websocket-unavailable' : 'none');
}
