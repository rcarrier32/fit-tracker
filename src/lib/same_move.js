/**
 * One move, once a day: Daily Mobility, the hip warm-up / Pelvic Reset and any workout can share a
 * move (Cat Cow, pelvic tilt breathing, the half-kneeling hip flexor stretch...). Once it's done in
 * one place today, the others show it as done there instead of asking for it again.
 * Plain module (no app imports) so it runs in node: `node data/check_same_move.mjs`.
 */

/** Different names for the same move across the plans. */
const ALIASES = {
  'cat camel': 'cat cow',
  'cat cow stretch': 'cat cow',
  'half kneeling hip flexor': 'half kneeling hip flexor stretch',
  'pelvic tilt breathing': 'posterior pelvic tilt breathing',
};

/** Canonical key for a move name: lowercase words, no "(optional)"-style notes, aliases folded. */
export function moveKey(name) {
  const k = String(name || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/\boptional\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ').trim();
  return ALIASES[k] || k;
}

/**
 * Where each move was done today.
 * @param sessions   today's workout sessions ({ id, program_id, exercises: [{ name, sets }] })
 * @param hipDone    names of hip-plan exercises checked off today
 * @param labelFor   program_id → label ("Daily Mobility", "Recovery & Mobility")
 * @returns Map moveKey → { label, sessionId | null }
 */
export function movesDoneToday(sessions = [], hipDone = [], labelFor = (id) => id) {
  const out = new Map();
  for (const s of sessions) {
    if (s.skipped) continue;
    for (const x of s.exercises || []) {
      if (!(x.sets || []).some(st => st?.done && !st.credit)) continue;   // a credit isn't a second source
      const k = moveKey(x.name);
      if (k && !out.has(k)) out.set(k, { label: labelFor(s.program_id), sessionId: s.id ?? null });
    }
  }
  for (const n of hipDone) {
    const k = moveKey(n);
    if (k && !out.has(k)) out.set(k, { label: 'Hip plan', sessionId: null });
  }
  return out;
}

/** Where this row's move was already done today, other than in this session (null if nowhere). */
export function doneElsewhere(name, done, sessionId = null) {
  const hit = done.get(moveKey(name));
  return hit && (hit.sessionId == null || hit.sessionId !== sessionId) ? hit : null;
}
