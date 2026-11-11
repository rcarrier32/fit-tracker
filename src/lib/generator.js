/**
 * Plan generator: builds a multi-week progression program from the tagged exercise catalog,
 * following data/design_rules.json (human version: docs/PROGRAM_DESIGN.md).
 *
 * Plain ES module with no DOM or DB access, so it runs in the app (Plans → Generate a plan)
 * and in node for Claude-built plans (data/generate_plan.mjs).
 *
 *   generatePlan(params, { exercises, rules, hasVideo })
 *   params: { goal, days, minutes, weeks, equipment[], focus[], plyo, level, seed,
 *             sport: { name: 'basketball', days: [weekday…] } (pickup games: they are the jumps, sprints and
 *             hard conditioning, so the plan leaves those out and lays the week out around them) }
 *   returns a program in the app's weeks format, plus `summary` (weekly sets per muscle).
 */
import { progressesBy } from './progression.js';
import { planWeek } from './week_plan.js';

// Small seeded RNG (mulberry32) so a plan can be regenerated exactly, or varied by seed.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Roles a slot accepts, best first (a home gym has no barbell "main" lift, so a
// dumbbell "secondary" compound fills a main slot).
const ROLE_FALLBACK = {
  any: ['main', 'secondary', 'accessory', 'core'],
  main: ['main', 'secondary'],
  secondary: ['secondary', 'main'],
  accessory: ['accessory', 'secondary'],
  core: ['core', 'accessory'],
  power: ['power'],
  warmup: ['warmup'],
  conditioning: ['conditioning'],
};
const TIMED = /plank|hold|\biso\b|isos\b|isometric|copenhagen|balance|hang|airplane|wall sit|carry|single leg stance|single-leg stance/i;
const SPEED_DAY = /^speed_/;
const HARD_INTERVALS = /sprint|zone 4|zone 5|hiit|tabata|interval/i;
const IMPACT_PATTERNS = new Set(['plyo_jump', 'plyo_bound_hop', 'speed_accel', 'deceleration_landing', 'agility_cod']);

const secsOf = (t) => {
  const str = String(t || '').trim();
  if (/^\d+(:\d{1,2}){1,2}$/.test(str)) return str.split(':').reduce((a, n) => a * 60 + +n, 0);
  const m = str.match(/([\d.]+)\s*(s|sec|m|min)?/i);
  return m ? Math.round(+m[1] * (/^m/i.test(m[2] || '') ? 60 : 1)) : 0;
};

/** Rough session length in minutes: warm-up + every set's work and rest (supersets share rest). */
export function estimateMinutes(day, rules) {
  let secs = (day.warmup || []).reduce((a, w) => a + 45 * (w.sets || 1), 0) + 60;
  day.exercises.forEach((x, i) => {
    const role = Object.values(rules.roles).find(r => r.rest === x.rest) || rules.roles.accessory;
    const rounds = /^(\d+)\s*rounds?$/i.exec(x.reps || '');
    const work = x.time ? secsOf(x.time) : rounds ? +rounds[1] * 70 : role.secs_per_set;
    const prev = day.exercises[i - 1];
    const explicitPair = x.round_group && prev?.round_group === x.round_group && /^0/.test(prev.rest || '');
    const rest = !x.rest ? 0 : /^0/.test(x.rest) ? 10
      : (secsOf(x.rest) || role.rest_secs || 0) * (x.round_group && !explicitPair ? 0.5 : 1);
    secs += (x.sets || 1) * (work + rest);
  });
  return Math.round(secs / 60);
}

export const FOCUS_GROUPS = {
  Chest: ['chest'], Back: ['lats', 'upper_back'], Shoulders: ['front_delts', 'side_delts', 'rear_delts'],
  Arms: ['biceps', 'triceps'], Glutes: ['glutes'], Legs: ['quads', 'hamstrings'], Hips: ['adductors', 'abductors', 'hip_flexors', 'glutes'],
  Core: ['abs', 'obliques'],
};

