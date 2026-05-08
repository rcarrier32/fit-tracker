/**
 * Plan management — multi-week program runs with week tracking.
 *
 * A plan = { id, program_id, start_date, total_weeks, active }
 * Week number is derived live from start_date + today's date.
 */
import { getAll, put, del } from '../db.js';

export async function getActivePlan() {
  const all = await getAll('plans');
  return all.find(p => p.active) || null;
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
    start_date: start_date || new Date().toISOString().slice(0, 10),
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
  const start = new Date(plan.start_date + 'T12:00:00');
  const now = new Date();
  const diffDays = Math.floor((now - start) / (1000 * 60 * 60 * 24));
  return Math.min(Math.max(1, Math.floor(diffDays / 7) + 1), plan.total_weeks);
}

export function planProgress(plan) {
  const week = currentWeek(plan);
  const pct = Math.round((week / plan.total_weeks) * 100);
  const weeksLeft = plan.total_weeks - week + 1;
  return { week, pct, weeksLeft };
}
