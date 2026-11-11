/**
 * What's been done today, everywhere: every workout session plus the hip plan's check-offs, keyed by
 * move (src/lib/same_move.js). Used by Lift, the Hip tab and Today so a move done in one place shows
 * as done in the others.
 */
import { pref, getByIndex } from '../db.js';
import { localDateStr } from './date.js';
import { loadCatalogs } from './static_data.js';
import { ALL_EXERCISES, SECTIONS } from './hip_protocol.js';
import { movesDoneToday, doneElsewhere } from './same_move.js';

export async function movesToday({ includeHip = true } = {}) {
  const day = localDateStr();
  const [sessions, hipLogs, custom, customPrograms, cat] = await Promise.all([
    getByIndex('sessions', 'date', day),
    includeHip ? pref('hip_logs') : null,
    includeHip ? pref('hip_custom') : null,
    pref('custom_programs'),
    loadCatalogs(),
  ]);
  const names = new Map([...ALL_EXERCISES, ...(custom || [])].map(e => [e.id, e.name]));
  const hipDone = Object.entries((hipLogs || {})[day] || {}).filter(([, v]) => v).map(([id]) => names.get(id)).filter(Boolean);
  const custById = new Map((customPrograms || []).map(p => [p.id, p]));
  const labelFor = (id) => {
    const p = cat.programById.get(id) || custById.get(id);
    return p?.name || p?.program_name || 'another workout';
  };
  return movesDoneToday(sessions, hipDone, labelFor);
}

/**
 * Hip-plan exercises done today somewhere else (a workout): id → where. Shown as done on the Hip
 * tab and counted on Today, without writing to the hip log.
 */
export async function hipCredits(custom = []) {
  const m = await movesToday({ includeHip: false });
  const out = {};
  for (const s of SECTIONS) for (const e of [...(s.exercises || []), ...custom.filter(c => c.sectionId === s.id)]) {
    const hit = doneElsewhere(e.name, m);
    if (hit) out[e.id] = hit.label;
  }
  return out;
}
