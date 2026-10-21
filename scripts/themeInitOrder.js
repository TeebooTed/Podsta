/**
 * theme-init.js has to run before the first paint, so it stays a classic
 * blocking script. It must not sit above the stylesheet and module, or the
 * parser cannot discover those until this small file has downloaded.
 */
export function placeThemeInitAfterStylesheet(html) {
  const match = html.match(/<script src="[^"]*theme-init\.js"><\/script>/);
  if (!match) return html;
  const tag = match[0];
  const without = html.replace(tag, '');
  const link = without.match(/<link rel="stylesheet"[^>]*>/);
  if (!link) return html;
  const at = without.indexOf(link[0]) + link[0].length;
  return `${without.slice(0, at)}\n    ${tag}${without.slice(at)}`;
}
