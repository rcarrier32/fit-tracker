/**
 * Next-session targets from what was logged: the adaptive layer on top of a written plan.
 * Plain module (no app imports) so it runs in node for tests: `node data/check_adapt.mjs`.
 *
 * Rules (docs/research/Workout plan builder methods.md, "Adaptive layer"):
 * - Double progression: when every set at the working weight reached the top of the rep range,
 *   add the smallest weight step and aim for the bottom of the range. If that step is more than
 *   10% of the load (light dumbbells), aim for 2 more reps at the same weight first.
 * - Below the range on two sessions in a row at that weight: drop about 8% and rebuild.
 * - Back after 14+ days: start at about 90% of the last weight.
 * - Otherwise: same weight, beat last time's reps.
 * - What was logged is the baseline, so a weight the person changed by hand carries forward.
 * - No load logged (bodyweight): every set at the top of the range → move to a harder version.
 */

const STEP_LB = { barbell: 5, trap_bar: 10, smith: 5, landmine: 5, machine: 5, cable: 5, kettlebell: 5, dumbbell: 5, sled: 10 };

export function repRange(target) {
  const s = String(target || '');
  let m = s.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (m) return [+m[1], +m[2]];
  m = s.match(/^\s*(\d+)\b/);
  return m ? [+m[1], +m[1]] : null;
}

export function weightStep(weight, equipment = []) {
  const steps = equipment.map(q => STEP_LB[q]).filter(Boolean);
  let step = steps.length ? Math.min(...steps) : 5;
  if ((equipment.includes('dumbbell') || equipment.includes('cable')) && weight > 0 && weight < 15) step = 2.5;
  return step;
}

const roundTo = (v, step) => Math.max(step, Math.round(v / step) * step);
const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 86400000);

/** The logged sets of one session at its working (heaviest) weight. */
function working(session) {
  const done = (session?.sets || []).filter(s => s && s.reps && (s.done ?? true));
  if (!done.length) return null;
  const w = Math.max(...done.map(s => +s.weight || 0));
  return { weight: w, reps: done.filter(s => (+s.weight || 0) === w).map(s => +s.reps), count: done.length };
}

/**
 * @param history   past sessions of this exercise, newest first: [{ date, sets: [{weight, reps, done}] }]
 * @param target    the prescribed reps ("8-10", "10-12 each side", "12")
 * @param sets      prescribed number of sets
 * @param equipment the exercise's equipment tags
 * @param today     'YYYY-MM-DD'
 * @returns { weight, reps, kind: 'up'|'reps'|'hold'|'down'|'back'|'harder', note } or null when there's nothing to go on
 */
export function nextTarget({ history = [], target, sets = 3, equipment = [], today, profile = null }) {
  const range = repRange(target);
  const last = working(history[0]);
  if (!range || !last) return null;
  const [lo, hi] = range;
  const w = last.weight;
  const gap = today && history[0].date ? daysBetween(history[0].date, today) : 0;

  if (!w) {
    if (last.count >= sets && last.reps.every(r => r >= hi)) {
      return { weight: null, reps: hi, kind: 'harder', note: `Every set hit ${hi} last time: move to a harder version (⋯ → Swap) or add load.` };
    }
    return null;
  }
  const step = weightStep(w, equipment);
  if (gap >= 14) {
    return { weight: roundTo(w * 0.9, step), reps: lo, kind: 'back', note: `${gap} days since last time: start at about 90% and build back.` };
  }
  const allHit = last.count >= sets && last.reps.length >= Math.min(sets, last.count) && last.reps.every(r => r >= hi);
  if (allHit) {
    if (step / w > 0.1) {
      return { weight: w, reps: hi + 2, kind: 'reps', note: `Every set hit ${hi}. A ${step} lb jump is big at ${w} lb: aim for ${hi + 2} reps first.` };
    }
    // Learned (src/lib/learn.js): if you usually beat the top of the range by 2+, and did again, jump twice as far.
    if (profile?.progression?.overshoot_rate >= 0.3 && last.reps.every(r => r >= hi + 2) && (2 * step) / w <= 0.1) {
      return { weight: w + 2 * step, reps: lo, kind: 'up', note: `↑ ${2 * step} lb: you beat ${hi} on every set, as you often do.` };
    }
    return { weight: w + step, reps: lo, kind: 'up', note: `↑ ${step} lb: every set hit ${hi} last time.` };
  }
  const under = (s) => { const x = working(s); return x && x.weight >= w && x.reps.some(r => r < lo); };
  if (under(history[0]) && under(history[1])) {
    const down = roundTo(w * 0.92, step);
    return { weight: down < w ? down : w - step, reps: lo, kind: 'down', note: `↓ Under ${lo} reps two sessions running: lighter, then build back up.` };
  }
  const best = Math.max(...last.reps);
  return { weight: w, reps: Math.min(hi, Math.max(lo, best + (best < hi ? 1 : 0))), kind: 'hold',
           note: `Same weight: beat ${last.reps.join(', ')}. At ${hi} on every set, add weight.` };
}

/** Several lifts going backwards in one session is the cue for a deload week (none is scheduled). */
export function deloadAdvice(targets) {
  const down = targets.filter(t => t?.kind === 'down').length;
  return down >= 3 ? `${down} lifts have dropped two sessions running. Consider a deload week: half the sets, same weights, then build back.` : null;
}
