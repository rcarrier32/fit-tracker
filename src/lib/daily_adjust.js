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
 * - Every rest day starts with PJF's 5-minute foam roll circuit (from PJF's Recovery + Correctives day):
 *   quads, glutes, calves, lats, upper back. Rest & Recover is the recovery day, so it gets the release work.
 * - A rest day after a big one (9+ leg sets or impact work): suggest an easy 15-20 min walk or ride on top,
 *   which clears soreness better than sitting still.
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
export const FOAM_ROLL = 'Foam Roller Circuit';
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
  if (restToday && !out.some(r => /foam roll/i.test(r.name)) && lookup(FOAM_ROLL)) {
    out = [{ name: FOAM_ROLL, orig_name: FOAM_ROLL, sets: [], target_sets: 1, target_reps: '', time: '5:00',
      notes: 'Rest & Recover: quads, glutes, calves, lats, upper back. Slow passes, breathe, about 30s an area.', prep_add: true }, ...out];
  }
  if (restToday && load && (load.legSets >= 9 || load.impact >= 3)) {
    notes.push('Rest day after a big one: an easy 15-20 min walk or ride on top of this helps the legs recover.');
  }
  return { rows: out, note: notes.length ? notes.join(' ') : null };
}

/**
 * A day with no workout: the hip plan's warm-up folds into Daily Mobility instead of being a separate list.
 * Only its moves today's routine doesn't already cover are added (Cat Camel covers Cat-Cow, any hip-flexor
 * hold covers the hip-flexor stretches, pigeon or figure-4 covers the piriformis…). The walk stays out: on a
 * rest day the note already suggests one. Each added row keeps its hip_id, so ticking it checks it on the Hip tab.
 * @param rows     today's rows
 * @param hipRows  the hip plan's warm-up ({ name, hip_id, sets, time, reps, notes })
 */
const HIP_COVER = [
  [/walk|bike/i, /.^/],   // never added (see above)
  [/cat.?cow/i, /cat.?(cow|camel)/i],
  [/pelvic tilt/i, /pelvic tilt/i],
  [/hip flexor/i, /hip flexor|couch stretch/i],
  [/piriformis/i, /piriformis|pigeon|figure.?4/i],
  [/hamstring/i, /hamstring/i],
];
export function foldHipWarmup(rows, hipRows) {
  const out = rows.map(r => ({ ...r }));
  const added = [];
  for (const h of hipRows || []) {
    const rule = HIP_COVER.find(([m]) => m.test(h.name));
    if (rule && rule[0].source === 'walk|bike') continue;
    const cover = rule ? out.find(r => rule[1].test(r.name)) : out.find(r => r.name.toLowerCase() === h.name.toLowerCase());
    if (cover) { (cover.covers_hip ||= []).push(h.hip_id); continue; }   // doing that row checks this one on the Hip tab
    const at = out.findLastIndex(r => /single.?leg (stance|balance)/i.test(r.name));
    out.splice(at < 0 ? out.length : at, 0, { name: h.name, orig_name: h.name, sets: [], target_sets: h.sets || 1,
      target_reps: h.reps || '', time: h.time || null, hip_id: h.hip_id, hip_add: true,
      notes: [h.notes, 'From your hip plan\'s warm-up: ticking it here checks it on the Hip tab.'].filter(Boolean).join(' ') });
    added.push(h.name);
  }
  return { rows: out, note: added.length ? `Your hip warm-up is in here today (no workout): added ${added.join(', ')}; the rest is already covered.`
    : 'Your hip warm-up is covered by today\'s routine.' };
}
