/**
 * One toast after compose. A failed share must not be overwritten by "Posted publicly".
 * The post itself was saved; sharing is a second step.
 */
export function postedToast({ makePublic, shareFailed, shareMessage }) {
  if (shareFailed) {
    const detail = shareMessage?.trim() || 'unknown error';
    return {
      type: 'error',
      message: `Posted, but sharing failed: ${detail}`,
    };
  }
  if (makePublic) {
    return { type: 'success', message: 'Posted publicly' };
  }
  return { type: 'success', message: 'Posted privately' };
}
