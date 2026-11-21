/**
 * Daily Mobility looks at yesterday's training and adjusts today's routine.
 * Plain module (no app imports) so it runs in node: `node data/check_daily_adjust.mjs`.
 *
 * Rules (docs/research/Daily hip and body health at 40.md):
 * - Tendons: after jumps, sprints, landings or a heavy leg day, today's pogos become a balance hold.
 *   Elastic and heavy tendon loading is spaced across the week (PJF, Knees Over Toes: 2-5 days, not
 *   daily), so the day after gets the low-impact version.
 * - Stretch what was worked: each region yesterday trained directly (4+ working sets) gets one more set
 *   of today's holds and mobility moves for it (max 3), the same rule as generated cooldowns.
 * - Sore from your notes: areas a recent workout note calls sore (src/lib/feel.js readNote) get one
 *   more set of their holds too, even when the sets alone wouldn't have triggered it.
 * - Nothing changes after a rest day, or when yesterday was only mobility.
 */
import { readNote } from './feel.js';
// Note words → the regions below.
const NOTE_REGION = { quads: 'quads', 'hip flexors': 'hip flexors', hamstrings: 'hamstrings', glutes: 'glutes', adductors: 'adductors',
  calves: 'calves', 'lower back': 'lower back', 'upper back': 'upper back', shoulders: 'shoulders', chest: 'chest', hips: 'glutes' };

/**
 * Moves you marked "Helped" on a finish screen in the last 30 days (newest first), with the dose you
 * did them at, so Daily Mobility can bring one back when its area is sore or was worked hard.
 */
export function helpedMoves(sessions, today) {
  const since = new Date(new Date(today + 'T12:00:00') - 30 * 864e5).toISOString().slice(0, 10);
  const out = new Map();
  for (const s of [...(sessions || [])].sort((a, b) => b.date.localeCompare(a.date))) {
    if (!s.date || s.date < since || s.date > today) continue;
    for (const x of s.exercises || []) if (x.helped && !out.has(x.name)) {
      out.set(x.name, { name: x.name, target_sets: Math.min(2, +x.target_sets || 2), target_reps: x.target_reps || '', time: x.time || null });
    }
  }
  return [...out.values()];
}

/** Areas recent workout notes call sore (not Daily Mobility's own sessions). */
export function soreFromNotes(sessions, { skipProgram = 'daily_mobility' } = {}) {
  const out = new Set();
  for (const s of sessions || []) if (s.program_id !== skipProgram && s.note) for (const a of readNote(s.note).sore) if (NOTE_REGION[a]) out.add(NOTE_REGION[a]);
  return [...out];
}
const REGION = {
  quads: 'quads', hamstrings: 'hamstrings', glutes: 'glutes', abductors: 'glutes', adductors: 'adductors',
  hip_flexors: 'hip flexors', calves: 'calves', chest: 'chest', front_delts: 'shoulders', side_delts: 'shoulders',
  lats: 'lats', upper_back: 'upper back', rear_delts: 'upper back', lower_back: 'lower back',
};
const IMPACT = new Set(['plyo_jump', 'plyo_bound_hop', 'speed_accel', 'agility_cod', 'deceleration_landing']);
const LEGS = new Set(['quads', 'hamstrings', 'glutes']);
const STRETCHY = (e) => e && (e.role === 'cooldown' || e.role === 'warmup' || ['mobility', 'isometric', 'balance'].includes(e.pattern));

/** What yesterday's sessions did: sets per region (direct), impact sets, and the lifts behind each region. */
export function yesterdayLoad(sessions, lookup, { skipProgram = 'daily_mobility' } = {}) {
  const sets = {}, by = {}, direct = {};
  let impact = 0, legSets = 0;
  for (const s of sessions) {
    if (!s.done || s.skipped || s.program_id === skipProgram) continue;
    for (const x of s.exercises || []) {
      const n = (x.sets || []).filter(st => st?.done).length;
      const e = lookup(x.name);
      if (!n || !e || e.role === 'warmup' || e.role === 'cooldown') continue;
      if (IMPACT.has(e.pattern)) impact += n;
      const r = REGION[e.primary_muscle];
      if (!r) continue;
      direct[r] = (direct[r] || 0) + n;
      if (LEGS.has(e.primary_muscle)) legSets += n;
      (by[r] ||= []).includes(x.name) || by[r].push(x.name);
      for (const m of e.muscles || []) if (REGION[m] && REGION[m] !== r) sets[REGION[m]] = (sets[REGION[m]] || 0) + n / 2;
      sets[r] = (sets[r] || 0) + n;
    }
  }
  return { sets, direct, by, impact, legSets };
}

