/** Checks src/lib/gym_swap.js on the real catalog and Lean & Tone. `node data/check_gym_swap.mjs` */
import { readFileSync } from 'fs';
import { applyGymDay, isStandIn, GYM_DEFAULT } from '../src/lib/gym_swap.js';

let fail = 0;
const ok = (n, c, x = '') => { if (!c) { fail++; console.log(`✗ ${n} ${x}`); } else console.log(`✓ ${n}`); };
const { loadFullCatalog } = await import('./catalog.mjs');
const { exercises } = await loadFullCatalog();
for (const e of exercises) if (!e.video_url && e.video?.url) e.video_url = e.video.url;
const by = new Map(exercises.map(e => [e.name.toLowerCase(), e]));
const lookup = (n) => by.get(String(n).toLowerCase());
const learned = JSON.parse(readFileSync(new URL('./learned_patterns.json', import.meta.url), 'utf8'));
const lib = JSON.parse(readFileSync(new URL('./library.json', import.meta.url), 'utf8'));
const lean = lib.programs.lean_tone[0];
const rowsOf = (d) => d.exercises.map(x => ({ name: x.name, orig_name: x.name, notes: x.notes || null, sets: [] }));

// Every Lean & Tone day: swaps keep movement + muscle, use gym kit, never touch dumbbell/holds/favourites/Copenhagen.
let total = 0;
const seen = [];
for (const w of lean.weeks.slice(0, 2)) for (const d of w.days) {
  const rows = rowsOf(d);
  const { rows: out, swaps } = applyGymDay(rows, true, lookup, exercises, { gym: GYM_DEFAULT, learned, favorites: ['Banded Lat Pulldown'] });
  total += swaps.length;
  for (const s of swaps) {
    const a = lookup(s.from), b = lookup(s.to);
    seen.push(s.note ? `${s.from}: ${s.note}` : `${s.from} → ${s.to}`);
    if (s.note) continue;
    if (a.pattern !== b.pattern || a.primary_muscle !== b.primary_muscle) ok(`same movement ${s.from}`, false, `${a.pattern}/${a.primary_muscle} vs ${b.pattern}/${b.primary_muscle}`);
    if (!(b.equipment || []).some(q => ['dumbbell', 'cable', 'machine', 'barbell', 'smith', 'trap_bar', 'landmine', 'pullup_bar'].includes(q))) ok(`loaded kit ${s.to}`, false);
    if ((b.equipment || []).includes('barbell') && exercises.some(c => c.pattern === a.pattern && c.primary_muscle === a.primary_muscle && (c.equipment || []).includes('dumbbell') && c.video_url && !/optional|last resort/i.test(c.name) && (c.role === a.role || (a.role !== 'accessory' && c.role !== 'accessory'))))
      ok(`dumbbell preferred over barbell: ${s.from} → ${s.to}`, false);
    if (!b.video_url) ok(`video ${s.to}`, false);
  }
  for (const [i, x] of out.entries()) {
    const e = lookup(rows[i].name);
    if (x.name !== rows[i].name && !isStandIn(e)) ok(`only stand-ins swapped: ${rows[i].name}`, false);
    if (lookup(rows[i].name)?.pattern === 'lunge_single_leg' && x.name !== rows[i].name) ok(`lunges keep their movement: ${rows[i].name}`, false);
    if (rows[i].name === 'Banded Lat Pulldown' && x.name !== 'Banded Lat Pulldown') ok('favourite kept', false);
    if (/copenhagen/i.test(rows[i].name) && x.name !== rows[i].name) ok('Copenhagen kept', false);
  }
}
ok('Lean & Tone has gym swaps', total > 0, String(total));
console.log('  swaps seen:', [...new Set(seen)].join(' · '));

// Logged rows stay; toggling off restores the plan exactly.
const d0 = lean.weeks[0].days[1];
const rows = rowsOf(d0);
const on = applyGymDay(rows, true, lookup, exercises, { gym: GYM_DEFAULT, learned });
ok('day 2 swaps something', on.swaps.length > 0);
const back = applyGymDay(on.rows, false, lookup, exercises, {});
ok('off restores names', back.rows.every((x, i) => x.name === rows[i].name), JSON.stringify(back.rows.map(x => x.name)));
ok('off restores notes', back.rows.every((x, i) => (x.notes ?? null) === rows[i].notes));
const loggedRows = rowsOf(d0).map(x => ({ ...x, sets: [{ done: true, weight: 20, reps: 10 }] }));
ok('logged rows never swapped', applyGymDay(loggedRows, true, lookup, exercises, { learned }).swaps.length === 0);
// A gym without cables or machines swaps nothing that needs them.
const small = applyGymDay(rows, true, lookup, exercises, { gym: ['dumbbell', 'bench', 'barbell'], learned });
ok('respects the gym\'s equipment', small.rows.every(x => (lookup(x.name).equipment || []).every(q => ['bodyweight', 'dumbbell', 'bench', 'barbell'].includes(q)) || !x.gym_swap));
// Applying twice changes nothing more.
ok('idempotent', applyGymDay(on.rows, true, lookup, exercises, { learned }).swaps.length === 0);

console.log(fail ? `${fail} failed` : 'all passed');
process.exit(fail ? 1 : 0);
