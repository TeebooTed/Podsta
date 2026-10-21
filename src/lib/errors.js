export function podStatus(err) {
  return Number(err?.statusCode || err?.status || err?.response?.status || 0);
}

export function describePodFailure(err) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'You are offline. Saved posts stay on this device until the Pod answers.';
  }
  const status = podStatus(err);
  if (status === 401) return 'Your sign-in expired. Sign in again to reach your Pod.';
  if (status === 403) return 'The Pod refused that request.';
  if (status === 429) return 'The Pod is busy. Wait a moment and try again.';
  const message = String(err?.message || '');
  if (status === 0 || /failed to fetch|network|timeout|aborted/i.test(message)) {
    return 'The Pod did not respond. Check the connection and try again.';
  }
  return 'Something went wrong talking to the Pod.';
}
