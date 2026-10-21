// Runs before the app so the first paint already has the right theme.
// Mirrors resolveTheme() in src/lib/theme.js.
(function () {
  var choice = 'system';
  try {
    choice = localStorage.getItem('podsta-theme') || 'system';
  } catch (e) {
    // Storage can be blocked; fall back to the system setting.
  }
  var dark =
    choice === 'dark' ||
    (choice !== 'light' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#160E20' : '#FFF7EE');
})();
