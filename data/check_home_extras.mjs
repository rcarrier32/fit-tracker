/** Checks src/lib/home_extras.js. `node data/check_home_extras.mjs` */
import { weekStart, weekSummary, weightTrend, feelingSummary } from '../src/lib/home_extras.js';
let fail = 0;
const ok = (n, c, x = '') => { if (!c) { fail++; console.log(`✗ ${n} ${x}`); } else console.log(`✓ ${n}`); };
const T = '2026-11-11';   // a Wednesday
ok('week starts Monday', weekStart(T) === '2026-11-09' && weekStart('2026-11-09') === '2026-11-09' && weekStart('2026-11-15') === '2026-11-09');
const S = (date, program_id = 'lean', extra = {}) => ({ date, program_id, done: true, ...extra });
const w = weekSummary({ today: T, planned: 4, sessions: [S('2026-11-09'), S('2026-11-10'), S('2026-11-10', 'daily_mobility'), S('2026-11-11', 'daily_mobility'),
  S('2026-11-08'), S('2026-11-11', 'lean', { skipped: true }), S('2026-11-11', 'lean', { done: false })],
  cardio: [{ date: '2026-11-09', duration_min: 30 }, { date: '2026-11-08', duration_min: 60 }, { date: '2026-11-11', duration_min: 15 }] });
ok('2 workouts this week (last Sunday, skipped and unfinished not counted)', w.workouts === 2 && w.planned === 4, JSON.stringify(w));
ok('2 Daily Mobility days', w.dailyDays === 2);
ok('activity minutes this week only', w.cardioMin === 45);
ok('7 days, today marked, later days future', w.days.length === 7 && w.days[2].today && w.days[3].future && !w.days[2].future && w.days[1].workout && w.days[1].daily);

ok('no trend with 2 weigh-ins', weightTrend([{ date: T, weight_lb: 185 }, { date: '2026-11-10', weight_lb: 186 }], T) === null);
const body = [['11-01', 188], ['11-03', 187.6], ['11-04', 187], ['11-06', 186.8], ['11-07', 186.2], ['11-08', 186.4], ['11-09', 185.8], ['11-10', 186], ['11-11', 185.2], ['11-12', 150]]
  .map(([md, w]) => ({ date: '2026-' + md, weight_lb: w }));
const tr = weightTrend(body, T);
ok('7-day average', tr && tr.avg === 186.1, JSON.stringify(tr));
ok('change vs the 7 days before', tr.prev === 187.5 && tr.change === -1.5, JSON.stringify(tr));
ok('future entries ignored, chart points sorted', tr.points.every(p => p.date <= T) && tr.points[0].date === '2026-11-01');

const F = (date, effort, energy, extra = {}) => S(date, 'lean', { feel: { effort, energy }, ...extra });
ok('no check-ins → null', feelingSummary([S(T)], T) === null);
let f = feelingSummary([F('2026-11-05', 'right', 2), F('2026-11-07', 'hard', 2), F('2026-11-09', 'right', 1)], T);
ok('2 of last 3 heavy → lighter-week advice', /lighter week/.test(f.advice || ''), JSON.stringify(f));
f = feelingSummary([F('2026-11-05', 'hard', 1), F('2026-11-07', 'right', 3), F('2026-11-09', 'easy', 3)], T);
ok('recent fine → no advice', f.advice === null && f.recent.length === 3);
f = feelingSummary([F('2026-11-09', 'right', 2, { exercises: [{ name: 'Bulgarian Split Squat', hurt: true }] }), F('2026-10-01', 'right', 2, { exercises: [{ name: 'Old', hurt: true }] }),
  S('2026-11-10', 'daily_mobility', { feel: { effort: 'hard', energy: 1 } })], T);
ok('hurts from the last two weeks only; Daily Mobility ignored', f.hurts.join() === 'Bulgarian Split Squat' && f.recent.length === 2, JSON.stringify(f));
console.log(fail ? `${fail} failed` : 'all passed');
process.exit(fail ? 1 : 0);
