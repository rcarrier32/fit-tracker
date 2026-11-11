/** Checks src/lib/week_plan.js. `node data/check_week_plan.mjs` */
import { planWeek } from '../src/lib/week_plan.js';
let fail = 0;
const ok = (n, c, x = '') => { if (!c) { fail++; console.log(`✗ ${n} ${x}`); } else console.log(`✓ ${n}`); };
const D = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const show = (w) => w.days.map((t, i) => `${D[i]}:${t === 'move30_recovery_mobility' ? 'recovery' : t}`).join(' ');
const LEGS = /lower|leg|glute/i;
const check = (label, focuses, games) => {
  const w = planWeek(focuses, games);
  console.log(`  ${label}: ${show(w)}  |  ${w.order.map(o => D[o.dow] + ' D' + o.day + ' ' + o.focus).join(', ')}  | start ${D[w.start_dow]}${w.note ? ' | ' + w.note : ''}`);
  ok(`${label}: games kept`, games.every(g => w.days[g] === 'basketball'));
  ok(`${label}: all ${focuses.length} training days placed`, w.days.filter(t => t === 'train').length === focuses.length);
  ok(`${label}: no leg day before a game`, !w.order.some(o => games.includes((o.dow + 1) % 7) && LEGS.test(o.focus)));
  ok(`${label}: Sunday rest (unless the week says there's no room)`, games.includes(0) || w.days[0] === 'rest' || /no full rest day/.test(w.note || ''));
  return w;
};
check('3-day full body, games Mon/Fri', ['Full Body A', 'Full Body B', 'Full Body C'], [1, 5]);
check('4-day upper/lower, games Mon/Fri', ['Lower · Quad', 'Upper A', 'Lower · Glute & Hinge', 'Upper B'], [1, 5]);
check('2-day, game Wed', ['Full Body A', 'Full Body B'], [3]);
const w5 = check('5-day, games Mon/Fri', ['Upper A', 'Lower · Quad', 'Push', 'Pull', 'Lower · Glute & Hinge'], [1, 5]);
ok('5 workouts + 2 games: no rest day, and the week says so', w5.days.filter(t => t === 'train').length === 5 && /no full rest day/.test(w5.note || ''));
const w3 = planWeek(['Full Body A', 'Full Body B', 'Full Body C'], [1, 5]);
ok('leftover day gets recovery', w3.days.includes('move30_recovery_mobility'));
ok('no game → still a sensible week', planWeek(['Upper', 'Lower'], []).days.filter(t => t === 'train').length === 2);
const wSun = planWeek(['Full Body A', 'Full Body B'], [0, 3]);
ok('start day is a training day', w3.days[w3.start_dow] === 'train');
ok('Sunday game → rest moves to Saturday', wSun.days[0] === 'basketball' && wSun.days[6] === 'rest', show(wSun));
console.log(fail ? `${fail} failed` : 'all passed');
process.exit(fail ? 1 : 0);
