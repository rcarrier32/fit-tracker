/**
 * Lay out a generated plan's week around the sports you play (pickup basketball Mon & Fri…). Plain
 * module so it runs in node: `node data/check_week_plan.mjs`.
 *
 * Rules (docs/PROGRAM_DESIGN.md "Sports days in generated plans"):
 * - Game days are the game. Sunday is rest (or the first free day if you play Sunday).
 * - Training days go on the other days, in the plan's order; the week may start on any of its days
 *   (start_dow says which weekday Day 1 falls on), so e.g. the upper days can sit before the games.
 * - No leg-heavy day the day before a game (tired legs in a game is how you get hurt); a leg day the day
 *   after a game is fine (its jumps come out on the day, src/views/workout.js).
 * - No more than two hard days in a row, counting games as hard days.
 * - Days left over get Recovery & Mobility.
 */
const DOW = [1, 2, 3, 4, 5, 6, 0];   // Monday first
const LEGS = /lower|leg|glute|hinge|squat|quad|ham/i;

function* combos(arr, k, start = 0, pick = []) {
  if (pick.length === k) { yield pick; return; }
  for (let i = start; i < arr.length; i++) yield* combos(arr, k, i + 1, [...pick, arr[i]]);
}

/**
 * @param focuses   the plan's day titles in order ("Lower · Quad", "Upper A", "Full Body A"…)
 * @param sportDays weekdays with a game (0 = Sun … 6 = Sat)
 * @param recovery  program id for leftover days (null = rest)
 * @returns { days: [7 tokens, Sun..Sat: 'train' | 'rest' | 'basketball' | recovery id], order: [{ dow, focus }],
 *            start_dow (weekday for Day 1), note (a line about the week, e.g. no full rest day) }
 */
export function planWeek(focuses, sportDays = [], { sport = 'basketball', recovery = 'move30_recovery_mobility' } = {}) {
  const n = focuses.length;
  const games = new Set(sportDays);
  let rest = !games.has(0) ? 0 : DOW.slice().reverse().find(d => !games.has(d));
  const free = DOW.filter(d => !games.has(d) && d !== rest);
  // More training days than free days: the rest day is used too (and the week says so).
  const noRest = n > free.length;
  if (noRest) rest = null;
  const pool = noRest ? DOW.filter(d => !games.has(d)) : free;
  let best = null;
  for (const pick of combos(pool, Math.min(n, pool.length))) for (let r = 0; r < n; r++) {
    const order = DOW.filter(d => pick.includes(d));
    const focusOn = new Map(order.map((d, i) => [d, focuses[(i + r) % n]]));
    let score = 0;
    for (const d of order) {
      const next = (d + 1) % 7, prev = (d + 6) % 7;
      if (games.has(next) && LEGS.test(focusOn.get(d))) score += 4;          // leg day right before a game
      if (games.has(prev) && LEGS.test(focusOn.get(d))) score += 0.5;        // after one: fine, a little less ideal
    }
    // Hard days in a row (training or game), around the week.
    const hard = (d) => games.has(d) || pick.includes(d);
    for (const d of DOW) if (hard(d) && hard((d + 1) % 7) && hard((d + 2) % 7)) score += 3;
    // Spread: two training days back to back is fine, so only a nudge toward rest between.
    for (const d of order) if (pick.includes((d + 1) % 7)) score += 0.2;
    score += r * 0.05;   // all else equal, Day 1 first in the week
    if (!best || score < best.score) best = { score, order, r };
  }
  const days = Array.from({ length: 7 }, (_, d) => games.has(d) ? sport : best?.order.includes(d) ? 'train' : d === rest ? 'rest' : (recovery || 'rest'));
  const order = (best?.order || []).map((d, i) => ({ dow: d, focus: focuses[(i + best.r) % n], day: (i + best.r) % n + 1 }));
  const start = order.find(o => o.day === 1);
  return { days, order, start_dow: start ? start.dow : null,
    note: noRest ? `${n} workouts plus ${games.size} game${games.size === 1 ? '' : 's'} leaves no full rest day: Daily Mobility every day, and drop to ${n - 1} workouts if you feel run down.` : null };
}
