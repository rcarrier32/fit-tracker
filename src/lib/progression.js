/**
 * Levels and how exercises progress. Plain module (no app imports) so the plan generator can use it in node too.
 * See docs/EXERCISE_TAXONOMY.md.
 */
export const LEVEL_LABEL = { 1: 'Beginner', 2: 'Intermediate', 3: 'Advanced' };

// Movements that get harder by changing the exercise, not by adding weight (Griffith's way).
const VARIATION_PATTERNS = new Set(['mobility', 'balance', 'isometric', 'plyo_jump', 'plyo_bound_hop', 'speed_accel',
  'agility_cod', 'deceleration_landing', 'rotation', 'anti_rotation', 'anti_extension', 'lateral_flexion']);
const LOADS = new Set(['dumbbell', 'kettlebell', 'barbell', 'trap_bar', 'cable', 'machine', 'smith', 'landmine', 'sled']);
/**
 * How an exercise progresses: 'load' (more weight or reps, the BWS way) or 'variation' (move up to a
 * harder version: supported → loaded → single-leg/elevated → dynamic, Griffith's way).
 * An explicit `progresses_by` tag wins; otherwise it's derived from the movement.
 */
export function progressesBy(e) {
  if (!e) return 'load';
  if (e.progresses_by) return e.progresses_by;
  if (['warmup', 'cooldown'].includes(e.role) || VARIATION_PATTERNS.has(e.pattern)) return 'variation';
  if (e.hip_focus && !(e.equipment || []).some(q => LOADS.has(q))) return 'variation';
  return 'load';
}

