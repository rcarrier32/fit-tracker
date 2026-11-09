/**
 * Builds "Hip Plan: PT + Motion RC" into data/library.json (programs.hip) from the Hip tab's
 * own data (src/lib/hip_protocol.js), so the plan runs on the Lift card like every other
 * program: weights, reps, timers, videos, week-by-week progress.
 *
 *   node data/build_hip_program.mjs && python3 data/tag_exercises.py
 *
 * Session A / Session B alternate 3 days a week (A·B·A, then B·A·B), exactly as the Hip tab
 * schedules them. Each 2-week phase moves every exercise one step up its progression
 * ladder (HIP_LADDERS), skipping any step without a video. Prep work becomes the warm-up.
 */
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { SECTIONS, EXERCISE_INDEX, HIP_LADDERS } from '../src/lib/hip_protocol.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const LIB = path.join(ROOT, 'data/library.json');
const lib = JSON.parse(readFileSync(LIB, 'utf8'));

const WARMUP_IDS = ['mrc-distraction-ir', 'mrc-distraction-er', 'mrc-seated-banded-ir', 'mrc-tfl-ir-stretch', 'mrc-quadruped-hip-hike'];
const WEEKS = 6;
const session = (id) => SECTIONS.find(s => s.id === id).exercises;

/** "3 × 10 per leg" → { sets: 3, reps: '10 per leg' }; "3 × 30 s" → { sets: 3, time: '30s' }. */
function parseRx(rx) {
  const m = String(rx || '').match(/^\s*(\d+)\s*[×x]\s*(.+)$/);
  if (!m) return { sets: 1, reps: String(rx || '') };
  const sets = +m[1], rest = m[2].trim();
  const t = rest.match(/^(\d+)\s*s\b(.*)$/);
  if (t) return { sets, time: `${t[1]}s`, note: t[2].replace(/^[,\s]+/, '') || null };
  const [reps, load] = rest.split('@').map(x => x.trim());
  return { sets, reps, note: load ? `Load: ${load}` : null };
}

/** The ladder step for this phase (0, 1, 2…), skipping steps without a video. */
function atPhase(id, phase) {
  const ladder = HIP_LADDERS[id];
  if (!ladder) return EXERCISE_INDEX[id];
  const steps = ladder.steps.map(s => EXERCISE_INDEX[s]).filter(Boolean);
  for (let i = Math.min(phase, steps.length - 1); i >= 0; i--) {
    if (steps[i].videoId || steps[i].video_url) return steps[i];
  }
  return steps[0];
}

const rowFor = (ex) => {
  const rx = parseRx(ex.sets);
  return {
    name: ex.name, round_group: null, is_alternate: false, sets: rx.sets, reps: rx.reps || null, weight: null,
    distance: null, time: rx.time || null, rest: rx.time ? '30s' : '60s',
    notes: [rx.note, ex.cues?.[0]].filter(Boolean).join(' ') || null,
  };
};

const warmup = WARMUP_IDS.map(id => EXERCISE_INDEX[id]).map(ex => {
  const rx = parseRx(ex.sets);
  return { name: ex.name, reps: rx.reps || null, time: rx.time || null, notes: ex.subtitle || null };
});
// The Hip tab warm-up is all hips; Session A also works core hard, so add one core move (Griffith's demo).
warmup.push({ name: 'Dead Bug', reps: '5 each side', time: null, notes: 'Slow, low back pressed down: wakes up the core.' });

function dayFor(sessionId, dayNum, phase, week) {
  const label = sessionId === 'session-a' ? 'Session A' : 'Session B';
  const exercises = session(sessionId)
    .filter(ex => !WARMUP_IDS.includes(ex.id))
    .map(ex => rowFor({ ...atPhase(ex.id, phase), sets: atPhase(ex.id, phase).sets || ex.sets }));
  const inPhase = ((week - 1) % 2) + 1;
  return {
    day_num: dayNum,
    focus: `${label} · ${sessionId === 'session-a' ? 'Posterior & Single-Leg' : 'Lateral & Adductors'}`,
    warmup,
    notes: [
      `Phase ${phase + 1} of 3, week ${inPhase}: ${phase === 0 ? 'your PT and Motion RC exercises as prescribed.' : 'every exercise moved one step up its progression.'}`,
      inPhase === 2 ? 'Same exercises as last week: add a rep, a few seconds, or a little load.' : 'Log the load you use so next week starts from it.',
    ],
    exercises,
  };
}

const weeks = [];
for (let w = 1; w <= WEEKS; w++) {
  const phase = Math.floor((w - 1) / 2);
  const order = w % 2 === 1 ? ['session-a', 'session-b', 'session-a'] : ['session-b', 'session-a', 'session-b'];
  weeks.push({ week_num: w, days: order.map((s, i) => dayFor(s, i + 1, phase, w)) });
}

const program = {
  id: 'hip_plan_pt_motion_rc',
  program_name: 'Hip Plan: PT + Motion RC',
  group: 'Your Hip Plan',
  source: 'Hip',
  description: 'Your Hip tab sessions on the Lift screen: Session A and B alternate 3 days a week with your PT and Motion RC exercises, '
    + 'and every 2 weeks each exercise moves up its progression (single-leg bench bridge, long-lever Copenhagen, unsupported airplanes…).',
  sessions_per_week: 3,
  session_length_min: 45,
  level: 'Your plan',
  equipment: ['Long band', 'Mini band', 'Bench or box', 'Slider', 'Foam roller', 'BOSU or pad', 'Dumbbell or kettlebell'],
  goal: 'Build the hip: strength, control and range, then load it.',
  weeks,
};

lib.programs.hip = [program];
writeFileSync(LIB, JSON.stringify(lib, null, 2) + '\n');
console.log('wrote', program.id, weeks.length, 'weeks;', [...new Set(weeks.flatMap(w => w.days.flatMap(d => d.exercises.map(x => x.name))))].length, 'distinct exercises');