/**
 * @param rows   today's Daily Mobility rows ({ name, target_sets, time, target_reps, notes, ... })
 * @param load   yesterdayLoad(...)
 * @param lookup name → catalog entry ({ role, pattern, primary_muscle, muscles })
 * @returns { rows, note } (rows copied; note null when nothing changed)
 */
export function adjustDaily(rows, load, lookup, { sore = [], helped = [] } = {}) {
  if ((!load || (!Object.keys(load.direct).length && !load.impact)) && !sore.length) return { rows, note: null };
  load = load || { direct: {}, by: {}, impact: 0, legSets: 0 };
  const out = rows.map(r => ({ ...r }));
  const changes = [];
  const worked = Object.entries(load.direct).filter(([, n]) => n >= 4).sort((a, b) => b[1] - a[1]).map(([r]) => r);
  for (const r of sore) if (!worked.includes(r)) worked.push(r);

  // Tendons: no pogos the day after impact work or a heavy leg day.
  if (load.impact >= 3 || load.legSets >= 9) {
    const why = load.impact >= 3 ? 'jumps/sprints' : 'heavy legs';
    const hasBalance = out.some(r => /single.?leg (stance|balance)/i.test(r.name));
    for (let j = out.length - 1; j >= 0; j--) if (/^pogos?$/i.test(out[j].name)) {
      if (hasBalance) {   // the routine already ends on a balance hold: drop the pogos rather than doubling it
        out.splice(j, 1);
        changes.push(`pogos off today (tendons rest after ${why}; the balance hold stays)`);
      } else {
        Object.assign(out[j], { name: 'Single Leg Stance', orig_name: out[j].orig_name || out[j].name, target_reps: '', time: '30s', target_sets: 2,
          notes: 'Swapped from pogos: your tendons get a day after ' + (load.impact >= 3 ? 'yesterday\'s jumps and sprints.' : 'yesterday\'s heavy legs.') + ' Each side.' });
        changes.push(`pogos → balance hold (tendons rest after ${why})`);
      }
    }
  }
  // Stretch what was worked.
  const bumped = [];
  for (const r of out) {
    const e = lookup(r.name);
    if (!STRETCHY(e) || !r.time && !/breath|each|\d/.test(r.target_reps || '')) continue;
    const regions = new Set([REGION[e.primary_muscle], ...(e.muscles || []).map(m => REGION[m])].filter(Boolean));
    const hit = worked.find(w => regions.has(w));
    if (hit && (+r.target_sets || 1) < 3) { r.target_sets = (+r.target_sets || 1) + 1; bumped.push(`${r.name} (${hit})`); }
  }
  if (bumped.length) changes.push('+1 set: ' + bumped.join(', '));
  // Moves you said helped, for an area that's sore or was worked: up to 2, before the finish.
  const have = new Set(out.map(r => r.name.toLowerCase()));
  const brought = [];
  for (const h of helped) {
    if (brought.length >= 2 || have.has(h.name.toLowerCase())) continue;
    const e = lookup(h.name);
    // Mobility, stretch and balance moves, or unloaded ones (a Peterson lunge): a loaded lift you liked isn't mobility.
    const unloaded = e && (e.equipment || ['bodyweight']).every(q => ['bodyweight', 'band', 'mini_band'].includes(q)) && e.role !== 'main';
    if (!STRETCHY(e) && !unloaded) continue;
    const regions = new Set([REGION[e?.primary_muscle], ...(e?.muscles || []).map(m => REGION[m])].filter(Boolean));
    const hit = worked.find(w => regions.has(w));
    if (!hit) continue;
    const at = out.findLastIndex(r => /single.?leg (stance|balance)/i.test(r.name));
    out.splice(at < 0 ? out.length : at, 0, { name: h.name, orig_name: h.name, sets: [], target_sets: h.target_sets, target_reps: h.target_reps, time: h.time,
      notes: `You marked this as helping last time: for your ${hit}.`, helped_add: true });
    have.add(h.name.toLowerCase()); brought.push(`${h.name} (${hit})`);
  }
  if (brought.length) changes.push('added what helped: ' + brought.join(', '));
  if (!changes.length) return { rows, note: null };
  const what = worked.slice(0, 3).map(w => (load.by[w] || []).length ? `${w} (${load.by[w].slice(0, 2).join(', ')})` : `${w} (sore, from your note)`).join('; ');
  const game = (load.by.quads || []).includes('Basketball') || Object.values(load.by).some(l => l.includes('Basketball'));
  return { rows: out, note: `Adjusted for ${game ? "yesterday's game" : "yesterday's training"}${what ? ` — ${what}` : ''}: ${changes.join('; ')}.`, game };
}

