/**
 * Daily Mobility card on Home: today's state and the streak. Plain module (no app imports) so it
 * runs in node: `node data/check_daily_card.mjs`.
 */

/** 'YYYY-MM-DD' of the day before. */
export function prevDay(ymd) {
  const d = new Date(ymd + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const finished = (s) => s.done && !s.skipped;

/**
 * Days in a row with Daily Mobility finished. Today not done yet doesn't break it (the streak runs
 * through yesterday until midnight); a skipped or missed day does.
 */
export function dailyStreak(sessions, today, programId = 'daily_mobility') {
  const days = new Set(sessions.filter(s => s.program_id === programId && finished(s)).map(s => s.date));
  let d = days.has(today) ? today : prevDay(today);
  let n = 0;
  while (days.has(d)) { n++; d = prevDay(d); }
  return n;
}

/**
 * Today's card state.
 * @param sessions today's sessions (any program)
 * @returns { state: 'todo' | 'started' | 'done' | 'skipped', done, total, next, minutes }
 */
export function dailyState(sessions, { programId = 'daily_mobility', skippedToday = false, dayRows = [] } = {}) {
  const s = sessions.filter(x => x.program_id === programId).sort((a, b) => (b.id || 0) - (a.id || 0))[0];
  const rows = s?.exercises || dayRows;
  const total = rows.length;
  const doneRow = (x) => (x.sets || []).some(st => st?.done);
  const done = s ? rows.filter(doneRow).length : 0;
  const next = s ? rows.find(x => !doneRow(x)) || null : null;
  // Same estimate as the finish screen: first to last set, plus a few minutes for the first and last moves.
  const stamps = (s?.exercises || []).flatMap(x => (x.sets || []).map(st => st?.done && st.at)).filter(Boolean);
  const minutes = stamps.length > 1 ? Math.round((Math.max(...stamps) - Math.min(...stamps)) / 60000) + 4 : null;
  if (s && finished(s)) return { state: 'done', done, total, next: null, minutes };
  if (skippedToday || s?.skipped) return { state: 'skipped', done, total, next: null, minutes };
  if (done > 0) return { state: 'started', done, total, next, minutes };
  return { state: 'todo', done, total, next: null, minutes };
}

/** "2 × 30s each side" / "3 × 10" for a row. */
export function rowTarget(x) {
  const sets = +x.target_sets || 1;
  const what = x.time || x.target_reps || '';
  return what ? `${sets} × ${what}` : `${sets} set${sets === 1 ? '' : 's'}`;
}
