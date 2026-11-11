/** Checks src/lib/week_flow.js. `node data/check_week_flow.mjs` */
import { flowOf, flowProgram } from '../src/lib/week_flow.js';
let fail = 0;
const ok = (n, c, x = '') => { if (!c) { fail++; console.log(`✗ ${n} ${x}`); } else console.log(`✓ ${n}`); };
const P = 'lean_tone_home_6wk', R = 'move30_recovery_mobility';
const T = { program_id: P, mode: 'follow' }, REC = { program_id: R, mode: 'follow' }, REST = { label: 'Rest' };
const week = [REST, T, T, REC, T, T, REC];   // Lean & Tone's suggested week, Sun..Sat
ok('flow found: run of 2', JSON.stringify(flowOf(week)) === JSON.stringify({ train: P, companion: R, run: 2 }), JSON.stringify(flowOf(week)));
ok('one program only → no flow', flowOf([REST, T, T, T, T, T, REST]) === null);
const S = (date, program_id, extra = {}) => ({ date, program_id, done: true, ...extra });
// The user's week: Mon 11-09 nothing, Tue 11-10 Lean & Tone Day 1.
const tue = [S('2026-11-10', P)];
ok('Wed after only one workout → Lean & Tone, not recovery', flowProgram(week, 3, tue, '2026-11-11') === P);
ok('Wed, recovery already done today → stays recovery', flowProgram(week, 3, [...tue, S('2026-11-11', R)], '2026-11-11') === R);
const wedRec = [...tue, S('2026-11-11', R)];
ok('Thu after recovery → Lean & Tone', flowProgram(week, 4, wedRec, '2026-11-12') === P);
ok('Fri after one → Lean & Tone', flowProgram(week, 5, [...wedRec, S('2026-11-12', P)], '2026-11-13') === P);
ok('Sat after two → recovery', flowProgram(week, 6, [...wedRec, S('2026-11-12', P), S('2026-11-13', P)], '2026-11-14') === R);
ok('Sun stays rest', flowProgram(week, 0, wedRec, '2026-11-15') === null);
ok('a Tue slot after two in a row → recovery', flowProgram(week, 2, [S('2026-11-15', P), S('2026-11-16', P)], '2026-11-17') === R);
ok('skipped workouts don\'t count', flowProgram(week, 3, [S('2026-11-09', P), S('2026-11-10', P, { skipped: true })], '2026-11-11') === P);
ok('first ever day → train', flowProgram(week, 1, [], '2026-11-09') === P);
ok('two sessions one day count once', flowProgram(week, 3, [S('2026-11-10', P), S('2026-11-10', P)], '2026-11-11') === P);
console.log(fail ? `${fail} failed` : 'all passed');
process.exit(fail ? 1 : 0);
