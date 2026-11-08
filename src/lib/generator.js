/**
 * Plan generator: builds a multi-week progression program from the tagged exercise catalog,
 * following data/design_rules.json (human version: docs/PROGRAM_DESIGN.md).
 *
 * Plain ES module with no DOM or DB access, so it runs in the app (Plans → Generate a plan)
 * and in node for Claude-built plans (data/generate_plan.mjs).
 *
 *   generatePlan(params, { exercises, rules, hasVideo })
 *   params: { goal, days, minutes, weeks, equipment[], focus[], plyo, level, seed }
 *   returns a program in the app's weeks format, plus `summary` (weekly sets per muscle).
 */

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

const secsOf = (t) => {
  const str = String(t || '').trim();
  if (/^\d+(:\d{1,2}){1,2}$/.test(str)) return str.split(':').reduce((a, n) => a * 60 + +n, 0);
  const m = str.match(/([\d.]+)\s*(s|sec|m|min)?/i);
  return m ? Math.round(+m[1] * (/^m/i.test(m[2] || '') ? 60 : 1)) : 0;
};

/** Rough session length in minutes: warm-up + every set's work and rest (supersets share rest). */
export function estimateMinutes(day, rules) {
  let secs = (day.warmup?.length || 0) * 45 + 60;
  for (const x of day.exercises) {
    const role = Object.values(rules.roles).find(r => r.rest === x.rest) || rules.roles.accessory;
    const work = x.time ? secsOf(x.time) : role.secs_per_set;
    const rest = x.rest ? (secsOf(x.rest) || role.rest_secs || 0) * (x.round_group ? 0.5 : 1) : 0;
    secs += (x.sets || 1) * (work + rest);
  }
  return Math.round(secs / 60);
}

export const FOCUS_GROUPS = {
  Chest: ['chest'], Back: ['lats', 'upper_back'], Shoulders: ['front_delts', 'side_delts', 'rear_delts'],
  Arms: ['biceps', 'triceps'], Glutes: ['glutes'], Legs: ['quads', 'hamstrings'], Hips: ['adductors', 'abductors', 'hip_flexors', 'glutes'],
  Core: ['abs', 'obliques'],
};

