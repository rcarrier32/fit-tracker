/**
 * Extensive test of the plan generator (src/lib/generator.js).
 *
 *   node data/test_generator.mjs            # full sweep, summary + failures
 *   node data/test_generator.mjs --quick    # a sample, for a fast check
 *   node data/test_generator.mjs --report   # also writes docs/GENERATOR_TEST_REPORT.md
 *
 * Sweeps goals × days × minutes × equipment × level × weeks, plus random mixes of focus, plyo,
 * "go easy on", a learned profile and favourites. Every plan is checked against hard rules (must never
 * fail) and measured on quality (reported, not failed): coach-range match, coach exercise share,
 * session length vs the time asked for, muscles trained twice a week, push/pull balance, variety.
 */
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { generatePlan, estimateMinutes } from '../src/lib/generator.js';
import { comparePlan } from '../src/lib/compare.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const rules = JSON.parse(readFileSync(path.join(ROOT, 'data/design_rules.json'), 'utf8'));
const learned = JSON.parse(readFileSync(path.join(ROOT, 'data/learned_patterns.json'), 'utf8'));
const { loadFullCatalog } = await import('./catalog.mjs');
const { exercises } = await loadFullCatalog();
for (const e of exercises) if (!e.video_url && e.video?.url) e.video_url = e.video.url;
const byName = new Map(exercises.map(e => [e.name, e]));

// Small seeded RNG for the random mixes, so a run is repeatable.
let seed0 = 12345;
const rnd = () => { seed0 = (seed0 * 1103515245 + 12345) & 0x7fffffff; return seed0 / 0x7fffffff; };
const pick = (a) => a[Math.floor(rnd() * a.length)];

const KITS = {
  bodyweight: [],
  home_db: ['dumbbell', 'bench', 'band', 'mini_band'],
  home_plus: ['dumbbell', 'kettlebell', 'bench', 'box', 'band', 'mini_band', 'slider', 'bosu_pad', 'med_ball', 'agility_ladder'],
  gym: ['dumbbell', 'barbell', 'trap_bar', 'bench', 'box', 'cable', 'machine', 'pullup_bar', 'band', 'mini_band', 'landmine', 'kettlebell', 'med_ball', 'smith'],
};
const GOALS = Object.keys(rules.goals);
const REGION = { chest: 'push', front_delts: 'push', side_delts: 'push', triceps: 'push', lats: 'pull', upper_back: 'pull', rear_delts: 'pull', biceps: 'pull',
  quads: 'legs', glutes: 'legs', hamstrings: 'legs', adductors: 'legs', abductors: 'legs', hip_flexors: 'legs', calves: 'legs', abs: 'core', obliques: 'core', lower_back: 'core' };
const PLYO = ['plyo_jump', 'plyo_bound_hop', 'deceleration_landing'];
const fakeProfile = (avoid) => ({ ready: true, sessions: 20, avoid: [avoid], prefer: {}, favorites: [], progressing: [], stalled: [] });

const failures = {};   // rule → [messages]
const fail = (rule, msg) => { (failures[rule] ||= []).push(msg); };
const stats = { plans: 0, days: 0, minutes: [], short: 0, long: 0, coachIn: {}, coachShare: {}, twice: { ok: 0, n: 0 }, pushPull: [], variety: [] };

