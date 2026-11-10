/**
 * Run the plan generator in node (for Claude-built plans and for testing).
 *
 *   node data/generate_plan.mjs --goal athletic --days 4 --minutes 60 --weeks 6 \
 *        --equipment dumbbell,barbell,bench,box,band --focus Glutes,Core --plyo --level 2 --seed 1
 *   node data/generate_plan.mjs ... --json > draft.json     # full program JSON
 *   node data/generate_plan.mjs --sanity                    # checks every goal × days × minutes
 *
 * Uses the same src/lib/generator.js the app runs, on the same catalog (data/catalog.mjs).
 */
import { readFileSync } from 'fs';
import path from 'path';
import { generatePlan, estimateMinutes } from '../src/lib/generator.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };

export async function loadCatalog() {
  const rules = JSON.parse(readFileSync(path.join(ROOT, 'data/design_rules.json'), 'utf8'));
  // Same catalog the phone sees, provider exercises and provider videos included.
  const { loadFullCatalog } = await import('./catalog.mjs');
  const { exercises } = await loadFullCatalog();
  for (const e of exercises) if (!e.video_url && e.video?.url) e.video_url = e.video.url;
  return { exercises, rules };
}

const { exercises, rules } = await loadCatalog();

if (args.includes('--sanity')) {
  const gyms = { home: ['dumbbell', 'band', 'mini_band', 'bench'], gym: ['dumbbell', 'barbell', 'trap_bar', 'bench', 'box', 'cable', 'machine', 'pullup_bar', 'band', 'mini_band', 'landmine', 'kettlebell', 'med_ball'] };
  let problems = 0, runs = 0;
  for (const goal of Object.keys(rules.goals)) for (const days of [2, 3, 4, 5, 6]) for (const minutes of [30, 60]) for (const [gname, eq] of Object.entries(gyms)) {
    runs++;
    const plan = generatePlan({ goal, days, minutes, weeks: 6, equipment: eq, seed: 7 }, { exercises, rules });
    const issues = [];
    // Required moves (Copenhagen, Nordics) appear as often as the goal asks, wherever the kit allows one.
    for (const r of rules.goals[goal].required || []) {
      const re = new RegExp(r.match, 'i'), not = r.not ? new RegExp(r.not, 'i') : null;
      const possible = exercises.some(e => re.test(e.name) && !(not && not.test(e.name)) && e.video_url && (e.level || 2) <= 3
        && e.equipment.every(q => q === 'bodyweight' || eq.includes(q)));
      for (const w of possible ? plan.weeks : []) {
        const n = w.days.flatMap(d => d.exercises).filter(x => re.test(x.name) && !(not && not.test(x.name))).length;
        const want = Math.min(r.per_week[Math.min(Math.floor((w.week_num - 1) / rules.phases.length_weeks), r.per_week.length - 1)], days);
        if (n < want) issues.push(`W${w.week_num} has ${n} × ${r.match}, wants ${want}`);
      }
    }
    for (const w of plan.weeks) for (const d of w.days) {
      const names = d.exercises.map(x => x.name);
      if (new Set(names).size !== names.length) issues.push(`W${w.week_num} D${d.day_num} repeats an exercise`);
      const groups = {};
      for (const x of d.exercises) if (x.round_group) groups[x.round_group] = (groups[x.round_group] || 0) + 1;
      if (Object.values(groups).some(n => n < 2)) issues.push(`W${w.week_num} D${d.day_num} has a one-exercise superset`);
      if (d.exercises.length < 3) issues.push(`W${w.week_num} D${d.day_num} only ${d.exercises.length} exercises`);
      for (const x of d.exercises) {
        const e = exercises.find(q => q.name === x.name);
        if (!e?.video_url) issues.push(`${x.name} has no video`);
        if (e && !e.equipment.every(q => q === 'bodyweight' || eq.includes(q))) issues.push(`${x.name} needs ${e.equipment}`);
      }
      // Warm-up covers every region the day works with 2+ exercises.
      const R = { chest: 'push', front_delts: 'push', side_delts: 'push', triceps: 'push', lats: 'pull', upper_back: 'pull', rear_delts: 'pull', biceps: 'pull',
        quads: 'legs', glutes: 'legs', hamstrings: 'legs', adductors: 'legs', abductors: 'legs', hip_flexors: 'legs', calves: 'legs', abs: 'core', obliques: 'core', lower_back: 'core' };
      const cnt = {};
      for (const x of d.exercises) { const r = R[exercises.find(q => q.name === x.name)?.primary_muscle]; if (r) cnt[r] = (cnt[r] || 0) + 1; }
      const cov = new Set((d.warmup || []).flatMap(w => (exercises.find(q => q.name === w.name)?.muscles || []).map(m => R[m])));
      const gap = Object.entries(cnt).filter(([r, c]) => c >= 2 && !cov.has(r)).map(([r]) => r);
      if (gap.length) issues.push(`W${w.week_num} D${d.day_num} warm-up misses ${gap.join('/')}`);
      // Plyo dose: research finds 40-100 jumps a session works; more adds impact, not results.
      const PLYO = ['plyo_jump', 'plyo_bound_hop', 'deceleration_landing'];
      const contacts = d.exercises.reduce((a, x) => a + (PLYO.includes(exercises.find(q => q.name === x.name)?.pattern)
        ? (x.sets || 1) * (parseInt(x.reps) || 0) * (/each/.test(x.reps || '') ? 2 : 1) : 0), 0);
      if (contacts > (rules.goals[goal].max_contacts || 100)) issues.push(`W${w.week_num} D${d.day_num} ${contacts} jump contacts`);
      const mins = estimateMinutes(d, rules);
      if (mins > minutes * 1.15) issues.push(`W${w.week_num} D${d.day_num} ~${mins} min > ${minutes}`);
    }
    if (['strength', 'muscle'].includes(goal) && gname === 'gym' && days >= 3 && minutes >= 60) {
      for (const [m, [lo]] of Object.entries(rules.volume_targets)) {
        if (lo >= 9 && (plan.summary[m] || 0) < lo * 0.5) issues.push(`${m} only ${plan.summary[m] || 0} sets/wk`);
      }
    }
    const uniq = [...new Set(issues)];
    if (uniq.length) { problems++; console.log(`${goal} ${days}d ${minutes}min ${gname}: ${uniq.slice(0, 4).join('; ')}${uniq.length > 4 ? ` (+${uniq.length - 4})` : ''}`); }
  }
  console.log(`${runs - problems}/${runs} combinations clean`);
  process.exit(problems ? 1 : 0);
}

