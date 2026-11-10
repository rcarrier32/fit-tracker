/**
 * Checks src/lib/adapt.js (next-session targets from logged sets).
 *
 *   node data/check_adapt.mjs
 */
import { nextTarget, deloadAdvice, repRange } from '../src/lib/adapt.js';

let fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fail++; console.log(`✗ ${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); }
  else console.log(`✓ ${name}`);
};
const s = (...pairs) => ({ sets: pairs.map(([weight, reps]) => ({ weight, reps, done: true })) });
const today = '2026-11-10';
const at = (d, x) => ({ ...x, date: d });
const pick = (t) => t && { weight: t.weight, reps: t.reps, kind: t.kind };

eq('range 8-10', repRange('8-10 each side'), [8, 10]);
eq('range 12', repRange('12'), [12, 12]);
eq('range AMRAP', repRange('AMRAP'), null);
eq('no history', nextTarget({ target: '8-10', today }), null);
eq('all sets at top → add 5 lb, back to 8',
  pick(nextTarget({ history: [at('2026-11-07', s([100, 10], [100, 10], [100, 10]))], target: '8-10', sets: 3, equipment: ['barbell'], today })),
  { weight: 105, reps: 8, kind: 'up' });
eq('one set short → hold, beat it',
  pick(nextTarget({ history: [at('2026-11-07', s([100, 10], [100, 9], [100, 8]))], target: '8-10', sets: 3, equipment: ['barbell'], today })),
  { weight: 100, reps: 10, kind: 'hold' });
eq('light dumbbells: jump too big → reps first',
  pick(nextTarget({ history: [at('2026-11-07', s([20, 15], [20, 15], [20, 15]))], target: '12-15', sets: 3, equipment: ['dumbbell'], today })),
  { weight: 20, reps: 17, kind: 'reps' });
eq('small dumbbells step 2.5',
  pick(nextTarget({ history: [at('2026-11-07', s([10, 12], [10, 12]))], target: '10-12', sets: 2, equipment: ['dumbbell'], today })),
  { weight: 10, reps: 14, kind: 'reps' });
eq('under range twice → down ~8%',
  pick(nextTarget({ history: [at('2026-11-07', s([135, 6], [135, 5])), at('2026-11-03', s([135, 7], [135, 6]))], target: '8-10', sets: 2, equipment: ['barbell'], today })),
  { weight: 125, reps: 8, kind: 'down' });
eq('under range once → hold',
  pick(nextTarget({ history: [at('2026-11-07', s([135, 6], [135, 5])), at('2026-11-03', s([130, 9], [130, 8]))], target: '8-10', sets: 2, equipment: ['barbell'], today })).kind,
  'hold');
eq('two weeks off → 90%',
  pick(nextTarget({ history: [at('2026-10-20', s([200, 8], [200, 8]))], target: '6-8', sets: 2, equipment: ['barbell'], today })),
  { weight: 180, reps: 6, kind: 'back' });
eq('fewer sets than prescribed → no weight jump',
  pick(nextTarget({ history: [at('2026-11-07', s([100, 10], [100, 10]))], target: '8-10', sets: 3, equipment: ['barbell'], today })).kind,
  'hold');
eq('bodyweight at top → harder version',
  pick(nextTarget({ history: [at('2026-11-07', s([0, 15], [0, 15], [0, 15]))], target: '12-15', sets: 3, today })),
  { weight: null, reps: 15, kind: 'harder' });
eq('manual change carries: heaviest set is the baseline',
  pick(nextTarget({ history: [at('2026-11-07', s([95, 10], [110, 10], [110, 10]))], target: '8-10', sets: 2, equipment: ['barbell'], today })),
  { weight: 115, reps: 8, kind: 'up' });
eq('third jump in a row → offer a set',
  !!nextTarget({ history: [at('2026-11-07', s([110, 10], [110, 10], [110, 10])), at('2026-11-04', s([105, 9], [105, 8], [105, 8])), at('2026-11-01', s([100, 10], [100, 10], [100, 10]))], target: '8-10', sets: 3, equipment: ['barbell'], today }).addSet, true);
eq('first jump → no extra set',
  !!nextTarget({ history: [at('2026-11-07', s([100, 10], [100, 10], [100, 10])), at('2026-11-04', s([100, 9], [100, 8], [100, 8]))], target: '8-10', sets: 3, equipment: ['barbell'], today }).addSet, false);
eq('feeling beat → no extra set',
  !!nextTarget({ history: [at('2026-11-07', s([110, 10], [110, 10], [110, 10])), at('2026-11-04', s([105, 9], [105, 8], [105, 8])), at('2026-11-01', s([100, 10], [100, 10], [100, 10]))], target: '8-10', sets: 3, equipment: ['barbell'], today, profile: { fatigue: { advice: 'x' } } }).addSet, false);
eq('deload advice at 3 drops', !!deloadAdvice([{ kind: 'down' }, { kind: 'down' }, { kind: 'down' }, { kind: 'up' }]), true);
eq('no deload advice at 2', deloadAdvice([{ kind: 'down' }, { kind: 'down' }]), null);

console.log(fail ? `${fail} failed` : 'all passed');
process.exit(fail ? 1 : 0);