function check(params, label) {
  const plan = generatePlan(params, { exercises, rules, learned });
  stats.plans++;
  const goal = rules.goals[params.goal];
  const have = new Set(['bodyweight', ...params.equipment]);
  const reqs = (goal.required || []).map(r => ({ ...r, re: new RegExp(r.match, 'i'), not: r.not ? new RegExp(r.not, 'i') : null }));
  const isReq = (n) => reqs.some(r => r.re.test(n) && !(r.not && r.not.test(n)));
  const easy = (params.easy || []).map(k => rules.easy_on[k]);
  const easyHit = (e) => easy.some(z => (z.patterns || []).includes(e.pattern) || (z.names && new RegExp(z.names, 'i').test(e.name)));

  if (plan.weeks.length !== params.weeks) fail('weeks', `${label}: ${plan.weeks.length} weeks`);
  const mainByDay = {};
  for (const w of plan.weeks) {
    if (w.days.length !== Math.min(6, Math.max(2, params.days))) fail('days', `${label} W${w.week_num}: ${w.days.length} days`);
    for (const d of w.days) {
      stats.days++;
      const tag = `${label} W${w.week_num} D${d.day_num} ${d.focus}`;
      const work = d.exercises.filter(x => x.round_group !== 'Cooldown' && byName.get(x.name)?.role !== 'conditioning');
      const names = d.exercises.map(x => x.name);
      if (new Set(names).size !== names.length) fail('no repeats in a day', tag);
      if (work.length < 3) fail('3+ working exercises', `${tag}: ${work.length}`);
      for (const x of [...d.exercises, ...(d.warmup || [])]) {
        const e = byName.get(x.name);
        if (!e) { fail('exercise exists', `${tag}: ${x.name}`); continue; }
        if (!e.video_url) fail('every exercise has a video', `${tag}: ${x.name}`);
        if (!(e.equipment || ['bodyweight']).every(q => have.has(q))) fail('equipment you have', `${tag}: ${x.name} needs ${e.equipment}`);
        const maxL = params.level + (isReq(x.name) || /one level up/.test(x.why || '') ? 1 : 0);
        if ((e.level || 2) > maxL) fail('level', `${tag}: ${x.name} L${e.level} > L${params.level}`);
        if (easy.length && easyHit(e) && !isReq(x.name)) fail('go easy on', `${tag}: ${x.name}`);
        if (/last resort/i.test(x.name)) fail('no "last resort" picks', `${tag}: ${x.name}`);
      }
      for (const x of d.exercises) {
        if (!x.sets || x.sets < 1) fail('sets', `${tag}: ${x.name}`);
        if (!x.reps && !x.time) fail('reps or time', `${tag}: ${x.name}`);
      }
      // Supersets/pairs: 2+ members; a pair's first member rests 0-15 s.
      const g = {};
      for (const x of d.exercises) if (x.round_group && x.round_group !== 'Cooldown' && x.round_group !== 'Circuit') (g[x.round_group] ||= []).push(x);
      for (const [k, xs] of Object.entries(g)) {
        if (xs.length < 2) fail('supersets have 2+', `${tag}: ${k}`);
        if (/^Pair/.test(k) && !/^0/.test(xs[0].rest || '')) fail('pair rest 0-15 s', `${tag}: ${k}`);
      }
      // Time box.
      const mins = estimateMinutes(d, rules);
      stats.minutes.push(mins / params.minutes);
      if (mins > params.minutes * 1.15) fail('fits the time asked', `${tag}: ~${mins} min > ${params.minutes}`);
      if (!/^(Speed|Agility)/.test(d.focus) && mins < params.minutes * 0.55) stats.short++;
      // Jump contacts.
      const contacts = d.exercises.reduce((a, x) => a + (PLYO.includes(byName.get(x.name)?.pattern) ? (x.sets || 1) * (parseInt(x.reps) || 0) * (/each/.test(x.reps || '') ? 2 : 1) : 0), 0);
      if (contacts > (goal.max_contacts || 100)) fail('jump contacts ≤ cap', `${tag}: ${contacts}`);
      // Warm-up covers regions worked with 2+ exercises.
      const cnt = {};
      for (const x of work) { const r = REGION[byName.get(x.name)?.primary_muscle]; if (r) cnt[r] = (cnt[r] || 0) + 1; }
      const cov = new Set((d.warmup || []).flatMap(wu => (byName.get(wu.name)?.muscles || []).map(m => REGION[m])));
      const gap = Object.entries(cnt).filter(([r, c]) => c >= 2 && !cov.has(r)).map(([r]) => r);
      if (gap.length) fail('warm-up covers the day', `${tag}: misses ${gap}`);
      // Cooldown only where the goal asks for it.
      const hasCool = d.exercises.some(x => x.round_group === 'Cooldown');
      if (!!goal.cooldown !== hasCool) fail('cooldown by goal', `${tag}: cooldown ${hasCool}`);
      // Main lifts: kept within a block.
      for (const [i, x] of d.exercises.entries()) if (/^Main lift/.test(x.why || '')) (mainByDay[`${d.day_num}`] ||= []).push(`${w.week_num}:${x.name}`);
    }
  }
  // Deload: only where the rules allow it.
  const dl = rules.phases.deload;
  const wantDeload = dl.goals.includes(params.goal) && params.weeks >= dl.min_weeks;
  const last = plan.weeks[plan.weeks.length - 1], prev = plan.weeks[plan.weeks.length - 2];
  if (prev) {
    const isDeload = last.days.some(d => /^Deload week/.test(d.notes[0] || ''));
    const sets = (w) => w.days.flatMap(d => d.exercises).filter(x => x.round_group !== 'Cooldown').reduce((a, x) => a + (x.sets || 0), 0);
    if (isDeload && sets(last) > sets(prev) * 0.75) fail('deload halves the sets', `${label}: ${sets(last)} vs ${sets(prev)}`);
    if (isDeload !== wantDeload) fail('deload only where the rules say', `${label}: deload ${isDeload}, want ${wantDeload}`);
  }
  // The last phase never has fewer sets than the one before it (outside a deload).
  // Athletic plans are skipped: their sprint work grows across phases (accelerations 4 → 5 sets) and,
  // being speed-first, takes that time from lifting on short days.
  if (plan.weeks.length >= 4 && params.goal !== 'athletic') {
    const L = rules.phases.length_weeks, nPh = Math.ceil(params.weeks / L);
    const wk = (ph) => plan.weeks[Math.min(plan.weeks.length - 1, ph * L)];
    // Lifting sets only: power drills vary by pick (a sprint drill is 4-5 sets, a cut drill 3), finishers shrink to fit.
    const sets = (w) => w.days.filter(d => !/^(Speed|Agility)/.test(d.focus)).flatMap(d => d.exercises).filter(x => x.round_group !== 'Cooldown' && !/^(Power|Finisher|Long easy)/.test(x.why || '')).reduce((a, x) => a + (x.sets || 0), 0);
    if (nPh >= 2 && !/^Deload/.test(wk(nPh - 1).days[0].notes[0] || '') && sets(wk(nPh - 1)) < Math.min(sets(wk(nPh - 2)) - 1, sets(wk(nPh - 2)) * 0.92))   // >8%: small dips come from different picks
      fail('last phase keeps its sets', `${label}: phase ${nPh} ${sets(wk(nPh - 1))} < phase ${nPh - 1} ${sets(wk(nPh - 2))}`);
  }
  // Required moves per week.
  for (const r of reqs) {
    const possible = exercises.some(e => r.re.test(e.name) && !(r.not && r.not.test(e.name)) && e.video_url && (e.level || 2) <= params.level + 1
      && (e.equipment || ['bodyweight']).every(q => have.has(q)));
    if (!possible) continue;
    for (const w of plan.weeks) {
      const n = w.days.flatMap(d => d.exercises).filter(x => r.re.test(x.name) && !(r.not && r.not.test(x.name))).length;
      const slotDays = r.slot === 'hip_focus' ? w.days.filter(d => !/^(Speed|Agility)/.test(d.focus)).length : w.days.length;
      const want = Math.min(r.per_week[Math.min(Math.floor((w.week_num - 1) / rules.phases.length_weeks), r.per_week.length - 1)], slotDays);
      if (n < want) fail('required moves', `${label} W${w.week_num}: ${n} × ${r.match}, want ${want}`);
    }
  }
  // Learned "avoid" respected.
  if (params.profile) {
    const used = new Set(plan.weeks.flatMap(w => w.days.flatMap(d => d.exercises.map(x => x.name))));
    if (used.has(params.profile.avoid[0]) && !isReq(params.profile.avoid[0])) {
      // Allowed only when it's the only thing that fits: without it in the catalog, a slot would go empty.
      const without = generatePlan(params, { exercises: exercises.filter(e => e.name !== params.profile.avoid[0]), rules, learned });
      const count = (pl) => pl.weeks.flatMap(w => w.days.flatMap(d => d.exercises)).length;
      if (count(without) >= count(plan)) fail('learned: avoided stays out', `${label}: ${params.profile.avoid[0]}`);
    }
  }
  // Determinism.
  if (rnd() < 0.05) {
    const again = generatePlan(params, { exercises, rules, learned });
    if (JSON.stringify(again.weeks) !== JSON.stringify(plan.weeks)) fail('same seed, same plan', label);
  }

  // ── Quality (reported) ──
  const c = comparePlan(plan, learned, params.goal);
  if (c && c.total) (stats.coachIn[params.goal] ||= []).push(c.inRange / c.total);
  const coachGoal = learned.goals[params.goal] ? params.goal : params.goal === 'strength' ? 'muscle' : null;
  if (coachGoal) {
    const use = learned.goals[coachGoal].exercises || {};
    const w1 = plan.weeks[0].days.flatMap(d => d.exercises).filter(x => x.round_group !== 'Cooldown');
    (stats.coachShare[params.goal] ||= []).push(w1.filter(x => use[x.name]).length / Math.max(1, w1.length));
  }
  if (['strength', 'muscle'].includes(params.goal) && params.days >= 3 && params.minutes >= 45) {
    // A day trains a muscle when its fractional sets reach 3 (main muscle 1 per set, helpers 0.5:
    // a squat trains glutes, a row lats and upper back), the way the research counts volume.
    const freq = {};
    for (const d of plan.weeks[0].days) {
      const fr = {};
      for (const x of d.exercises) {
        const e = byName.get(x.name);
        if (!e || x.round_group === 'Cooldown' || ['warmup', 'cooldown', 'conditioning', 'core'].includes(e.role)) continue;
        fr[e.primary_muscle] = (fr[e.primary_muscle] || 0) + (x.sets || 1);
        for (const m of (e.muscles || []).slice(0, 3)) if (m !== e.primary_muscle) fr[m] = (fr[m] || 0) + (x.sets || 1) / 2;
      }
      for (const [m, v] of Object.entries(fr)) if (v >= 3) freq[m] = (freq[m] || 0) + 1;
    }
    for (const m of ['chest', 'quads', 'hamstrings', 'glutes', 'lats', 'upper_back']) { stats.twice.n++; if ((freq[m] || 0) >= 2) stats.twice.ok++; }
  }
  const pp = { push: 0, pull: 0 };
  for (const x of plan.weeks[0].days.flatMap(d => d.exercises)) { const r = REGION[byName.get(x.name)?.primary_muscle]; if (r === 'push' || r === 'pull') pp[r] += x.sets || 0; }
  if (pp.push && pp.pull) stats.pushPull.push(pp.push / pp.pull);
  const allNames = plan.weeks.flatMap(w => w.days.flatMap(d => d.exercises.map(x => x.name)));
  stats.variety.push(new Set(allNames).size / Math.max(1, allNames.length));
  return plan;
}

