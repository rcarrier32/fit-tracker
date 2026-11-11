/** Checks src/lib/daily_adjust.js against the real catalog and the Daily Mobility program. `node data/check_daily_adjust.mjs` */
import { readFileSync } from 'fs';
import { yesterdayLoad, adjustDaily, soreFromNotes, helpedMoves } from '../src/lib/daily_adjust.js';

let fail = 0;
const ok = (n, c, x = '') => { if (!c) { fail++; console.log(`✗ ${n} ${x}`); } else console.log(`✓ ${n}`); };
const idx = JSON.parse(readFileSync(new URL('./exercise_index.json', import.meta.url), 'utf8')).exercises;
const byName = new Map(idx.map(e => [e.name.toLowerCase(), e]));
const lookup = (n) => byName.get(String(n).toLowerCase());
const lib = JSON.parse(readFileSync(new URL('./library.json', import.meta.url), 'utf8'));
const prog = lib.programs.daily_mobility[0];
const rowsOf = (d) => d.exercises.map(x => ({ name: x.name, target_sets: x.sets, target_reps: x.reps || '', time: x.time, notes: x.notes }));
const A = rowsOf(prog.days[0]), C = rowsOf(prog.days[2]);
const done = (name, n) => ({ name, sets: Array.from({ length: n }, () => ({ done: true, weight: 100, reps: 8 })) });
const sess = (program_id, ex) => ({ program_id, done: true, exercises: ex });

// Rest day: nothing changes.
let r = adjustDaily(A, yesterdayLoad([], lookup), lookup);
ok('rest day → unchanged', r.note === null && r.rows === A);

// Heavy legs yesterday.
const legs = yesterdayLoad([sess('x', [done('Barbell Back Squat', 4), done('Dumbbell Romanian Deadlift', 3), done('Bulgarian Split Squat', 3), done('Lying Leg Curls', 3)])], lookup);
ok('legs counted', legs.legSets >= 9, JSON.stringify(legs.direct));
r = adjustDaily(A, legs, lookup);
ok('pogos swapped after heavy legs', r.rows.some(x => x.name === 'Single Leg Stance' && x.orig_name === 'Pogos') && !r.rows.some(x => x.name === 'Pogos'));
const hf = r.rows.find(x => x.name === 'Hip Flexor/Quad Bridge');
ok('quad/hip-flexor hold gets a set', hf && hf.target_sets === 3, JSON.stringify(hf));
ok('note explains', /yesterday/i.test(r.note) && /quads/.test(r.note), r.note);
const rc = adjustDaily(C, legs, lookup);
ok('Daily C: hamstring and hip holds bumped', rc.rows.filter((x, i) => x.target_sets > C[i].target_sets).length >= 2, rc.note);

// Upper day: pogos stay, shoulder/upper-back moves get time.
const upper = yesterdayLoad([sess('x', [done('Barbell Bench Press', 4), done('Barbell Row (mid/upper back)', 4), done('Standing Barbell Overhead Press', 3)])], lookup);
r = adjustDaily(A, upper, lookup);
ok('upper day keeps pogos', r.rows.some(x => x.name === 'Pogos'));
ok('upper day bumps a shoulder/upper-back move', r.rows.some((x, i) => x.target_sets > A[i].target_sets), r.note);

// Jumps yesterday (light legs) still swap pogos.
const jumps = yesterdayLoad([sess('x', [done('Pogos', 2), done('Lateral Hops', 3)])], lookup);
ok('jumps counted', jumps.impact >= 3, JSON.stringify(jumps));
ok('pogos swapped after jumps', adjustDaily(A, jumps, lookup).rows.some(x => x.orig_name === 'Pogos'));

// Yesterday's Daily Mobility doesn't count as training.
const mob = yesterdayLoad([sess('daily_mobility', [done('Pogos', 3), done('Hip Flexor/Quad Bridge', 2)])], lookup);
ok('daily mobility ignored', adjustDaily(A, mob, lookup).note === null);

// Skipped sessions don't count.
ok('skipped ignored', adjustDaily(A, yesterdayLoad([{ ...sess('x', [done('Barbell Back Squat', 5)]), skipped: true }], lookup), lookup).note === null);

// Sore from a note: a rest day otherwise, but the note's areas get a set.
const sore = soreFromNotes([{ program_id: 'move30', note: 'Front legs like quad from above knee up to hip flexor extra sore from prior day workout' }]);
ok('note → quads + hip flexors', sore.includes('quads') && sore.includes('hip flexors'), JSON.stringify(sore));
r = adjustDaily(A, yesterdayLoad([], lookup), lookup, { sore });
const hf2 = r.rows.find(x => x.name === 'Hip Flexor/Quad Bridge');
ok('sore note bumps the quad/hip-flexor hold', hf2 && hf2.target_sets === 3 && /from your note/.test(r.note || ''), r.note);
ok('pogos stay (soreness isn\'t impact)', r.rows.some(x => x.name === 'Pogos'));
ok('Daily Mobility notes ignored', soreFromNotes([{ program_id: 'daily_mobility', note: 'quads sore' }]).length === 0);
// Moves marked "Helped" come back when their area is sore.
const helped = helpedMoves([{ date: '2026-11-11', program_id: 'move30', exercises: [{ name: 'Back Leg Lunge (Peterson Lunge)', helped: true, target_sets: 2, target_reps: '8 each side' },
  { name: 'Wall Slides', helped: true, target_sets: 2, target_reps: '8' }] }, { date: '2026-09-01', exercises: [{ name: 'Old Move', helped: true }] }], '2026-11-12');
ok('helped moves: recent only', helped.length === 2 && !helped.some(h => h.name === 'Old Move'), JSON.stringify(helped));
r = adjustDaily(A, yesterdayLoad([], lookup), lookup, { sore: ['quads'], helped });
ok('sore quads → Peterson lunge added', r.rows.some(x => x.name === 'Back Leg Lunge (Peterson Lunge)' && x.helped_add) && /added what helped/.test(r.note), r.note);
ok('a helped move for an area that\'s fine stays out', !r.rows.some(x => x.name === 'Wall Slides' && x.helped_add));
ok('nothing sore → nothing added', adjustDaily(A, yesterdayLoad([], lookup), lookup, { helped }).note === null);
console.log(fail ? `${fail} failed` : 'all passed');
process.exit(fail ? 1 : 0);