export function generatePlan(params, { exercises, rules, hasVideo = (e) => !!e.video_url, learned = null }) {
  const p = { goal: 'muscle', days: 3, minutes: 60, weeks: 6, equipment: ['bodyweight', 'dumbbell'], focus: [], plyo: false, level: 2, seed: 1, ...params };
  // Games take days too: at most 7 minus the games (6 workouts + 2 games won't fit a week).
  const askedDays = p.days;
  if (p.sport?.days?.length) p.days = Math.min(p.days, 7 - p.sport.days.length);
  // What the app learned from the logs (src/lib/learn.js): leave out what you swap or skip, prefer
  // what you swap to and what's progressing, rotate what's stalled. Absent until there are enough logs.
  const prof = params.profile?.ready ? params.profile : null;
  const avoidSet = new Set(prof?.avoid || []);
  const likeSet = new Set([...(prof?.favorites || []), ...Object.values(prof?.prefer || {})]);
  const upSet = new Set(prof?.progressing || []), stallSet = new Set(prof?.stalled || []);
  // Favourites (♡): chosen by you, so they count more than anything learned, and from day one.
  const favSet = new Set(params.favorites || []);
  const learnedFrom = { avoided: new Set(), preferred: new Set(), favorites: new Set() };
  // What the coaches pick (data/learned_patterns.json, from the uploaded PJF/BWS/Griffith programs):
  // exercises the goal's coach programs use score higher, by how many of them use it. Strength has no
  // coach program, so it borrows the BWS (muscle) list.
  const coachGoal = learned?.goals?.[p.goal] ? p.goal : p.goal === 'strength' ? 'muscle' : null;
  const coachUse = learned?.goals?.[coachGoal]?.exercises || {};
  const coachN = learned?.goals?.[coachGoal]?.programs?.length || 1;
  const anyCoach = new Set(Object.values(learned?.goals || {}).flatMap(g => Object.keys(g.exercises || {})));
  const goal = rules.goals[p.goal];
  const rand = rng(p.seed);
  const have = new Set(['bodyweight', ...p.equipment]);
  const focusMuscles = new Set(p.focus.flatMap(f => FOCUS_GROUPS[f] || [f]));
  // Sports you play (pickup basketball): two or more games a week are the jump, sprint and speed work.
  const games = (p.sport?.days || []).length;
  const power = (goal.power && games < 2) || (p.plyo && !games);
  const session = rules.session_minutes[String(p.minutes)] || rules.session_minutes['60'];

  // Go easy on (rules.easy_on): leave out moves that commonly load a sore area.
  const easy = (p.easy || []).map(k => rules.easy_on?.[k]).filter(Boolean);
  const easyHit = (e) => easy.some(z => (z.patterns || []).includes(e.pattern) || (z.names && new RegExp(z.names, 'i').test(e.name)));
  // Moves whose video is a stand-in (another move's demo) wait for their own before plans use them.
  const pool = exercises.filter(e =>
    e.pattern && e.role && hasVideo(e) && !e.video_standin && (e.level || 2) <= p.level &&
    (e.equipment || ['bodyweight']).every(q => have.has(q)) && !easyHit(e) && !/last resort/i.test(e.name));

  const byName = new Map(exercises.map(e => [e.name, e]));   // required moves can sit outside the pool
  // One level above the person's level: the last resort for a slot nothing at their level fits.
  const levelUpPool = exercises.filter(e => e.pattern && e.role && hasVideo(e) && !e.video_standin && (e.level || 2) === p.level + 1 &&
    (e.equipment || ['bodyweight']).every(q => ['bodyweight', ...p.equipment].includes(q)) && !/last resort/i.test(e.name) && !easyHit(e));
  const levelUp = new Set();
  const nDays = String(Math.min(6, Math.max(2, p.days)));
  // Speed and agility days are jumps, sprints and cuts: not with "go easy on knees".
  const speedOk = !(p.easy || []).includes('knee') && games < 2;
  const splitSet = goal.splits?.[nDays] ? goal.splits : power && speedOk && rules.athletic_splits[nDays] ? rules.athletic_splits : rules.splits;
  const split = splitSet[nDays];
  // Home kit (no barbell, cable or machine) can't keep adding load: progress by reps, rest and
  // harder versions instead, the way Lean & Tone and PJF's home programs do (rules.load_limited).
  const LL = rules.load_limited;
  const loadLimited = !!LL && !p.equipment.some(q => LL.heavy_equipment.includes(q));
  const nPhases = Math.max(1, Math.ceil(p.weeks / rules.phases.length_weeks));
  // Goal overrides (data/design_rules.json goal_overrides_doc). Volume targets the goal sets are scaled
  // down for fewer than 5 training days, so a 3-day plan isn't pushed to 5-day core volume.
  const scale = Math.min(1, p.days / 5);
  const volumeTargets = { ...rules.volume_targets };
  for (const [m, [lo, hi]] of Object.entries(goal.volume_targets || {})) volumeTargets[m] = [Math.round(lo * scale), Math.round(hi * scale)];
  const restFor = (role) => goal.rest?.[role] || (rules.roles[role] || rules.roles.accessory).rest;
  const dl = rules.phases.deload;
  const isDeload = (w) => (dl.goals || []).includes(p.goal) && p.weeks >= (dl.min_weeks || 6) && w === p.weeks;
  const ml = rules.phases.main_lifts || {};
  const mainBlock = (ph) => p.weeks <= (ml.keep_whole_plan_up_to_weeks || 99) ? 0 : Math.floor(ph * rules.phases.length_weeks / (ml.keep_weeks || 4));
  const warmupRounds = goal.warmup_rounds?.[String(p.minutes)] ?? session.warmup_rounds ?? 1;
  const LIGHT_CORE = ['anti_extension', 'anti_rotation', 'lateral_flexion', 'isometric'];
  // Required moves (goal.required): evidence-backed drills a goal must include, e.g. Copenhagen and
  // Nordics for durability. They may sit one level above the person's level.
  const required = (goal.required || []).map(r => ({ ...r, re: new RegExp(r.match, 'i'), notRe: r.not ? new RegExp(r.not, 'i') : null }));
  const reqOf = (e) => e && required.find(r => r.re.test(e.name) && !(r.notRe && r.notRe.test(e.name)));
  const reqQuota = (r, ph) => r.per_week[Math.min(ph, r.per_week.length - 1)];
  // A muscle slot for the first listed muscle wins (Nordics on the hamstring slot); later ones are the
  // fallback for splits that have none (full-body days).
  const reqFits = (r, slot) => {
    if (r.slot === 'hip_focus') return !!slot.hip_focus;
    if (slot.role === 'main' || slot.role === 'power') return false;
    const ms = r.muscles || [r.muscle];
    const first = daySlots.some(ss => ss.some(x => x.role !== 'main' && x.role !== 'power' && (x.muscles || []).includes(ms[0])));
    return (slot.muscles || []).some(m => first ? m === ms[0] : ms.includes(m));
  };
  function requiredPick(r, usedToday, ph) {
    const target = Math.max(1, Math.min(p.level, p.level - (nPhases - 1 - ph)));
    // A version that doesn't hit a "go easy on" area wins (no 90/90 Copenhagen for a sore hip); one that does is the last resort.
    return exercises.filter(e => r.re.test(e.name) && !(r.notRe && r.notRe.test(e.name)) && hasVideo(e) && !e.video_standin && !usedToday.has(e.name)
        && (e.level || 2) <= p.level + 1 && (e.equipment || ['bodyweight']).every(q => have.has(q)))
      .map(e => [Math.abs((e.level || 2) - target) + ((e.level || 2) > p.level ? 0.5 : 0) + (easyHit(e) ? 10 : 0) + rand() * 0.3, e])
      .sort((a, b) => a[0] - b[0])[0]?.[1] || null;
  }

  // Weekly sets per primary muscle, filled as picks are made, so later slots balance volume.
  const weekly = {};
  // Primary muscle gets full credit, the others half (a step-up still trains quads).
  const addVol = (e, sets) => {
    weekly[e.primary_muscle] = (weekly[e.primary_muscle] || 0) + sets;
    for (const m of (e.muscles || []).slice(0, 3)) if (m !== e.primary_muscle) weekly[m] = (weekly[m] || 0) + sets / 2;
  };

  function candidates(slot, usedToday, usedWeek, avoid, ph = 0) {
    // Moves that progress by variation climb a level per phase and reach your level in the last phase.
    const target = Math.max(1, Math.min(p.level, p.level - (nPhases - 1 - ph)));
    const roles = ROLE_FALLBACK[slot.role] || [slot.role];
    return pool.filter(e => {
      if (!roles.includes(e.role)) return false;
      if (usedToday.has(e.name)) return false;
      // Games in the week: no hard intervals (the games are), and with 2+ games no jumps or sprints anywhere.
      if (games && e.role === 'conditioning' && HARD_INTERVALS.test(e.name)) return false;
      if (games >= 2 && e.role !== 'warmup' && (e.role === 'power' || IMPACT_PATTERNS.has(e.pattern))) return false;
      if (slot.patterns && !slot.patterns.includes(e.pattern)) return false;
      if (slot.muscles && !slot.muscles.includes(e.primary_muscle)) return false;
      if (slot.unilateral && !e.unilateral) return false;
      if (slot.hip_focus && !e.hip_focus) return false;
      return true;
    }).map(e => {
      let s = 0;
      const roles = ROLE_FALLBACK[slot.role] || [slot.role];
      s += roles.indexOf(e.role) === 0 ? 3 : 1;
      if (slot.patterns) s += slot.patterns.indexOf(e.pattern) === 0 ? 1 : 0.5;
      if (focusMuscles.has(e.primary_muscle)) s += 2;
      else if ((e.muscles || []).some(m => focusMuscles.has(m))) s += 0.75;
      const t = volumeTargets[e.primary_muscle];
      const v = weekly[e.primary_muscle] || 0;
      if (t) { if (v < t[0]) s += 1.2; else if (v >= t[1]) s -= 2; }
      if (usedWeek.has(e.name)) s -= 2.5;
      if (avoid?.has(e.name)) s -= 3;                          // rotate accessories between phases
      if (slot.prefer) s += new RegExp(slot.prefer, 'i').test(e.name) ? 3 : 0;
      if (progressesBy(e) === 'variation' || (loadLimited && slot.role !== 'main')) {
        const L = e.level || 2;
        s += L === target ? 1.5 : L > target ? -1 : -0.6 * (target - L);
      } else if ((e.level || 2) === p.level) s += 0.4;
      if (goal.hip_focus && e.hip_focus) s += 0.8;
      if (goal.hip_focus && slot.role !== 'main' && e.sources?.some(x => x === 'hip' || x === 'trainheroic')) s += 1;   // the user's own PT/Motion RC + TrainHeroic hip-plan exercises
      const lifting = p.goal === 'strength' || p.goal === 'muscle' || p.goal === 'fat_loss';
      const loadable = e.equipment?.some(q => !['bodyweight', 'band', 'mini_band', 'bench', 'box', 'bosu_pad', 'slider'].includes(q));
      if (loadable) s += lifting ? 1 : 0.3;                       // load beats bodyweight/band for strength work
      if (lifting && (slot.role === 'main' || slot.role === 'secondary') && !loadable && e.equipment?.includes('band')) s -= 1.5;
      if (slot.muscles && ['isolation_upper', 'isolation_lower'].includes(e.pattern)) s += lifting ? 1.5 : 0.5;
      if (slot.muscles && ['mobility', 'balance', 'isometric'].includes(e.pattern) && !slot.hip_focus) s -= lifting ? 2.5 : 1;
      if (/optional/i.test(e.name)) s -= 0.6;
      if (/last resort/i.test(e.name)) s -= 3;
      // Scaled by how many of the goal's coach programs use it: BWS staples (8 of 9) clearly,
      // a one-off in one PJF program only a nudge, so volume balancing still decides.
      if (coachUse[e.name]) s += 0.3 + 1.6 * coachUse[e.name] / coachN;
      else if (anyCoach.has(e.name)) s += 0.3;
      // A slot lists its muscles best first ("chest", then "triceps"): the first one wins a tie.
      if (slot.muscles?.length > 1 && slot.muscles[0] === e.primary_muscle) s += 1;
      if (avoidSet.has(e.name)) s -= 6;
      if (favSet.has(e.name)) s += 2.5;
      else if (likeSet.has(e.name)) s += 1.5;
      if (upSet.has(e.name)) s += 0.8;
      if (stallSet.has(e.name) && slot.role !== 'main') s -= 0.8;
      return [s + rand() * 0.9, e];
    }).sort((a, b) => b[0] - a[0]).map(([, e]) => e);
  }

  function slotsFor(dayKey) {
    const tpl = rules.days[dayKey];
    let slots = tpl.slots.filter(s => !s.if || (s.if === 'power' && power));
    if (goal.hip_focus && !SPEED_DAY.test(dayKey)) {
      const at = slots.findIndex(s => s.role === 'core');
      slots.splice(at < 0 ? slots.length : at, 0, rules.hip_focus_slot);
    }
    // Core early (PJF): the day's core move goes right after power work, light patterns only.
    if (goal.core_early && !SPEED_DAY.test(dayKey)) {
      const ci = slots.findIndex(s => s.role === 'core' && !s.hip_focus);
      if (ci >= 0) {
        const [c] = slots.splice(ci, 1);
        const light = (c.patterns || []).filter(x => LIGHT_CORE.includes(x));
        const after = slots.map(s => s.role).lastIndexOf('power') + 1;
        slots.splice(after, 0, { ...c, patterns: light.length ? light : ['anti_extension', 'anti_rotation'], early: true });
      }
    }
    // Fit the time box: drop accessories from the end, then secondaries, never main/power/the first core.
    const max = session.max_exercises + (power ? 1 : 0);
    const dropOrder = ['accessory', 'secondary', 'core'];
    for (const role of dropOrder) {
      while (slots.length > max) {
        const i = slots.map(s => s.role).lastIndexOf(role);
        if (i < 0 || (role === 'core' && slots.filter(s => s.role === 'core').length <= 1)) break;
        slots.splice(i, 1);
      }
    }
    if (goal.conditioning && !SPEED_DAY.test(dayKey) && !slots.some(x => x.role === 'conditioning')) {
      // With games in the week the finisher stays easy (Zone 2): the games are the hard intervals.
      slots.push({ role: 'conditioning', finisher: true, prefer: games ? 'zone 2|low impact|easy|walk|bike' : rules.conditioning?.finisher_prefer });
    }
    return slots;
  }

  // Pick exercises: phase 1 picks everything; later phases keep main lifts and rotate the rest.
  const picks = []; // picks[phase][dayIndex] = [exercise|null per slot]
  const daySlots = split.days.map(slotsFor);
  // A required move with no slot to go in (Nordics on a 2-day full-body plan) gets an accessory
  // slot of its own on the first day with a hinge, before core.
  for (const r of required) {
    if (r.slot === 'hip_focus') continue;
    const ms = r.muscles || [r.muscle];
    if (daySlots.some(ss => ss.some(x => x.role !== 'main' && x.role !== 'power' && (x.muscles || []).some(m => ms.includes(m))))) continue;
    let di = daySlots.findIndex(ss => ss.some(x => (x.patterns || []).includes('hinge')));
    if (di < 0) di = daySlots.findIndex((ss, i) => !SPEED_DAY.test(split.days[i]));
    if (di < 0) continue;
    const ci = daySlots[di].map(x => x.role).lastIndexOf('core');
    daySlots[di].splice(ci < 0 ? daySlots[di].length : ci, 0, { role: 'accessory', muscles: [ms[0]] });
  }
  for (let ph = 0; ph < nPhases; ph++) {
    for (const k of Object.keys(weekly)) delete weekly[k];
    const usedWeek = new Set();
    const reqCount = required.map(() => 0);
    picks[ph] = split.days.map((dayKey, di) => {
      const usedToday = new Set();
      return daySlots[di].map((slot, si) => {
        const prev = ph > 0 ? picks[ph - 1][di][si] : null;
        let e = null;
        if (prev && slot.role === 'main' && mainBlock(ph) === mainBlock(ph - 1)) e = prev;
        if (!e) {
          const ri = required.findIndex((r, k) => reqCount[k] < reqQuota(r, ph) && reqFits(r, slot));
          if (ri >= 0 && (e = requiredPick(required[ri], usedToday, ph))) reqCount[ri]++;
        }
        if (!e) {
          const avoid = prev ? new Set([prev.name]) : null;
          // Learned "avoid" is a hard rule whenever there's another choice.
          const first = (list) => list.find(x => !avoidSet.has(x.name)) || null;
          const exact = candidates(slot, usedToday, usedWeek, avoid, ph);
          e = first(exact);
          // Nothing fits (bodyweight-only or a thin kit): widen the slot step by step rather than leave it empty —
          // any working role in the same movement, then the same muscles, then one level up.
          if (!e && slot.role !== 'power' && slot.role !== 'conditioning') {
            const wide = { ...slot, role: 'any', unilateral: false, hip_focus: false };
            e = first(candidates(wide, usedToday, usedWeek, avoid, ph));
            if (!e && slot.patterns) {
              const ms = [...new Set(pool.filter(x => slot.patterns.includes(x.pattern)).map(x => x.primary_muscle))];
              if (ms.length) e = first(candidates({ ...wide, patterns: null, muscles: ms }, usedToday, usedWeek, avoid, ph));
            }
            if (!e) {
              const up = levelUpPool.filter(x => ROLE_FALLBACK.any.includes(x.role) && !usedToday.has(x.name) && !avoidSet.has(x.name)
                && (slot.patterns ? slot.patterns.includes(x.pattern) : (slot.muscles || []).includes(x.primary_muscle)));
              e = up[Math.floor(rand() * up.length)] || null;
              if (e) levelUp.add(e.name);
            }
          }
          if (!e) e = exact[0] || null;   // only an avoided exercise fits: better than an empty slot
        }
        if (e) {
          if (likeSet.has(e.name)) learnedFrom.preferred.add(e.name);
          if (favSet.has(e.name)) learnedFrom.favorites.add(e.name);
          usedToday.add(e.name); usedWeek.add(e.name);
          addVol(e, (rules.roles[slot.role] || {}).sets || 3);
        }
        return e;
      });
    });
  }

  // Warm-ups cover what the day works: each body region hit by 2+ exercises gets a warm-up move,
  // biggest region first; provider moves (Griffith, PJF) and moves at the phase's level preferred; rotated by phase.
  const REGION = { chest: 'push', front_delts: 'push', side_delts: 'push', triceps: 'push', lats: 'pull', upper_back: 'pull',
    rear_delts: 'pull', biceps: 'pull', quads: 'legs', glutes: 'legs', hamstrings: 'legs', adductors: 'legs', abductors: 'legs',
    hip_flexors: 'legs', calves: 'legs', abs: 'core', obliques: 'core', lower_back: 'core' };
  function warmupFor(dayKey, ph, exs) {
    const worked = {};
    for (const x of exs) { const e = byName.get(x.name); const r = REGION[e?.primary_muscle]; if (r) worked[r] = (worked[r] || 0) + 1; }
    const order = Object.entries(worked).filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).map(([r]) => r);
    if (!order.length) order.push(/upper|push|pull/.test(dayKey) ? 'pull' : 'legs');
    const target = Math.max(1, Math.min(p.level, p.level - (nPhases - 1 - ph)));
    const warm = pool.filter(e => e.role === 'warmup');
    const n = session.warmup_count;
    const out = [], covered = new Set();
    const score = (e, r) => ((e.muscles || []).filter(m => REGION[m] === r).length) + (e.sources?.some(x => x === 'trainheroic' || x === 'pjf') ? 1 : 0)
      + ((e.level || 1) === target ? 0.7 : 0) + (e.pattern === 'mobility' ? 0.3 : 0) + rand() * 0.8;
    for (let pass = 0; out.length < n && pass < 3; pass++) for (const r of order) {
      if (out.length >= n || (pass === 0 && covered.has(r))) continue;
      const best = warm.filter(e => !out.includes(e) && (e.muscles || []).some(m => REGION[m] === r)).map(e => [score(e, r), e]).sort((a, b) => b[0] - a[0])[0]?.[1];
      if (best) { out.push(best); (best.muscles || []).forEach(m => REGION[m] && covered.add(REGION[m])); }
    }
    return out.map(e => ({
      name: e.name,
      sets: warmupRounds > 1 ? warmupRounds : undefined,
      reps: TIMED.test(e.name) || e.pattern === 'speed_accel' ? null : (e.unilateral ? '6 each side' : '8'),
      time: TIMED.test(e.name) ? '30s' : null,
      notes: null,
    })).map(w => (w.reps || w.time ? w : { ...w, reps: '2 × 10 yd' }));
  }

  function dose(slot, e, week, ph) {
    const role = rules.roles[slot.role] || rules.roles.accessory;
    const inPhaseWeek = ((week - 1) % rules.phases.length_weeks) + 1;
    const deload = isDeload(week);
    let sets = role.sets;
    if (slot.role === 'core' && goal.core_sets) sets = goal.core_sets;
    const req = reqOf(e);
    if (req?.dose) {
      const d = req.dose;
      return { sets: deload ? Math.max(1, Math.round(d.sets[Math.min(ph, d.sets.length - 1)] * dl.sets_factor)) : d.sets[Math.min(ph, d.sets.length - 1)],
               reps: d.reps, time: null, rest: d.rest || restFor(slot.role) };
    }
    if (slot.role === 'main' && ph >= 1 && (p.goal === 'strength' || p.goal === 'athletic')) sets = 4;
    // Coaches progress by adding sets, not reps: by the last phase secondaries get a set (set_ramp 1.1),
    // and accessories too (1.2).
    const ramp = goal.set_ramp || 1;
    let ramped = false;
    if (nPhases > 1 && ph === nPhases - 1 && !deload) {
      if (slot.role === 'secondary' && ramp >= 1.1) { sets += 1; ramped = true; }
      if (slot.role === 'accessory' && ramp >= 1.2) { sets += 1; ramped = true; }
    }
    if (p.minutes <= 30 && slot.role === 'accessory') { sets = 2; ramped = false; }
    if (deload) sets = Math.max(1, Math.round(sets * rules.phases.deload.sets_factor));
    const each = e.unilateral ? ' each side' : '';
    let reps = null, time = null;
    if (slot.role === 'conditioning') {
      // The long Zone 2 block leaves room for the day's circuit: about 40% of a 30-min session, 45% of longer ones.
      const mins = slot.long ? (p.minutes <= 30 ? 12 : p.minutes <= 45 ? 18 : 25) + (p.minutes <= 30 ? 2 : 5) * Math.min(ph, 1)
        : (p.minutes <= 30 ? 6 : p.minutes <= 45 ? 8 : 12);
      // Named intervals (Sprint 10s/Jog 20s/Walk 40s) are written as rounds; the app times each phase.
      const phases = (e.name.match(/(\d+)\s*s\b/g) || []).map(x => parseInt(x));
      if (phases.length >= 2) {
        const per = phases.reduce((a, b) => a + b, 0);
        return { sets: 1, reps: `${Math.max(4, Math.round(mins * 60 / per) + 2 * ph)} rounds`, time: null, rest: null };
      }
      time = `${mins}:00`;
    }
    else if (TIMED.test(e.name) || e.pattern === 'isometric' || e.pattern === 'balance') {
      time = `${20 + 5 * (ph + inPhaseWeek - 1)}s`;
    } else if (slot.role === 'main') reps = (loadLimited ? LL.main_reps : goal.main_reps)[Math.min(ph, (loadLimited ? LL.main_reps : goal.main_reps).length - 1)];
    else if (slot.role === 'secondary') reps = loadLimited ? LL.secondary_reps[Math.min(ph, LL.secondary_reps.length - 1)] : goal.secondary_reps;
    else if (slot.role === 'power') {
      reps = {
        speed_accel: ph === 0 ? '10 yd at 70%' : ph === 1 ? '15 yd at 85%' : '20 yd full speed',
        agility_cod: '4 each side', deceleration_landing: '4',
        plyo_bound_hop: ph === 0 ? '8' : '5 each side', plyo_jump: ph === 0 ? '5' : '4',
      }[e.pattern] || (ph === 0 ? '6' : '4');
      if (e.pattern === 'speed_accel') sets = ph === 0 ? 4 : 5;
      return { sets, reps, time: null, rest: e.pattern === 'speed_accel' ? '90s' : restFor(slot.role) };
    }
    else if (slot.role === 'core') reps = slot.early ? '8-10' : '10-12';
    else reps = goal.accessory_reps;
    if (reps && each) reps += each;
    let rest = restFor(slot.role);
    // Home kit: the last phase also gets denser (L&T: 60 s → 45 s after a pair).
    if (loadLimited && nPhases > 1 && ph === nPhases - 1 && slot.role !== 'main' && /^\d+s$/.test(rest || '')) {
      rest = `${Math.max(30, parseInt(rest) - LL.last_phase_rest_drop_secs)}s`;
    }
    return { sets, reps, time, rest, ramped };
  }

  // Trim a session to the time box: accessory sets to 2, then drop accessories from the end,
  // then secondary sets to 2. Main lifts, power work and the first core move stay.
  // Lifting sets per day of each phase's first week, so a later phase's trim stops at the earlier phase's
  // sets while the day still fits in 115% of the time asked (the last phase never ends up with fewer sets).
  const phaseSets = {};
  const liftSets = (day, roleOf) => day.exercises.filter(x => x.round_group !== 'Cooldown' && !['power', 'conditioning'].includes(roleOf(x)))
    .reduce((a, x) => a + (x.sets || 0), 0);
  function fitToTime(day, slots, dayPicks, ph = 0, di = 0) {
    const budget = p.minutes * 1.1;
    const roleOf = (x) => slots[dayPicks.findIndex(e => e?.name === x.name)]?.role;
    const steps = [
      // The last phase's extra set goes first: a session that can't fit it keeps the earlier phases' sets.
      () => { let ch = false; for (const x of day.exercises) if (x._ramp) { x.sets -= 1; delete x._ramp; ch = true; } return ch; },
      // Then the finisher gets shorter (down to 4 rounds / 4 min) before any lift loses a set.
      () => { const x = day.exercises.find(q => roleOf(q) === 'conditioning'); if (!x) return false;
        const m = /^(\d+):00$/.exec(x.time || ''), rr = /^(\d+) rounds$/.exec(x.reps || '');
        if (m && +m[1] > 4) { x.time = `${+m[1] - 2}:00`; return true; }
        if (rr && +rr[1] > 4) { x.reps = `${+rr[1] - 2} rounds`; return true; }
        return false; },
      () => { let ch = false; for (const x of day.exercises) if (['accessory', 'core'].includes(roleOf(x)) && x.sets > 2) { x.sets = 2; ch = true; } return ch; },
      // Jumps added to a non-athletic goal ("Add jumps" ticked) give way before lifting sets do.
      () => { if (goal.power) return false; let ch = false; for (const x of day.exercises) if (roleOf(x) === 'power' && x.sets > 2) { x.sets = 2; ch = true; } return ch; },
      () => { const i = day.exercises.map(x => reqOf(x) ? null : roleOf(x)).lastIndexOf('accessory'); if (i < 0) return false; day.exercises.splice(i, 1); return true; },
      () => { let ch = false; for (const x of day.exercises) if (roleOf(x) === 'secondary' && x.sets > 2) { x.sets = 2; ch = true; } return ch; },
      () => { const rs = day.exercises.map(x => reqOf(x) ? null : roleOf(x)); const i = rs.lastIndexOf('core'); if (i < 0 || day.exercises.map(roleOf).filter(r => r === 'core').length < 2) return false; day.exercises.splice(i, 1); return true; },
      () => { const i = day.exercises.map(roleOf).lastIndexOf('secondary'); if (i < 0 || day.exercises.map(roleOf).filter(r => r === 'secondary').length < 2) return false; day.exercises.splice(i, 1); return true; },
      // Still long: fewer cooldown holds (breathing stays), then a shorter finisher.
      () => { const holds = day.exercises.filter(x => x.round_group === 'Cooldown' && !/breathing/i.test(x.name)); if (holds.length < 2) return false; day.exercises.splice(day.exercises.indexOf(holds[holds.length - 1]), 1); return true; },
    ];
    // A pair whose partner was trimmed rests after itself again (it was counted at 0-15 s).
    const fixOrphans = () => {
      const size = {};
      for (const x of day.exercises) if (x.round_group) size[x.round_group] = (size[x.round_group] || 0) + 1;
      for (const x of day.exercises) if (x.round_group && size[x.round_group] < 2 && x.round_group !== 'Cooldown') {
        x.round_group = null;
        if (/^0/.test(x.rest || '')) x.rest = '60s';
      }
    };
    fixOrphans();   // a lone 'superset' member is estimated at half rest: settle it before measuring
    const floor = ph > 0 ? phaseSets[`${ph - 1}:${di}`] : null;
    const keep = () => floor != null && liftSets(day, roleOf) <= floor && estimateMinutes(day, rules) <= p.minutes * 1.15;
    for (const step of steps) {
      while (estimateMinutes(day, rules) > budget && !keep()) { if (!step()) break; fixOrphans(); }
    }
    for (const x of day.exercises) delete x._ramp;
  }

  // Fill a short session (rules.fill): a day under 85% of the time asked gets accessories for the
  // muscles trained on the fewest days this week, then a set on the secondary and main lifts. Decided
  // once per phase and day (week 1 of the phase), so every week of a phase has the same exercises.
  const FILL = rules.fill || null;
  const fillCache = {};   // `${ph}:${di}` → { adds: [{ slot, e }], bump: Set(names) }
  const BIG = ['quads', 'hamstrings', 'glutes', 'chest', 'lats', 'upper_back', 'side_delts', 'rear_delts', 'biceps', 'triceps', 'calves'];
  /** Days this phase that train muscle m: fractional sets (main muscle 1, helpers 0.5) of 3+ on the day. */
  function daysTraining(ph, extra = {}) {
    const out = {};
    split.days.forEach((_, di) => {
      const fr = {};
      const add = (e, sets) => { if (!e) return; fr[e.primary_muscle] = (fr[e.primary_muscle] || 0) + sets;
        for (const m of (e.muscles || []).slice(0, 3)) if (m !== e.primary_muscle) fr[m] = (fr[m] || 0) + sets / 2; };
      daySlots[di].forEach((slot, si) => { if (['main', 'secondary', 'accessory'].includes(slot.role)) add(picks[ph][di][si], (rules.roles[slot.role] || {}).sets || 3); });
      for (const a of (extra[di] || [])) add(a.e, 3);
      for (const [m, v] of Object.entries(fr)) if (v >= 3) out[m] = (out[m] || 0) + 1;
    });
    return out;
  }
  function fillToTime(day, dayKey, di, ph, w) {
    if (!FILL || rules.days[dayKey].circuit || SPEED_DAY.test(dayKey) || isDeload(w)) return;
    const key = `${ph}:${di}`;
    let plan = fillCache[key];
    const insertAt = () => { const i = day.exercises.findIndex(x => x.round_group === 'Cooldown' || ['core', 'conditioning'].includes(byName.get(x.name)?.role)); return i < 0 ? day.exercises.length : i; };
    const rowFor = (slot, e) => { const d = dose(slot, e, w, ph);
      return { name: e.name, round_group: null, is_alternate: false, sets: d.sets, reps: d.reps, weight: null, distance: null, time: d.time, rest: d.rest, notes: null,
        why: `Extra ${e.primary_muscle.replace(/_/g, ' ')} work: fills the time you asked for and trains it on another day this week` }; };
    // A later phase adds at least what the phase before did, so the last phase never has fewer sets
    // (it may then use the trim budget, 110% of the time asked).
    const prev = ph > 0 ? fillCache[`${ph - 1}:${di}`] : null;
    const minAdds = prev?.adds.length || 0, minBumps = prev?.bump.size || 0;
    const short = () => estimateMinutes(day, rules) < p.minutes * FILL.below;
    const cap = (forced) => p.minutes * (forced ? 1.1 : 1);
    if (!plan) {
      plan = fillCache[key] = { adds: [], bump: new Set() };
      if (!short() && !minAdds && !minBumps) return;
      // Which muscles suit the day: an upper day stays upper, a lower day lower, full body anything.
      const groups = new Set(daySlots[di].flatMap((s, si) => { const e = picks[ph][di][si]; return e && ['main', 'secondary'].includes(s.role) ? [GROUP[e.primary_muscle]] : []; }));
      const suits = (m) => groups.has(GROUP[m]) || (groups.has('push') && groups.has('pull') && groups.has('legs'));
      const usedToday = new Set(day.exercises.map(x => x.name));
      const usedWeek = new Set(picks[ph].flat().filter(Boolean).map(e => e.name));
      const extra = {};
      for (const k of Object.keys(fillCache)) if (k.startsWith(`${ph}:`)) extra[+k.split(':')[1]] = [...fillCache[k].adds];
      const working = () => day.exercises.filter(x => x.round_group !== 'Cooldown' && !['warmup', 'cooldown', 'conditioning'].includes(byName.get(x.name)?.role)).length;
      while (plan.adds.length < FILL.max_added && (plan.adds.length < minAdds
        || (working() < session.max_exercises + (power ? 1 : 0) + FILL.max_extra_exercises && short()))) {
        const forced = plan.adds.length < minAdds && !short();
        const freq = daysTraining(ph, extra);
        const today = new Set(day.exercises.map(x => byName.get(x.name)?.primary_muscle));
        const rank = (a, b) => (freq[a] || 0) - (freq[b] || 0) || (focusMuscles.has(b) ? 1 : 0) - (focusMuscles.has(a) ? 1 : 0) || BIG.indexOf(a) - BIG.indexOf(b);
        let order = BIG.filter(m => suits(m) && (!today.has(m) || (freq[m] || 0) < 2)).sort(rank);
        // Every muscle that suits the day is already covered: any of them, fewest days first.
        if (!order.length) order = BIG.filter(suits).sort(rank);
        let added = false;
        for (const m of order) {
          const slot = { role: 'accessory', muscles: [m] };
          const e = candidates(slot, usedToday, usedWeek, null, ph).find(x => !avoidSet.has(x.name) && !['mobility', 'balance', 'isometric'].includes(x.pattern));
          if (!e) continue;
          const row = rowFor(slot, e);
          day.exercises.splice(insertAt(), 0, row);
          if (estimateMinutes(day, rules) > cap(forced)) { day.exercises.splice(day.exercises.indexOf(row), 1); continue; }
          plan.adds.push({ slot, e }); usedToday.add(e.name); usedWeek.add(e.name);
          (extra[di] ||= []).push({ e }); added = true; break;
        }
        if (!added) break;
      }
      // Still short: one more set on secondary, then main lifts.
      for (const role of ['secondary', 'main']) for (const x of day.exercises) {
        if (!short() && plan.bump.size >= minBumps) break;
        const forced = !short();
        const r = daySlots[di][picks[ph][di].findIndex(e => e?.name === x.name)]?.role;
        if (r !== role || reqOf(byName.get(x.name)) || x.time) continue;
        if (x.sets >= (role === 'main' ? FILL.main_max_sets : FILL.secondary_max_sets)) continue;
        x.sets += 1; plan.bump.add(x.name);
        if (estimateMinutes(day, rules) > cap(forced)) { x.sets -= 1; plan.bump.delete(x.name); }
      }
    } else {
      // Later weeks of the phase: same additions, same extra sets.
      for (const a of plan.adds) day.exercises.splice(insertAt(), 0, rowFor(a.slot, a.e));
      for (const x of day.exercises) if (plan.bump.has(x.name)) x.sets += 1;
    }
    // New exercises: the warm-up and cooldown cover them too.
    if (plan.adds.length) {
      day.warmup = warmupFor(dayKey, ph, day.exercises.filter(x => x.round_group !== 'Cooldown'));
      if (goal.cooldown) {
        day.exercises = day.exercises.filter(x => x.round_group !== 'Cooldown');
        day.exercises.push(...cooldownFor(day.exercises));
      }
    }
  }

  // Pair every lift with one that doesn't compete for the same muscles (lower with upper, push with
  // pull), as Lean & Tone and PJF do for fat loss: 0-15 s between the two, rest after the pair.
  const GROUP = { quads: 'legs', glutes: 'legs', hamstrings: 'legs', adductors: 'legs', abductors: 'legs', hip_flexors: 'legs', calves: 'legs',
    chest: 'push', front_delts: 'push', side_delts: 'push', triceps: 'push',
    lats: 'pull', upper_back: 'pull', rear_delts: 'pull', biceps: 'pull', forearms: 'pull',
    abs: 'core', obliques: 'core', lower_back: 'core', full_body: 'core' };
  function pairAll(rows, slots, dayPicks) {
    const slotOf = (x) => slots[dayPicks.findIndex(e => e?.name === x.name)] || {};
    const ok = (x) => { const sl = slotOf(x); return ['main', 'secondary', 'accessory', 'core'].includes(sl.role) && !sl.early; };
    const grp = (x) => GROUP[byName.get(x.name)?.primary_muscle] || 'core';
    const partner = new Map(), used = new Set();
    rows.forEach((a, i) => {
      if (used.has(i) || !ok(a)) return;
      const ga = grp(a);
      const fits = (j, strict) => !used.has(j) && j !== i && ok(rows[j]) && grp(rows[j]) !== ga
        && (!strict || (ga === 'legs') !== (grp(rows[j]) === 'legs'));
      let j = rows.findIndex((_, k) => k > i && fits(k, true));
      if (j < 0) j = rows.findIndex((_, k) => k > i && fits(k, false));
      if (j < 0) return;
      used.add(i); used.add(j); partner.set(i, j);
    });
    const out = [];
    let n = 0;
    rows.forEach((x, i) => {
      if (partner.has(i)) {
        const y = rows[partner.get(i)], g = `Pair ${String.fromCharCode(65 + n++)}`;
        const restAfter = [x.rest, y.rest].sort((a, b) => secsOf(b) - secsOf(a))[0];
        out.push({ ...x, round_group: g, rest: '0-15s' }, { ...y, round_group: g, rest: restAfter });
      } else if (![...partner.values()].includes(i)) out.push(x);
    });
    return out;
  }

  // Cooldown: hold-stretches for what the day worked (data/session_prep.py's rule, in JS): score the
  // regions by sets, target the ones worked directly or at least half as hard as the top one, pick
  // holds greedily so every target is reached and the two hardest-worked get a hold mainly for them;
  // then 3 minutes of PJF's 7/11 breathing.
  const CREG = { quads: 'quads', hamstrings: 'hamstrings', glutes: 'glutes', abductors: 'glutes', adductors: 'adductors',
    hip_flexors: 'hip flexors', calves: 'calves', chest: 'chest', front_delts: 'shoulders', side_delts: 'shoulders',
    lats: 'lats', upper_back: 'upper back', rear_delts: 'upper back', lower_back: 'lower back' };
  const regionsOf = (e) => { const o = {}; for (const m of e?.muscles || []) if (CREG[m]) o[CREG[m]] = Math.max(o[CREG[m]] || 0, 0.5); if (CREG[e?.primary_muscle]) o[CREG[e.primary_muscle]] = 1; return o; };
  const coolPool = exercises.filter(e => hasVideo(e) && !e.video_standin && (e.level || 1) <= p.level && (e.equipment || ['bodyweight']).every(q => have.has(q)) && !easyHit(e) && !/foam|gentle|optional static|breathing|hang/i.test(e.name) && (
    e.role === 'cooldown' || (e.role === 'warmup' && e.pattern === 'mobility' && /opener|stretch/i.test(e.name))));
  const breathing = exercises.find(e => e.name === '7/11 Breathing' && hasVideo(e));
  function cooldownFor(rows) {
    const score = {}, by = {}, direct = new Set();
    for (const x of rows) {
      const e = byName.get(x.name);
      if (!e) continue;
      const n = e.role === 'conditioning' ? 1 : (x.sets || 1);
      if (n >= 2 && !['conditioning', 'warmup', 'cooldown'].includes(e.role) && CREG[e.primary_muscle]) direct.add(CREG[e.primary_muscle]);
      for (const [r, st] of Object.entries(regionsOf(e))) {
        score[r] = (score[r] || 0) + n * (st === 1 ? 2 : 1);
        (by[r] ||= {})[x.name] = ((by[r] || {})[x.name] || 0) + n;
      }
    }
    const order = Object.entries(score).sort((a, b) => b[1] - a[1]).map(([r]) => r);
    if (!order.length) return [];
    const top = score[order[0]];
    const need = order.filter(r => direct.has(r) || score[r] >= 0.5 * top);
    const strong = need.filter(r => direct.has(r)).slice(0, 2);
    const okR = (r, st) => st >= (strong.includes(r) ? 1 : 0.5);
    const reach = new Set(coolPool.flatMap(e => Object.keys(regionsOf(e))));
    const kMax = p.minutes <= 30 ? 2 : 4, kMin = Math.min(3, kMax);
    const picks = [], covered = new Set();
    while (picks.length < kMax) {
      const left = need.filter(r => !covered.has(r) && reach.has(r));
      if (!left.length && picks.length >= kMin) break;
      const aim = left.length ? left : order.filter(r => !covered.has(r) && reach.has(r)).slice(0, 1);
      if (!aim.length) break;
      let best = null, gain = 0;
      for (const e of coolPool) {
        if (picks.includes(e)) continue;
        const reg = regionsOf(e);
        const g = aim.reduce((a, r) => a + (okR(r, reg[r] || 0) ? score[r] * reg[r] : 0), 0) + rand() * 0.5;
        if (g > gain) { best = e; gain = g; }
      }
      if (!best || gain < 1) break;
      picks.push(best);
      for (const [r, st] of Object.entries(regionsOf(best))) if (okR(r, st)) covered.add(r);
    }
    const out = picks.map(e => {
      const serves = need.filter(r => regionsOf(e)[r]);
      const why = serves.map(r => `${r} (${Object.entries(by[r] || {}).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([n]) => n).join(', ')})`).join('; ');
      return { name: e.name, round_group: 'Cooldown', is_alternate: false, sets: 1, reps: null, weight: null, distance: null,
               time: e.role === 'warmup' ? '30s' : '45s', rest: null, notes: serves.length ? `For today's ${why}.` : null,
               why: serves.length ? `Stretch for today's ${serves.join(', ')}` : 'Cooldown stretch' };
    });
    if (breathing) out.push({ name: breathing.name, round_group: 'Cooldown', is_alternate: false, sets: 1, reps: null,
      weight: null, distance: null, time: '3:00', rest: null, notes: 'Slow breathing to finish: in for 7, out for 11.', why: 'Wind down (PJF)' });
    return out;
  }

  // One line per pick saying why it's there (shown in the plan preview).
  const PAT = { squat: 'squat', hinge: 'hinge', lunge_single_leg: 'single-leg', push_horizontal: 'press', push_vertical: 'overhead press',
    pull_horizontal: 'row', pull_vertical: 'pull-down / pull-up', plyo_jump: 'jumps', plyo_bound_hop: 'hops & bounds', speed_accel: 'sprints',
    agility_cod: 'agility', deceleration_landing: 'landings' };
  function whyFor(slot, e, ph, di, si) {
    const req = reqOf(e);
    if (req) return req.why.split(':')[0].replace(/\s*\(.*?\)/, '');
    if (slot.role === 'conditioning') return slot.long ? 'Long easy cardio (Zone 2)' : 'Finisher: intervals';
    const bits = [];
    if (slot.role === 'main') bits.push(ph > 0 && picks[ph - 1]?.[di]?.[si]?.name === e.name ? 'Main lift, kept from the last phase' : 'Main lift');
    else if (slot.early) bits.push('Core early, to switch it on');
    else if (slot.hip_focus) bits.push('Hip-building move');
    else if (slot.role === 'power') bits.push(`Power first: ${PAT[e.pattern] || e.pattern}`);
    else if (slot.role === 'core') bits.push('Core');
    else bits.push(`${slot.role === 'secondary' ? 'Second lift' : 'Accessory'}: ${PAT[e.pattern] || muscleWord(e.primary_muscle)}`);
    if (levelUp.has(e.name)) bits.push(`one level up: nothing at your level fits this slot with your equipment`);
    if (favSet.has(e.name)) bits.push('♥ your favourite');
    if (coachUse[e.name] && slot.role !== 'core') bits.push(`in ${coachUse[e.name]} of ${coachN} coach program${coachN === 1 ? '' : 's'}`);
    if (likeSet.has(e.name)) bits.push('one you swap to or add');
    else if (upSet.has(e.name)) bits.push('going up for you');
    if (focusMuscles.has(e.primary_muscle)) bits.push('your focus');
    if (ph > 0 && slot.role !== 'main' && (progressesBy(e) === 'variation' || loadLimited) && (e.level || 2) > 1) bits.push(`level ${e.level} for phase ${ph + 1}`);
    return bits.join(' · ');
  }
  const muscleWord = (m) => String(m || '').replace(/_/g, ' ');

  const weeks = [];
  for (let w = 1; w <= p.weeks; w++) {
    const ph = Math.min(nPhases - 1, Math.floor((w - 1) / rules.phases.length_weeks));
    const inPhaseWeek = ((w - 1) % rules.phases.length_weeks) + 1;
    const deload = isDeload(w);
    weeks.push({
      week_num: w,
      days: split.days.map((dayKey, di) => {
        const supersetAcc = !goal.superset_all && (session.superset_accessories || goal.superset_accessories);
        const circuit = !!rules.days[dayKey].circuit;
        let pair = 0, inPair = 0;
        let exercises = daySlots[di].map((slot, si) => {
          const e = picks[ph][di][si];
          if (!e) return null;
          const d = dose(slot, e, w, ph);
          let group = null;
          if (circuit && slot.role !== 'conditioning') group = 'Circuit';
          else if (supersetAcc && !slot.early && (slot.role === 'accessory' || slot.role === 'core')) {
            if (inPair === 0) pair++;
            group = `Superset ${String.fromCharCode(64 + pair)}`;
            inPair = (inPair + 1) % 2;
          }
          return { name: e.name, round_group: group, is_alternate: false, sets: d.sets, reps: d.reps, weight: null,
                   distance: null, time: d.time, rest: d.rest, notes: null, why: whyFor(slot, e, ph, di, si), _ramp: d.ramped || undefined };
        }).filter(Boolean);
        if (circuit) {
          const rows = exercises.filter(x => x.round_group === 'Circuit');
          rows.forEach((x, i) => { x.rest = i === rows.length - 1 ? '60s' : '0s'; });
        } else if (goal.superset_all) exercises = pairAll(exercises, daySlots[di], picks[ph][di]);
        const notes = [
          deload ? 'Deload week: half the sets, same weights. Leave fresh.'
            : `Phase ${ph + 1} of ${nPhases}, week ${inPhaseWeek}. ${inPhaseWeek === 1 ? 'Find weights that leave 2 reps in the tank.' : 'Same exercises: once every set reaches the top of its rep range, add a little weight.'}`,
        ];
        if (!deload && nPhases > 1 && ph === nPhases - 1 && inPhaseWeek === 1 && (goal.set_ramp || 1) > 1) notes.push('Last phase: one more set on the secondary lifts' + ((goal.set_ramp || 1) >= 1.2 ? ' and accessories.' : '.'));
        if (goal.superset_all && exercises.some(x => /^Pair/.test(x.round_group || ''))) notes.push('Pairs: go straight from the first exercise to the second, then rest.');
        if (circuit) notes.push('Circuit: one exercise after another with no rest, 60 s after each round.');
        if (loadLimited && ph > 0 && inPhaseWeek === 1 && !deload) notes.push('Home weights: progress with more reps, shorter rest, slower lowering and harder versions rather than heavier dumbbells.');
        if (daySlots[di].some((s, i) => s.early && picks[ph][di][i])) notes.push('Core comes early to switch it on: smooth reps, stop well short of failure.');
        if (power && exercises.some(x => /^(power)$/.test((daySlots[di].find((s, i) => picks[ph][di][i]?.name === x.name) || {}).role))) {
          notes.push('Power work first, on fresh legs: full effort, full rest, stop when reps slow down.');
        }
        const day = { day_num: di + 1, focus: rules.days[dayKey].focus, warmup: warmupFor(dayKey, ph, exercises), notes, exercises };
        if (goal.cooldown) day.exercises.push(...cooldownFor(day.exercises));
        fitToTime(day, daySlots[di], picks[ph][di], ph, di);
        fillToTime(day, dayKey, di, ph, w);
        if (phaseSets[`${ph}:${di}`] == null && !isDeload(w)) {
          const roleOf = (x) => daySlots[di][picks[ph][di].findIndex(e => e?.name === x.name)]?.role || byName.get(x.name)?.role;
          phaseSets[`${ph}:${di}`] = liftSets(day, roleOf);
        }
        // A superset left with one exercise (odd count, or its partner trimmed) is a straight set.
        const groupSize = {};
        for (const x of day.exercises) if (x.round_group) groupSize[x.round_group] = (groupSize[x.round_group] || 0) + 1;
        for (const x of day.exercises) if (x.round_group && groupSize[x.round_group] < 2 && x.round_group !== 'Cooldown') {
          x.round_group = null;
          if (/^0/.test(x.rest || '')) x.rest = '60s';   // its partner was trimmed: rest after it instead
        }
        return day;
      }),
    });
  }

  // Weekly sets per primary muscle for the first week (shown in the preview).
  const summary = {};
  let workingSets = 0;   // plain sets in week 1 (the summary counts half sets for helper muscles)
  for (const d of weeks[0].days) for (const x of d.exercises) {
    const e = byName.get(x.name);
    if (!e || ['warmup', 'cooldown', 'conditioning'].includes(e.role) || x.round_group === 'Cooldown') continue;
    workingSets += x.sets || 0;
    summary[e.primary_muscle] = (summary[e.primary_muscle] || 0) + (x.sets || 0);
    for (const m of (e.muscles || []).slice(0, 3)) if (m !== e.primary_muscle) summary[m] = (summary[m] || 0) + (x.sets || 0) / 2;
  }
  for (const k of Object.keys(summary)) summary[k] = Math.round(summary[k]);
  const goalLabel = goal.label;
  // The week, laid out around the games (src/lib/week_plan.js): Mixed Week slots the start sheet can set up.
  const week = games ? planWeek(split.days.map(k => rules.days[k].focus), p.sport.days, { sport: p.sport.name || 'basketball' }) : null;
  const DOWN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return {
    id: `gen-${Date.now().toString(36)}`,
    name: `${goalLabel} · ${p.days} days · ${p.weeks} weeks`,
    source: 'custom',
    generated: { ...p },
    description: `${split.name}, ${p.minutes}-minute sessions, ${nPhases} phase${nPhases > 1 ? 's' : ''}${isDeload(p.weeks) ? ' + deload' : ''}.`
      + (week ? ` Built around ${p.sport.name || 'basketball'} ${p.sport.days.map(d => DOWN[d]).join(' & ')}: the games are the jumps and hard conditioning.` : '')
      + (askedDays > p.days ? ` ${askedDays} workouts plus ${p.sport.days.length} games won't fit a week, so it's ${p.days}.` : ''),
    ...(week ? { suggested_week: { days: week.days, labels: { move30_recovery_mobility: 'Recovery & Mobility' }, start_dow: week.start_dow, note: week.note } } : {}),
    sessions_per_week: p.days,
    session_length_min: p.minutes,
    weeks,
    summary,
    working_sets: workingSets,
    pool_size: pool.length,
    favorites_used: [...learnedFrom.favorites],
    learned: prof ? { from_sessions: prof.sessions, avoided: (prof.avoid || []).filter(n => pool.some(e => e.name === n)),
      preferred: [...learnedFrom.preferred] } : null,
  };
}

/** Replace one exercise everywhere it appears on the same day number (all weeks). */
export function swapInPlan(plan, dayNum, oldName, newName) {
  for (const w of plan.weeks) for (const d of w.days) {
    if (d.day_num !== dayNum) continue;
    for (const x of d.exercises) if (x.name === oldName) x.name = newName;
  }
  return plan;
}
