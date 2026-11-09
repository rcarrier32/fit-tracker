/**
 * Validate a program in data/library.json before shipping it.
 *
 *   node data/check_program.mjs home_beginner_4wk          # structure + names + videos
 *   node data/check_program.mjs home_beginner_4wk --net    # also checks follow-along links respond
 *   node data/check_program.mjs pjf_durability_code_prime --local ~/Documents/fit-tracker-private/pjf-local-videos.json
 *       # counts the on-device PJF videos (never committed) as covered, like the user's phone does
 *
 * Fails (exit 1) on anything that would show up wrong on the Lift screen: a name that
 * doesn't resolve to a catalog entry, an exercise with no video ("🔍 Find"), a timed
 * move whose time doesn't parse, missing sets/reps, gaps in week/day numbering.
 */
import { readFileSync } from 'fs';
import path from 'path';
import { tagErrors } from './check_catalog.mjs';
import { loadFullCatalog, norm } from './catalog.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const [id, ...flags] = process.argv.slice(2);
const NET = flags.includes('--net');
const LOCAL = flags.includes('--local') ? flags[flags.indexOf('--local') + 1] : null;
// Mirrors static_data.js isHeaderRow: section headers in PJF sheets aren't exercises.
const isHeaderRow = (n) => /^(daily overview|start of workout.*overview|superset|circuit|combo cardio)\b/i.test(String(n || '').trim());
if (!id) { console.error('Usage: node data/check_program.mjs <program_id> [--net] [--local <extra provider file>]'); process.exit(1); }

// Same catalog the phone sees: library + hip tab + data/providers/*.json (+ an optional extra file).
const { lib, byName: catalogByName, providers } = await loadFullCatalog({ extra: [LOCAL] });
const byName = catalogByName;
const localNames = Object.values(providers).flatMap(f => Object.values(f.videos || {}))
  .filter(o => (o?.v || o?.url || o?.yt) && o.name).map(o => norm(o.name));
const hasLocal = (name) => {
  const n = norm(name);
  return !!n && (localNames.includes(n) || (n.length >= 12 && localNames.some(k => k.startsWith(n))));
};
const all = [...Object.values(lib.programs).flat(), ...Object.values(providers).flatMap(f => f.programs || [])];
const p = all.find(x => x.id === id);
if (!p) { console.error(`No program with id "${id}". Known: ${all.map(x => x.id).filter(Boolean).join(', ')}`); process.exit(1); }

const errors = [], warns = [];
const parseSecs = (t) => {
  if (t == null) return 0;
  const s = String(t).trim();
  if (/^\d+(:\d{1,2}){1,2}$/.test(s)) return s.split(':').reduce((a, n) => a * 60 + +n, 0);
  const m = s.match(/([\d.]+)\s*(s|sec|second|m|min|minute)?/i);
  return m ? Math.round(+m[1] * (/^m/i.test(m[2] || '') ? 60 : 1)) : 0;
};

for (const k of ['program_name', 'description', 'sessions_per_week', 'session_length_min', 'level'])
  if (!p[k]) warns.push(`program.${k} missing (shown on the Programs card)`);
if (!p.weeks?.length && !p.days?.length) errors.push('program has neither weeks[] nor days[]');

const weeks = p.weeks || [{ week_num: 1, days: p.days }];
weeks.forEach((w, wi) => {
  if (p.weeks && w.week_num !== wi + 1) errors.push(`week ${wi + 1}: week_num is ${w.week_num}`);
  w.days.forEach((d, di) => {
    const at = `W${w.week_num} D${di + 1}${d.focus ? ` (${d.focus})` : ''}`;
    if (p.weeks && d.day_num !== di + 1) errors.push(`${at}: day_num is ${d.day_num}`);
    if (!d.focus && !d.day_name) errors.push(`${at}: no focus/day_name (the day's title)`);
    if (!d.exercises?.length) errors.push(`${at}: no exercises`);
    const check = (ex, where) => {
      const hit = byName.get(String(ex.name).toLowerCase());
      if (!hit) errors.push(`${at} ${where}: "${ex.name}" doesn't resolve to a catalog exercise`);
      else if (!hit.video_url && !ex.video_url && !hasLocal(ex.name)) errors.push(`${at} ${where}: "${ex.name}" has no video (shows 🔍 Find)`);
      if (hit && tagErrors(hit).length) errors.push(`${at} ${where}: "${ex.name}" isn't tagged (${tagErrors(hit)[0]}): classify it in data/exercise_tags.json`);
      const target = ex.reps || ex.time || ex.distance || ex.set_targets?.length;
      if (!target) warns.push(`${at} ${where}: "${ex.name}" has no reps/time/distance target`);
      if (!ex.reps && ex.time && !parseSecs(ex.time)) errors.push(`${at} ${where}: "${ex.name}" time "${ex.time}" won't run a timer`);
    };
    (d.warmup || []).forEach(ex => check(ex, 'warm-up'));
    // The app hides header rows and alternates (workout.js), so they aren't checked.
    (d.exercises || []).filter(ex => !ex.is_alternate && !isHeaderRow(ex.name)).forEach(ex => {
      check(ex, 'exercise');
      if (!(+ex.sets >= 1) && !ex.set_targets?.length) warns.push(`${at}: "${ex.name}" has no set count (app defaults to 3)`);
      if (ex.round_group && !ex.rest) warns.push(`${at}: "${ex.name}" is in a circuit with no rest (no rest timer)`);
    });
    if (d.video && !/^https?:\/\//.test(d.video.url || '')) errors.push(`${at}: follow-along video has no URL`);
  });
});

if (NET) {
  const urls = [...new Set(weeks.flatMap(w => w.days.map(d => d.video?.url).filter(Boolean)))];
  for (const u of urls) {
    const yt = u.match(/(?:youtu\.be\/|v=)([\w-]{11})/);
    const probe = yt ? `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${yt[1]}&format=json` : u;
    const r = await fetch(probe, { redirect: 'follow' }).catch(() => null);
    if (!r?.ok) errors.push(`follow-along ${u} → ${r ? r.status : 'no response'}${yt ? ' (private, deleted or not embeddable?)' : ''}`);
  }
}

const days = weeks.reduce((n, w) => n + w.days.length, 0);
console.log(`${p.program_name || p.name} (${id}): ${weeks.length} week(s), ${days} day(s)`);
for (const w of [...new Set(warns)]) console.log('  warn ', w);
for (const e of [...new Set(errors)]) console.log('  ERROR', e);
console.log(errors.length ? `\n${new Set(errors).size} error(s). Fix before shipping.` : '\nOK: every name resolves and is tagged, every exercise has a video, every timed move has a timer.');
process.exit(errors.length ? 1 : 0);
