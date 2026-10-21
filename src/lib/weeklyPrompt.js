/** Gentle photo ideas. One per week, the same for everyone, chosen on this device. */
export const WEEKLY_PROMPTS = [
  'Something green',
  'Morning light',
  'Something close by',
  'Hands busy with something',
  'A shadow',
  'On the table',
  'Anything blue',
  'From a walk',
  'Through a window',
  'Something warm',
];

export const WEEKLY_PROMPT_KEY = 'podsta.weeklyPrompt.dismissed';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** ISO week, so Monday starts the next idea and a year boundary stays put. */
export function weekId(date) {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const year = utc.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(((utc - yearStart) / 86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function promptForDate(date = new Date()) {
  const [year, week] = weekId(date).split('-W').map(Number);
  const index = Math.abs(year * 53 + week) % WEEKLY_PROMPTS.length;
  return WEEKLY_PROMPTS[index];
}

/** True when a followed person's post is from the last seven days. */
export function friendsPostedThisWeek(entries, now = new Date()) {
  const latest = now.getTime();
  const earliest = latest - WEEK_MS;
  return (entries || []).some((entry) => {
    const time = Date.parse(entry?.dateCreated || '');
    return Number.isFinite(time) && time >= earliest && time <= latest + 60 * 60 * 1000;
  });
}

function dismissToken(date, webId) {
  return `${weekId(date)}:${webId}`;
}

/** Hidden when this person already skipped the current week on this device. */
export function isWeeklyPromptDismissed(storage, webId, date = new Date()) {
  if (!storage || !webId) return true;
  try {
    return storage.getItem(WEEKLY_PROMPT_KEY) === dismissToken(date, webId);
  } catch {
    return true;
  }
}

export function dismissWeeklyPrompt(storage, webId, date = new Date()) {
  if (!storage || !webId) return;
  try {
    storage.setItem(WEEKLY_PROMPT_KEY, dismissToken(date, webId));
  } catch {
    // Private mode forgets the skip. The card can return, which is harmless.
  }
}
