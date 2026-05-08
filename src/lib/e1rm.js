/**
 * 1RM estimation. Epley is fine for 1-10 reps; falls apart at higher reps.
 * For tracking trend over time, consistency matters more than absolute accuracy.
 */
export function epley(weight, reps) {
  if (!weight || !reps) return 0;
  if (reps <= 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

// RPE-adjusted 1RM (Brzycki + RPE chart approximation)
// reps_in_reserve = 10 - rpe; e1rm = weight / (1 - 0.0333 * (reps + RIR))
export function rpeE1RM(weight, reps, rpe) {
  if (!weight || !reps) return 0;
  if (rpe === undefined || rpe === null) return epley(weight, reps);
  const rir = Math.max(0, 10 - rpe);
  const totalReps = reps + rir;
  if (totalReps <= 1) return weight;
  const factor = 1 - 0.0333 * Math.min(totalReps - 1, 10);
  return factor > 0 ? Math.round(weight / factor) : weight;
}

export function setVolume(set) {
  return (set.weight || 0) * (set.reps || 0);
}
