/**
 * What the app learns from the logs, on the phone, with no AI service: plain statistics over the
 * sessions in IndexedDB. Plain module (no app imports) so it runs in node: `node data/check_learn.mjs`.
 *
 *   const profile = learnProfile(sessions, { today: '2026-11-10' });
 *
 * The profile feeds the plan generator (exercise picks, session length, days) and the next-session
 * targets (weight steps). It needs a few weeks of logs; until then every field says how much data
 * it rests on, and callers fall back to the coach rules. See docs/PROGRAM_DESIGN.md, "Learning from your logs".
 */
import { epley } from './e1rm.js';

const DAY = 86400000;
const toDate = (s) => new Date(s + 'T12:00');
const weeksBetween = (a, b) => (toDate(b) - toDate(a)) / (7 * DAY);
const median = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const rangeOf = (t) => { const m = String(t || '').match(/(\d+)\s*[-–]\s*(\d+)/); if (m) return [+m[1], +m[2]]; const n = String(t || '').match(/^\s*(\d+)\b/); return n ? [+n[1], +n[1]] : null; };

/** Least-squares slope of y over x (x in weeks), as a share of the mean y: 0.02 = +2% a week. */
function trend(points) {
  if (points.length < 3) return null;
  const n = points.length, mx = points.reduce((a, p) => a + p[0], 0) / n, my = points.reduce((a, p) => a + p[1], 0) / n;
  const sxx = points.reduce((a, p) => a + (p[0] - mx) ** 2, 0);
  if (!sxx || !my) return null;
  return points.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0) / sxx / my;
}

export const LEARN_MIN = { sessions: 6, appearances: 3, swaps: 2 };

/**
 * @param sessions every stored session (any program)
 * @param opts.today 'YYYY-MM-DD'; opts.weeks how far back to look (default 12)
 * @param opts.muscleOf name → { primary_muscle } lookup, for per-muscle trends (optional)
 */
