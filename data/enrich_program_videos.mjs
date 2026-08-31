/**
 * Program exercise YouTube enrichment — GATED, review-only. Same pattern as
 * enrich_hip_videos.mjs (ported from nextplay/scripts/enrich-dev-skills.mjs), generalized
 * to target any `sources` tag in data/library.json's top-level `exercises` catalog instead
 * of just the hip protocol's SECTIONS.
 *
 * For each untouched exercise, searches the YouTube Data API, keeps short embeddable
 * clips, boosts trusted athletic-performance/strength channels (plus the program's own
 * channel, if named), and writes the top-N per exercise to a REVIEW FILE. Nothing is
 * written into library.json — a human reviews data/<source>-video-review.json and
 * approved ids get applied with --apply.
 *
 * Usage:
 *   node data/enrich_program_videos.mjs --source pjf                  # first 80 unresolved
 *   node data/enrich_program_videos.mjs --source pjf --limit 40       # smaller quota-sized chunk
 *   node data/enrich_program_videos.mjs --source pjf --only "Kickstand RDL"
 *   node data/enrich_program_videos.mjs --source pjf --redo           # re-search ones already in the review file
 *   node data/enrich_program_videos.mjs --source pjf --apply          # write approved video_urls into library.json
 *
 * Review flow:
 *   1. Run without --apply. Open data/<source>-video-review.json.
 *   2. For each exercise, move your chosen candidate's videoId into "approved".
 *   3. Re-run with --apply to patch video_url into library.json.
 *   4. Quota-limited (YouTube Data API default 10,000 units/day, ~100 units per exercise
 *      searched) — re-run on later days without --redo to pick up where you left off; each
 *      run merges into the same review file rather than overwriting prior candidates.
 *
 * Requires YOUTUBE_API_KEY (env, or .env.local at the repo root — gitignored, never printed).
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

const ROOT         = path.resolve(import.meta.dirname, '..');
const LIBRARY_PATH = path.join(ROOT, 'data/library.json');

// ── args ──
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const SOURCE      = opt('source', null);
const ONLY        = opt('only', null);
const TOP         = parseInt(opt('top', '3'), 10);
const LIMIT       = parseInt(opt('limit', '80'), 10);   // new searches this run — quota guard
const MAX_SECONDS = parseInt(opt('max-seconds', '300'), 10);
const APPLY       = args.includes('--apply');
const REDO        = args.includes('--redo');

if (!SOURCE) {
  console.error('Usage: node data/enrich_program_videos.mjs --source <tag> [--apply]');
  process.exit(1);
}
const REVIEW_PATH = path.join(ROOT, `data/${SOURCE}-video-review.json`);

/**
 * Per-source channel name (channelTitle substring) to try FIRST, scoped search — the
 * program's own trainer, if any of their demos are still public. Falls through to the
 * general trusted-channel search below when nothing usable turns up (e.g. PJF Performance
 * moved most current demos into his own app rather than YouTube).
 */
// PJF Performance's own channel doesn't turn up matches for his current program content —
// he's since moved most demo videos into his own paid app rather than YouTube (confirmed
// empirically: zero isSource hits across test runs) — so skip the extra source-channel
// query and its API cost for that source. Left here as a mechanism for sources where the
// trainer's own channel is still productive.
const SOURCE_CHANNEL = {
  bws: 'Jeremy Ethier',
};

/**
 * Trusted athletic-performance / strength channels — channelTitle substrings that BOOST a
 * result. Distinct from enrich_hip_videos.mjs's rehab/PT list: this is for power, plyo,
 * agility, and general strength programming rather than clinical rehab demos.
 */
const TRUSTED_CHANNELS = [
  'pjf performance', 'jeremy ethier', 'built with science',
  'just fly sports performance', 'just-fly', 'justfly',
  'attack athletics', 'chris barnard', 'overtime athletics', 'central athlete',
  'lee taft', 'movement vault', 'brendon rearick', 'train ugly',
  'bar athlete', 'ath performance', 'complete athlete',
  'kneesovertoesguy', 'knees over toes guy', 'squat university', 'precision movement',
  'renaissance periodization', 'jeff nippard', 'stronger by science',
  'bret contreras', 'perform better',
];

const GOOD_TITLE_HINTS = [
  'how to', 'proper form', 'technique', 'exercise', 'demonstration', 'demo',
  'tutorial', 'correctly', 'drill', 'progression',
];
const BAD_TITLE_HINTS = [
  'top 10', 'top 5', 'best exercises', 'worst', 'stop doing', 'shocking',
  'in 30 days', 'day challenge', 'full workout', 'follow along', 'podcast', 'react',
];