/**
 * Tomorrow's plan shapes today's routine too (research: docs/PROGRAM_DESIGN.md "Daily Mobility looks both ways").
 * - The day before a game (a Basketball/game slot): add up to 3 prep moves for what a pickup game loads most,
 *   when today's routine doesn't already cover them: hips through their full rotation (Hip CARs), the groin
 *   (Adductor Rock Back: groin strains are the classic pickup injury) and ankle dorsiflexion (Hip Hinge
 *   Ankle Rocker: cutting and landing need it). Low intensity, no extra impact.
 * - A day with no workout is a recovery day, built the way PJF's Durability Code builds its own
 *   (Lower, Upper, then "Recovery + Correctives": foam roll, correctives, easy locomotion, a hold, Zone 2):
 *   - It opens with PJF's 5-minute Foam Roller Circuit. After a training day the time goes to what was
 *     worked (yesterdayLoad regions); post-workout rolling reduces next-day soreness a little
 *     (Wiewelhove 2019 meta-analysis), the main thing a day after heavy legs needs.
 *   - After a big day, the standing Split Stance Lunge Overhead Reach becomes PJF's floor version
 *     (Rolling Arm Bar w/ Screwdriver Rotation): same reach and rotation, legs off.
 *   - After a big day (9+ leg sets or impact work) it also gets a Zone 2 walk or ride (20 min) as a row
 *     you tick, not a note: easy blood flow clears soreness better than sitting still.
 * @param rows      today's rows (after adjustDaily)
 * @param tomorrow  { label, programId } for tomorrow's slot, or null
 * @param opts      { restToday: today is a rest slot, load: yesterdayLoad(...) }
 * @returns { rows, note } (note null when nothing changed)
 */
