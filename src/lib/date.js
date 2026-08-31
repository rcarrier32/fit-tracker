/**
 * Local-calendar-day helpers. `Date#toISOString()` is always UTC, so slicing it for a
 * "today" key rolls the day over at UTC midnight — hours before local midnight west of
 * Greenwich (e.g. ~4-8pm in US timezones). Every "what day is this" key in the app should
 * go through here instead.
 */
export function localDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
