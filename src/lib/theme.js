/**
 * Appearance preference: follow the system, or force light or dark.
 * Stored only in this browser. public/theme-init.js applies it before first paint,
 * and must agree with resolveTheme() here.
 */

export const THEME_KEY = 'podsta-theme';
export const THEME_CHOICES = [
  { id: 'system', label: 'Auto' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

export const THEME_COLORS = { light: '#FFF7EE', dark: '#160E20' };

export function normalizeTheme(value) {
  return value === 'light' || value === 'dark' ? value : 'system';
}

export function resolveTheme(preference, systemPrefersDark = false) {
  const choice = normalizeTheme(preference);
  if (choice === 'system') return systemPrefersDark ? 'dark' : 'light';
  return choice;
}

export function readTheme(storage) {
  try {
    return normalizeTheme(storage?.getItem(THEME_KEY));
  } catch {
    return 'system';
  }
}

export function writeTheme(storage, preference) {
  const choice = normalizeTheme(preference);
  try {
    if (choice === 'system') storage?.removeItem(THEME_KEY);
    else storage?.setItem(THEME_KEY, choice);
  } catch {
    // Private mode can refuse storage. The choice still applies to this tab.
  }
  return choice;
}

export function applyTheme(doc, resolved) {
  if (!doc?.documentElement) return;
  doc.documentElement.classList.toggle('dark', resolved === 'dark');
  doc.querySelectorAll?.('meta[name="theme-color"]').forEach((meta) => {
    meta.setAttribute('content', THEME_COLORS[resolved] || THEME_COLORS.light);
  });
}
