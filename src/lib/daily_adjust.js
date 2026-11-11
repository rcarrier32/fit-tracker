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
    for (const r of out) if (/^pogos?$/i.test(r.name)) {
      Object.assign(r, { name: 'Single Leg Stance', orig_name: r.orig_name || r.name, target_reps: '', time: '30s', target_sets: 2,
        notes: 'Swapped from pogos: your tendons get a day after ' + (load.impact >= 3 ? 'yesterday\'s jumps and sprints.' : 'yesterday\'s heavy legs.') + ' Each side.' });
      changes.push('pogos → balance hold (tendons rest after ' + (load.impact >= 3 ? 'jumps/sprints' : 'heavy legs') + ')');
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
    const regions = new Set([REGION[e?.primary_muscle], ...(e?.muscles || []).map(m => REGION[m])].filter(Boolean));
    const hit = worked.find(w => regions.has(w));
    if (!hit) continue;
    const at = out.findIndex(r => /single.?leg (stance|balance)/i.test(r.name));
    out.splice(at < 0 ? out.length : at, 0, { name: h.name, orig_name: h.name, sets: [], target_sets: h.target_sets, target_reps: h.target_reps, time: h.time,
      notes: `You marked this as helping last time: for your ${hit}.`, helped_add: true });
    have.add(h.name.toLowerCase()); brought.push(`${h.name} (${hit})`);
  }
  if (brought.length) changes.push('added what helped: ' + brought.join(', '));
  if (!changes.length) return { rows, note: null };
  const what = worked.slice(0, 3).map(w => (load.by[w] || []).length ? `${w} (${load.by[w].slice(0, 2).join(', ')})` : `${w} (sore, from your note)`).join('; ');
  return { rows: out, note: `Adjusted for yesterday's training${what ? ` — ${what}` : ''}: ${changes.join('; ')}.` };
}