// ── The sweep ──
const quick = args.includes('--quick');
let n = 0;
for (const goal of GOALS) for (const days of [2, 3, 4, 5, 6]) for (const minutes of [30, 45, 60]) for (const [kitName, kit] of Object.entries(KITS))
  for (const level of [1, 2, 3]) for (const weeks of [4, 6, 8]) {
    if (quick && rnd() > 0.15) continue;
    const params = { goal, days, minutes, weeks, level, equipment: kit, seed: 1 + (n++ % 97) };
    const label = `${goal} ${days}d ${minutes}min ${kitName} L${level} ${weeks}wk`;
    // Random extras on a third of the runs.
    if (rnd() < 0.33) {
      const extra = [];
      if (rnd() < 0.4) { params.focus = [pick(['Glutes', 'Core', 'Arms', 'Back', 'Hips', 'Legs'])]; extra.push('focus ' + params.focus); }
      if (rnd() < 0.3) { params.plyo = true; extra.push('plyo'); }
      if (rnd() < 0.3) { params.easy = [pick(['hip', 'knee', 'back', 'shoulder'])]; extra.push('easy ' + params.easy); }
      if (rnd() < 0.3) { params.favorites = ['Barbell Bench Press', 'Dumbbell Romanian Deadlift', 'Knee Circles']; extra.push('favs'); }
      if (rnd() < 0.3) {
        const base = generatePlan({ ...params }, { exercises, rules, learned });
        const acc = base.weeks[0].days[0].exercises.find(x => byName.get(x.name)?.role === 'accessory');
        if (acc) { params.profile = fakeProfile(acc.name); extra.push('avoid ' + acc.name); }
      }
      try { check(params, `${label} [${extra.join(', ')}]`); } catch (err) { fail('no crash', `${label} [${extra.join(', ')}]: ${err.message}`); }
    } else {
      try { check(params, label); } catch (err) { fail('no crash', `${label}: ${err.message}`); }
    }
  }

