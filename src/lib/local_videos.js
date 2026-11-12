/**
 * On-device exercise videos (PJF member-library demos) and PJF coaching notes.
 *
 * The provider files ship with the app in data/providers/ (personal-use app: the user chose to
 * keep them in the repo), so every phone has them with no import. A file imported through
 * Home → Import data still works for any other source; for a bundled source the shipped file wins.
 *
 * File shape: { source: 'pjf' | 'trainheroic' | …, videos: { slug: { name, v?, url?, yt?, notes[], alts[], tags? } },
 *               programs?: [...], dayNotes?: [...] }
 *   v   Mux playback id (https://stream.mux.com/<v>.m3u8)   — PJF
 *   url a direct video file or HLS stream URL                  — e.g. TrainHeroic
 *   yt  a YouTube video id
 *   tags taxonomy tags (docs/EXERCISE_TAXONOMY.md) for exercises the public catalog doesn't have
 * Each source is stored separately in pref('local_sources'), so importing one never wipes another.
 * Programs in a file show under "Private · this phone" (merged in static_data.js).
 */
import { pref } from '../db.js';

let _byName = new Map();   // normalized name → { v, url, yt, source, notes, alts: [names], tags }
let _sources = {};         // source → imported file
let _words = [];          // [word form, key] longest first, for names cut short or with a bracket added
let _dayNotes = [];        // { program, week, day, note, exercises: [normalized names] }

