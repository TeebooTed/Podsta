/** Breaks `text` into at most `maxLines` lines that fit `width`, ending with … if cut. */
export function wrapLines(text, width, maxLines, measure) {
  const words = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  const lines = [];
  let line = '';
  let cut = false;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (!line || measure(next) <= width) {
      line = next;
      continue;
    }
    if (lines.length === maxLines - 1) {
      cut = true;
      break;
    }
    lines.push(line);
    line = word;
  }
  if (line) lines.push(line);
  const fit = (value, force) => {
    if (!force && measure(value) <= width) return value;
    let shorter = value;
    while (shorter && measure(`${shorter}…`) > width) shorter = shorter.slice(0, -1).trimEnd();
    return `${shorter}…`;
  };
  return lines.map((value, i) => fit(value, cut && i === lines.length - 1));
}
