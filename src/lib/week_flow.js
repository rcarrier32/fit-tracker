/**
 * A training week that follows what you did, not the calendar: for a Mixed Week of one training program
 * plus a recovery program (Lean & Tone's "two on, recovery"), recovery comes after you've finished as
 * many training days in a row as the week plans (2), whatever day that lands on. Miss a day and nothing
 * shifts early: the next workout waits for you. Rest slots (Sunday) stay rest.
 * Plain module so it runs in node: `node data/check_week_flow.mjs`.
 */

/** The training program, its recovery companion and the planned run of training days, or null. */
export function flowOf(slots) {
  const ids = (slots || []).filter(s => s?.program_id && s.mode === 'follow').map(s => s.program_id);
  const count = {};
  for (const id of ids) count[id] = (count[id] || 0) + 1;
  const progs = Object.keys(count);
  if (progs.length !== 2) return null;
  const companion = progs.find(id => /recovery|mobility/i.test(id));
  const train = progs.find(id => id !== companion);
  if (!companion || !train) return null;
  // Longest run of training slots in a row, Monday first (the week wraps).
  const order = [1, 2, 3, 4, 5, 6, 0].map(d => slots[d]);
  let run = 0, cur = 0;
  for (const s of [...order, ...order]) { cur = s?.program_id === train ? cur + 1 : 0; run = Math.max(run, Math.min(cur, 7)); }
  return { train, companion, run: Math.max(1, Math.min(run, count[train])) };
}

/**
 * Which program today's slot should be.
 * @param slots    the Mixed Week (Sun..Sat)
 * @param dow      today's weekday (0 = Sun)
 * @param sessions sessions ({ date, program_id, done, skipped })
 * @param today    'YYYY-MM-DD'
 * @returns program id, or null to leave the slot as it is (a rest slot, or not a training + recovery week)
 */
export function flowProgram(slots, dow, sessions, today) {
  const f = flowOf(slots);
  const slot = slots?.[dow];
  if (!f || !slot?.program_id || ![f.train, f.companion].includes(slot.program_id)) return null;
  const fin = (sessions || []).filter(s => s.done && !s.skipped && (s.program_id === f.train || s.program_id === f.companion));
  // Already finished one today: today stays that one.
  const todays = fin.filter(s => s.date === today).sort((a, b) => (b.id || 0) - (a.id || 0))[0];
  if (todays) return todays.program_id;
  const before = fin.filter(s => s.date < today);
  const lastRecovery = before.filter(s => s.program_id === f.companion).map(s => s.date).sort().pop() || null;
  const trainedSince = new Set(before.filter(s => s.program_id === f.train && (!lastRecovery || s.date > lastRecovery)).map(s => s.date)).size;
  // No recovery yet and nothing trained: start with training.
  return trainedSince < f.run ? f.train : f.companion;
}
