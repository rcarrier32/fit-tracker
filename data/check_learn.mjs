/**
 * Checks src/lib/learn.js (what the app learns from the logs) and that the generator uses it.
 *
 *   node data/check_learn.mjs
 */
import { learnProfile, profileSummary } from '../src/lib/learn.js';
import { generatePlan } from '../src/lib/generator.js';
import { readFileSync } from 'fs';

let fail = 0;
const ok = (name, cond, extra = '') => { if (!cond) { fail++; console.log(`✗ ${name} ${extra}`); } else console.log(`✓ ${name}`); };

// Eight weeks, Mon/Wed/Fri. Bench goes up; curls stall; Bulgarian split squats always swapped to
// reverse lunges; set times 50 min apart.
const sessions = [];
const start = new Date('2026-09-14T12:00');
let k = 0;
for (let w = 0; w < 8; w++) for (const dow of [0, 2, 4]) {
  const d = new Date(start.getTime() + (w * 7 + dow) * 864e5);
  const date = d.toISOString().slice(0, 10);
  const t0 = d.getTime();
  const set = (weight, reps, i) => ({ weight, reps, done: true, at: t0 + i * 60000 * 7 });
  sessions.push({ id: ++k, date, done: true, exercises: [
    { name: 'Barbell Bench Press', target_reps: '8-10', sets: [set(135 + w * 5, 9, 0), set(135 + w * 5, 9, 1), set(135 + w * 5, 8, 2)] },
    { name: 'Dumbbell Curl', target_reps: '10-12', sets: [set(25, 10, 3), set(25, 10, 4), set(25, 10, 5)] },
    { name: 'Reverse Lunges', orig_name: 'Bulgarian Split Squat', swapped: true, target_reps: '8-10', sets: [set(30, 12, 6), set(30, 12, 7)] },
  ] });
}
sessions.push({ id: ++k, date: '2026-11-06', done: true, skipped: true, exercises: [] });

const prof = learnProfile(sessions, { today: '2026-11-10', muscleOf: (n) => ({ 'Barbell Bench Press': { primary_muscle: 'chest' }, 'Dumbbell Curl': { primary_muscle: 'biceps' } })[n] });
ok('enough data', prof.ready && prof.sessions === 24, JSON.stringify({ sessions: prof.sessions }));
ok('bench is progressing', prof.progressing.includes('Barbell Bench Press'));
ok('curls stalled', prof.stalled.includes('Dumbbell Curl'));
ok('Bulgarian avoided', prof.avoid.includes('Bulgarian Split Squat'));
ok('swap target remembered', prof.prefer['Bulgarian Split Squat'] === 'Reverse Lunges');
ok('about 3 a week', prof.days.per_week >= 2.5 && prof.days.per_week <= 3.5, String(prof.days.per_week));
ok('session length from set times', prof.duration && Math.abs(prof.duration.median_min - 53) <= 2, JSON.stringify(prof.duration));
ok('chest trend up, biceps flat', prof.muscles.chest?.trend_per_week > 0 && prof.muscles.biceps?.trend_per_week === 0, JSON.stringify(prof.muscles));
ok('overshoot noticed', prof.progression?.overshoot_rate > 0.2, JSON.stringify(prof.progression));
ok('summary reads', profileSummary(prof).length >= 4, profileSummary(prof).join(' | '));
ok('empty logs', profileSummary(learnProfile([], { today: '2026-11-10' }))[0].startsWith('Nothing logged'));
const hurtSessions = sessions.map((s, i) => i >= 20 && i < 23 ? { ...s, feel: { effort: 'hard', energy: 1 }, exercises: s.exercises.map(x => x.name === 'Dumbbell Curl' ? { ...x, hurt: true } : x) } : s);
const hp = learnProfile(hurtSessions, { today: '2026-11-10' });
ok('hurt twice → avoided', hp.hurts.includes('Dumbbell Curl') && hp.avoid.includes('Dumbbell Curl'));
ok('felt heavy → deload advice', !!hp.fatigue?.advice, JSON.stringify(hp.fatigue));
ok('too few logs → not ready', !learnProfile(sessions.slice(0, 3), { today: '2026-11-10' }).ready);

// The generator leaves out what you avoid, and picks what you swap to.
const rules = JSON.parse(readFileSync(new URL('./design_rules.json', import.meta.url), 'utf8'));
const { loadFullCatalog } = await import('./catalog.mjs');
const { exercises } = await loadFullCatalog();
for (const e of exercises) if (!e.video_url && e.video?.url) e.video_url = e.video.url;
const base = { goal: 'muscle', days: 4, minutes: 60, weeks: 6, equipment: ['dumbbell', 'barbell', 'bench', 'cable', 'machine', 'pullup_bar'], seed: 3 };
const names = (pl) => new Set(pl.weeks.flatMap(w => w.days.flatMap(d => d.exercises.map(x => x.name))));
const before = names(generatePlan(base, { exercises, rules }));
const avoidName = [...before].find(n => exercises.find(e => e.name === n)?.role === 'accessory');
const fake = { ...prof, avoid: [avoidName], prefer: {}, favorites: [], progressing: [], stalled: [] };
const planAfter = generatePlan({ ...base, profile: fake }, { exercises, rules });
ok(`avoided "${avoidName}" left out`, !names(planAfter).has(avoidName));
ok('plan says what it learned', planAfter.learned?.avoided.includes(avoidName));

console.log(fail ? `${fail} failed` : 'all passed');
process.exit(fail ? 1 : 0);
