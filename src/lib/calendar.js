/**
 * Workout reminders through the phone's own calendar: an .ics file with one weekly repeating
 * event per training day, each with an alert before it. A home-screen web app can't schedule its
 * own notifications reliably (iPhone especially), but the Calendar app can.
 *
 * Plain module (no app imports) so it runs in node: `node data/check_calendar.mjs`.
 */
const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const pad = (n) => String(n).padStart(2, '0');
const stamp = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
const local = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
const escText = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
// Lines over 75 octets are folded (RFC 5545 §3.1); titles here are short, but notes may not be.
const fold = (line) => line.length <= 74 ? line : line.match(/.{1,74}/g).join('\r\n ');

/**
 * @param days    [{ dow: 0-6, title, notes? }]
 * @param time    'HH:MM' (local time; floating, so it stays at that clock time when travelling)
 * @param minutes event length
 * @param alarm   minutes before to alert (0 = no alert)
 * @param from    Date to start from (default today)
 * @param weeks   how many weeks the events repeat (default 12, one plan or so)
 */
export function buildIcs({ days, time = '18:00', minutes = 60, alarm = 30, from = new Date(), weeks = 12, uidBase = 'fit-tracker' }) {
  const [hh, mm] = time.split(':').map(Number);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Fit Tracker//Workouts//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const d of days) {
    const first = new Date(from.getFullYear(), from.getMonth(), from.getDate(), hh, mm);
    first.setDate(first.getDate() + ((d.dow - first.getDay() + 7) % 7));
    if (first < from) first.setDate(first.getDate() + 7);
    const end = new Date(first.getTime() + minutes * 60000);
    lines.push('BEGIN:VEVENT',
      `UID:${uidBase}-${BYDAY[d.dow]}-${local(first)}`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${local(first)}`, `DTEND:${local(end)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[d.dow]};COUNT=${weeks}`,
      fold(`SUMMARY:${escText(d.title)}`));
    if (d.notes) lines.push(fold(`DESCRIPTION:${escText(d.notes)}`));
    if (alarm > 0) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', fold(`DESCRIPTION:${escText(d.title)}`), `TRIGGER:-PT${alarm}M`, 'END:VALARM');
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
