/* Opens a Podsta notification in an existing window when one is already open. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const href = event.notification.data?.href || '';
  const url = event.notification.data?.url || './';
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows.find((client) => 'focus' in client);
      if (open) {
        open.postMessage({ type: 'podsta-notice', href });
        await open.focus();
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
