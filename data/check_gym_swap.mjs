/** Checks src/lib/gym_swap.js on the real catalog and Lean & Tone. `node data/check_gym_swap.mjs` */
import { readFileSync } from 'fs';
import { applyGymDay, isStandIn, GYM_DEFAULT, applyHomeKit, fitsKit } from '../src/lib/gym_swap.js';

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

// Home swap (v220): a gym-heavy BWS day at home ends up doable with the home kit, same movement.
const HOME = new Set(['bodyweight', 'dumbbell', 'bench', 'band', 'mini_band', 'foam_roller']);
const bwsProg = Object.values(lib.programs).flat().find(p => p && /^bws_4day/.test(p.id));
let hs = 0, unfit = 0, sameMove = 0;
for (const d of (bwsProg.weeks ? bwsProg.weeks[0].days : bwsProg.days)) {
  const rows = d.exercises.filter(x => !x.is_alternate).map(x => ({ name: x.name, orig_name: x.name, notes: null, sets: [], alternates: x.alternates || null }));
  const r = applyHomeKit(rows, lookup, exercises, { kit: HOME, learned });
  hs += r.swaps.length;
  for (const x of r.rows) {
    const e = lookup(x.name);
    if (e && !fitsKit(e, HOME)) unfit++;
    if (x.home_swap && lookup(x.home_swap.from)?.primary_muscle === e?.primary_muscle) sameMove++;
  }
  const back = applyHomeKit(r.rows, lookup, exercises, { on: false });
  ok(`BWS ${d.focus || d.day_name}: undo puts the plan back`, back.rows.every((x, i) => x.name === rows[i].name));
}
ok(`BWS 4-day at home: ${hs} swaps, every row doable with the home kit`, hs > 0 && unfit === 0, `${unfit} left needing gym kit`);
ok('home swaps keep the main muscle', sameMove === hs, `${sameMove}/${hs}`);
const fav = applyHomeKit([{ name: 'Cable Pushdowns', sets: [] }], lookup, exercises, { kit: HOME, favorites: ['Cable Pushdowns'] });
ok('a ♥ favourite is never home-swapped', fav.swaps.length === 0);
const lt = applyHomeKit(rowsOf(lean.weeks[0].days[0]), lookup, exercises, { kit: new Set([...HOME, 'kettlebell', 'box', 'slider', 'bosu_pad', 'med_ball']) });
ok('Lean & Tone (built for home) needs no home swaps', lt.swaps.length === 0, JSON.stringify(lt.swaps));
console.log(fail ? `${fail} failed` : 'all passed');
process.exit(fail ? 1 : 0);