export const GAME_PREP = [
  { name: 'Hip CARs', target_sets: 1, target_reps: '3 slow circles each way, each side', area: 'hips', covered: /hip car|hip circle|knee circle/i },
  { name: 'Adductor Rock Back', target_sets: 1, target_reps: '8 each side', area: 'groin', covered: /adductor|groin|lateral lunge|cossack/i },
  { name: 'Hip Hinge Ankle Rocker', target_sets: 1, target_reps: '10 each side', area: 'ankles', covered: /ankle rocker|dorsiflex|ankle mobility/i },
];
export const FOAM_ROLL = 'Foam Roller Circuit', RECOVER_WALK = 'Brisk Walk';
// The lacrosse ball, as PJF's foam roll circuit (feet) and HoopStudy's tissue work (calves, hamstrings, glutes) use it.
// Glutes yes (the right-side gripping), but around the side of the hip, never on the bony point: pressing there
// squeezes the outer-hip tendons (Locala NHS lateral hip guide).
const LAX = 'Then the lacrosse ball: 30-60s on each glute (the right one where it grips), staying off the bony point on the side of the hip, and 30s under each foot.';
// v207: the day before a plan workout, one mobility move for the area it loads most, when today's routine doesn't
// already reach it. Small on purpose: PJF and Griffith put a day's targeted prep in that day's own warm-up (which
// the app does too); this only leans today's easy mobility toward tomorrow.
export const PLAN_PREP = [
  { region: 'hamstrings', name: 'Hamstring Floss', target_reps: '8 each side', covered: /hamstring/i },
  { region: 'adductors', name: 'Adductor Rock Back', target_reps: '8', covered: /adductor|groin|lateral lunge|cossack|frog/i },
  { region: 'glutes', name: 'Hip CARs', target_reps: '3 slow circles each way, each side', covered: /hip car|hip circle|90\/90|pigeon/i },
  { region: 'quads', name: 'Hip Flexor/Quad Bridge', time: '45s', target_reps: '', covered: /hip flexor|couch|quad/i },
  { region: 'hip flexors', name: 'Hip Flexor/Quad Bridge', time: '45s', target_reps: '', covered: /hip flexor|couch|quad/i },
  { region: 'upper back', name: 'Wall Side T Spine Opener', target_reps: '5 each side', covered: /t.?spine|thoracic|world'?s greatest/i },
  { region: 'lats', name: 'Wall Side T Spine Opener', target_reps: '5 each side', covered: /t.?spine|thoracic|world'?s greatest|pullover/i },
];

/** Planned working sets per region for a program day's rows (warm-up and cool-down rows don't count). */
export function plannedLoad(rows, lookup) {
  const direct = {};
  for (const x of rows || []) {
    const e = lookup(x.name);
    if (!e || e.role === 'warmup' || e.role === 'cooldown' || STRETCHY(e)) continue;
    const r = REGION[e.primary_muscle];
    if (!r) continue;
    const n = Array.isArray(x.sets) ? (x.target_sets || x.sets.length || 3) : (+x.sets || +x.target_sets || 3);
    direct[r] = (direct[r] || 0) + n;
  }
  return direct;
}
// Areas a foam roller reaches, in the order to roll them.
// Recovery-day swaps after a big day: [row name, PJF recovery move, dose, why].
const RECOVERY_SWAPS = [
  [/split stance lunge/i, 'Rolling Arm Bar w/ Screwdriver Rotation', '5 each side',
    'the same reach and rotation on the floor, from PJF\'s recovery day, so your legs get the day off.'],
];
const ROLL_AREAS = ['quads', 'glutes', 'hamstrings', 'adductors', 'calves', 'lats', 'upper back'];
export const isGameLabel = (label) => /basketball|pickup|game|soccer|tennis|pickleball/i.test(label || '');

export function prepForTomorrow(rows, tomorrow, lookup, { restToday = false, load = null } = {}) {
  const notes = [];
  let out = rows;
  if (tomorrow && isGameLabel(tomorrow.label)) {
    out = rows.map(r => ({ ...r }));
    const added = [];
    for (const p of GAME_PREP) {
      if (out.some(r => p.covered.test(r.name)) || !lookup(p.name)) continue;
      const at = out.findLastIndex(r => /single.?leg (stance|balance)/i.test(r.name));
      out.splice(at < 0 ? out.length : at, 0, { name: p.name, orig_name: p.name, sets: [], target_sets: p.target_sets,
        target_reps: p.target_reps, time: null, notes: `Ready for tomorrow's ${tomorrow.label.toLowerCase()}: ${p.area}.`, prep_add: true });
      added.push(`${p.name} (${p.area})`);
    }
    notes.push(added.length
      ? `Getting you ready for tomorrow's ${tomorrow.label.toLowerCase()}: added ${added.join(', ')}. Easy and controlled, no extra jumping.`
      : `Tomorrow is ${tomorrow.label.toLowerCase()}: today's routine already covers hips, groin and ankles. Keep it easy.`);
  }
  // Tomorrow is a plan workout: lean today's mobility toward the area it loads most (one move at most).
  if (tomorrow && !isGameLabel(tomorrow.label) && tomorrow.day?.exercises?.length) {
    const planned = Object.entries(plannedLoad(tomorrow.day.exercises, lookup)).filter(([, n]) => n >= 6).sort((a, b) => b[1] - a[1]);
    for (const [region] of planned) {
      const p = PLAN_PREP.find(x => x.region === region);
      if (!p || !lookup(p.name)) continue;
      if (out.some(r => p.covered.test(r.name))) break;    // today already reaches tomorrow's main area
      if (out === rows) out = rows.map(r => ({ ...r }));
      const what = tomorrow.day.focus || tomorrow.day.day_name || 'workout';
      const at = out.findLastIndex(r => /single.?leg (stance|balance)/i.test(r.name));
      out.splice(at < 0 ? out.length : at, 0, { name: p.name, orig_name: p.name, sets: [], target_sets: 1, target_reps: p.target_reps,
        time: p.time || null, notes: `Ready for tomorrow (${what}): ${region}.`, prep_add: true });
      notes.push(`Tomorrow's ${what} works your ${region} most: added ${p.name}, easy.`);
      break;
    }
  }
  if (restToday) {
    if (out === rows) out = rows.map(r => ({ ...r }));
    const big = !!load && (load.legSets >= 9 || load.impact >= 3);
    const worked = load ? Object.entries(load.direct || {}).filter(([, n]) => n >= 4).sort((a, b) => b[1] - a[1]).map(([r]) => r) : [];
    const roll = ROLL_AREAS.filter(a => worked.includes(a));
    if (!out.some(r => /foam roll/i.test(r.name)) && lookup(FOAM_ROLL)) {
      out.unshift({ name: FOAM_ROLL, orig_name: FOAM_ROLL, sets: [], target_sets: 1, target_reps: '', time: '5:00', recover_add: true,
        notes: roll.length
          ? `Recovery from yesterday: most of the time on your ${roll.join(', ')} (about 60s each), then a quick pass on the rest. Slow, breathe, no grinding on sore spots. ${LAX}`
          : `Quads, glutes, calves, lats, upper back: about 30-60s each. Slow passes, breathe. ${LAX}` });
    }
    // After a big day, standing split-stance work loads the legs you're recovering: PJF's recovery day does its
    // rotation on the floor instead (Rolling Arm Bar w/ Screwdriver Rotation, from Recovery + Correctives).
    if (big) for (const r of out) {
      const swap = RECOVERY_SWAPS.find(([m]) => m.test(r.name));
      if (!swap || !lookup(swap[1])) continue;
      Object.assign(r, { orig_name: r.orig_name || r.name, name: swap[1], target_reps: swap[2], target_sets: 1, time: null, recover_add: true,
        notes: `Recovery day: ${swap[3]}` });
    }
    if (big && !out.some(r => /walk|bike|zone 2|ride/i.test(r.name)) && lookup(RECOVER_WALK)) {
      // Before the closing breathing: the calm-down stays last.
      const calm = out.length && /7\/11|breathing/i.test(out[out.length - 1].name) ? out.length - 1 : out.length;
      out.splice(calm, 0, { name: RECOVER_WALK, orig_name: RECOVER_WALK, sets: [], target_sets: 1, target_reps: '', time: '20:00', recover_add: true,
        alternates: ['Easy Bike Ride', 'Zone 2 Low Impact'],
        notes: `Zone 2 after yesterday's ${load.impact >= 3 ? 'jumps and sprints' : 'leg day'}: easy, conversational pace. Swap for a bike ride if you'd rather.` });
    }
    notes.push(`Recovery day: foam roll${roll.length ? ` (mostly ${roll.join(', ')})` : ''}${big ? ' and a 20 min easy walk' : ''}.`);
  }
  return { rows: out, note: notes.length ? notes.join(' ') : null };
}

/**
 * A day with no workout: the hip plan's warm-up folds into Daily Mobility instead of being a separate list.
 * Only its moves today's routine doesn't already cover are added (Cat Camel covers Cat-Cow, any hip-flexor
 * hold covers the hip-flexor stretches, a 90/90 or pigeon covers the 90/90 opener, adductor work covers the rock back…). The walk is only added
 * as the recovery walk (prepForTomorrow, after a big day), which then checks it. Each added row keeps its hip_id, so ticking it checks it on the Hip tab.
 * @param rows     today's rows
 * @param hipRows  the hip plan's warm-up ({ name, hip_id, sets, time, reps, notes })
 */
const HIP_COVER = [
  [/walk|bike/i, /walk|bike|ride|zone 2/i],   // covered by the recovery walk when there is one, never added
  [/cat.?cow/i, /cat.?(cow|camel)/i],
  [/pelvic tilt/i, /pelvic tilt/i],
  [/hip flexor/i, /hip flexor|couch stretch/i],
  [/piriformis/i, /piriformis|pigeon|figure.?4/i],
  [/90.?90/i, /90.?90|pigeon/i],                     // the hip warm-up's 90/90 Hip Opener (v204)
  [/adductor rock|frog/i, /adductor|frog|lateral lunge/i],
  [/hamstring/i, /hamstring/i],
];
export function foldHipWarmup(rows, hipRows) {
  const out = rows.map(r => ({ ...r }));
  const added = [];
  for (const h of hipRows || []) {
    const rule = HIP_COVER.find(([m]) => m.test(h.name));
    const cover = rule ? out.find(r => rule[1].test(r.name)) : out.find(r => r.name.toLowerCase() === h.name.toLowerCase());
    if (cover) { (cover.covers_hip ||= []).push(h.hip_id); continue; }   // doing that row checks this one on the Hip tab
    if (rule && rule[0].source === 'walk|bike') continue;
    const at = out.findLastIndex(r => /single.?leg (stance|balance)/i.test(r.name));
    out.splice(at < 0 ? out.length : at, 0, { name: h.name, orig_name: h.name, sets: [], target_sets: h.sets || 1,
      target_reps: h.reps || '', time: h.time || null, hip_id: h.hip_id, hip_add: true,
      notes: [h.notes, 'From your hip plan\'s warm-up: ticking it here checks it on the Hip tab.'].filter(Boolean).join(' ') });
    added.push(h.name);
  }
  return { rows: out, note: added.length ? `Your hip warm-up is in here today (no workout): added ${added.join(', ')}; the rest is already covered.`
    : 'Your hip warm-up is covered by today\'s routine.' };
}

/**
 * v210: a lifting day has ONE warm-up: the hip plan's warm-up merged with the program's own prep, RAMP order
 * (raise → mobilise from the hip list, then the plan's activation and prep). A hip move the plan's prep already
 * reaches is dropped and rides on that row (covers_hip, so ticking it checks the Hip tab); the long stretch
 * holds ride on the day's cool-down when it holds the same area; Pelvic Tilts ride on Cat-Cow; the hip-flexor
 * hold drops to one round (the cool-down repeats it). Rest days keep the whole hip warm-up (foldHipWarmup).
 * @param hipRows   the hip plan's warm-up rows ({ name, hip_id, sets, time, reps, notes })
 * @param planRows  the program day's own warm-up rows
 * @param cooldown  the day's cool-down rows (names only matter)
 * @returns { rows, cooldownCovers: { [cooldown index]: [hip ids] }, dropped: [names] }
 */
const WU_COVER = [
  [/walk|bike/i, /walk|bike|ride|zone 2|jog/i],
  [/cat.?cow/i, /cat.?(cow|camel)/i],
  [/90.?90/i, /90.?90|pigeon|shin box/i],
  [/adductor rock|frog/i, /adductor|groin|lateral squat|lateral lunge|cossack|frog/i],
  [/hamstring/i, /hamstring/i],
  [/half.?kneeling hip flexor/i, /hip flexor stretch|couch stretch/i],
];
const CD_COVER = [
  [/thomas/i, /hip flexor|couch|quad bridge/i],
  [/hamstring/i, /hamstring|post chain|rdl length|rotational rdl/i],
];
export function mergeHipWarmup(hipRows, planRows = [], cooldown = []) {
  const plan = planRows.map(r => ({ ...r }));
  const head = [], cooldownCovers = {}, dropped = [];
  const catCow = () => head.find(r => /cat.?cow/i.test(r.name)) || plan.find(r => /cat.?(cow|camel)/i.test(r.name));
  for (const h of hipRows || []) {
    const rule = WU_COVER.find(([m]) => m.test(h.name));
    const cover = rule && plan.find(r => rule[1].test(r.name));
    if (cover) { (cover.covers_hip ||= []).push(h.hip_id); dropped.push(h.name); continue; }
    if (/pelvic tilt/i.test(h.name) && catCow()) { (catCow().covers_hip ||= []).push(h.hip_id); dropped.push(h.name); continue; }
    const cd = CD_COVER.find(([m]) => m.test(h.name));
    const ci = cd ? cooldown.findIndex(r => cd[1].test(r.name)) : -1;
    if (ci >= 0) { (cooldownCovers[ci] ||= []).push(h.hip_id); dropped.push(h.name); continue; }
    head.push(/half.?kneeling hip flexor/i.test(h.name) && (h.sets || 1) > 1
      ? { ...h, sets: 1, notes: [h.notes, 'One round before lifting; the cool-down holds it again.'].filter(Boolean).join(' ') }
      : { ...h });
  }
  return { rows: [...head, ...plan], cooldownCovers, dropped };
}

