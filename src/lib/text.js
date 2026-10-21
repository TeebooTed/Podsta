const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const SCRIPT_TAG = /<\s*\/?\s*script\b[^>]*>/gi;
const HTML_TAG = /<\/?[a-z][^>\n]*>/gi;
const SCRIPT_URL = /javascript\s*:/gi;

/**
 * User-written captions, comments, names, and bios are plain text.
 * Tags are removed so a stored string cannot become markup if a later
 * change renders it as HTML. Quotes and line breaks stay.
 */
export function plainText(value) {
  return String(value ?? '')
    .replace(CONTROL, '')
    .replace(SCRIPT_TAG, '')
    .replace(HTML_TAG, '')
    .replace(SCRIPT_URL, '')
    .trim();
}
