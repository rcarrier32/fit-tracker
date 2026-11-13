/**
 * A training week that follows what you did, not the calendar: for a Mixed Week of one training program
 * plus a recovery program (Lean & Tone: Mon Tue train, Wed recovery, Thu Fri train, Sat recovery, Sun
 * rest), the program's days keep the pairs the week puts them in (Days 1+2, then Days 3+4) and recovery
 * comes after the last day of each pair, whatever weekday that lands on. Miss a day and nothing shifts
 * early: the next workout waits for you. Rest slots (Sunday) stay rest.
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
  // Which training days end a pair: in the week's own order (Monday first), the training slot whose next
  // non-rest slot is recovery. Lean & Tone: training days 2 and 4 of its 4.
  const seq = order.filter(s => s?.program_id);
  const nTrain = seq.filter(s => s.program_id === train).length;
  const pairEnds = [];
  let k = 0;
  seq.forEach((s, i) => {
    if (s.program_id !== train) return;
    k++;
    const next = seq[(i + 1) % seq.length];
    if (next?.program_id === companion) pairEnds.push(k);
  });
  return { train, companion, run: Math.max(1, Math.min(run, count[train])), nTrain, pairEnds };
}

/** Where a finished training session sits in the week's cycle (1..nTrain). */
function dayInCycle(s, nTrain) {
  const n = s.day_index != null && s.week == null ? s.day_index + 1 : s.day;
  return n ? ((n - 1) % nTrain) + 1 : null;
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
  // A rest or basketball day (a labelled slot) with no training done on it also starts a fresh run.
  let lastReset = null;
  for (let k = 1; k <= 7; k++) {
    const d = new Date(today + 'T12:00:00'); d.setDate(d.getDate() - k);
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (slots[d.getDay()]?.label && !before.some(s => s.date === ds && s.program_id === f.train)) { lastReset = ds; break; }
  }
  const from = [lastRecovery, lastReset].filter(Boolean).sort().pop() || null;
  const since = before.filter(s => s.program_id === f.train && (!from || s.date > from))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.id || 0) - (b.id || 0));
  if (!since.length) return f.train;
  // Recovery after the last day of a pair (Day 2, Day 4); also after the week's longest run as a backstop.
  const pos = dayInCycle(since[since.length - 1], f.nTrain);
  if (pos != null && f.pairEnds.includes(pos)) return f.companion;
  return new Set(since.map(s => s.date)).size >= f.run ? f.companion : f.train;
}

/**
 * How many training workouts behind this week's plan you are, before today: the week's training slots
 * from Monday to yesterday, minus the training sessions finished (not skipped) since Monday. A session
 * that also did the next day's work (merged_day) counts twice. 0 when on track or ahead.
 * @param slots   the Mixed Week (Sun..Sat)
 * @param trainId the training program
 * @param today   'YYYY-MM-DD'
 */
export function behindThisWeek(slots, trainId, sessions, today) {
  const t = new Date(today + 'T12:00:00');
  const sinceMon = (t.getDay() + 6) % 7;                 // Mon 0 … Sun 6
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  let planned = 0;
  for (let k = 1; k <= sinceMon; k++) {
    const d = new Date(t); d.setDate(d.getDate() - k);
    if (slots?.[d.getDay()]?.program_id === trainId) planned++;
  }
  const mon = new Date(t); mon.setDate(mon.getDate() - sinceMon);
  const done = (sessions || []).filter(s => s.program_id === trainId && s.done && !s.skipped && s.date >= ymd(mon) && s.date < today)
    .reduce((n, s) => n + (s.merged_day ? 2 : 1), 0);
  return Math.max(0, planned - done);
}
