/**
 * Hip Recovery YouTube enrichment — GATED, review-only.
 *
 * For each exercise in src/lib/hip_protocol.js, searches the YouTube Data API, keeps
 * SHORT EMBEDDABLE clips, boosts trusted rehab/PT channels, scores them, and writes the
 * top-N per exercise to a REVIEW FILE. Nothing is written into the app — a human reviews
 * data/hip-video-review.json and approved ids get applied with --apply.
 *
 * Ported from nextplay/scripts/enrich-dev-skills.mjs (same scoring shape, rehab allowlist).
 *
 * Usage:
 *   node data/enrich_hip_videos.mjs                        # all exercises, top 3, <= 6 min
 *   node data/enrich_hip_videos.mjs --section pt           # one section id
 *   node data/enrich_hip_videos.mjs --only pt-bird-dog     # one exercise id
 *   node data/enrich_hip_videos.mjs --top 5 --max-seconds 420
 *   node data/enrich_hip_videos.mjs --apply                # write approved picks into hip_protocol.js
 *
 * Review flow:
 *   1. Run without --apply. Open data/hip-video-review.json.
 *   2. For each exercise, move your chosen candidate's videoId into "approved".
 *   3. Re-run with --apply to patch videoId/videoTitle/channel into hip_protocol.js.
 *
 * Requires YOUTUBE_API_KEY (env, or .env.local at the repo root — gitignored, never printed).
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { pathToFileURL } from 'url';
import path from 'path';

const ROOT         = path.resolve(import.meta.dirname, '..');
const PROTOCOL_PATH = path.join(ROOT, 'src/lib/hip_protocol.js');
const REVIEW_PATH   = path.join(ROOT, 'data/hip-video-review.json');

const { SECTIONS } = await import(pathToFileURL(PROTOCOL_PATH).href);

// ── args ──
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const SECTION     = opt('section', null);
const ONLY        = opt('only', null);
const TOP         = parseInt(opt('top', '3'), 10);
const MAX_SECONDS = parseInt(opt('max-seconds', '360'), 10);  // rehab demos run longer than drill clips
const APPLY       = args.includes('--apply');

/**
 * Trusted rehab channels — channelTitle substrings that BOOST a result. These are the
 * evidence-based PT / rehab channels that consistently publish clean single-exercise demos.
 */
const TRUSTED_CHANNELS = [
  // Evidence-based PT / rehab
  'e3 rehab', 'ask doctor jo', 'bob & brad', 'bob and brad', 'physiotutors',
  'precision movement', 'squat university', 'adam meakins', 'rehab hero',
  'the prehab guys', 'prehab guys', 'upright health', 'tone and tighten',
  'physical therapy video', 'brad heineck', 'dr. jo', 'rehab science',
  'performance place', 'sports injury', 'physio', 'mskneurology', 'msk physio',
  // Hip-specialist / strength-rehab
  'hip hooray', 'movement fix', 'barbell rehab', 'p3 rehab', 'kneesovertoesguy',
  'strength side', 'uphealth',
  // Aquatic therapy
  'aquatic therapy', 'aqua', 'swimming world', 'global triathlon network',
  'skills n talents', 'effortless swimming',
];

/** Titles that signal a clean, single-exercise demonstration rather than a vlog or listicle. */
const GOOD_TITLE_HINTS = [
  'how to', 'proper form', 'technique', 'exercise', 'demonstration', 'demo',
  'physical therapy', 'rehab', 'tutorial', 'correctly',
];

/** Titles to push down — compilations, clickbait, and product pitches. */
const BAD_TITLE_HINTS = [
  'top 10', 'top 5', 'best exercises', 'worst', 'stop doing', 'shocking',
  'in 30 days', 'day challenge', 'full workout', 'follow along', 'podcast',
];

if (!process.env.YOUTUBE_API_KEY) {
  const envFile = path.join(ROOT, '.env.local');
  if (existsSync(envFile)) { try { process.loadEnvFile(envFile); } catch { /* shell may set it */ } }
}
// Treat the shipped placeholder as unset so an unedited .env.local gives the clear
// message below rather than an opaque "API key not valid" from Google.
const KEY = process.env.YOUTUBE_API_KEY === 'PASTE_YOUR_KEY_HERE'
  ? null
  : process.env.YOUTUBE_API_KEY;

// ── target selection ──
const targets = SECTIONS
  .filter(s => !SECTION || s.id === SECTION)
  .flatMap(s => (s.exercises || []).map(ex => ({ ...ex, sectionId: s.id, sectionLabel: s.label })))
  .filter(ex => !ONLY || ex.id === ONLY);

