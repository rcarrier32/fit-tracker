/**
 * One-time cleanup for duplicate workout sessions left by the double-boot bug: app.js was
 * evaluated twice, so two workout renders raced to create the same day's session and sets
 * or swaps could land in either copy. Each group of same-date, same-program-day sessions
 * is merged into one and the extras are deleted. Every removed record is kept verbatim in
 * pref('dedupe_sessions_backup'), so nothing is lost.
 */
import { getAll, put, del, pref } from '../db.js';

const FLAG = 'dedupe_sessions_v1';
const BACKUP = 'dedupe_sessions_backup';

const doneSets = (ex) => (ex.sets || []).filter(s => s?.done).length;
const loggedSets = (s) => (s.exercises || []).reduce((n, ex) => n + doneSets(ex), 0);
const groupKey = (s) => [s.date, s.program_id, s.week, s.day, s.day_index].join('|');

/**
 * Pure merge step. Keeper = the copy with the most logged sets (lowest id on ties). Sets
 * logged only in a duplicate are carried over: into the keeper's exercise of the same name
 * when that has none logged, or appended as an added exercise when the keeper lacks it.
 * Where both copies logged the same exercise, the keeper's sets win.
 */
export function planDedupe(sessions) {
  const groups = new Map();
  for (const s of sessions) {
    if (!s.program_id || !s.date) continue;
    const k = groupKey(s);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(s);
  }

  const keep = [];
  const remove = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    group.sort((a, b) => loggedSets(b) - loggedSets(a) || a.id - b.id);
    const keeper = structuredClone(group[0]);
    for (const dup of group.slice(1)) {
      for (const ex of dup.exercises || []) {
        if (!doneSets(ex)) continue;
        const match = (keeper.exercises || []).find(k => k.name === ex.name);
        if (!match) (keeper.exercises ||= []).push({ ...structuredClone(ex), added: true });
        else if (!doneSets(match)) match.sets = structuredClone(ex.sets);
      }
      keeper.done = !!(keeper.done || dup.done);
      remove.push(dup);
    }
    keep.push(keeper);
  }
  return { keep, remove };
}

/** Runs once per device (and again after restoring an older backup, which lacks the flag). */
export async function dedupeSessions() {
  if (await pref(FLAG)) return 0;
  const { keep, remove } = planDedupe(await getAll('sessions'));
  if (remove.length) {
    const prior = (await pref(BACKUP)) || [];
    await pref(BACKUP, [...prior, ...remove]);   // backup first, then mutate
    for (const s of keep) await put('sessions', s);
    for (const s of remove) await del('sessions', s.id);
  }
  await pref(FLAG, { at: new Date().toISOString(), merged: keep.length, removed: remove.length });
  return remove.length;
}
