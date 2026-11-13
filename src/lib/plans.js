/**
 * Plan management — multi-week program runs with week tracking.
 *
 * A plan = { id, program_id, start_date, total_weeks, active }
 * Week number: for a week-by-week program, where you are in it (its cursor: missed days don't push
 * you ahead); for a rotation, derived from start_date + today's date.
 */
import { getAll, put, del, pref } from '../db.js';
import { localDateStr } from './date.js';

export async function getActivePlan() {
  const all = await getAll('plans');
  const plan = all.find(p => p.active) || null;
  if (plan) plan._place = await placeIn(plan.program_id);
  return plan;
}

/** { week, day, perWeek, weeks, done } for a week-by-week program, from its cursor; else null. */
async function placeIn(programId) {
  try {
    const { loadCatalogs } = await import('./static_data.js');
    const { programById } = await loadCatalogs();
    const program = programById.get(programId) || ((await pref('custom_programs')) || []).find(c => c.id === programId);
    if (!program?.weeks?.length) return null;
    const cur = (await pref(`cursor:${programId}`)) || {};
    const perWeek = Math.max(1, ...program.weeks.map(w => w.days?.length || 0));
    return { week: cur.week || 1, day: cur.day || 1, perWeek, weeks: program.weeks.length, done: !!(await pref(`completed:${programId}`)) };
  } catch { return null; }
}

export async function getAllPlans() {
  return (await getAll('plans')).sort((a, b) => b.id - a.id);
}

export async function startPlan(program_id, total_weeks, start_date) {
  // Deactivate any existing active plan
  const all = await getAll('plans');
  for (const p of all.filter(p => p.active)) {
    await put('plans', { ...p, active: false });
  }
  return put('plans', {
    program_id,
    start_date: start_date || localDateStr(),
    total_weeks,
    active: true,
  });
}

export async function endPlan(planId) {
  const all = await getAll('plans');
  const plan = all.find(p => p.id === planId);
  if (plan) await put('plans', { ...plan, active: false });
}

export function currentWeek(plan) {
  if (!plan) return null;
  if (plan._place) return Math.min(plan._place.week, plan.total_weeks);
  const start = new Date(plan.start_date + 'T12:00:00');
  const now = new Date();
  const diffDays = Math.floor((now - start) / (1000 * 60 * 60 * 24));
  return Math.min(Math.max(1, Math.floor(diffDays / 7) + 1), plan.total_weeks);
}

export function planProgress(plan) {
  const week = currentWeek(plan);
  const weeksLeft = plan.total_weeks - week + 1;
  const elapsed = Math.max(0, Math.floor((Date.now() - new Date(plan.start_date + 'T12:00:00')) / 864e5));
  // Time actually elapsed — "Week 1 of 2" used to read as 50% complete on day one.
  const pct = Math.min(100, Math.round((elapsed / (plan.total_weeks * 7)) * 100));
  const pl = plan._place;
  if (pl) {   // workouts done, not days gone by
    const total = Math.min(pl.weeks, plan.total_weeks) * pl.perWeek;
    const did = pl.done ? total : (pl.week - 1) * pl.perWeek + (pl.day - 1);
    return { week, pct: Math.min(100, Math.round((did / total) * 100)), weeksLeft, over: pl.done };
  }
  return { week, pct, weeksLeft, over: elapsed >= plan.total_weeks * 7 };
}