const norm = (s) => String(s ?? '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '');
/**
 * Video matching keeps what's in brackets: "Copenhagen Side Plank (Knee)" and "(Long Lever)",
 * or BWS's "(quad focus)" / "(glute focus)", are different demos from the plain name.
 * Only "(Optional)" is dropped.
 */
const vkey = (s) => String(s ?? '').toLowerCase().replace(/\(optional\)/g, '').replace(/[^a-z0-9]/g, '');
const words = (s) => String(s ?? '').toLowerCase().replace(/\(optional\)/g, '')
  .replace(/[^a-z0-9(]+/g, ' ').replace(/\s+/g, ' ').trim();

// PJF first: its demos are the closest match for PJF program names.
const ORDER = (a, b) => (a === 'pjf' ? -1 : b === 'pjf' ? 1 : a.localeCompare(b));

function index(sources) {
  _sources = sources || {};
  _byName = new Map();
  _dayNotes = [];
  for (const src of Object.keys(_sources).sort(ORDER)) {
    const data = _sources[src];
    const videos = data?.videos || {};
    for (const o of Object.values(videos)) {
      if (!o?.name || _byName.has(vkey(o.name))) continue;
      _byName.set(vkey(o.name), {
        v: o.v || null, url: o.url || null, yt: o.yt || null, source: src, name: o.name,
        notes: o.notes || [],
        alts: (o.alts || []).map(s => videos[s]?.name).filter(Boolean),
        tags: o.tags || null,
      });
    }
    _dayNotes.push(...(data?.dayNotes || []).map(d => ({ ...d, exercises: (d.exercises || []).map(norm) })));
  }
  _words = [..._byName.values()].map(o => [words(o.name), vkey(o.name)]).sort((a, b) => b[0].length - a[0].length);
}

/** Every imported private source (for catalog merging): { source: file }. */
export const localSources = () => _sources;
/** Does this on-device entry have something playable? */
export const playable = (l) => !!(l && (l.v || l.url || l.yt));

/**
 * PJF's notes for a workout day. PJF numbers its workouts differently from the app (some
 * days hold two workouts), so a note belongs to the app day whose exercises it shares.
 * dayNum (the app's day in the week) rules out a matching note from an earlier day.
 */
export function dayNotesFor(programName, week, exerciseNames, dayNum = 0) {
  const p = norm(programName);
  const mine = new Set(exerciseNames.map(norm));
  // Repeating A/B days carry near-identical notes; keep only the best-matching one of those.
  const seen = new Set();
  return _dayNotes
    .filter(d => norm(d.program) === p && d.week === week && d.note && d.exercises.length)
    // PJF splits some app days into two workouts, so its number is never below the app's.
    .filter(d => !dayNum || (d.day >= dayNum && d.day <= dayNum * 2))
    .map(d => ({ d, score: d.exercises.filter(n => mine.has(n)).length / d.exercises.length }))
    .filter(x => x.score >= 0.5)
    .sort((a, b) => b.score - a.score || Math.abs(a.d.day - b.d.day))
    .filter(({ d }) => { const k = norm(d.note).slice(0, 60); return !seen.has(k) && seen.add(k); })
    .sort((a, b) => a.d.day - b.d.day)
    .map(({ d }) => d.note);
}

/** Load the stored file into memory. Called once at boot; cheap when nothing is stored. */
export async function loadLocalVideos() {
  try {
    let sources = await pref('local_sources');
    if (!sources) {                              // before v81 one PJF file lived in 'local_videos'
      const old = await pref('local_videos');
      sources = old ? { [old.source || 'pjf']: old } : {};
      if (old) await pref('local_sources', sources);
    }
    index({ ...sources, ...(await bundled()) });
  } catch { /* storage unavailable: no local videos */ }
  await loadClips();
}

/**
 * Clips: play only part of a demo that also shows other moves (PJF's "KB Swing + Box Jump
 * Contrast" for a plain swing). Keyed by exercise and tied to one video (`src`, see
 * videoSrcKey), so a clip never lands on a different video. data/clips.json ships with the
 * app; clips set on this phone (exercise sheet → ⋯ → Clip video) sit on top in pref('clips').
 */
let _bundledClips = {};
let _clips = {};
async function loadClips() {
  try {
    const file = await fetch('data/clips.json').then(r => (r.ok ? r.json() : null)).catch(() => null);
    _bundledClips = Object.fromEntries(Object.entries(file?.clips || {}).map(([n, c]) => [vkey(n), { ...c, name: n }]));
    _clips = { ..._bundledClips, ...((await pref('clips')) || {}) };
  } catch { /* no clips */ }
}
/** "mux:<id>", "yt:<id>" or the file URL: which video a clip belongs to. */
export const videoSrcKey = ({ v, url, yt } = {}) => (v ? `mux:${v}` : yt ? `yt:${yt}` : url || null);
/** { start, end, mine } for this exercise on this video, or null. */
export function clipFor(name, src) {
  const c = src && _clips[vkey(name)];
  return c && c.src === src ? { start: +c.start || 0, end: +c.end || 0, mine: !!c.mine } : null;
}
/** Save (start/end in seconds) or, with start == null, remove this phone's clip. */
export async function saveClip(name, src, start, end) {
  const k = vkey(name);
  const mine = (await pref('clips')) || {};
  if (start == null) {
    delete mine[k];
    if (_bundledClips[k]) _clips[k] = _bundledClips[k]; else delete _clips[k];
  } else {
    mine[k] = { name, src, start: Math.round(start * 10) / 10, end: Math.round(end * 10) / 10, mine: true };
    _clips[k] = mine[k];
  }
  await pref('clips', mine);
}

/** Loop a <video data-start data-end> inside its clip. */
function clipVideo(el) {
  const start = +el.dataset.start || 0, end = +el.dataset.end || 0;
  if (!end || el._clipped) return;
  el._clipped = true;
  const toStart = () => { if (!el.dataset.full) el.currentTime = start; };
  el.addEventListener('loadedmetadata', toStart);
  el.addEventListener('play', () => { if (!el.dataset.full && (el.currentTime < start - 0.5 || el.currentTime >= end)) toStart(); });
  el.addEventListener('timeupdate', () => { if (!el.dataset.full && el.currentTime >= end) toStart(); });
}

/** Provider files shipped with the app (data/providers/<source>.json). */
export const BUNDLED_SOURCES = ['pjf', 'trainheroic'];
let _bundled = null;
const bundled = () => _bundled ??= Promise.all(BUNDLED_SOURCES.map(src =>
  fetch(`data/providers/${src}.json`).then(r => (r.ok ? r.json() : null)).catch(() => null)
    .then(d => (d?.videos ? [src, d] : null))))
  .then(list => Object.fromEntries(list.filter(Boolean)));

/** Is this a local-videos export rather than a full app backup? */
export const isLocalVideosFile = (data) => {
  if (!data?.videos || data.sessions || data.prefs) return false;
  if (typeof data.source === 'string') return true;
  const first = Object.values(data.videos)[0];   // older exports had no source/kind labels
  return !!first && typeof first.name === 'string' && 'v' in first;
};

/** Store one source's file (replacing that source only) and re-index. Returns playable count. */
export async function importLocalVideos(data) {
  const src = data.source || 'pjf';
  const sources = { ...((await pref('local_sources')) || _sources), [src]: data };
  await pref('local_sources', sources);
  index({ ...sources, ...(await bundled()) });
  return Object.values(data.videos).filter(o => o.v || o.url || o.yt).length;
}

/**
 * PJF video + notes for an exercise name, or null. Exact name first. Otherwise a provider
 * name that only adds a bracket ("Zone 5 Cardio" → "Zone 5 Cardio (90-100%)"), or that
 * finishes a word our name was cut off in ("Cable Hip Flexor Driv" → "…Drive"). Never a
 * longer, different exercise: "Dumbbell Lateral Raise" is not "…Raise + Post Delt Row Drop Set",
 * and "Lateral Lunge" is not "Lateral Lunge Length Under Load".
 */
export function localFor(name) {
  const n = vkey(name);
  if (!n) return null;
  const hit = _byName.get(n);
  if (hit) return hit;
  const w = words(name);
  for (const [pw, k] of _words) {
    if (!pw.startsWith(w)) continue;
    const rest = pw.slice(w.length);
    if (rest.startsWith(' (')) return _byName.get(k);                       // provider adds a bracket
    if (rest && rest[0] !== ' ' && n.length >= 12) return _byName.get(k);   // our name was cut off mid-word
  }
  return null;
}

export const muxThumb = (id) => `https://image.mux.com/${id}/thumbnail.jpg?width=320`;
const muxSrc = (id) => `https://stream.mux.com/${id}.m3u8`;

let _hls = null;   // hls.js loader, only for browsers without native HLS (desktop Chrome/Firefox)

/**
 * Start every <video data-mux> under root. iPhone Safari (native HLS, no MediaSource) plays
 * the stream directly; everywhere else hls.js does, since some desktop browsers claim HLS
 * support in canPlayType and then fail to play it.
 */
export function attachMuxVideos(root) {
  root.querySelectorAll('video[data-end]').forEach(clipVideo);
  for (const el of root.querySelectorAll('video[data-mux], video[data-hls]')) {
    const src = el.dataset.mux ? muxSrc(el.dataset.mux) : el.dataset.hls;
    if (!window.MediaSource && el.canPlayType('application/vnd.apple.mpegurl')) { el.src = src; continue; }
    _hls ??= new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js';
      s.onload = () => resolve(window.Hls);
      s.onerror = reject;
      document.head.appendChild(s);
    });
    _hls.then(Hls => {
      if (!Hls?.isSupported()) return;
      const h = new Hls();
      h.loadSource(src);
      h.attachMedia(el);
    }).catch(() => {});
  }
}
