/** Checks src/lib/calendar.js. `node data/check_calendar.mjs` */
import { buildIcs } from '../src/lib/calendar.js';

let fail = 0;
const ok = (n, c, x = '') => { if (!c) { fail++; console.log(`✗ ${n} ${x}`); } else console.log(`✓ ${n}`); };
const ics = buildIcs({ days: [{ dow: 1, title: 'Lift: Full Body A' }, { dow: 4, title: 'Lift, Glutes; Zone 2', notes: 'Bring the band' }],
  time: '06:30', minutes: 50, alarm: 30, from: new Date(2026, 10, 10, 9, 0), weeks: 6 });
ok('calendar wrapper', ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.trim().endsWith('END:VCALENDAR'));
ok('two events', (ics.match(/BEGIN:VEVENT/g) || []).length === 2);
ok('Monday 6:30 starts next Monday', ics.includes('DTSTART:20261116T063000'), ics);
ok('Thursday this week', ics.includes('DTSTART:20261112T063000'));
ok('50 min long', ics.includes('DTEND:20261116T072000'));
ok('weekly, 6 times', ics.includes('RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=6'));
ok('alert 30 min before', ics.includes('TRIGGER:-PT30M'));
ok('text escaped', ics.includes('SUMMARY:Lift\\, Glutes\\; Zone 2') && ics.includes('DESCRIPTION:Bring the band'));
ok('CRLF line ends', !/[^\r]\n/.test(ics));
console.log(fail ? `${fail} failed` : 'all passed');
process.exit(fail ? 1 : 0);