export function generatePlan(params, { exercises, rules, hasVideo = (e) => !!e.video_url }) {
  const p = { goal: 'muscle', days: 3, minutes: 60, weeks: 6, equipment: ['bodyweight', 'dumbbell'], focus: [], plyo: false, level: 2, seed: 1, ...params };
  const goal = rules.goals[p.goal];
  const rand = rng(p.seed);
  const have = new Set(['bodyweight', ...p.equipment]);
  const focusMuscles = new Set(p.focus.flatMap(f => FOCUS_GROUPS[f] || [f]));
  const power = goal.power || p.plyo;
  const session = rules.session_minutes[String(p.minutes)] || rules.session_minutes['60'];

  const pool = exercises.filter(e =>
    e.pattern && e.role && hasVideo(e) && (e.level || 2) <= p.level &&
    (e.equipment || ['bodyweight']).every(q => have.has(q)));

  const splitSet = power && rules.athletic_splits[String(p.days)] ? rules.athletic_splits : rules.splits;
  const split = splitSet[String(Math.min(6, Math.max(2, p.days)))];
  const nPhases = Math.max(1, Math.ceil(p.weeks / rules.phases.length_weeks));

  // Weekly sets per primary muscle, filled as picks are made, so later slots balance volume.
  const weekly = {};
  const addVol = (e, sets) => { weekly[e.primary_muscle] = (weekly[e.primary_muscle] || 0) + sets; };

  function candidates(slot, usedToday, usedWeek, avoid) {
    const roles = ROLE_FALLBACK[slot.role] || [slot.role];
    return pool.filter(e => {
      if (!roles.includes(e.role)) return false;
      if (usedToday.has(e.name)) return false;
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
      const t = rules.volume_targets[e.primary_muscle];
      const v = weekly[e.primary_muscle] || 0;
      if (t) { if (v < t[0]) s += 1.2; else if (v >= t[1]) s -= 2; }
      if (usedWeek.has(e.name)) s -= 2.5;
      if (avoid?.has(e.name)) s -= 3;                          // rotate accessories between phases
      if ((e.level || 2) === p.level) s += 0.4;
      if (goal.hip_focus && e.hip_focus) s += 0.8;
      if (goal.hip_focus && slot.role !== 'main' && e.sources?.includes('hip')) s += 1;   // the user's own PT + Motion RC exercises
      const lifting = p.goal === 'strength' || p.goal === 'muscle' || p.goal === 'fat_loss';
      const loadable = e.equipment?.some(q => !['bodyweight', 'band', 'mini_band', 'bench', 'box', 'bosu_pad', 'slider'].includes(q));
      if (loadable) s += lifting ? 1 : 0.3;                       // load beats bodyweight/band for strength work
      if (lifting && (slot.role === 'main' || slot.role === 'secondary') && !loadable && e.equipment?.includes('band')) s -= 1.5;
      if (slot.muscles && ['isolation_upper', 'isolation_lower'].includes(e.pattern)) s += lifting ? 1.5 : 0.5;
      if (slot.muscles && ['mobility', 'balance', 'isometric'].includes(e.pattern) && !slot.hip_focus) s -= lifting ? 2.5 : 1;
      if (/optional/i.test(e.name)) s -= 0.6;
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
    if (goal.conditioning && !SPEED_DAY.test(dayKey)) slots.push({ role: 'conditioning' });
    return slots;
  }

  // Pick exercises: phase 1 picks everything; later phases keep main lifts and rotate the rest.
  const picks = []; // picks[phase][dayIndex] = [exercise|null per slot]
  const daySlots = split.days.map(slotsFor);
  for (let ph = 0; ph < nPhases; ph++) {
    for (const k of Object.keys(weekly)) delete weekly[k];
    const usedWeek = new Set();
    picks[ph] = split.days.map((dayKey, di) => {
      const usedToday = new Set();
      return daySlots[di].map((slot, si) => {
        const prev = ph > 0 ? picks[ph - 1][di][si] : null;
        let e = null;
        if (prev && (slot.role === 'main' || slot.role === 'power' && ph === 1 && false)) e = prev;
        if (!e) {
          const avoid = prev ? new Set([prev.name]) : null;
          e = candidates(slot, usedToday, usedWeek, avoid)[0] || null;
        }
        if (e) {
          usedToday.add(e.name); usedWeek.add(e.name);
          addVol(e, (rules.roles[slot.role] || {}).sets || 3);
        }
        return e;
      });
    });
  }

  // Warm-ups: mobility and drills matched to the day (lower vs upper), rotated by phase.
  function warmupFor(dayKey, ph) {
    const lower = /lower|full|speed/.test(dayKey);
    const pref = lower ? ['hip_flexors', 'glutes', 'adductors', 'calves', 'hamstrings'] : ['upper_back', 'rear_delts', 'front_delts', 'obliques'];
    const list = pool.filter(e => e.role === 'warmup')
      .map(e => [(pref.includes(e.primary_muscle) ? 2 : 0) + (e.pattern === 'mobility' ? 1 : 0.5) + rand(), e])
      .sort((a, b) => b[0] - a[0]).map(([, e]) => e);
    const n = session.warmup_count;
    const start = (ph * n) % Math.max(1, list.length - n);
    return list.slice(start, start + n).map(e => ({
      name: e.name,
      reps: TIMED.test(e.name) || e.pattern === 'speed_accel' ? null : (e.unilateral ? '6 each side' : '8'),
      time: TIMED.test(e.name) ? '30s' : e.pattern === 'speed_accel' ? null : null,
      notes: null,
    })).map(w => (w.reps || w.time ? w : { ...w, reps: '2 × 10 yd' }));
  }

  function dose(slot, e, week, ph) {
    const role = rules.roles[slot.role] || rules.roles.accessory;
    const inPhaseWeek = ((week - 1) % rules.phases.length_weeks) + 1;
    const deload = p.weeks >= 6 && week === p.weeks;
    let sets = role.sets;
    if (slot.role === 'main' && ph >= 1 && (p.goal === 'strength' || p.goal === 'athletic')) sets = 4;
    if (p.minutes <= 30 && slot.role === 'accessory') sets = 2;
    if (deload) sets = Math.max(1, Math.round(sets * rules.phases.deload.sets_factor));
    const each = e.unilateral ? ' each side' : '';
    let reps = null, time = null;
    if (slot.role === 'conditioning') time = p.minutes <= 30 ? '6:00' : p.minutes <= 45 ? '8:00' : '12:00';
    else if (TIMED.test(e.name) || e.pattern === 'isometric' || e.pattern === 'balance') {
      time = `${20 + 5 * (ph + inPhaseWeek - 1)}s`;
    } else if (slot.role === 'main') reps = goal.main_reps[Math.min(ph, goal.main_reps.length - 1)];
    else if (slot.role === 'secondary') reps = goal.secondary_reps;
    else if (slot.role === 'power') {
      reps = {
        speed_accel: ph === 0 ? '10 yd at 70%' : ph === 1 ? '15 yd at 85%' : '20 yd full speed',
        agility_cod: '4 each side', deceleration_landing: '4',
        plyo_bound_hop: ph === 0 ? '8' : '5 each side', plyo_jump: ph === 0 ? '5' : '4',
      }[e.pattern] || (ph === 0 ? '6' : '4');
      if (e.pattern === 'speed_accel') sets = ph === 0 ? 4 : 5;
      return { sets, reps, time: null, rest: e.pattern === 'speed_accel' ? '90s' : role.rest };
    }
    else if (slot.role === 'core') reps = '10-12';
    else reps = goal.accessory_reps;
    if (reps && each) reps += each;
    return { sets, reps, time, rest: role.rest };
  }

  // Trim a session to the time box: accessory sets to 2, then drop accessories from the end,
  // then secondary sets to 2. Main lifts, power work and the first core move stay.
  function fitToTime(day, slots, dayPicks) {
    const budget = p.minutes * 1.1;
    const roleOf = (x) => slots[dayPicks.findIndex(e => e?.name === x.name)]?.role;
    const steps = [
      () => { let ch = false; for (const x of day.exercises) if (['accessory', 'core'].includes(roleOf(x)) && x.sets > 2) { x.sets = 2; ch = true; } return ch; },
      () => { const i = day.exercises.map(roleOf).lastIndexOf('accessory'); if (i < 0) return false; day.exercises.splice(i, 1); return true; },
      () => { let ch = false; for (const x of day.exercises) if (roleOf(x) === 'secondary' && x.sets > 2) { x.sets = 2; ch = true; } return ch; },
      () => { const rs = day.exercises.map(roleOf); const i = rs.lastIndexOf('core'); if (i < 0 || rs.filter(r => r === 'core').length < 2) return false; day.exercises.splice(i, 1); return true; },
      () => { const i = day.exercises.map(roleOf).lastIndexOf('secondary'); if (i < 0 || day.exercises.map(roleOf).filter(r => r === 'secondary').length < 2) return false; day.exercises.splice(i, 1); return true; },
    ];
    for (const step of steps) {
      while (estimateMinutes(day, rules) > budget) if (!step()) break;
    }
  }

  const weeks = [];
  for (let w = 1; w <= p.weeks; w++) {
    const ph = Math.min(nPhases - 1, Math.floor((w - 1) / rules.phases.length_weeks));
    const inPhaseWeek = ((w - 1) % rules.phases.length_weeks) + 1;
    const deload = p.weeks >= 6 && w === p.weeks;
    weeks.push({
      week_num: w,
      days: split.days.map((dayKey, di) => {
        const supersetAcc = session.superset_accessories || goal.superset_accessories;
        let pair = 0, inPair = 0;
        const exercises = daySlots[di].map((slot, si) => {
          const e = picks[ph][di][si];
          if (!e) return null;
          const d = dose(slot, e, w, ph);
          let group = null;
          if (supersetAcc && (slot.role === 'accessory' || slot.role === 'core')) {
            if (inPair === 0) pair++;
            group = `Superset ${String.fromCharCode(64 + pair)}`;
            inPair = (inPair + 1) % 2;
          }
          return { name: e.name, round_group: group, is_alternate: false, sets: d.sets, reps: d.reps, weight: null,
                   distance: null, time: d.time, rest: d.rest, notes: null };
        }).filter(Boolean);
        const notes = [
          deload ? 'Deload week: half the sets, same weights. Leave fresh.'
            : `Phase ${ph + 1} of ${nPhases}, week ${inPhaseWeek}. ${inPhaseWeek === 1 ? 'Find weights that leave 2 reps in the tank.' : 'Same exercises: add a rep or a little weight on each.'}`,
        ];
        if (power && exercises.some(x => /^(power)$/.test((daySlots[di].find((s, i) => picks[ph][di][i]?.name === x.name) || {}).role))) {
          notes.push('Power work first, on fresh legs: full effort, full rest, stop when reps slow down.');
        }
        const day = { day_num: di + 1, focus: rules.days[dayKey].focus, warmup: warmupFor(dayKey, ph), notes, exercises };
        fitToTime(day, daySlots[di], picks[ph][di]);
        return day;
      }),
    });
  }

  // Weekly sets per primary muscle for the first week (shown in the preview).
  const summary = {};
  for (const d of weeks[0].days) for (const x of d.exercises) {
    const e = pool.find(q => q.name === x.name);
    if (e) summary[e.primary_muscle] = (summary[e.primary_muscle] || 0) + (x.sets || 0);
  }
  const goalLabel = goal.label;
  return {
    id: `gen-${Date.now().toString(36)}`,
    name: `${goalLabel} · ${p.days} days · ${p.weeks} weeks`,
    source: 'custom',
    generated: { ...p },
    description: `${split.name}, ${p.minutes}-minute sessions, ${nPhases} phase${nPhases > 1 ? 's' : ''}${p.weeks >= 6 ? ' + deload' : ''}.`,
    sessions_per_week: p.days,
    session_length_min: p.minutes,
    weeks,
    summary,
    pool_size: pool.length,
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
