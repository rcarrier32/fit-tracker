/**
 * Pickup basketball days: "Played" or "Didn't play", saved as a session (program_id 'basketball') so the
 * game counts toward the streak and This week, and the next day's workout and Daily Mobility know about
 * it (no jumps or hard intervals the day after; tendons get a lighter day).
 */
import { getByIndex, put, del } from '../db.js';
import { localDateStr } from './date.js';

export const GAME_ID = 'basketball';

/** Today's game record: { played: true|false } or null when not answered yet. */
export async function gameOn(date = localDateStr()) {
  const s = (await getByIndex('sessions', 'date', date)).find(x => x.program_id === GAME_ID);
  return s ? { played: !s.skipped, session: s } : null;
}

/** Save "Played" (a ~60-minute game, logged as 4 quarters) or "Didn't play"; null clears it. */
export async function setGame(played, date = localDateStr()) {
  const old = (await getByIndex('sessions', 'date', date)).filter(x => x.program_id === GAME_ID);
  for (const s of old) await del('sessions', s.id);
  if (played == null) return;
  const now = Date.now();
  await put('sessions', {
    date, program_id: GAME_ID, focus: 'Basketball', done: true, skipped: !played,
    exercises: played ? [{ name: 'Basketball', orig_name: 'Basketball', target_sets: 4, target_reps: '', time: '15:00',
      sets: Array.from({ length: 4 }, () => ({ done: true, at: now })) }] : [],
  });
}
