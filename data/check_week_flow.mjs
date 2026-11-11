/** Checks src/lib/week_flow.js. `node data/check_week_flow.mjs` */
import { flowOf, flowProgram } from '../src/lib/week_flow.js';
let fail = 0;
const ok = (n, c, x = '') => { if (!c) { fail++; console.log(`✗ ${n} ${x}`); } else console.log(`✓ ${n}`); };
const P = 'lean_tone_home_6wk', R = 'move30_recovery_mobility';
const T = { program_id: P, mode: 'follow' }, REC = { program_id: R, mode: 'follow' }, REST = { label: 'Rest' };
const week = [REST, T, T, REC, T, T, REC];   // Lean & Tone's suggested week, Sun..Sat
const fw = flowOf(week);
ok('flow found: run of 2, pairs end on days 2 and 4', fw.train === P && fw.companion === R && fw.run === 2 && fw.nTrain === 4 && fw.pairEnds.join() === '2,4', JSON.stringify(fw));
ok('one program only → no flow', flowOf([REST, T, T, T, T, T, REST]) === null);
const S = (date, program_id, extra = {}) => ({ date, program_id, done: true, ...extra });
const L = (date, day, week = 1) => S(date, P, { week, day });
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
// Pairs kept: the user's weeks from here (Tue Day 1, Wed recovery).
let h = [L('2026-11-10', 1), S('2026-11-11', R)];
const step = (dow, date, want, add) => { const got = flowProgram(week, dow, h, date); ok(`${date}: ${want === P ? 'train' : want === R ? 'recovery' : 'rest'}`, got === want, String(got)); if (add) h.push(add); };
step(4, '2026-11-12', P, L('2026-11-12', 2));          // Thu Day 2
step(5, '2026-11-13', R, S('2026-11-13', R));          // Fri recovery (after Day 2)
step(6, '2026-11-14', P, L('2026-11-14', 3));          // Sat Day 3 (not recovery: pair 3+4 starts)
step(0, '2026-11-15', null);                           // Sun rest
step(1, '2026-11-16', P, L('2026-11-16', 4));          // Mon Day 4
step(2, '2026-11-17', R, S('2026-11-17', R));          // Tue recovery (after Day 4)
step(3, '2026-11-18', P, L('2026-11-18', 1, 2));       // Wed week 2 Day 1
step(4, '2026-11-19', P, L('2026-11-19', 2, 2));       // Thu Day 2
step(5, '2026-11-20', R);                              // Fri recovery
// Basketball week: Sun rest, Mon 🏀, Tue Wed train, Thu recovery, Fri 🏀, Sat train (Day 3 + Day 4's circuit).
const B = { label: 'Basketball' };
const bw = [REST, B, T, T, REC, B, T];
const fb = flowOf(bw);
ok('basketball week: pairs end on day 2', fb.pairEnds.join() === '2' && fb.nTrain === 3, JSON.stringify(fb));
h = [L('2026-11-14', 3)];                                  // Sat Day 3 (+4)
const st2 = (dow, date, want, add) => { const got = flowProgram(bw, dow, h, date); ok(`basketball week ${date}: ${want ?? 'label'}`, got === want, String(got)); if (add) h.push(add); };
st2(1, '2026-11-16', null);                                // Mon 🏀 (label)
st2(2, '2026-11-17', P, L('2026-11-17', 1, 2));            // Tue Day 1
st2(3, '2026-11-18', P, L('2026-11-18', 2, 2));            // Wed Day 2 (Mon game resets the count)
st2(4, '2026-11-19', R, S('2026-11-19', R));               // Thu recovery
st2(5, '2026-11-20', null);                                // Fri 🏀
st2(6, '2026-11-21', P);                                   // Sat Day 3
// The user's switch, mid-week (Wed 11-11): Tue Day 1, Wed recovery done; basketball week from now on.
h = [L('2026-11-10', 1), S('2026-11-11', R)];
const st3 = (dow, date, want, add) => { const got = flowProgram(bw, dow, h, date); ok(`switch week ${date}: ${want === P ? 'train' : want === R ? 'recovery' : 'label'}`, got === want, String(got)); if (add) h.push(add); };
st3(4, '2026-11-12', P, L('2026-11-12', 2));               // Thu: Day 2 (a recovery slot, but only one workout since)
st3(5, '2026-11-13', null);                                // Fri 🏀
st3(6, '2026-11-14', P, L('2026-11-14', 3));               // Sat Day 3 (+ Day 4's circuit)
st3(0, '2026-11-15', null);                                // Sun rest
st3(1, '2026-11-16', null);                                // Mon 🏀
st3(2, '2026-11-17', P, L('2026-11-17', 1, 2));            // Tue week 2 Day 1
st3(3, '2026-11-18', P, L('2026-11-18', 2, 2));            // Wed Day 2
st3(4, '2026-11-19', R);                                   // Thu recovery
console.log(fail ? `${fail} failed` : 'all passed');
process.exit(fail ? 1 : 0);
