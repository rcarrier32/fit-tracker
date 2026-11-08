/**
 * Validate a program in data/library.json before shipping it.
 *
 *   node data/check_program.mjs home_beginner_4wk          # structure + names + videos
 *   node data/check_program.mjs home_beginner_4wk --net    # also checks follow-along links respond
 *
 * Fails (exit 1) on anything that would show up wrong on the Lift screen: a name that
 * doesn't resolve to a catalog entry, an exercise with no video ("🔍 Find"), a timed
 * move whose time doesn't parse, missing sets/reps, gaps in week/day numbering.
 */
import { readFileSync } from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');
const [id, ...flags] = process.argv.slice(2);
const NET = flags.includes('--net');
if (!id) { console.error('Usage: node data/check_program.mjs <program_id> [--net]'); process.exit(1); }

const lib = JSON.parse(readFileSync(path.join(ROOT, 'data/library.json'), 'utf8'));
const { HIP_CATALOG_ENTRIES } = await import(path.join(ROOT, 'src/lib/hip_protocol.js'));

// Same resolution as static_data.js: library names, then aliases, then hip-tab entries.
const byName = new Map();
for (const e of lib.exercises) byName.set(e.name.toLowerCase(), e);
for (const e of lib.exercises) for (const a of e.aliases || []) if (!byName.has(a.toLowerCase())) byName.set(a.toLowerCase(), e);
for (const h of HIP_CATALOG_ENTRIES) {
  const dup = byName.get(h.name.toLowerCase());
  if (!dup) byName.set(h.name.toLowerCase(), h);
  else if (!dup.video_url && h.video_url) dup.video_url = h.video_url;
}

const all = Object.values(lib.programs).flat();
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
      else if (!hit.video_url) errors.push(`${at} ${where}: "${ex.name}" has no video (shows 🔍 Find)`);
      if (!ex.reps && !ex.time) errors.push(`${at} ${where}: "${ex.name}" has neither reps nor time`);
      if (!ex.reps && ex.time && !parseSecs(ex.time)) errors.push(`${at} ${where}: "${ex.name}" time "${ex.time}" won't run a timer`);
    };
    (d.warmup || []).forEach(ex => check(ex, 'warm-up'));
    (d.exercises || []).forEach(ex => {
      check(ex, 'exercise');
      if (!(+ex.sets >= 1)) errors.push(`${at}: "${ex.name}" sets is ${ex.sets}`);
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
console.log(errors.length ? `\n${new Set(errors).size} error(s). Fix before shipping.` : '\nOK: every name resolves, every exercise has a video, every timed move has a timer.');
process.exit(errors.length ? 1 : 0);