export function learnProfile(sessions, { today, weeks = 12, muscleOf = () => null } = {}) {
  const since = today ? new Date(toDate(today) - weeks * 7 * DAY) : null;
  const recent = sessions.filter(s => s.date && (!since || toDate(s.date) >= since) && (!today || s.date <= today))
    .sort((a, b) => a.date.localeCompare(b.date));
  const done = recent.filter(s => s.done && !s.skipped);
  const skipped = recent.filter(s => s.skipped);

  // ── Exercises: done, left undone, swapped away from, swapped to, strength trend ──
  const ex = {};
  const E = (n) => (ex[n] ||= { done: 0, undone: 0, swappedAway: 0, swappedTo: 0, added: 0, e1rm: [], hitTop: 0, overshoot: 0, ranged: 0, lastDate: null });
  for (const s of done) {
    for (const x of s.exercises || []) {
      const sets = (x.sets || []).filter(st => st?.done);
      if (x.swapped && x.orig_name && x.orig_name !== x.name) { E(x.orig_name).swappedAway++; E(x.name).swappedTo++; }
      if (x.added) E(x.name).added++;
      const r = E(x.name);
      if (!sets.length) { r.undone++; continue; }
      r.done++; r.lastDate = s.date;
      const best = Math.max(...sets.map(st => epley(+st.weight || 0, +st.reps || 0)));
      if (best > 0) r.e1rm.push([weeksBetween(done[0].date, s.date), best]);
      const range = rangeOf(x.target_reps);
      const reps = sets.map(st => +st.reps || 0).filter(Boolean);
      if (range && reps.length) {
        r.ranged++;
        if (reps.every(v => v >= range[1])) r.hitTop++;
        if (reps.every(v => v >= range[1] + 2)) r.overshoot++;
      }
    }
  }
  const exercises = {};
  for (const [name, r] of Object.entries(ex)) {
    exercises[name] = {
      done: r.done, undone: r.undone, swapped_away: r.swappedAway, swapped_to: r.swappedTo, added: r.added,
      trend_per_week: r.e1rm.length >= LEARN_MIN.appearances ? round(trend(r.e1rm), 3) : null,
      last: r.lastDate,
    };
  }

  // Avoid: swapped away from at least twice and more often than done, or left undone most times it came up.
  const avoid = Object.entries(ex).filter(([, r]) =>
    (r.swappedAway >= LEARN_MIN.swaps && r.swappedAway >= r.done) ||
    (r.undone >= LEARN_MIN.appearances && r.undone > r.done)).map(([n]) => n);
  // Preferred replacements: what you swap each avoided exercise to most.
  const replacements = {};
  for (const s of done) for (const x of s.exercises || []) {
    if (x.swapped && x.orig_name && x.orig_name !== x.name) (replacements[x.orig_name] ||= {})[x.name] = ((replacements[x.orig_name] || {})[x.name] || 0) + 1;
  }
  const prefer = {};
  for (const [orig, to] of Object.entries(replacements)) prefer[orig] = Object.entries(to).sort((a, b) => b[1] - a[1])[0][0];
  const favorites = Object.entries(ex).filter(([, r]) => r.swappedTo + r.added >= 2).map(([n]) => n);
  const progressing = Object.entries(exercises).filter(([, r]) => r.trend_per_week > 0.005).map(([n]) => n);
  const stalled = Object.entries(exercises).filter(([, r]) => r.trend_per_week != null && r.trend_per_week <= 0).map(([n]) => n);

  // ── Muscles: average trend of their lifts ──
  const byMuscle = {};
  for (const [n, r] of Object.entries(exercises)) {
    const m = muscleOf(n)?.primary_muscle;
    if (m && r.trend_per_week != null) (byMuscle[m] ||= []).push(r.trend_per_week);
  }
  const muscles = Object.fromEntries(Object.entries(byMuscle).map(([m, ts]) => [m, { trend_per_week: round(ts.reduce((a, b) => a + b, 0) / ts.length, 3), lifts: ts.length }]));

  // ── How fast you progress: share of ranged exercises where every set hit / beat the top ──
  const ranged = Object.values(ex).reduce((a, r) => a + r.ranged, 0);
  const progression = ranged >= 10 ? {
    hit_top_rate: round(Object.values(ex).reduce((a, r) => a + r.hitTop, 0) / ranged, 2),
    overshoot_rate: round(Object.values(ex).reduce((a, r) => a + r.overshoot, 0) / ranged, 2),
    samples: ranged,
  } : null;

  // ── Session length from set timestamps (first to last logged set, plus a few minutes) ──
  const lengths = done.map(s => {
    const ts = (s.exercises || []).flatMap(x => (x.sets || []).map(st => st?.done && st.at)).filter(Boolean);
    return ts.length >= 4 ? (Math.max(...ts) - Math.min(...ts)) / 60000 + 4 : null;
  }).filter(v => v != null && v > 8 && v < 180);
  const duration = lengths.length >= 3 ? { median_min: Math.round(median(lengths)), sessions: lengths.length } : null;

  // ── When you train: weekday counts, and sessions per week ──
  const weekday = [0, 0, 0, 0, 0, 0, 0], skippedDay = [0, 0, 0, 0, 0, 0, 0];
  for (const s of done) weekday[toDate(s.date).getDay()]++;
  for (const s of skipped) skippedDay[toDate(s.date).getDay()]++;
  const spanWeeks = done.length ? Math.max(1, weeksBetween(done[0].date, today || done[done.length - 1].date)) : 0;
  const per_week = done.length >= LEARN_MIN.sessions ? round(done.length / spanWeeks, 1) : null;

  return {
    updated: today || null,
    sessions: done.length, skipped: skipped.length, weeks: round(spanWeeks, 1),
    ready: done.length >= LEARN_MIN.sessions,
    exercises, avoid, prefer, favorites, progressing, stalled, muscles,
    progression, duration,
    days: { trained: weekday, skipped: skippedDay, per_week },
  };
}

function round(v, d) { return v == null ? null : Math.round(v * 10 ** d) / 10 ** d; }

/** Plain-language lines for the "What the app has learned" card. */
export function profileSummary(p) {
  if (!p || !p.sessions) return ['Nothing logged yet. Log a few workouts and this fills in.'];
  const out = [];
  if (!p.ready) out.push(`${p.sessions} workout${p.sessions === 1 ? '' : 's'} logged. It learns more after ${LEARN_MIN.sessions}.`);
  if (p.days.per_week) {
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const top = p.days.trained.map((n, i) => [n, i]).filter(([n]) => n > 0).sort((a, b) => b[0] - a[0]).slice(0, 4).map(([, i]) => names[i]);
    out.push(`You train about ${p.days.per_week}× a week, mostly ${top.join(', ')}.`);
  }
  if (p.duration) out.push(`Your workouts take about ${p.duration.median_min} min.`);
  if (p.progressing.length) out.push(`Going up: ${p.progressing.slice(0, 4).join(', ')}${p.progressing.length > 4 ? ` +${p.progressing.length - 4}` : ''}.`);
  if (p.stalled.length) out.push(`Stalled: ${p.stalled.slice(0, 4).join(', ')}${p.stalled.length > 4 ? ` +${p.stalled.length - 4}` : ''}. New plans try something different.`);
  if (p.avoid.length) out.push(`You swap or skip: ${p.avoid.slice(0, 4).join(', ')}. New plans leave ${p.avoid.length === 1 ? 'it' : 'them'} out${Object.keys(p.prefer).length ? ' and use what you swap to' : ''}.`);
  if (p.progression?.overshoot_rate >= 0.3) out.push('You often beat the top of the rep range by 2+: weight goes up in bigger steps.');
  return out;
}
