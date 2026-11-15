/** Checks src/lib/daily_adjust.js against the real catalog and the Daily Mobility program. `node data/check_daily_adjust.mjs` */
import { readFileSync } from 'fs';
import { yesterdayLoad, adjustDaily, soreFromNotes, helpedMoves, prepForTomorrow, foldHipWarmup } from '../src/lib/daily_adjust.js';

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
ok('pogos off after heavy legs, no second balance hold', !r.rows.some(x => x.name === 'Pogos') && r.rows.filter(x => /single leg stance/i.test(x.name)).length === 1, r.note);
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
ok('pogos off after jumps', !adjustDaily(A, jumps, lookup).rows.some(x => x.name === 'Pogos'));
ok('a loaded lift you liked is not added to mobility', !adjustDaily(A, legs, lookup, { helped: [{ name: 'Bulgarian Split Squat', target_sets: 2, target_reps: '8' }] }).rows.some(x => x.helped_add));

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
// Tomorrow: a game → game prep added (only what today's routine lacks); rest day after big legs → a walk.
let p = prepForTomorrow(A, { label: 'Basketball' }, lookup);
const addedA = p.rows.filter(x => x.prep_add).map(x => x.name);
ok('before a game: Daily A gets hip CARs, adductor and ankle prep', ['Hip CARs', 'Adductor Rock Back', 'Hip Hinge Ankle Rocker'].every(n => addedA.includes(n)), addedA.join(', '));
ok('prep goes before the balance finish', p.rows.findIndex(x => x.prep_add) < p.rows.findIndex(x => /single leg stance/i.test(x.name)));
p = prepForTomorrow(C, { label: 'Basketball' }, lookup);
ok('Daily C already has a lateral lunge: no adductor prep', !p.rows.some(x => x.prep_add && x.name === 'Adductor Rock Back'), p.note);
ok('training tomorrow → unchanged', prepForTomorrow(A, { label: null, programId: 'lean_tone_home_6wk' }, lookup).note === null);
p = prepForTomorrow(A, null, lookup, { restToday: true, load: legs });
ok('rest day after heavy legs → starts with the PJF foam roll circuit', p.rows[0].name === 'Foam Roller Circuit');
ok('…aimed at the legs that were worked', /quads|glutes|hamstrings/.test(p.rows[0].notes), p.rows[0].notes);
ok('…standing split-stance reach → PJF floor rotation', !p.rows.some(x => /split stance lunge/i.test(x.name)) && p.rows.some(x => /rolling arm bar/i.test(x.name)));
ok('…and a 20 min Zone 2 walk you tick', p.rows.some(x => x.name === 'Brisk Walk' && x.time === '20:00'));
const easy = prepForTomorrow(A, null, lookup, { restToday: true, load: upper });
ok('rest day after an upper day → split-stance reach stays', easy.rows.some(x => /split stance lunge/i.test(x.name)));
ok('rest day after an upper day → foam roll, no walk', easy.rows[0].name === 'Foam Roller Circuit' && !easy.rows.some(x => x.name === 'Brisk Walk'));
const hipAfter = foldHipWarmup(p.rows, [{ name: 'Walk or Easy Bike', hip_id: 'w', time: '5:00' }]);
ok('hip warm-up walk → checked by the recovery walk', hipAfter.rows.find(x => x.name === 'Brisk Walk').covers_hip?.includes('w'));
ok('not a rest day → no foam roll', !prepForTomorrow(A, null, lookup, { load: upper }).rows.some(x => /foam/i.test(x.name)));
// No workout today: the hip warm-up folds in, only what isn't covered.
const HIP = [{ name: 'Walk or Easy Bike', hip_id: 'w', time: '5:00' }, { name: 'Cat-Cow', hip_id: 'c', reps: '10' }, { name: 'Pelvic Tilts', hip_id: 'p', reps: '15' },
  { name: 'Half-Kneeling Hip Flexor Stretch', hip_id: 'h', sets: 3, time: '30s' }, { name: 'Thomas Hip Flexor Stretch', hip_id: 't', sets: 2, time: '30s' },
  { name: 'Piriformis Stretch', hip_id: 'pi', sets: 3, time: '30s' }, { name: 'Hamstring Stretch', hip_id: 'hs', sets: 3, time: '30s' }];
let f = foldHipWarmup(A, HIP);
const addedH = f.rows.filter(x => x.hip_add).map(x => x.name);
ok('Daily A: adds pelvic tilts, piriformis, hamstring (cat camel and hip-flexor bridge cover the rest; no walk)',
  ['Pelvic Tilts', 'Piriformis Stretch', 'Hamstring Stretch'].every(n => addedH.includes(n)) && !addedH.some(n => /walk|cat|hip flexor/i.test(n)), addedH.join(', '));
ok('folded rows keep their hip_id', f.rows.filter(x => x.hip_add).every(x => x.hip_id));
ok('covered moves ride on the row that covers them', f.rows.find(x => x.name === 'Cat Camel')?.covers_hip?.includes('c'), JSON.stringify(f.rows.find(x => x.name === 'Cat Camel')));
f = foldHipWarmup(C, HIP);
ok('Daily C (pigeon, hamstring floss): piriformis and hamstring covered', !f.rows.some(x => x.hip_add && /piriformis|hamstring/i.test(x.name)), f.rows.filter(x => x.hip_add).map(x => x.name).join(', '));
console.log(fail ? `${fail} failed` : 'all passed');
process.exit(fail ? 1 : 0);
