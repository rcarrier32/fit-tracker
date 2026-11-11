/**
 * How a generated plan compares with the coach programs for the same goal
 * (data/learned_patterns.json, made by data/learn_patterns.py from PJF, BWS and Griffith).
 * Plain module so it runs in node.
 *
 *   comparePlan(plan, learned, goal) → { coaches, perSession, coachPerSession, inRange, total, low, high } | null
 */
const NAMES = { pjf: 'PJF', bws: 'BWS', ryhan: 'your BWS splits', th: 'Griffith' };
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export function comparePlan(plan, learned, goal) {
  const g = learned?.goals?.[goal];
  if (!g || !plan?.summary) return null;
  const progs = (learned.programs || []).filter(p => p.goal === goal);
  const one = progs.length < 2;
  const days = plan.weeks?.[0]?.days?.length || plan.sessions_per_week || 1;
  // Coach weeks have a different number of days (PJF fat loss: 6): scale their weekly ranges to this plan's days.
  const coachDays = progs.length ? median(progs.map(p => p.days_per_week)) : days;
  const scale = Math.min(1.5, Math.max(0.5, days / coachDays));
  const low = [], high = [];
  let inRange = 0, total = 0;
  // Muscles the coaches train with at least 3 sets a week; ranges are their min–max (±30% with one program).
  for (const [m, v] of Object.entries(g.volume || {})) {
    if (v.median < 3 || m === 'full_body' || m === 'forearms') continue;
    total++;
    const lo = (one ? v.median * 0.7 : v.min) * scale, hi = (one ? v.median * 1.3 : v.max) * scale;
    const have = plan.summary[m] || 0;
    if (have < lo * 0.9) low.push({ muscle: m, plan: have, lo: Math.round(lo), hi: Math.round(hi) });
    else if (have > hi * 1.1) high.push({ muscle: m, plan: have, lo: Math.round(lo), hi: Math.round(hi) });
    else inRange++;
  }
  const planSets = plan.working_sets ?? Object.values(plan.summary).reduce((a, b) => a + b, 0);
  const coachPerSession = progs.length ? Math.round(median(progs.map(p => p.total_sets_by_week[0] / p.days_per_week))) : null;
  const sources = [...new Set(progs.map(p => NAMES[p.id.split('_')[0]] || p.id.split('_')[0]))];
  return {
    coaches: `${sources.join(' + ')} (${progs.length} program${progs.length === 1 ? '' : 's'})`,
    perSession: Math.round(planSets / days), coachPerSession, scaled: scale !== 1 ? { from: coachDays, to: days } : null,
    inRange, total, low, high,
  };
}

/** One line for the plan preview. */
export function compareLine(c, label = (m) => m.replace(/_/g, ' ')) {
  if (!c || !c.total) return null;
  const rng = (x) => x.lo === x.hi ? `~${x.lo}` : `${x.lo}–${x.hi}`;
  const parts = [`${c.inRange} of ${c.total} muscles in the coaches' weekly range`];
  if (c.low.length) parts.push(`lower: ${c.low.slice(0, 3).map(x => `${label(x.muscle)} ${x.plan} (${rng(x)})`).join(', ')}`);
  if (c.high.length) parts.push(`higher: ${c.high.slice(0, 3).map(x => `${label(x.muscle)} ${x.plan} (${rng(x)})`).join(', ')}`);
  if (c.coachPerSession) parts.push(`${c.perSession} sets a session vs their ${c.coachPerSession}`);
  return `Compared with ${c.coaches}${c.scaled ? `, scaled from ${c.scaled.from} to ${c.scaled.to} days` : ''}: ${parts.join('; ')}.`;
}
