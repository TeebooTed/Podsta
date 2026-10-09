/**
 * One toast after compose. A failed share must not be overwritten by "Posted publicly".
 * The post itself was saved; sharing is a second step.
 * `audience` is "public" | "contacts" | "private". `makePublic` remains for older callers.
 */
export function postedToast({ makePublic, audience, shareFailed, shareMessage }) {
  if (shareFailed) {
    const detail = shareMessage?.trim() || 'unknown error';
    return {
      type: 'error',
      message: `Posted, but sharing failed: ${detail}`,
    };
  }
  const who = audience || (makePublic ? 'public' : 'private');
  if (who === 'public') return { type: 'success', message: 'Posted publicly' };
  if (who === 'contacts') return { type: 'success', message: 'Posted for your contacts' };
  return { type: 'success', message: 'Posted privately' };
}