// ── apply mode: patch approved ids into hip_protocol.js, no API needed ──
if (APPLY) {
  if (!existsSync(REVIEW_PATH)) {
    console.error(`No review file at ${REVIEW_PATH}. Run without --apply first.`);
    process.exit(1);
  }
  const review = JSON.parse(readFileSync(REVIEW_PATH, 'utf8'));
  let src = readFileSync(PROTOCOL_PATH, 'utf8');
  let patched = 0, skipped = 0;

  for (const entry of review.exercises || []) {
    const pick = entry.approved
      ? (entry.candidates || []).find(c => c.videoId === entry.approved)
        || { videoId: entry.approved, title: '', channel: '' }
      : null;
    if (!pick) { skipped++; continue; }

    // Replace the `videoId: null,` line inside this exercise's object literal.
    const idAnchor = new RegExp(`(id:\\s*'${entry.id}'[\\s\\S]*?)videoId:\\s*(?:null|'[^']*')(,?)`, 'm');
    if (!idAnchor.test(src)) {
      console.warn(`  ! could not locate ${entry.id} in hip_protocol.js`);
      skipped++;
      continue;
    }
    const meta = [
      `videoId: '${pick.videoId}'`,
      pick.title   ? `videoTitle: ${JSON.stringify(pick.title)}` : null,
      pick.channel ? `channel: ${JSON.stringify(pick.channel)}`  : null,
    ].filter(Boolean).join(',\n        ');
    src = src.replace(idAnchor, `$1${meta}$2`);
    patched++;
  }

  writeFileSync(PROTOCOL_PATH, src);
  console.log(`\nApplied ${patched} video id${patched === 1 ? '' : 's'} to hip_protocol.js (${skipped} skipped — no "approved" set).`);
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

const parseISO = (iso) => {   // PT#H#M#S → seconds
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || '') || [];
  return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
};

const decode = (s) => (s || '')
  .replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));

const hits = (text, list) => { const t = (text || '').toLowerCase(); return list.some(x => t.includes(x)); };

async function enrich(ex) {
  const q = ex.search || `${ex.name} exercise physical therapy`;
  const search = await yt('search', {
    part: 'snippet', type: 'video', maxResults: '12', q, videoEmbeddable: 'true',
  });
  const ids = search.items.map(it => it.id.videoId).filter(Boolean);
  if (!ids.length) return [];

  const details = await yt('videos', { part: 'contentDetails,status', id: ids.join(',') });
  const byId = new Map(details.items.map(v => [v.id, v]));

  return search.items
    .map(it => {
      const id      = it.id.videoId;
      const detail  = byId.get(id);
      const seconds = detail ? parseISO(detail.contentDetails.duration) : 9999;
      const channel = it.snippet.channelTitle;
      const title   = decode(it.snippet.title);
      const trusted = hits(channel, TRUSTED_CHANNELS);
      // Title names the exercise (first significant word of its name).
      const keyword = ex.name.toLowerCase().replace(/[^a-z\s-]/g, '').split(/\s+/)[0];
      const titleHit = title.toLowerCase().includes(keyword);
      const goodHint = hits(title, GOOD_TITLE_HINTS);
      const badHint  = hits(title, BAD_TITLE_HINTS);

      const score =
        (trusted  ? 3 : 0) +
        (titleHit ? 1 : 0) +
        (goodHint ? 0.5 : 0) +
        (badHint ? -2 : 0) +
        Math.max(0, (MAX_SECONDS - seconds) / MAX_SECONDS);

      return {
        videoId: id, title, channel, seconds, trusted,
        embeddable: detail?.status?.embeddable !== false,
        url: `https://youtu.be/${id}`,
        score: +score.toFixed(2),
      };
    })
    .filter(c => c.embeddable && c.seconds <= MAX_SECONDS)
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP);
}

// ── run ──
const out = { generated_for: targets.length, max_seconds: MAX_SECONDS, exercises: [] };

for (const ex of targets) {
  process.stdout.write(`  ${ex.sectionId}/${ex.id} … `);
  try {
    const candidates = await enrich(ex);
    out.exercises.push({
      id: ex.id,
      name: ex.name,
      section: ex.sectionId,
      query: ex.search || null,
      approved: null,        // ← put the chosen videoId here, then re-run with --apply
      candidates,
    });
    console.log(`${candidates.length} candidate${candidates.length === 1 ? '' : 's'}${candidates[0]?.trusted ? ' ★' : ''}`);
  } catch (e) {
    console.log(`FAILED — ${e.message}`);
    out.exercises.push({ id: ex.id, name: ex.name, section: ex.sectionId, error: e.message, approved: null, candidates: [] });
  }
}

writeFileSync(REVIEW_PATH, JSON.stringify(out, null, 2));
const withCandidates = out.exercises.filter(e => e.candidates.length).length;
console.log(`\nWrote ${REVIEW_PATH}`);
console.log(`${withCandidates}/${targets.length} exercises have candidates. Set "approved" per exercise, then: node data/enrich_hip_videos.mjs --apply`);
