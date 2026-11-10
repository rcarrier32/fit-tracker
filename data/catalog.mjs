/**
 * The full exercise catalog exactly as the phone sees it, for every node tool (validators,
 * the plan generator) and for the exercise knowledge index.
 *
 *   library.json exercises  +  Hip tab entries  +  provider files (data/providers/*.json)
 *
 * Provider files are loaded the same way src/lib/local_videos.js does at boot:
 * - a provider entry whose name matches a catalog exercise gives it the provider's own video
 *   (PJF member demo, TrainHeroic/Griffith demo), which beats the catalog's YouTube link;
 * - a tagged provider entry the catalog doesn't have joins the catalog.
 *
 *   node data/catalog.mjs          # rewrite data/exercise_index.json (also run by tag_exercises.py)
 */
import { readFileSync, readdirSync, writeFileSync } from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');
export const norm = (s) => String(s ?? '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '');
// Video matching, mirrored from src/lib/local_videos.js: brackets count ("(Knee)", "(quad focus)"),
// except "(Optional)"; a longer provider name matches only if it just adds a bracket or finishes
// a word our name was cut off in.
const vkey = (s) => String(s ?? '').toLowerCase().replace(/\(optional\)/g, '').replace(/[^a-z0-9]/g, '');
const words = (s) => String(s ?? '').toLowerCase().replace(/\(optional\)/g, '')
  .replace(/[^a-z0-9(]+/g, ' ').replace(/\s+/g, ' ').trim();
function providerMatcher(providers, order) {
  const byKey = new Map();
  for (const src of order) for (const o of Object.values(providers[src].videos || {})) {
    if (o?.name && !byKey.has(vkey(o.name))) byKey.set(vkey(o.name), { src, o });
  }
  const list = [...byKey.values()].map(x => [words(x.o.name), x]).sort((a, b) => b[0].length - a[0].length);
  return (name) => {
    const n = vkey(name);
    if (!n) return null;
    if (byKey.has(n)) return byKey.get(n);
    const w = words(name);
    for (const [pw, x] of list) {
      if (!pw.startsWith(w)) continue;
      const rest = pw.slice(w.length);
      if (rest.startsWith(' (')) return x;
      if (rest && rest[0] !== ' ' && n.length >= 12) return x;
    }
    return null;
  };
}
const FIELDS = ['primary_muscle', 'muscles', 'pattern', 'role', 'equipment', 'level', 'unilateral', 'plane', 'hip_focus'];

/** Read a provider/private file (older PJF exports were not UTF-8). */
export function readProviderFile(file) {
  const buf = readFileSync(file.replace(/^~/, process.env.HOME));
  let txt = buf.toString('utf8');
  if (txt.includes('�')) txt = buf.toString('latin1');
  return JSON.parse(txt);
}

/** Every data/providers/*.json file, plus any extra file passed (e.g. --local), keyed by source. */
export function loadProviders(extra = []) {
  const dir = path.join(ROOT, 'data/providers');
  const out = {};
  for (const f of readdirSync(dir).filter(f => f.endsWith('.json'))) {
    const d = readProviderFile(path.join(dir, f));
    out[d.source || f.replace(/\.json$/, '')] = d;
  }
  for (const f of extra.filter(Boolean)) { const d = readProviderFile(f); out[d.source || 'pjf'] = d; }
  return out;
}

const providerVideo = (o) => (o.v ? `https://stream.mux.com/${o.v}.m3u8` : o.url || (o.yt ? `https://youtu.be/${o.yt}` : null));

/**
 * { lib, exercises, byName, providers }. Each exercise carries its taxonomy tags and
 * `video` = { url, from } where from is the provider ('pjf', 'trainheroic') or 'catalog'.
 */
export async function loadFullCatalog({ extra = [] } = {}) {
  const lib = JSON.parse(readFileSync(path.join(ROOT, 'data/library.json'), 'utf8'));
  const { HIP_CATALOG_ENTRIES } = await import(path.join(ROOT, 'src/lib/hip_protocol.js'));
  const byName = new Map();
  const exercises = [];
  const add = (e) => { exercises.push(e); byName.set(e.name.toLowerCase(), e); };
  for (const e of lib.exercises) add({ ...e });
  for (const e of exercises.slice()) for (const a of e.aliases || []) if (!byName.has(a.toLowerCase())) byName.set(a.toLowerCase(), e);
  for (const h of HIP_CATALOG_ENTRIES) {
    const dup = byName.get(h.name.toLowerCase());
    if (!dup) add({ ...h, ...(lib.extra_tags?.[h.id] || {}) });
    else if (!dup.video_url && h.video_url) dup.video_url = h.video_url;
  }
  for (const e of exercises) e.video = e.video_url ? { url: e.video_url, from: 'catalog' } : null;

  // Provider files: PJF first (closest match for PJF program names), like local_videos.js.
  const providers = loadProviders(extra);
  const order = Object.keys(providers).sort((a, b) => (a === 'pjf' ? -1 : b === 'pjf' ? 1 : a.localeCompare(b)));
  // Provider-only moves (with tags) join the catalog as private entries.
  for (const src of order) {
    for (const o of Object.values(providers[src].videos || {})) {
      if (!o?.name || !o.tags || byName.has(o.name.toLowerCase())) continue;
      add({ id: `private-${src}-${o.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name: o.name, sources: [src], aliases: [],
        video_url: o.yt ? `https://youtu.be/${o.yt}` : null, ...o.tags, video: null });
    }
  }
  // Every exercise's video is whatever the app plays: the provider demo localFor() finds, else
  // the library's YouTube link. Same matching as src/lib/local_videos.js (keep the two in step).
  const providerFor = providerMatcher(providers, order);
  for (const e of exercises) {
    const p = providerFor(e.name);
    const url = p && providerVideo(p.o);
    if (url) e.video = { url, from: p.src };
    else if (!e.video && e.video_url) e.video = { url: e.video_url, from: e.sources?.[0] || 'catalog' };
    if (p?.o.notes?.length) e.provider_notes ??= p.o.notes;
  }
  return { lib, exercises, byName, providers };
}

/** data/exercise_index.json: every exercise → muscles, movement, equipment, its video and where that video comes from. */
export async function writeExerciseIndex() {
  const { exercises } = await loadFullCatalog();
  const rows = exercises.filter(e => e.pattern).map(e => ({
    name: e.name, id: e.id, sources: e.sources || [],
    ...Object.fromEntries(FIELDS.map(k => [k, e[k]])),
    video: e.video?.url || null, video_from: e.video?.from || null,
  })).sort((a, b) => a.name.localeCompare(b.name));
  const group = (key) => {
    const m = {};
    for (const r of rows) for (const v of [].concat(r[key] ?? [])) (m[v] ??= []).push(r.name);
    return Object.fromEntries(Object.entries(m).sort());
  };
  const out = {
    _doc: 'Generated by data/catalog.mjs (run by tag_exercises.py). Build plans from this: pick exercises by muscle and pattern, '
      + 'and every pick comes with its video. video_from: pjf / trainheroic = the provider\'s own demo; catalog = the YouTube link in library.json.',
    counts: { exercises: rows.length, with_video: rows.filter(r => r.video).length,
      video_from: rows.reduce((c, r) => ((c[r.video_from || 'none'] = (c[r.video_from || 'none'] || 0) + 1), c), {}) },
    by_primary_muscle: group('primary_muscle'),
    by_muscle: group('muscles'),
    by_pattern: group('pattern'),
    exercises: rows,
  };
  writeFileSync(path.join(ROOT, 'data/exercise_index.json'), JSON.stringify(out, null, 1) + '\n');
  return out.counts;
}

if (import.meta.url === `file://${process.argv[1]}`) console.log('exercise_index:', JSON.stringify(await writeExerciseIndex()));
