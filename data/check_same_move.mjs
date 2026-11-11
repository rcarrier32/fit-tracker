/** Checks src/lib/same_move.js. `node data/check_same_move.mjs` */
import { moveKey, movesDoneToday, doneElsewhere } from '../src/lib/same_move.js';

let fail = 0;
const ok = (n, c, x = '') => { if (!c) { fail++; console.log(`✗ ${n} ${x}`); } else console.log(`✓ ${n}`); };

ok('Cat Camel = Cat-Cow', moveKey('Cat Camel') === moveKey('Cat-Cow'));
ok('hyphens and case', moveKey('Half-Kneeling Hip Flexor Stretch') === moveKey('Half Kneeling Hip Flexor Stretch'));
ok('optional dropped', moveKey('Double Leg Functional Calf Raise (Optional)') === moveKey('Double Leg Functional Calf Raise'));
ok('different moves stay different', moveKey('Pelvic Tilts') !== moveKey('Posterior Pelvic Tilt Breathing') && moveKey('Hamstring Stretch') !== moveKey('Hamstring Floss'));

const done1 = (n) => ({ name: n, sets: [{ done: true }] });
const sessions = [
  { id: 1, program_id: 'daily_mobility', exercises: [done1('Cat Camel'), { name: 'Pogos', sets: [{ done: false }] }, done1('Posterior Pelvic Tilt Breathing')] },
  { id: 2, program_id: 'recovery', skipped: true, exercises: [done1('Dead Bug')] },
  { id: 3, program_id: 'recovery', exercises: [{ name: 'World\'s Greatest Stretch', sets: [{ done: true, credit: 'Daily Mobility' }] }] },
];
const label = (id) => ({ daily_mobility: 'Daily Mobility', recovery: 'Recovery & Mobility' }[id] || id);
const m = movesDoneToday(sessions, ['Half-Kneeling Hip Flexor Stretch'], label);
ok('Cat-Cow on the hip plan → done in Daily Mobility', doneElsewhere('Cat-Cow', m)?.label === 'Daily Mobility');
ok('not done elsewhere within its own session', doneElsewhere('Cat Camel', m, 1) === null);
ok('another session sees it', doneElsewhere('Cat Camel', m, 3)?.label === 'Daily Mobility');
ok('unlogged sets don\'t count', doneElsewhere('Pogos', m, 3) === null);
ok('skipped sessions don\'t count', doneElsewhere('Dead Bug', m) === null);
ok('credits don\'t count as a source', doneElsewhere('World\'s Greatest Stretch', m) === null);
ok('hip plan check-off reaches workouts', doneElsewhere('Half Kneeling Hip Flexor Stretch', m, 1)?.label === 'Hip plan');

console.log(fail ? `${fail} failed` : 'all passed');
process.exit(fail ? 1 : 0);
