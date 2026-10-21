export function podStatus(err) {
  return Number(err?.statusCode || err?.status || err?.response?.status || 0);
}

export function describePodFailure(err) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return "You're offline. Posts saved on this device are still here. Try again once you're back online.";
  }
  const status = podStatus(err);
  if (status === 401) return 'Your sign-in expired. Sign in again to reach your pod.';
  if (status === 403) return 'Your pod said no to that request.';
  if (status === 429) return 'Your pod is a bit busy. Give it a moment and try again.';
  const message = String(err?.message || '');
  if (status === 0 || /failed to fetch|network|timeout|aborted/i.test(message)) {
    return "Your pod isn't answering right now. Your posts are safe. Give it a minute and try again.";
  }
  return 'Something went wrong on our end. Your posts are safe in your pod. Try again, and if it keeps happening, reload the page.';
}