const plan = generatePlan({
  goal: opt('goal', 'muscle'), days: +opt('days', 3), minutes: +opt('minutes', 60), weeks: +opt('weeks', 6),
  equipment: opt('equipment', 'dumbbell,bench').split(','), focus: opt('focus', '') ? opt('focus').split(',') : [],
  plyo: args.includes('--plyo'), level: +opt('level', 2), seed: +opt('seed', 1),
}, { exercises, rules });

if (args.includes('--json')) { console.log(JSON.stringify(plan, null, 1)); process.exit(0); }
console.log(`${plan.name} — ${plan.description} (pool ${plan.pool_size} exercises)`);
for (const w of plan.weeks.filter(w => [1, 3, 5].includes(w.week_num))) {
  console.log(`\nWeek ${w.week_num}`);
  for (const d of w.days) {
    console.log(`  ${d.focus}  [warm-up${d.warmup[0]?.sets ? ` × ${d.warmup[0].sets} rounds` : ''}: ${d.warmup.map(x => x.name).join(', ')}]`);
    for (const x of d.exercises) console.log(`    ${x.round_group ? x.round_group.padEnd(11) : ' '.repeat(11)} ${x.name} — ${x.sets} × ${x.reps || x.time}${x.rest ? `, rest ${x.rest}` : ''}`);
  }
}
console.log('\nWeek 1 sets per muscle:', JSON.stringify(plan.summary));
