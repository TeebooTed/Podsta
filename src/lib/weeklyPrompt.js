/**
 * One photo prompt per week. It is chosen on this device from the week number.
 * There is no prompt server, and it is shown only when a friend has posted recently.
 */

export const WEEKLY_PROMPTS = [
  { title: 'A window', body: 'Photograph a window you look through.' },
  { title: 'On the table', body: 'Photograph what is on a table near you.' },
  { title: 'Something blue', body: 'Find one blue thing and photograph it.' },
  { title: 'Hands', body: 'Photograph a pair of hands doing something ordinary.' },
  { title: 'The walk', body: 'Photograph one thing you pass on a walk.' },
  { title: 'Morning light', body: 'Photograph the light where you start the day.' },
  { title: 'A tool', body: 'Photograph a tool you actually use.' },
  { title: 'Weather', body: 'Photograph what the weather is doing.' },
  { title: 'A meal', body: 'Photograph a meal before it is gone.' },
  { title: 'Shadow', body: 'Photograph a shadow.' },
  { title: 'A door', body: 'Photograph a door you open.' },
  { title: 'Quiet', body: 'Photograph a quiet corner.' },
];

const DAY = 24 * 60 * 60 * 1000;

export function isoWeekParts(date) {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc - yearStart) / DAY + 1) / 7);
  return { year: utc.getUTCFullYear(), week };
}

export function promptForDate(date = new Date()) {
  const parts = isoWeekParts(date);
  const prompt = WEEKLY_PROMPTS[(parts.week - 1) % WEEKLY_PROMPTS.length];
  return { ...prompt, year: parts.year, week: parts.week };
}

/** True when someone you follow posted inside the recent window. */
export function friendsAreActive(entries, now = Date.now(), days = 7) {
  const cutoff = now - days * DAY;
  return (entries || []).some((entry) => {
    const time = Date.parse(entry?.dateCreated || '');
    return Number.isFinite(time) && time >= cutoff && time <= now + 60 * 60 * 1000;
  });
}

export function promptStorageKey(webId, prompt) {
  return `podsta.prompt.${prompt.year}-W${prompt.week}:${encodeURIComponent(webId || '')}`;
}

export function promptDismissed(storage, webId, prompt) {
  if (!storage || !prompt) return false;
  try {
    return storage.getItem(promptStorageKey(webId, prompt)) === '1';
  } catch {
    return false;
  }
}

export function dismissWeeklyPrompt(storage, webId, prompt) {
  if (!storage || !prompt) return;
  try {
    storage.setItem(promptStorageKey(webId, prompt), '1');
  } catch {
    // Private mode can reject the write. The prompt can be dismissed again.
  }
}