if (!process.env.YOUTUBE_API_KEY) {
  const envFile = path.join(ROOT, '.env.local');
  if (existsSync(envFile)) { try { process.loadEnvFile(envFile); } catch { /* shell may set it */ } }
}
const KEY = process.env.YOUTUBE_API_KEY === 'PASTE_YOUR_KEY_HERE'
  ? null
  : process.env.YOUTUBE_API_KEY;

const lib = JSON.parse(readFileSync(LIBRARY_PATH, 'utf8'));

// ── target selection ──
const allTargets = lib.exercises
  .filter(e => (e.sources || []).includes(SOURCE))
  .filter(e => !ONLY || e.name === ONLY);

// ── apply mode: patch approved video_urls into library.json, no API needed ──
if (APPLY) {
  if (!existsSync(REVIEW_PATH)) {
    console.error(`No review file at ${REVIEW_PATH}. Run without --apply first.`);
    process.exit(1);
  }
  const review = JSON.parse(readFileSync(REVIEW_PATH, 'utf8'));
  const byId = new Map(lib.exercises.map(e => [e.id, e]));
  let patched = 0, skipped = 0;

  for (const entry of review.exercises || []) {
    const pick = entry.approved
      ? (entry.candidates || []).find(c => c.videoId === entry.approved)
        || { videoId: entry.approved, title: '', channel: '' }
      : null;
    if (!pick) { skipped++; continue; }
    const ex = byId.get(entry.id);
    if (!ex) { console.warn(`  ! ${entry.id} no longer in library.json`); skipped++; continue; }
    ex.video_url = `https://youtu.be/${pick.videoId}`;
    patched++;
  }

  writeFileSync(LIBRARY_PATH, JSON.stringify(lib, null, 2) + '\n');
  console.log(`\nApplied ${patched} video url${patched === 1 ? '' : 's'} to library.json (${skipped} skipped — no "approved" set).`);
  process.exit(0);
}

if (!KEY) {
  console.error('YOUTUBE_API_KEY not set. Add it to .env.local at the repo root, or export it.');
  process.exit(1);
}

// ── YouTube Data API ──
async function yt(endpoint, params) {
  const url = `https://www.googleapis.com/youtube/v3/${endpoint}?` +
    new URLSearchParams({ ...params, key: KEY }).toString();
  const r = await fetch(url);
  const d = await r.json();
  if (d.error) throw new Error(`${d.error.errors?.[0]?.reason}: ${d.error.message}`);
  return d;
}

const parseISO = (iso) => {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || '') || [];
  return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
};
const decode = (s) => (s || '')
  .replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
const hits = (text, list) => { const t = (text || '').toLowerCase(); return list.some(x => t.includes(x)); };

/**
 * PJF's program-source names are full of internal shorthand ("Iso", "Progressions",
 * fraction/percent load qualifiers, "or"-alternatives) that hurts search relevance —
 * nobody else's videos are titled "1/4 Squats or 1/4 Leg Press". Simplify to the
 * searchable movement itself before querying; the review file still shows the exercise's
 * real name so a human reviewing candidates knows what it's actually for.
 */
function simplifyForSearch(name) {
  let s = name.split(/\s+or\s+/i)[0];
  s = s.replace(/\([^)]*\)/g, '');
  s = s.replace(/\b1\/4\b/g, 'Quarter').replace(/\b1\/2\b/g, 'Half').replace(/\b3\/4\b/g, 'Three Quarter');
  s = s.replace(/\b\d+%/g, '').replace(/\b\d+\/\d+\b/g, '');
  s = s.replace(/\bISOs?\b/gi, 'Isometric Hold');
  s = s.replace(/\bw\//gi, 'with');
  s = s.replace(/\b(Progressions?|Mechanics|Freestyles?)\b/gi, '');
  return s.replace(/\s+/g, ' ').trim() || name;
}

async function searchOnce(q) {
  const search = await yt('search', {
    part: 'snippet', type: 'video', maxResults: '12', q, videoEmbeddable: 'true',
  });
  const ids = search.items.map(it => it.id.videoId).filter(Boolean);
  if (!ids.length) return [];
  const details = await yt('videos', { part: 'contentDetails,status', id: ids.join(',') });
  const byId = new Map(details.items.map(v => [v.id, v]));
  return search.items.map(it => ({ it, detail: byId.get(it.id.videoId) }));
}

