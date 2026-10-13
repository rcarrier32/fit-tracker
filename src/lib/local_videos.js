/**
 * On-device exercise videos (PJF member-library demos) and PJF coaching notes.
 *
 * These come from a file the user exports from their own PJF account and imports through
 * Home → Import data. They live only in this device's IndexedDB (pref 'local_videos') —
 * never in the repo, because the repo and the GitHub Pages site are public.
 *
 * File shape: { source: 'pjf', kind: 'mux', videos: { slug: { name, v, notes[], alts[] } } }
 * where v is a Mux playback id (https://stream.mux.com/<v>.m3u8).
 */
import { pref } from '../db.js';

let _byName = new Map();   // normalized name → { v, notes, alts: [names] }
let _names = [];           // normalized names, for prefix matching of truncated catalog names
let _dayNotes = [];        // { program, week, day, note, exercises: [normalized names] }

const norm = (s) => String(s ?? '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '');

function index(data) {
  _byName = new Map();
  const videos = data?.videos || {};
  for (const o of Object.values(videos)) {
    if (!o?.name) continue;
    _byName.set(norm(o.name), {
      v: o.v || null,
      notes: o.notes || [],
      alts: (o.alts || []).map(s => videos[s]?.name).filter(Boolean),
    });
  }
  _names = [..._byName.keys()].sort((a, b) => b.length - a.length);
  _dayNotes = (data?.dayNotes || []).map(d => ({ ...d, exercises: (d.exercises || []).map(norm) }));
}

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
  try { index(await pref('local_videos')); } catch { /* storage unavailable: no local videos */ }
}

/** Is this a local-videos export rather than a full app backup? */
export const isLocalVideosFile = (data) => {
  if (!data?.videos || data.sessions || data.prefs) return false;
  if (data.source === 'pjf') return true;
  const first = Object.values(data.videos)[0];   // older exports had no source/kind labels
  return !!first && typeof first.name === 'string' && 'v' in first;
};

export async function importLocalVideos(data) {
  await pref('local_videos', data);
  index(data);
  return Object.values(data.videos).filter(o => o.v).length;
}

/** PJF video + notes for an exercise name, or null. Handles catalog names cut short at import. */
export function localFor(name) {
  const n = norm(name);
  if (!n) return null;
  const hit = _byName.get(n);
  if (hit) return hit;
  if (n.length < 12) return null;
  const k = _names.find(k => k.startsWith(n));
  return k ? _byName.get(k) : null;
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
  for (const el of root.querySelectorAll('video[data-mux]')) {
    const src = muxSrc(el.dataset.mux);
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
