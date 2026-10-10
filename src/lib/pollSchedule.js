/** How often Podsta asks Pods what changed. The poll is the source of truth. */

export const POLL_BASE_MS = 45 * 1000;
export const POLL_MAX_MS = 5 * 60 * 1000;
export const POLL_CHANNEL_MS = 3 * 60 * 1000;

/**
 * Hidden tabs wait. A failure doubles the wait up to five minutes.
 * A connected Solid channel slows the poll; it does not replace it.
 * Returns null when the tab should not schedule another check.
 */
export function nextPollDelay({
  hidden = false,
  failed = false,
  previousDelay = POLL_BASE_MS,
  channelConnected = false,
} = {}) {
  if (hidden) return null;
  if (failed) {
    const previous = previousDelay > 0 ? previousDelay : POLL_BASE_MS;
    return Math.min(POLL_MAX_MS, previous * 2);
  }
  if (channelConnected) return POLL_CHANNEL_MS;
  return POLL_BASE_MS;
}

export function pollStatusCopy({ channelConnected = false, failing = false } = {}) {
  if (failing) return 'The last check failed. Podsta will wait longer before trying again.';
  if (channelConnected) return 'A live channel is connected. Podsta still checks on a slower timer.';
  return 'Podsta checks about every minute while this tab is open.';
}

export function sourceOutcome(results) {
  const attempted = (results || []).length;
  const failed = (results || []).filter((result) => result === 'failed').length;
  return {
    attempted,
    failed,
    failedAll: attempted > 0 && failed === attempted,
  };
}