// ── Summary ──
const avg = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
const pct = (x) => `${Math.round(x * 100)}%`;
const lines = [];
lines.push(`Plans: ${stats.plans} · days checked: ${stats.days}`);
lines.push(`Session length vs asked: average ${pct(avg(stats.minutes))}; days under 55% of the time asked: ${stats.short} (${pct(stats.short / stats.days)})`);
lines.push(`Muscles trained 2+ days a week (strength/muscle, 3+ days, 45+ min; a day counts at 3+ fractional sets): ${pct(stats.twice.ok / Math.max(1, stats.twice.n))}`);
lines.push(`Push:pull sets ratio, week 1: median ${(stats.pushPull.sort((a, b) => a - b)[stats.pushPull.length >> 1] || 0).toFixed(2)}`);
lines.push(`Variety (distinct / total picks over the plan): ${pct(avg(stats.variety))}`);
for (const g of GOALS) {
  lines.push(`  ${g.padEnd(10)} coach range: ${stats.coachIn[g] ? pct(avg(stats.coachIn[g])) : '—'} of muscles · coach exercises: ${stats.coachShare[g] ? pct(avg(stats.coachShare[g])) : '—'} of week-1 picks`);
}
const rulesFailed = Object.entries(failures).sort((a, b) => b[1].length - a[1].length);
lines.push('');
lines.push(rulesFailed.length ? 'HARD RULE FAILURES:' : 'Hard rules: all passed.');
for (const [r, ms] of rulesFailed) {
  lines.push(`  ✗ ${r}: ${ms.length}`);
  for (const m of ms.slice(0, 4)) lines.push(`      ${m}`);
}
console.log(lines.join('\n'));
if (args.includes('--report')) {
  writeFileSync(path.join(ROOT, 'docs/GENERATOR_TEST_REPORT.md'), `# Plan generator test report\n\nGenerated by \`node data/test_generator.mjs --report\` on ${new Date().toISOString().slice(0, 10)}.\n\n\`\`\`\n${lines.join('\n')}\n\`\`\`\n`);
}
process.exit(rulesFailed.length ? 1 : 0);