async function enrich(ex) {
  const sourceChannel = SOURCE_CHANNEL[SOURCE];
  const baseName = simplifyForSearch(ex.name);
  const queries = sourceChannel
    ? [`${baseName} ${sourceChannel}`, `${baseName} exercise tutorial`]
    : [`${baseName} exercise tutorial`];

  const seen = new Map();
  for (const q of queries) {
    const results = await searchOnce(q);
    for (const { it, detail } of results) {
      const id = it.id.videoId;
      if (seen.has(id)) continue;
      const seconds = detail ? parseISO(detail.contentDetails.duration) : 9999;
      const channel  = it.snippet.channelTitle;
      const title    = decode(it.snippet.title);
      const trusted  = hits(channel, TRUSTED_CHANNELS) || (sourceChannel && channel.toLowerCase().includes(sourceChannel.toLowerCase()));
      const isSource = sourceChannel && channel.toLowerCase().includes(sourceChannel.toLowerCase());
      const keyword  = baseName.toLowerCase().replace(/[^a-z\s-]/g, '').split(/\s+/)[0];
      const titleHit = title.toLowerCase().includes(keyword);
      const goodHint = hits(title, GOOD_TITLE_HINTS);
      const badHint  = hits(title, BAD_TITLE_HINTS);

      const score =
        (isSource ? 4 : 0) +
        (trusted  ? 3 : 0) +
        (titleHit ? 1 : 0) +
        (goodHint ? 0.5 : 0) +
        (badHint ? -2 : 0) +
        Math.max(0, (MAX_SECONDS - seconds) / MAX_SECONDS);

      seen.set(id, {
        videoId: id, title, channel, seconds, trusted, isSource,
        embeddable: detail?.status?.embeddable !== false,
        url: `https://youtu.be/${id}`,
        score: +score.toFixed(2),
      });
    }
  }
  return [...seen.values()]
    .filter(c => c.embeddable && c.seconds <= MAX_SECONDS)
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP);
}

// ── merge with any existing review file so chunked runs accumulate ──
let out = { source: SOURCE, generated_for: 0, max_seconds: MAX_SECONDS, exercises: [] };
if (existsSync(REVIEW_PATH)) {
  try { out = JSON.parse(readFileSync(REVIEW_PATH, 'utf8')); } catch { /* start fresh */ }
}
const already = new Map((out.exercises || []).map(e => [e.id, e]));

const todo = allTargets.filter(ex => REDO || ONLY || !already.has(ex.id) || already.get(ex.id).error);
const thisRun = todo.slice(0, LIMIT);

console.log(`${SOURCE}: ${allTargets.length} total, ${already.size} already attempted, running ${thisRun.length} this pass (--limit ${LIMIT})`);

for (const ex of thisRun) {
  process.stdout.write(`  ${ex.id} … `);
  try {
    const candidates = await enrich(ex);
    already.set(ex.id, {
      id: ex.id,
      name: ex.name,
      approved: already.get(ex.id)?.approved ?? null,   // preserve a prior human approval across re-runs
      candidates,
    });
    console.log(`${candidates.length} candidate${candidates.length === 1 ? '' : 's'}${candidates[0]?.isSource ? ' ★source' : candidates[0]?.trusted ? ' ★' : ''}`);
  } catch (e) {
    console.log(`FAILED — ${e.message}`);
    already.set(ex.id, { id: ex.id, name: ex.name, error: e.message, approved: null, candidates: [] });
    if (/quotaExceeded/i.test(e.message)) {
      console.log('\nQuota exceeded — stopping early. Re-run tomorrow (or with a fresh key) to continue; already-attempted exercises are preserved.');
      break;
    }
  }
}

out.exercises = [...already.values()];
out.generated_for = out.exercises.length;
writeFileSync(REVIEW_PATH, JSON.stringify(out, null, 2) + '\n');

const withCandidates = out.exercises.filter(e => e.candidates?.length).length;
const remaining = allTargets.length - out.exercises.filter(e => !e.error).length;
console.log(`\nWrote ${REVIEW_PATH}`);
console.log(`${withCandidates}/${out.exercises.length} attempted exercises have candidates. ${remaining} of ${allTargets.length} total not yet attempted.`);
console.log(`Set "approved" per exercise, then: node data/enrich_program_videos.mjs --source ${SOURCE} --apply`);
