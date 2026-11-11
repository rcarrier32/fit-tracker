/** Checks src/lib/daily_card.js (Home's Daily Mobility card). `node data/check_daily_card.mjs` */
import { dailyStreak, dailyState, rowTarget, prevDay } from '../src/lib/daily_card.js';

let fail = 0;
const ok = (n, c, x = '') => { if (!c) { fail++; console.log(`✗ ${n} ${x}`); } else console.log(`✓ ${n}`); };
const D = 'daily_mobility';
const s = (date, extra = {}) => ({ date, program_id: D, done: true, exercises: [], ...extra });

ok('prevDay crosses months', prevDay('2026-03-01') === '2026-02-28' && prevDay('2026-01-01') === '2025-12-31');
ok('prevDay across DST', prevDay('2026-03-09') === '2026-03-08' && prevDay('2026-11-02') === '2026-11-01');

const T = '2026-11-11';
ok('no sessions → 0', dailyStreak([], T) === 0);
ok('today only → 1', dailyStreak([s(T)], T) === 1);
ok('today not done yet keeps the streak', dailyStreak([s('2026-11-10'), s('2026-11-09')], T) === 2);
ok('three in a row incl. today', dailyStreak([s(T), s('2026-11-10'), s('2026-11-09')], T) === 3);
ok('a missed day breaks it', dailyStreak([s(T), s('2026-11-09')], T) === 1);
ok('a skipped day breaks it', dailyStreak([s(T), s('2026-11-10', { skipped: true }), s('2026-11-09')], T) === 1);
ok('unfinished day doesn\'t count', dailyStreak([s('2026-11-10', { done: false })], T) === 0);
ok('other programs don\'t count', dailyStreak([s(T, { program_id: 'lean_tone' })], T) === 0);
ok('two sessions one day count once', dailyStreak([s(T), s(T), s('2026-11-10')], T) === 2);

const rows = [{ name: 'Cat Camel', target_sets: 1, target_reps: '10' }, { name: 'Pogos', target_sets: 2, time: '30s' }, { name: 'Dead Bug', target_sets: 2, target_reps: '8 each' }];
const set = (at) => ({ done: true, at });
let st = dailyState([], { dayRows: rows });
ok('nothing yet → todo with the day\'s count', st.state === 'todo' && st.total === 3 && st.done === 0);
st = dailyState([], { dayRows: rows, skippedToday: true });
ok('skip today → skipped', st.state === 'skipped');
const ses = { program_id: D, done: false, exercises: [{ ...rows[0], sets: [set(1000)] }, { ...rows[1], sets: [] }, { ...rows[2], sets: [] }] };
st = dailyState([ses, { program_id: 'other', done: true, exercises: [] }], { dayRows: rows });
ok('one move done → started, next is Pogos', st.state === 'started' && st.done === 1 && st.next?.name === 'Pogos');
st = dailyState([{ ...ses, done: true, exercises: ses.exercises.map((x, i) => ({ ...x, sets: [set(1000 + i * 300000)] })) }], { dayRows: rows });
ok('finished → done with minutes', st.state === 'done' && st.minutes === 14, JSON.stringify(st));
ok('finished beats skip flag', dailyState([{ ...ses, done: true }], { skippedToday: true }).state === 'done');
ok('skipped session → skipped', dailyState([{ ...ses, done: true, skipped: true }]).state === 'skipped');
ok('rowTarget', rowTarget(rows[1]) === '2 × 30s' && rowTarget(rows[2]) === '2 × 8 each' && rowTarget({ target_sets: 1 }) === '1 set');

console.log(fail ? `${fail} failed` : 'all passed');
process.exit(fail ? 1 : 0);
