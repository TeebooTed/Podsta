/**
 * One toast after compose. A failed share must not be overwritten by "Shared with everyone."
 * The post itself was saved; sharing is a second step.
 * `audience` is "public" | "contacts" | "private". `makePublic` remains for older callers.
 */
export function postedToast({ makePublic, audience, shareFailed }) {
  if (shareFailed) {
    return {
      type: 'error',
      message:
        "Saved in your pod, but sharing didn't finish. It's still Only me for now. Try sharing again from the post.",
    };
  }
  const who = audience || (makePublic ? 'public' : 'private');
  if (who === 'public') return { type: 'success', message: 'Shared with everyone.' };
  if (who === 'contacts') return { type: 'success', message: 'Shared with your contacts.' };
  return { type: 'success', message: 'Posted to your pod.' };
}
