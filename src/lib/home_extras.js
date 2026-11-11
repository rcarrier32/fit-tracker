/**
 * Optional Today cards: This week, Weight trend, How you've been feeling. Plain module (no app
 * imports) so it runs in node: `node data/check_home_extras.mjs`.
 */
import { energyOf, heavyCheckIn, readNote } from './feel.js';
const DAY = 864e5;
const d = (ymd) => new Date(ymd + 'T12:00:00');
const ymd = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
const addDays = (s, n) => { const x = d(s); x.setDate(x.getDate() + n); return ymd(x); };

/** Monday of the week containing `today`. */
export function weekStart(today) {
  const dow = (d(today).getDay() + 6) % 7;   // Mon = 0
  return addDays(today, -dow);
}

/**
 * This week (Mon–Sun): workouts finished vs planned, Daily Mobility days, activity minutes.
 * @param planned workouts planned this week, or null when the plan doesn't say
 */
export function weekSummary({ sessions = [], cardio = [], today, planned = null, dailyId = 'daily_mobility' }) {
  const from = weekStart(today), to = addDays(from, 6);
  const inWeek = (x) => x.date >= from && x.date <= to;
  const fin = sessions.filter(s => inWeek(s) && s.done && !s.skipped);
  const workoutDays = new Set(fin.filter(s => s.program_id !== dailyId).map(s => s.date));
  const dailyDays = new Set(fin.filter(s => s.program_id === dailyId).map(s => s.date));
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(from, i);
    return { day, workout: workoutDays.has(day), daily: dailyDays.has(day), future: day > today, today: day === today };
  });
  const cardioMin = cardio.filter(inWeek).reduce((n, c) => n + (+c.duration_min || 0), 0);
  return { from, workouts: fin.filter(s => s.program_id !== dailyId).length, planned, dailyDays: dailyDays.size, cardioMin, days };
}

/**
 * Weight trend: 7-day average now vs the 7 days before, and the last 28 days for a small chart.
 * Null until there are 3 weigh-ins in the last 7 days.
 */
export function weightTrend(body = [], today) {
  const w = body.filter(b => +b.weight_lb > 0 && b.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  const avg = (from, to) => { const xs = w.filter(b => b.date >= from && b.date <= to).map(b => +b.weight_lb); return xs.length ? { avg: xs.reduce((a, b) => a + b, 0) / xs.length, n: xs.length } : null; };
  const now = avg(addDays(today, -6), today);
  if (!now || now.n < 3) return null;
  const prev = avg(addDays(today, -13), addDays(today, -7));
  const points = w.filter(b => b.date >= addDays(today, -27)).map(b => ({ date: b.date, w: +b.weight_lb }));
  const r1 = (x) => Math.round(x * 10) / 10;
  return { avg: r1(now.avg), prev: prev && prev.n >= 2 ? r1(prev.avg) : null, change: prev && prev.n >= 2 ? r1(now.avg - prev.avg) : null, points };
}

/**
 * How the last workouts felt (finish-screen check-in), anything flagged as hurting in the last two
 * weeks, and the lighter-week advice (same rule as src/lib/learn.js: 2 of the last 3 too much/drained).
 */
export function feelingSummary(sessions = [], today, { dailyId = 'daily_mobility' } = {}) {
  const fin = sessions.filter(s => s.done && !s.skipped && s.date <= today && s.program_id !== dailyId)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.id || 0) - (b.id || 0));
  const felt = fin.filter(s => (s.feel && (s.feel.effort || energyOf(s.feel) != null)) || s.note).slice(-5);
  if (!felt.length) return null;
  const last3 = felt.slice(-3);
  const heavy = last3.filter(heavyCheckIn).length;
  const since = addDays(today, -13), recent3 = addDays(today, -2);
  const hurts = [...new Set([
    ...fin.filter(s => s.date >= since).flatMap(s => (s.exercises || []).filter(x => x.hurt).map(x => x.name)),
    ...fin.filter(s => s.date >= since).flatMap(s => readNote(s.note).pain)])];
  // Soreness from notes in the last 3 days (soreness passes; pain is kept two weeks).
  const sore = [...new Set(fin.filter(s => s.date >= recent3).flatMap(s => readNote(s.note).sore))];
  return {
    recent: felt.map(s => ({ date: s.date, effort: s.feel?.effort || null, energy: energyOf(s.feel), heavy: heavyCheckIn(s) })),
    hurts, sore,
    advice: last3.length >= 2 && heavy >= 2 ? `${heavy} of your last ${last3.length} workouts felt like too much or left you drained or tired. Consider a lighter week: half the sets, same weights.` : null,
  };
}
