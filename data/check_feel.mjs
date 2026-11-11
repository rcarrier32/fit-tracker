/** Checks src/lib/feel.js. `node data/check_feel.mjs` */
import { readNote, energyOf, heavyCheckIn, noteSummary } from '../src/lib/feel.js';
let fail = 0;
const ok = (n, c, x = '') => { if (!c) { fail++; console.log(`✗ ${n} ${x}`); } else console.log(`✓ ${n}`); };
const eq = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

let r = readNote('Front legs like quad from above knee up to hip flexor extra sore from prior day workout');
ok('the user\'s note: quads + hip flexors sore, not knees', eq(r.sore, ['quads', 'hip flexors']) && !r.pain.length, JSON.stringify(r));
r = readNote('Left knee hurts going down stairs');
ok('knee pain', eq(r.pain, ['knees']), JSON.stringify(r));
r = readNote('Knee feels fine. Hamstrings and glutes tight.');
ok('fine knee ignored, tight hamstrings/glutes', eq(r.sore, ['hamstrings', 'glutes']) && !r.pain.length, JSON.stringify(r));
r = readNote('Sharp pinch in the front of my hip on lunges, low back a bit stiff');
ok('pain vs sore split by clause', eq(r.pain, ['hip flexors']) && eq(r.sore, ['lower back']), JSON.stringify(r));
r = readNote('Slept badly, felt drained');
ok('tired', r.tired && !r.sore.length);
ok('empty note', !readNote('').tired && !readNote(undefined).sore.length);
ok('no area, no hit', !readNote('great session').sore.length);
ok('calf/achilles', eq(readNote('achilles is sore').sore, ['calves']));

ok('5-point energy kept', energyOf({ energy5: 4 }) === 4);
ok('old 3-point mapped', energyOf({ energy: 1 }) === 1 && energyOf({ energy: 2 }) === 3 && energyOf({ energy: 3 }) === 5);
ok('no energy → null', energyOf({}) === null && energyOf(null) === null);
ok('heavy: too much', heavyCheckIn({ feel: { effort: 'hard' } }));
ok('heavy: Low', heavyCheckIn({ feel: { energy5: 2 } }) && !heavyCheckIn({ feel: { energy5: 3 } }));
ok('heavy: old Drained', heavyCheckIn({ feel: { energy: 1 } }) && !heavyCheckIn({ feel: { energy: 2 } }));
ok('heavy: tired note', heavyCheckIn({ feel: { energy5: 4 }, note: 'so tired today' }));
ok('summary names areas', /quads/.test(noteSummary(readNote('quads and hip flexors sore'))) && /hip flexors/.test(noteSummary(readNote('quads and hip flexors sore'))));
ok('summary empty when nothing read', noteSummary(readNote('good one')) === '');
ok('list inherits the word', eq(readNote('quads, hamstrings sore').sore, ['quads', 'hamstrings']));
console.log(fail ? `${fail} failed` : 'all passed');
process.exit(fail ? 1 : 0);
