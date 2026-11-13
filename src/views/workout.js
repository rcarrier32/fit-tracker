/**
 * Workout view: today's session — exercises, sets logging, RPE, video links.
 */
import { pref, put, getByIndex, getAll } from '../db.js';
import { rpeE1RM } from '../lib/e1rm.js';
import { nextTarget, deloadAdvice } from '../lib/adapt.js';
import { learnProfile } from '../lib/learn.js';
import { yesterdayLoad, adjustDaily, soreFromNotes, helpedMoves } from '../lib/daily_adjust.js';
import { isFav, toggleFav, favorites } from '../lib/favorites.js';
import { applyGymDay, isStandIn, GYM_DEFAULT } from '../lib/gym_swap.js';
import { toast, openSheet, navigate } from '../app.js';
import { todaysWorkout, dailyWorkout, advanceCursor, allowNextWorkoutToday, programName, positionLabel } from './schedule.js';
import { loadCatalogs, isHeaderRow } from '../lib/static_data.js';
import { localDateStr } from '../lib/date.js';
import { openExerciseDetail, exerciseRowHTML, wireExerciseRows } from '../lib/exercise_ui.js';
import { localFor, dayNotesFor, playable } from '../lib/local_videos.js';
import { parseRestSeconds, timerAlert, TIMER_WARN_SECS, TIMER_REST_WARN_SECS, SIDE_SWITCH_SECS, sidesOf, sideLabel, switchSpeech } from '../lib/exercise_session.js';
import { tagLine, rankSimilar, levelNeighbors, progressesBy, LEVEL_LABEL, MUSCLE_GROUPS, TYPE_GROUPS, EQUIPMENT_LABEL, hasVideo, muscleLabel as mLabel } from '../lib/taxonomy.js';
import { openProgressCheck } from './progress.js';
import { doneElsewhere } from '../lib/same_move.js';
import { GAME_ID } from '../lib/game.js';
import { ENERGY, energyOf, readNote, noteSummary } from '../lib/feel.js';
import { SECTIONS as HIP_SECTIONS } from '../lib/hip_protocol.js';
import { movesToday } from '../lib/moves_today.js';

const today = () => localDateStr();
let _restInterval = null;
let _renderToken = 0;   // newest renderWorkout wins; older in-flight renders bail out

/**
 * Sessions are created lazily: browsing to a day builds one in memory, and the first
 * real write (a set, a swap, Finish) stores it. Keeps the id once IndexedDB assigns it.
 */
async function saveSession(session) {
  const id = await put('sessions', session);
  if (session.id == null) session.id = id;
}

/** Seconds from a program time: "00:00:45", "1:30", "45 sec", "2 min". */
function parseSecs(t) {
  if (t == null) return 0;
  const str = String(t).trim();
  if (/^\d+(:\d{1,2}){1,2}$/.test(str)) return str.split(':').reduce((a, n) => a * 60 + +n, 0);
  const m = str.match(/([\d.]+)\s*(s|sec|second|m|min|minute)?/i);
  if (!m) return 0;
  return Math.round(+m[1] * (/^m/i.test(m[2] || '') ? 60 : 1));
}
const fmtSecs = (n) => `${Math.floor(n / 60)}:${String(Math.round(n % 60)).padStart(2, '0')}`;

const BAND_SHORT = {
  'Stretching/Mobility': 'Mobility', 'Lower Body Strength': 'Lower Body',
  'Full Body Integrated Strength': 'Full Body', 'Agility/Change of Direction': 'Agility',
};

/** A timed exercise (hold, interval, carry) logs a duration instead of weight × reps. */
const isTimed = (ex) => parseSecs(ex.time) > 0 && !ex.target_reps;

/**
 * Interval phases of one round, from the plan's words: "10 s fast, 20 s jog, 40 s walk",
 * "1 min hard, 1 min easy", or a name like "Sprint 10s/Jog 20s/Walk 40s". [] if none.
 */
function parseIntervals(notes, name) {
  const unit = (n, u) => /^m/i.test(u) ? +n * 60 : +n;
  const out = [];
  for (const m of String(notes || '').matchAll(/(\d+)\s*(s|secs?|seconds?|min|mins?|minutes?)\s+([a-z][a-z ]*?)(?=[,.;]|$)/gi)) {
    out.push({ secs: unit(m[1], m[2]), label: m[3].trim() });
  }
  if (out.length >= 2) return out;
  const byName = [...String(name || '').matchAll(/([A-Za-z][A-Za-z ]*?)\s*(\d+)\s*(s|sec|min)\b/gi)]
    .map(m => ({ secs: unit(m[2], m[3]), label: m[1].trim().toLowerCase() }));
  return byName.length >= 2 ? byName : [];
}

/** Running and conditioning rows (sprints, zone work, intervals), as opposed to a lift. */
const CARDIO_RE = /sprint|zone \d|cardio|interval|\bjog|\brun\b|shuttle|stride/i;

/**
 * A run written as one set is really N sets: "1 set × 8 rounds", PJF's "1 set × 14" sprint
 * intervals or "1 set × 10 · 0:15" zone-5 sprints, "1 set × 3 × 10 yd at 80%". Interval
 * rounds (sprint/jog/walk) become timed sets of one round each, with the phases for the timer.
 */
function roundsAsSets(x) {
  if ((+x.target_sets || 1) > 1) return x;
  const reps = String(x.target_reps || '').trim();
  let n = 0, rest = '';
  let m;
  if ((m = /^(\d+)\s*rounds?$/i.exec(reps))) n = +m[1];
  else if ((m = /^(\d+)\s*[×x]\s*(.+)$/i.exec(reps)) && CARDIO_RE.test(x.name)) { n = +m[1]; rest = m[2]; }
  else if ((m = /^(\d+)$/.exec(reps)) && +m[1] > 1 && CARDIO_RE.test(x.name)) n = +m[1];
  if (!n) return x;
  const intervals = parseSecs(x.time) ? [] : parseIntervals(x.notes, x.name);
  if (intervals.length) {
    return { ...x, target_sets: n, target_reps: '', intervals, time: String(intervals.reduce((a, p) => a + p.secs, 0)) };
  }
  // Timed reps ("× 10 · 0:15") become timed sets; a distance in the notes is each set's target.
  const dist = /^\s*\d+(?:\.\d+)?\s*(?:m|yd|yards?|meters?)\b/i.exec(x.notes || '')?.[0];
  return { ...x, target_sets: n, target_reps: parseSecs(x.time) ? '' : (rest || dist || '1') };
}

let _setTimer = null;   // the one running set/hold countdown: { interval, btn, idle }
function stopSetTimer() {
  if (!_setTimer) return;
  clearInterval(_setTimer.interval);
  if (_setTimer.btn?.isConnected) _setTimer.btn.textContent = _setTimer.idle;
  _setTimer.btn?.classList.remove('switching');
  _setTimer = null;
}

/**
 * A timed set or hold. One-side-at-a-time moves (sidesOf: Copenhagen, side plank,
 * single-leg, "each side") run like FKH's single-side drills: right side, then a beep and
 * "Switch legs — Left leg" with a 10 s switch countdown (3-2-1, Begin), then the left side
 * on a fresh timer. onDone runs once both sides are done.
 */
function runWorkTimer(btn, { secs, unit = null, intervals = null, idle, onDone }) {
  stopSetTimer();
  // Interval round (sprint / jog / walk): each phase gets its own countdown and a call-out.
  const phases = intervals?.length
    ? intervals.map(ph => ({ work: true, secs: ph.secs, label: ph.label[0].toUpperCase() + ph.label.slice(1) }))
    : unit
    ? [{ work: true, side: 0, secs }, { work: false, secs: SIDE_SWITCH_SECS }, { work: true, side: 1, secs }]
    : [{ work: true, secs }];
  if (phases[0].label) timerAlert('switch', phases[0].label);
  let p = 0, started = Date.now(), last = null;
  const tick = () => {
    if (!btn.isConnected) return stopSetTimer();
    const ph = phases[p];
    const left = Math.max(0, ph.secs - Math.floor((Date.now() - started) / 1000));
    if (left > 0) {
      if (left !== last && (!ph.work || ph.label) && left <= 3) timerAlert('count', left);
      last = left;
      btn.classList.toggle('switching', !ph.work);   // amber while changing sides, as in FKH
      btn.textContent = ph.work
        ? `■ ${ph.label ? ph.label + ' ' : unit ? sideLabel(unit, ph.side) + ' ' : ''}${fmtSecs(left)}`
        : `⇄ Switch · ${fmtSecs(left)}`;
      return;
    }
    p++; started = Date.now(); last = null;
    if (p >= phases.length) { stopSetTimer(); beep(); onDone?.(); return; }
    if (phases[p].label) timerAlert('switch', phases[p].label);
    else if (phases[p].work) timerAlert('begin');
    else timerAlert('switch', switchSpeech(unit));
    tick();
  };
  _setTimer = { btn, idle, interval: setInterval(tick, 250) };
  tick();
}
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.25, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    o.start(); o.stop(ctx.currentTime + 0.5);
  } catch { /* no audio */ }
  try { navigator.vibrate?.([200, 100, 200]); } catch { /* no vibration */ }
}

const setsDoneCount = (ex) => (ex.sets || []).filter(st => st?.done).length;
const exerciseDone = (ex) => setsDoneCount(ex) >= (parseInt(ex.target_sets) || 3);

/** Set k of an exercise, creating any missing sets before it (sparse arrays break Stats). */
function setAt(ex, k) {
  if (!ex.sets) ex.sets = [];
  for (let j = 0; j <= k; j++) if (!ex.sets[j]) ex.sets[j] = {};
  return ex.sets[k];
}

function ytVideoId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

/**
 * Video buttons open the shared exercise detail (video on top, prescription and notes below).
 * Set logging stays inline on the Lift card, where the weight/rep inputs live.
 */
function openLiftDetail(btn) {
  const d = btn.dataset;
  openExerciseDetail({
    name: d.ytname || 'Exercise',
    videoId: d.ytid,
    start: d.start || 0,
    rowVideo: d.row === '1',
    sets: d.target || '',
    subtitle: d.last || '',
    notes: d.notes || '',
  });
}

let _noRefresh = false;   // Finish from the sheet: don't redraw the Lift page over the Done screen

/** #/daily opens Daily Mobility (its Home card) without touching the active program. */
// #/daily (Daily Mobility) and #/routine/<id> (Basketball Warm-up …) open a side routine next to the plan.
const onDailyRoute = () => location.hash.startsWith('#/daily') || location.hash.startsWith('#/routine/');
const routineId = () => (/^#\/routine\/([\w-]+)/.exec(location.hash) || [])[1];
const whichWorkout = async () => (onDailyRoute() && (await dailyWorkout(routineId()))) || todaysWorkout();

export async function renderWorkout(app, { keepRest = false } = {}) {
  const token = ++_renderToken;
  const stale = () => token !== _renderToken;
  // A running rest timer survives leaving the tab and coming back to the same workout; it stops
  // only when a different workout is opened (checked below, once the session is known).
  stopSetTimer();
  const today_w = await whichWorkout();
  if (stale()) return;
  if (today_w.type === 'unset') {
    app.innerHTML = `
      <div class="empty">
        <div class="icon">🏋️</div>
        <div>No program for today</div>
        <button class="btn" id="back" style="margin-top:14px;max-width:240px">Set up schedule</button>
      </div>`;
    app.querySelector('#back').onclick = () => navigate('home');
    return;
  }
  if (today_w.type === 'completed') {
    const name = today_w.program?.name || today_w.program?.program_name || 'Program';
    app.innerHTML = `
      <div class="empty">
        <div class="icon">🏆</div>
        <div>${name} — complete!</div>
        <div class="muted" style="margin-top:6px;font-size:14px">Head back to Today to start over or choose a new program.</div>
        <button class="btn ghost" id="back" style="margin-top:14px;max-width:240px">Back to today</button>
      </div>`;
    app.querySelector('#back').onclick = () => navigate('home');
    return;
  }
  if (today_w.type === 'tag') {
    return await renderTagDay(app, today_w);
  }

  const program = today_w.program;
  const programId = program.id;
  const week = today_w.week;
  const day = today_w.day;
  const day_index = today_w.day_index;

  // Fetch the day's exercises
  const dayData = pickDay(program, week, day, day_index);
  if (!dayData) {
    app.innerHTML = `<div class="empty">No workout found for Wk ${week}, Day ${day}
      <button class="btn ghost" id="back" style="margin-top:14px;max-width:240px">Back to today</button></div>`;
    app.querySelector('#back').onclick = () => navigate('home');
    return;
  }

  // Fetch or create today's session
  const todaysSessions = await getByIndex('sessions', 'date', today());
  if (stale()) return;
  // Single-program sessions saved before v58 have no day_index; that meant the first
  // rotation day, so treat missing as 0 rather than starting a duplicate session.
  const sameIndex = (a, b) => (a ?? 0) === (b ?? 0);
  let session = todaysSessions.find(s => s.program_id === programId && s.week === week && s.day === day && sameIndex(s.day_index, day_index));
  _restKey = `${today()}|${programId}|${week}|${day}|${day_index ?? 0}`;
  if (!keepRest && _rest && _rest.key !== _restKey) stopRestTimer();
  if (!session) {
    const allSwaps = (await pref('swaps')) || {};
    const dayKey = _sessionDayKey({ day_index, week, day });
    const toRow = (ex) => ({
      name: ex.name,
      orig_name: ex.name,
      target_reps: ex.reps || ex.set_targets?.[0] || '',
      target_sets: ex.sets || ex.set_targets?.length || 3,
      time: ex.time,
      rest: ex.rest,
      round_group: ex.round_group || ex.group || ex.superset || null,
      notes: ex.notes,
      video_url: ex.video_url || null,   // a plan can point a row at its own video (and start time)
      alternates: ex.alternates || null, // a plan's own swap list, like BWS alternates
      sets: [],
    });
    let rawExercises = dayData.exercises.filter(e => !e.is_alternate && !isHeaderRow(e.name)).map(toRow).map(roundsAsSets);
    // Basketball week (Lean & Tone + pickup Mon & Fri): Saturday's Day 3 also does Day 4's band circuit, since
    // the games replace Day 4's treadmill. Finishing it counts both days.
    const gameNotes = [];
    const schedNow = today_w.daily ? null : await pref('schedule');
    const bw = program.basketball_week;
    let mergedDay = null;
    if (bw?.merge && program.weeks && day === bw.merge.into_day && schedNow?.slots?.some(sl => sl?.label === 'Basketball')) {
      const add = program.weeks.find(w2 => w2.week_num === week)?.days.find(d => d.day_num === bw.merge.add_day);
      const extra = (add?.exercises || []).filter(e => bw.merge.add_groups.includes(e.round_group)).map(toRow).map(roundsAsSets);
      if (extra.length) {
        const at = rawExercises.findIndex(x => x.round_group === 'Cooldown' || /finisher/i.test(x.round_group || ''));
        rawExercises.splice(at < 0 ? rawExercises.length : at, 0, ...extra);
        mergedDay = bw.merge.add_day;
        gameNotes.push(`Day ${bw.merge.add_day}'s ${bw.merge.add_groups.join(', ').toLowerCase()} is in here too: your games replace its treadmill, so this one session finishes both days.`);
      }
    }
    // The day after (or the day of) a pickup game: no jumps or hard intervals, the game already did them.
    let afterGame = false;
    if (!today_w.daily) {
      const yd = new Date(); yd.setDate(yd.getDate() - 1);
      const near = [...todaysSessions, ...(await getByIndex('sessions', 'date', localDateStr(yd)))];
      if (near.some(x => x.program_id === GAME_ID && x.done && !x.skipped)) {
        afterGame = true;
        const { exerciseByName: byN } = await loadCatalogs();
        const hard = (x) => { const e = byN.get(String(x.name).toLowerCase());
          return e?.role === 'power' || (e?.role === 'conditioning' && /sprint|zone 4|interval|hiit/i.test(x.name)); };
        const dropped = rawExercises.filter(hard).map(x => x.name);
        if (dropped.length) {
          rawExercises = rawExercises.filter(x => !hard(x));
          gameNotes.push(`Basketball covered the jumps and hard intervals, so ${dropped.join(', ')} ${dropped.length > 1 ? 'are' : 'is'} off today.`);
        }
      }
    }
    session = {
      date: today(),
      program_id: programId,
      week, day, day_index,
      focus: dayData.focus || dayData.day_name,
      exercises: dayKey ? _applySwaps(rawExercises, programId, dayKey, allSwaps, { week, day }) : rawExercises,
      done: false,
    };
    if (mergedDay) session.merged_day = mergedDay;
    if (afterGame) session.after_game = true;
    if (gameNotes.length) session.adjust_note = gameNotes.join(' ');
    // Daily Mobility adjusts for yesterday's training (src/lib/daily_adjust.js): no pogos after jumps
    // or heavy legs, one more set of the holds for what was worked. Decided once, when today's session starts.
    if (programId === 'daily_mobility') {
      const d = new Date(); d.setDate(d.getDate() - 1);
      const yesterday = await getByIndex('sessions', 'date', localDateStr(d));
      const { exerciseByName: byName } = await loadCatalogs();   // cached; exMap is built further down
      const lookup = (n) => byName.get(String(n).toLowerCase());
      // Notes from yesterday's and today's workouts: areas called sore get their stretches.
      const sore = soreFromNotes([...yesterday, ...todaysSessions]);
      const helped = helpedMoves(await getAll('sessions'), today());
      const adj = adjustDaily(session.exercises, yesterdayLoad(yesterday, lookup), lookup, { sore, helped });
      session.exercises = adj.rows;
      if (adj.note) session.adjust_note = adj.note;
    }
  }

  // A session started before rounds became sets: upgrade any "N rounds" row not logged yet.
  session.exercises = session.exercises.map(x => (x.sets || []).some(st => st?.done) ? x : roundsAsSets(x));

  // Already finished today (Finish advances the cursor, but today stays this workout).
  if (session.done && today_w.doneToday) {
    const allSessions = await getAll('sessions');
    if (stale()) return;
    renderWorkoutComplete(app, session, computeSessionStats(session, allSessions), program, week, day);
    return;
  }

  // Look up video URLs for each exercise
  const { exercises: allExercises, exerciseByName, warmups, bandOverviews } = await loadCatalogs();
  if (stale()) return;
  const exMap = {};
  for (const [k, v] of exerciseByName) exMap[k] = v;

  // A day can carry its own warm-up (home plans); otherwise pick one by focus.
  let warmup = dayData.warmup?.length
    ? { name: 'Warm-Up · 5 min', exercises: dayData.warmup }
    : _pickWarmup(dayData.focus || dayData.day_name, warmups);
  // The day after a game: the warm-up skips jumps and sprints too (pogos, skips, sprint drills).
  if (session.after_game && warmup?.exercises?.length) {
    const IMPACT = new Set(['plyo_jump', 'plyo_bound_hop', 'speed_accel', 'deceleration_landing', 'agility_cod']);
    const keep = warmup.exercises.filter(w => !IMPACT.has(exMap[String(w.name).toLowerCase()]?.pattern));
    if (keep.length !== warmup.exercises.length) warmup = { ...warmup, exercises: keep };
  }
  // Hip plan in use: its warm-up IS the workout's warm-up (the plan says to do it before any lift).
  // It replaces the generic warm-up; a program's own warm-up follows it. Checking a move here checks
  // it on the Hip tab too (hip_logs), and the other way round.
  const hipLogsAll = (await pref('hip_logs')) || {};
  _hipDone = hipLogsAll[today()] || {};
  if (!today_w.daily && ((await pref('hip_progress')) || Object.keys(hipLogsAll).length)) {
    const hipWarm = hipWarmupRows();
    warmup = { name: 'Warm-Up · hip first', exercises: [...hipWarm, ...(dayData.warmup?.length ? dayData.warmup : [])] };
  }
  // Warm-up swaps: saved for this day (swaps pref, keyed "wu:<name>" so they never touch a main
  // exercise of the same name) or just today (session.warmup_swaps).
  if (warmup?.exercises?.length) {
    const dk = _sessionDayKey(session);
    const saved = (dk && ((await pref('swaps')) || {})[programId]?.[dk]) || {};
    const pick = (n) => session.warmup_swaps?.[n] ?? saved[`wu:${n}`];
    if (warmup.exercises.some(w => pick(w.name))) {
      warmup = { ...warmup, exercises: warmup.exercises.map(w => {
        const to = pick(w.name);
        return to && to !== w.name ? { ...w, orig_name: w.name, name: to, alternates: w.alternates } : w;
      }) };
    }
  }
  // Band workouts: one tap to each category's band-setup overview, in workout order.
  const bandCats = [...new Set(session.exercises
    .map(x => exMap[x.name.toLowerCase()])
    .filter(e => e?.sources?.includes('band') && bandOverviews[e.category])
    .map(e => e.category))];

  // Band days have nothing to weigh, so they use the FKH layout like Hip and TOS: a row
  // with the video thumbnail, tap it for the video on top with the sets under it.
  const bandDay = program.source === 'PJF' && dayData.exercises.length > 0 && dayData.exercises
    .every(x => exMap[String(x.name).toLowerCase()]?.sources?.includes('band'));
  const anyLogged = session.exercises.some(x => (x.sets || []).some(st => st?.done));

  // Build last-session reference weights + all-time best e1RM per exercise
  const { ref: prevRef, bestE1RM: allTimeBestE1RM, history, profile } = await buildPrevReference(programId, session.id, today());
  if (stale()) return;
  _history = history;
  _elsewhere = await movesToday();
  if (stale()) return;
  _sessionId = session.id ?? null;
  _profile = profile;
  const _deload = bandDay ? null : (deloadAdvice(session.exercises.map(x => targetFor(x, exMap[String(x.name).toLowerCase()]))) || profile?.fatigue?.advice || null);

  app.innerHTML = `
    <h1>${dayData.focus || dayData.day_name}</h1>
    <div class="muted">${programName(program)}</div>
    <div class="muted" style="font-size:12px">${positionLabel(today_w)}<span id="session-clock"></span></div>
    ${pjfDayNotesHtml(program, week, day, dayData)}
    ${dayInfoHtml(program, dayData)}
    ${_deload ? `<div class="card" style="margin:10px 0;padding:10px 12px;font-size:13px;border-color:var(--accent)">🔄 ${_deload}</div>` : ''}
    ${session.adjust_note ? `<div class="card" style="margin:10px 0;padding:10px 12px;font-size:13px">↺ ${esc(session.adjust_note)}</div>` : ''}
    ${!today_w.daily && (session.gym_day || session.exercises.some(x => isStandIn(exMap[String(x.name).toLowerCase()]))) ? `
    <div style="display:flex;align-items:center;gap:8px;margin:10px 0">
      <button class="pill ${session.gym_day ? 'accent' : ''}" id="gym-toggle" style="cursor:pointer;padding:8px 14px;font-size:14px">🏋 ${session.gym_day ? 'At the gym today' : 'Going to the gym today?'}</button>
      <button class="pill" id="gym-kit" style="cursor:pointer;padding:8px 10px" aria-label="Gym equipment">⚙</button>
      <span class="muted" style="font-size:11px;flex:1">${session.gym_day ? 'Band and bodyweight stand-ins swapped for gym versions.' : 'Swaps band and bodyweight stand-ins for gym versions.'}</span>
    </div>` : ''}
    ${bandCats.length && !today_w.daily ? `<div class="band-setup">Band setup: ${bandCats.map(c =>
      `<button class="band-setup-link" data-band-cat="${c.replace(/"/g, '&quot;')}">▶ ${BAND_SHORT[c] || c}</button>`).join('')}</div>` : ''}
    ${today_w.mode === 'follow' && (program.weeks || (program.days?.length || 0) > 1) ? `<div class="btn-row" style="margin:10px 0">
      <button class="btn ghost" data-action="prev">← Day</button>
      <button class="btn ghost" data-action="next">Day →</button>
    </div>` : ''}
    <button class="btn" id="start-flow" style="margin:12px 0 4px">▶ ${anyLogged ? 'Continue workout' : 'Start workout'}</button>
    ${warmup ? _warmupBlockHtml(warmup, exMap) : ''}
    ${warmup ? '<div class="group-label" style="margin-top:14px">💪 Workout</div>' : ''}
    <div id="exercises"></div>
    <div class="btn-row" style="margin-top:14px">
      <button class="btn secondary" id="add-ex">+ Add exercise</button>
      <button class="btn" id="finish">Finish workout</button>
      <button class="btn ghost" id="skip-workout">Skip</button>
    </div>
  `;

  // Warm-up section: video buttons and check-offs (delegated). Check-offs last for today's session.
  const $warmupCard = app.querySelector('.warmup-section');
  if ($warmupCard) {
    $warmupCard.addEventListener('click', async e => {
      const btn = e.target.closest('button.video-link.has-video[data-ytid]');
      if (btn) return openLiftDetail(btn);
      const chk = e.target.closest('.warmup-check');
      if (chk) {
        const on = chk.textContent.trim() !== '✓';
        chk.textContent = on ? '✓' : '○';
        chk.closest('.warmup-ex').classList.toggle('done', on);
        try { sessionStorage.setItem(`wu:${today()}:${chk.dataset.wu}`, on ? '1' : '0'); } catch {}
        if (chk.dataset.hip) {   // the hip plan's warm-up: same check-off on the Hip tab
          const logs = (await pref('hip_logs')) || {};
          logs[today()] = { ...(logs[today()] || {}), [chk.dataset.hip]: on };
          await pref('hip_logs', logs);
          _hipDone = logs[today()];
        }
      }
    });
  }

  const $ex = app.querySelector('#exercises');
  const bandStart = bandDay ? renderBandList($ex, session, exMap) : null;
  let lastGroup = null;
  if (!bandDay) session.exercises.forEach((ex, i) => {
    const grp = ex.round_group;
    if (grp && grp !== lastGroup) {
      $ex.insertAdjacentHTML('beforeend', `<div class="group-label">${prettyGroup(grp)}</div>`);
      lastGroup = grp;
    } else if (!grp && lastGroup) {
      lastGroup = null;
    }
    const node = exerciseCard(ex, i, exMap, prevRef, allTimeBestE1RM);
    $ex.appendChild(node);
  });

  app.querySelector('[data-progress-check]')?.addEventListener('click', () => openProgressCheck());
  app.querySelector('[data-follow-along]')?.addEventListener('click', () => {
    const v = dayData.video;
    openExerciseDetail({ name: v.title, video_url: v.url, subtitle: v.note || 'Follow-along workout', source: programName(program) });
  });
  app.querySelectorAll('[data-band-cat]').forEach(b => b.onclick = () => {
    const c = b.dataset.bandCat;
    openExerciseDetail({ name: `${c}: band setup`, video_url: bandOverviews[c],
      subtitle: 'How to anchor the band for these exercises', source: 'PJF band' });
  });
  app.querySelector('[data-action="prev"]')?.addEventListener('click', () => changeDay(-1));
  app.querySelector('[data-action="next"]')?.addEventListener('click', () => changeDay(+1));
  app.querySelector('#add-ex').onclick = async () => {
    const picked = await pickExerciseFromLibrary(allExercises);
    if (!picked) return;
    session.exercises.push({
      name: picked.name,
      target_reps: '8-12',
      target_sets: 3,
      sets: [],
      added: true,
    });
    await saveSession(session);
    renderWorkout(app);
  };
  let finishing = false;
  app.querySelector('#finish').onclick = async (e) => {
    if (finishing) return;
    finishing = true;
    e.currentTarget.disabled = true;
    const wasDone = session.done;   // re-finishing an edited workout must not skip a day
    session.done = true;
    await saveSession(session);
    if (today_w.mode === 'follow' && !wasDone) {
      await advanceCursor(programId, 'follow');
      if (session.merged_day) await advanceCursor(programId, 'follow');   // Day 3 + Day 4 in one session
    }
    const allSessions = await getAll('sessions');
    const stats = computeSessionStats(session, allSessions);
    renderWorkoutComplete(app, session, stats, program, week, day);
  };
  app.querySelector('#skip-workout').onclick = async (e) => {
    if (finishing) return;
    const logged = session.exercises.some(x => (x.sets || []).some(st => st?.done));
    if (!confirm(logged
      ? 'Skip this workout? Sets you logged stay saved, and the program moves to the next day.'
      : 'Skip this workout and move to the next day?')) return;
    finishing = true;
    e.currentTarget.disabled = true;
    const wasDone = session.done;
    session.done = true;
    session.skipped = true;
    await saveSession(session);
    // Skipping Daily Mobility keeps its day for tomorrow (same as Skip today on its Home card).
    if (today_w.mode === 'follow' && !wasDone && !today_w.daily) {
      await advanceCursor(programId, 'follow');
      if (session.merged_day) await advanceCursor(programId, 'follow');
    }
    stopRestTimer();
    toast('Workout skipped');
    navigate('home');
  };

  // Set logging. The list's cards and the exercise sheet's card (Start workout) share it.
  const wireCards = ($root) => {
  $root.addEventListener('input', async e => {
    if (!e.target.matches('input.set-input')) return;
    const card = e.target.closest('.exercise');
    const i = +card.dataset.i;
    const setIdx = +e.target.dataset.set;
    const field = e.target.dataset.field;
    setAt(session.exercises[i], setIdx)[field] = +e.target.value || null;
    await saveSession(session);
  });
  $root.addEventListener('click', async e => {
    // Compact re-expansion: tap anywhere on a compact card except action buttons
    const compactCard = e.target.closest('.exercise--compact');
    if (compactCard && !e.target.closest('.check, .inc-btn, .rpe-btn, .ex-menu, .video-link, .rest-stop, .timer-btn, [data-rest], .add-set-sugg, .credit-btn')) {
      compactCard.classList.remove('exercise--compact');
      const $sum = compactCard.querySelector('.exercise-summary');
      if ($sum) $sum.style.display = 'none';
      return;
    }

    // Done today elsewhere: one tap fills its sets as done (marked as a credit, so it's not a second source).
    if (e.target.closest('.credit-btn')) {
      const card = e.target.closest('.exercise');
      const x = session.exercises[+card.dataset.i];
      const n = Math.max(1, +x.target_sets || (x.sets || []).length || 1);
      const now = Date.now();
      x.sets = Array.from({ length: n }, (_, k) => ({ ...(x.sets?.[k] || {}), done: true, at: now, credit: e.target.closest('.credit-btn').dataset.where }));
      await saveSession(session);
      renderWorkout(app, { keepRest: true });
      return;
    }

    if (e.target.matches('.inc-btn')) {
      const card = e.target.closest('.exercise');
      const i = +card.dataset.i;
      const setIdx = +e.target.dataset.set;
      const wInput = e.target.closest('.set-row').querySelector('[data-field="weight"]');
      const newVal = Math.round(((+wInput.value || 0) + 5) * 10) / 10;
      wInput.value = newVal;
      setAt(session.exercises[i], setIdx).weight = newVal;
      await saveSession(session);
    }

    if (e.target.matches('.check')) {
      const card = e.target.closest('.exercise');
      const i = +card.dataset.i;
      const setIdx = +e.target.dataset.set;
      const set = setAt(session.exercises[i], setIdx);

      // Reconcile pre-filled inputs that were never explicitly typed (input event never fired)
      if (!set.done) {
        const row = e.target.closest('.set-row');
        if (!set.weight) { const v = +row.querySelector('[data-field="weight"]')?.value; if (v) set.weight = v; }
        if (!set.reps)   { const v = +row.querySelector('[data-field="reps"]')?.value;   if (v) set.reps   = v; }
      }

      // An empty set inherits the set above it — checking ○ on set 2 means "same again".
      if (!set.done && !set.weight && !set.reps && setIdx > 0) {
        const above = session.exercises[i].sets[setIdx - 1];
        if (above?.weight || above?.reps) {
          set.weight = above.weight ?? null;
          set.reps = above.reps ?? null;
          const row = e.target.closest('.set-row');
          if (set.weight) row.querySelector('[data-field="weight"]').value = set.weight;
          if (set.reps) row.querySelector('[data-field="reps"]').value = set.reps;
        }
      }

      const timedRow = e.target.closest('.set-row').classList.contains('timed');
      if (timedRow) {
        if (!set.done && !set.secs) set.secs = parseSecs(session.exercises[i].time);
        if (_setTimer?.btn?.closest('.set-row') === e.target.closest('.set-row')) stopSetTimer();
      }

      set.done = !set.done;
      if (set.done) set.at = Date.now(); else delete set.at;   // set times give real session length (src/lib/learn.js)
      await saveSession(session);
      _tickClock();
      e.target.closest('.set-row').classList.toggle('done', !!set.done);
      e.target.textContent = set.done ? '✓' : '○';

      // Carry this set's numbers into the next empty row so the next set is one tap.
      if (set.done) {
        const nextRow = card.querySelectorAll('.set-row')[setIdx + 1];
        const nextSet = session.exercises[i].sets[setIdx + 1];
        if (nextRow && !nextSet?.done) {
          const $w = nextRow.querySelector('[data-field="weight"]');
          const $r = nextRow.querySelector('[data-field="reps"]');
          if ($w && !$w.value && set.weight) $w.value = set.weight;
          if ($r && !$r.value && set.reps) $r.value = set.reps;
        }
      }

      // Update e1RM display inline — no re-render needed
      const ex = session.exercises[i];
      const doneSets = (ex.sets || []).filter(s => s?.done && s.weight && s.reps);
      const $e1rm = card.querySelector('.e1rm-line');
      if ($e1rm) {
        if (doneSets.length) {
          const bestE = Math.max(...doneSets.map(s => rpeE1RM(s.weight, s.reps, s.rpe)));
          if (bestE > 0) {
            const isPR = (allTimeBestE1RM[ex.name] ?? 0) > 0 && bestE > allTimeBestE1RM[ex.name];
            $e1rm.innerHTML = isPR
              ? `<span style="color:var(--accent)">~${bestE} lb e1RM ★ PR</span>`
              : `<span style="color:var(--fg-dim)">~${bestE} lb e1RM</span>`;
          } else { $e1rm.innerHTML = ''; }
        } else { $e1rm.innerHTML = ''; }
      }

      if (set.done) {
        // Interval rounds run straight into the next. In a superset or circuit, rest comes after the
        // round's last move: A1 → A2 back to back.
        const nx = session.exercises[i + 1];
        const midRound = /superset|circuit|round/i.test(ex.round_group || '') && nx?.round_group === ex.round_group
          && !nx.sets?.[setIdx]?.done;
        // Logging a set means the rest is over: A1 of the next round stops A2's rest timer.
        if (!ex.intervals && !midRound) startRestTimer(card, ex); else stopRestTimer();
        applyCompactState(card, ex);
        showUndo(e.target, session, i, setIdx);
      } else {
        // Un-check: clear the timer only if it is running on this exercise
        if (_rest?.i === i) stopRestTimer();
        card.classList.remove('exercise--compact');
        const $sum = card.querySelector('.exercise-summary');
        if ($sum) $sum.style.display = 'none';
      }
    }

    if (e.target.matches('.timer-btn')) {
      const btn = e.target;
      const row = btn.closest('.set-row');
      if (_setTimer?.btn === btn) { stopSetTimer(); return; }   // tap again = stop
      stopRestTimer();
      const ex = session.exercises[+btn.closest('.exercise').dataset.i];
      runWorkTimer(btn, { secs: +btn.dataset.secs || 0, unit: ex.intervals ? null : sidesOf(ex), intervals: ex.intervals,
        idle: '▶ Start', onDone: () => {
          // Time's up (both sides): log the set (fires the normal check path, then the rest timer).
          const check = row.querySelector('.check');
          if (check && !row.classList.contains('done')) check.click();
          // Interval rounds run back to back: the next round starts by itself.
          if (ex.intervals) {
            const nextRow = row.nextElementSibling;
            if (nextRow?.matches('.set-row.timed:not(.done)')) nextRow.querySelector('.timer-btn')?.click();
          }
        } });
      return;
    }

    if (e.target.matches('.rpe-btn')) {
      const card = e.target.closest('.exercise');
      const i = +card.dataset.i;
      const setIdx = +e.target.dataset.set;
      openRPEPicker(card, setIdx, session, i);
    }
    if (e.target.matches('.add-set-sugg')) {
      const ex = session.exercises[+e.target.closest('.exercise').dataset.i];
      ex.target_sets = (parseInt(ex.target_sets) || 3) + 1;
      ex.set_added = true;
      await saveSession(session);
      toast(`${ex.name}: ${ex.target_sets} sets today`);
      renderWorkout(document.getElementById('app'), { keepRest: true });
      return;
    }
    if (e.target.matches('.ex-menu')) {
      const card = e.target.closest('.exercise');
      const i = +card.dataset.i;
      openExerciseMenu(session, i, allExercises, exMap);
    }

    // ▶ Video on a list card opens that exercise in the workout flow (video, sets, Next →).
    if (e.target.matches('button.video-link.has-video[data-ytid]')) {
      const card = e.target.closest('.exercise');
      if (card) openStep(steps.findIndex(st => st.i === +card.dataset.i));
      else openLiftDetail(e.target);
    }
  });
  };
  if (!bandDay) wireCards($ex);
  // Session clock: minutes since the first logged set (sets store their time).
  clearInterval(_clock);
  const tickClock = () => {
    const el = document.getElementById('session-clock');
    if (!el) return clearInterval(_clock);
    const ts = session.exercises.flatMap(x => (x.sets || []).map(st => st?.done && st.at)).filter(Boolean);
    el.textContent = ts.length && !session.done ? ` · ⏱ ${Math.max(1, Math.round((Date.now() - Math.min(...ts)) / 60000))} min` : '';
  };
  tickClock();
  _tickClock = tickClock;
  _clock = setInterval(tickClock, 15000);
  // A rest that was running when the sheet closed carries on, on that exercise's card.
  if (_rest) $ex.querySelector(`.exercise[data-i="${_rest.i}"] .rest-timer-line`)?.classList.add('rest-live');

  // ── Start workout: the FKH flow, one exercise at a time in the shared exercise sheet ──
  // Warm-up moves, then the exercises. Video on top, the Lift card's weight/rep rows under
  // it, rest countdown, and the last set moves on to the next exercise by itself.
  const wuKey = (n) => `wu:${today()}:${n}`;
  const wuDone = (n) => { if (Object.entries(_hipDone).some(([id, v]) => v && hipWarmupRows().find(r => r.hip_id === id)?.name === n)) return true;
    try { if (sessionStorage.getItem(wuKey(n)) === '1') return true; } catch { /* private mode */ }
    return !!doneElsewhere(n, _elsewhere, _sessionId); };   // done in another workout or the hip plan today
  const steps = [
    ...(bandDay ? [] : (warmup?.exercises || []).map(w => ({ wu: w }))),
    ...session.exercises.map((_, i) => ({ i })),
  ];
  const stepDone = (st) => st.wu ? wuDone(st.wu.name) : exerciseDone(session.exercises[st.i]);
  const stepName = (st) => st.wu ? st.wu.name : session.exercises[st.i].name;
  const warmCount = steps.filter(st => st.wu).length;

  // Next →: the next unfinished exercise, except at the end of a superset or circuit done a
  // set at a time, which goes back round to the group's first unfinished exercise.
  const nextOf = (k) => {
    const st = steps[k];
    if (st.i != null) {
      const ex = session.exercises[st.i];
      const g = ex.round_group;
      if (g && setsDoneCount(ex) > 0 && !exerciseDone(ex)) {
        const inG = (j) => steps[j]?.i != null && session.exercises[steps[j].i].round_group === g;
        let a = k, b = k;
        while (inG(a - 1)) a--;
        while (inG(b + 1)) b++;
        if (k === b && b > a) {
          for (let j = a; j < b; j++) if (!stepDone(steps[j])) return { k: j, round: true };
        }
      }
    }
    for (let j = k + 1; j < steps.length; j++) if (!stepDone(steps[j])) return { k: j };
    for (let j = warmCount; j < k; j++) if (!stepDone(steps[j])) return { k: j };   // skipped ones
    return null;
  };

  const refreshSoon = () => setTimeout(() => {
    if (_noRefresh) { _noRefresh = false; return; }
    if (!document.querySelector('.sheet-backdrop') && app.isConnected && /workout/.test(location.hash)) {
      renderWorkout(app, { keepRest: true });
    }
  }, 60);

  // ⋯ → Swap on a warm-up move: the row's alternates, similar warm-up moves, or any exercise.
  const openWarmupSwap = (w) => openSheet((s2, close2) => {
    const orig = w.orig_name || w.name;
    const lookup = exMap[orig.toLowerCase()];
    const alts = (w.alternates || []).filter(n => n !== w.name && n !== orig);
    const similar = rankSimilar(lookup, allExercises, { limit: 40 })
      .filter(e => (e.role === 'warmup' || e.pattern === 'mobility') && e.name !== w.name && e.name !== orig && !alts.includes(e.name)).slice(0, 10);
    const row = (n, meta = '') => `<div class="list-item" data-name="${esc(n)}" style="cursor:pointer"><div style="flex:1">
      <div class="list-item-title">${esc(n)}${n === orig ? ' <span class="pill" style="font-size:10px">original</span>' : ''}</div>
      <div class="list-item-meta" style="text-transform:capitalize">${meta}</div></div></div>`;
    const meta = (e) => (e?.pattern ? tagLine(e) : '') + (hasVideo(e) ? ' · ▶' : '');
    s2.innerHTML = `<h2>Swap: ${esc(w.name)}</h2>
      ${w.name !== orig ? `<div class="group-label" style="margin:0 0 6px">The plan's move</div>${row(orig, meta(lookup))}` : ''}
      ${alts.length ? `<div class="group-label" style="margin:0 0 6px">Plan alternatives</div>${alts.map(n => row(n, meta(exMap[n.toLowerCase()]))).join('')}` : ''}
      ${similar.length ? `<div class="group-label" style="margin:12px 0 6px">Similar warm-up moves</div>${similar.map(e => row(e.name, meta(e))).join('')}` : ''}
      <div class="group-label" style="margin:12px 0 6px">Any exercise</div>
      <input type="text" id="wu-filter" placeholder="Search all exercises…" autocomplete="off">
      <div id="wu-results"></div>`;
    const pick = async (name) => {
      session.warmup_swaps = { ...(session.warmup_swaps || {}), [orig]: name };
      await saveSession(session);
      if (name === orig) {   // back to the plan's move: drop a saved swap too
        const dk = _sessionDayKey(session), all = (await pref('swaps')) || {};
        if (dk && all[session.program_id]?.[dk]?.[`wu:${orig}`]) { delete all[session.program_id][dk][`wu:${orig}`]; await pref('swaps', all); }
        close2(); renderWorkout(app); return;
      }
      close2(!(session.program_id && _sessionDayKey(session)));
      _offerPermanentSwap(orig, name, session, `wu:${orig}`);
    };
    const wire = (root) => root.querySelectorAll('.list-item[data-name]').forEach(el => { el.onclick = () => pick(el.dataset.name); });
    wire(s2);
    const $f = s2.querySelector('#wu-filter'), $r = s2.querySelector('#wu-results');
    $f.oninput = () => {
      const q = $f.value.trim().toLowerCase();
      $r.innerHTML = q ? allExercises.filter(e => e.name.toLowerCase().includes(q)).slice(0, 10).map(e => row(e.name, meta(e))).join('') : '';
      wire($r);
    };
  });

  // ← Back: the step before this one (a superset reopens as its whole screen).
  const prevOf = (k) => () => (k > 0 && steps[k - 1] ? { name: stepName(steps[k - 1]), open: () => openStep(k - 1) } : null);

  function openGroup(a, b, common) {
    const idx = []; for (let j = a; j <= b; j++) idx.push(steps[j].i);
    const exs = idx.map(i => session.exercises[i]);
    const cards = [];
    const vid = (ex) => { const rv = !ex.swapped && ex.video_url ? ex.video_url : null;
      return { video_url: rv || exMap[ex.name.toLowerCase()]?.video_url, rowVideo: !!rv }; };
    const mount = (n) => (el, changed) => {
      const card = exerciseCard(exs[n], idx[n], exMap, prevRef, allTimeBestE1RM);
      card.classList.add('in-sheet');
      card.querySelector('.rest-timer-line')?.classList.add('rest-live');
      el.appendChild(card);
      cards[n] = card;
      wireCards(el);
      el.addEventListener('click', () => setTimeout(changed, 0));
      paintRest();
    };
    const label = prettyGroup(exs[0].round_group);
    // Next →: the first unfinished step after the group, else any earlier one left.
    const next = () => {
      let j = steps.findIndex((st, x) => x > b && !stepDone(st));
      if (j < 0) j = steps.findIndex((st, x) => x >= warmCount && x < a && !stepDone(st));
      return j < 0 ? null : { name: stepName(steps[j]), open: () => openStep(j) };
    };
    openExerciseDetail({ name: exs[0].name, ...vid(exs[0]),
      subtitle: `${label} · ${exs.length} moves, back to back`, notes: exs[0].notes }, {
      ...common,
      next,
      prev: prevOf(a),
      rx: formatTarget(exs[0]),
      doneLabel: `✓ Mark ${/superset/i.test(label) ? 'superset' : 'circuit'} done`,
      isDone: () => exs.every(exerciseDone),
      setDone: async (v) => {
        if (!v) return;
        for (const c of cards) c?.querySelectorAll('.set-row:not(.done) .check').forEach(x => x.click());
      },
      mountSets: mount(0),
      also: exs.slice(1).map((ex, n) => ({ ex: { name: ex.name, ...vid(ex), notes: ex.notes }, rx: formatTarget(ex), mountSets: mount(n + 1) })),
    });
  }

  function openStep(k) {
    const st = steps[k];
    if (!st) return;
    const next = () => {
      const n = nextOf(k);
      return n && { name: stepName(steps[n.k]) + (n.round ? ' · next round' : ''), open: () => openStep(n.k) };
    };
    const common = {
      accent: '#38bdf8',
      autoNext: true,
      next,
      prev: prevOf(k),
      onClose: refreshSoon,
      completeLabel: 'Every exercise done',
      finish: { label: 'Finish workout ✓', onClick: (close) => { _noRefresh = true; close(); app.querySelector('#finish')?.click(); } },
    };
    if (st.wu) {
      const w = st.wu;
      const lookup = exMap[w.name.toLowerCase()];
      const target = [w.sets ? `${w.sets} ×` : '', w.reps || w.time || ''].join(' ').trim();
      const secs = !w.reps && parseSecs(w.time);
      return openExerciseDetail({ name: w.name, video_url: lookup?.video_url, notes: w.notes,
        subtitle: `Warm-up ${k + 1} of ${warmCount}`, source: 'Warm-up' }, {
        ...common,
        rx: target,
        menu: [{ label: '🔄 Swap', onClick: (close) => { _noRefresh = true; close(false); openWarmupSwap(w); } }],
        isDone: () => wuDone(w.name),
        setDone: async (v) => {
          try { sessionStorage.setItem(wuKey(w.name), v ? '1' : '0'); } catch { /* private mode */ }
          if (w.hip_id) {   // the hip plan's warm-up: same check-off on the Hip tab
            const logs = (await pref('hip_logs')) || {};
            logs[today()] = { ...(logs[today()] || {}), [w.hip_id]: v };
            await pref('hip_logs', logs);
            _hipDone = logs[today()];
          }
        },
        extraHTML: secs ? `<button class="btn ghost hold-timer" data-secs="${secs}" data-sides="${sidesOf(w) || ''}" style="margin-top:10px">▶ Start ${fmtSecs(secs)}${sidesOf(w) ? ' each ' + sidesOf(w) : ''}</button>` : '',
      });
    }
    const i = st.i;
    // A superset or circuit opens as one screen: each move's video with its sets below (TrainHeroic-style).
    const g0 = session.exercises[i].round_group;
    if (/superset|circuit|round/i.test(g0 || '')) {
      const inG = (j) => steps[j]?.i != null && session.exercises[steps[j].i].round_group === g0;
      let a = k, b = k;
      while (inG(a - 1)) a--;
      while (inG(b + 1)) b++;
      if (b > a) return openGroup(a, b, common);
    }
    const ex = session.exercises[i];
    const lookup = exMap[ex.name.toLowerCase()];
    const rowVideo = !ex.swapped && ex.video_url ? ex.video_url : null;
    const grp = ex.round_group ? ` · ${prettyGroup(ex.round_group)}` : '';
    let card = null;
    openExerciseDetail({ name: ex.name, video_url: rowVideo || lookup?.video_url, rowVideo: !!rowVideo,
      subtitle: `Exercise ${i + 1} of ${session.exercises.length}${grp}`, notes: ex.notes }, {
      ...common,
      rx: formatTarget(ex),
      isDone: () => exerciseDone(ex),
      // ✓ Mark exercise done = tap each open set's ○, so prefilled weights and reps are logged.
      setDone: async (v) => {
        if (!v || !card) return;
        card.querySelectorAll('.set-row:not(.done) .check').forEach(c => c.click());
      },
      mountSets: (el, changed) => {
        card = exerciseCard(ex, i, exMap, prevRef, allTimeBestE1RM);
        card.classList.add('in-sheet');
        card.querySelector('.rest-timer-line')?.classList.add('rest-live');
        el.appendChild(card);
        wireCards(el);
        el.addEventListener('click', () => setTimeout(changed, 0));
        paintRest();
      },
    });
  }

  const startFlow = () => {
    if (bandDay) return bandStart?.();
    // Fresh: from the top (warm-up). Part-way through: the first unfinished exercise.
    const from = anyLogged ? warmCount : 0;
    let k = steps.findIndex((st, j) => j >= from && !stepDone(st));
    if (k < 0) k = steps.findIndex(st => !stepDone(st));
    openStep(k < 0 ? warmCount : k);
  };
  app.querySelector('#start-flow').onclick = startFlow;
  // 🏋 Gym today (src/lib/gym_swap.js): swap home stand-ins for better gym versions, or put the plan back.
  app.querySelector('#gym-toggle')?.addEventListener('click', async () => {
    const on = !session.gym_day;
    const [gym, learned] = await Promise.all([pref('gym_equipment'), _loadLearned()]);
    const lookup = (n) => exMap[String(n).toLowerCase()];
    const { rows, swaps } = applyGymDay(session.exercises, on, lookup, allExercises,
      { gym: gym || GYM_DEFAULT, learned, favorites: favorites(), avoid: _profile?.avoid || [] });
    session.exercises = rows;
    session.gym_day = on || undefined;
    await saveSession(session);
    const real = swaps.filter(x => x.from !== x.to);
    toast(on ? (real.length ? `Gym: ${real.length} swap${real.length === 1 ? '' : 's'}${swaps.length > real.length ? ', lunges with dumbbells' : ''}` : 'Nothing to swap: today already suits the gym')
      : 'Back to the plan', 2400);
    renderWorkout(app, { keepRest: true });
  });
  app.querySelector('#gym-kit')?.addEventListener('click', async () => {
    let kit = (await pref('gym_equipment')) || [...GYM_DEFAULT];
    const ALL = ['dumbbell', 'barbell', 'trap_bar', 'bench', 'box', 'cable', 'machine', 'pullup_bar', 'landmine', 'kettlebell', 'smith', 'med_ball', 'band', 'mini_band', 'sled', 'suspension'];
    openSheet((sheet, close) => {
      const paint = () => {
        sheet.innerHTML = `<h2>Your gym has</h2>
          <div class="muted" style="margin-bottom:10px">Used when you tap "Going to the gym today?".</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">${ALL.map(q => `<button class="pill ${kit.includes(q) ? 'accent' : ''}" data-q="${q}" style="cursor:pointer;padding:7px 11px">${EQUIPMENT_LABEL[q] || q}</button>`).join('')}</div>
          <button class="btn" id="gk-save" style="margin-top:14px">Save</button>`;
        sheet.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { const q = b.dataset.q; kit = kit.includes(q) ? kit.filter(x => x !== q) : [...kit, q]; paint(); });
        sheet.querySelector('#gk-save').onclick = async () => { await pref('gym_equipment', kit); close(); toast('Gym equipment saved'); };
      };
      paint();
    });
  });
  // Today's "Start workout" goes straight into the flow.
  let auto = false;
  try { auto = sessionStorage.getItem('lift-autostart') === '1'; sessionStorage.removeItem('lift-autostart'); } catch { /* private mode */ }
  if (auto) startFlow();
}

function _pickWarmup(focus, warmups) {
  const f = (focus || '').toLowerCase();
  if (f.includes('full')) {
    const upper = Object.values(warmups).find(w => w.day_types.includes('upper'));
    const lower = Object.values(warmups).find(w => w.day_types.includes('lower'));
    if (upper && lower) return {
      name: 'Full Body Warm-Up',
      exercises: [...upper.exercises, ...lower.exercises],
      note: upper.note,
    };
  }
  for (const w of Object.values(warmups)) {
    if (w.day_types.includes('any')) continue;
    if (w.day_types.some(t => f.includes(t))) return w;
  }
  return null;
}

/** PJF's own notes for this day (imported on this device), collapsed under the title. */
function pjfDayNotesHtml(program, week, day, dayData) {
  if (!week) return '';
  const notes = dayNotesFor(program.program_name || program.name || '', week, dayData.exercises.map(e => e.name), day);
  if (!notes.length) return '';
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  // PJF writes "-Do this -Then that"; give each point its own line.
  const lines = notes.flatMap(n => n.split(/\s(?=-[A-Z])/).map(t => t.replace(/^-/, '').trim())).filter(Boolean);
  return `
    <details class="pjf-day-notes" style="margin:10px 0;padding:8px 12px;border-radius:10px;
      background:rgba(56,189,248,0.07);border:1px solid rgba(56,189,248,0.2)">
      <summary style="cursor:pointer;font-size:12px;font-weight:700;letter-spacing:0.04em;color:#7dd3fc">PJF NOTES FOR TODAY</summary>
      ${lines.map(l => `<p style="font-size:13px;color:#cbd5e1;line-height:1.45;margin:8px 0 0">${esc(l)}</p>`).join('')}
    </details>`;
}

/** Day notes, a follow-along video and the safety line, for plans that author them per day. */
function dayInfoHtml(program, dayData) {
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const notes = dayData.notes || [];
  const v = dayData.video;
  if (!notes.length && !v && !program.safety && !dayData.progress_check && !program.guide) return '';
  const video = !v ? '' : ytVideoId(v.url)
    ? `<button class="btn secondary" data-follow-along style="margin-top:10px">▶ Follow along: ${esc(v.title)}</button>`
    : `<a class="btn secondary" href="${esc(v.url)}" target="_blank" rel="noopener" style="margin-top:10px;display:block;text-align:center;text-decoration:none">▶ Follow along: ${esc(v.title)} ↗</a>`;
  return `
    <div class="day-info" style="margin:10px 0;padding:10px 12px;border-radius:10px;
      background:rgba(244,114,182,0.07);border:1px solid rgba(244,114,182,0.22)">
      ${notes.map(n => `<p style="font-size:13px;line-height:1.45;margin:0 0 6px">${esc(n)}</p>`).join('')}
      ${v?.note ? `<p class="muted" style="font-size:12px;margin:0">${esc(v.note)}</p>` : ''}
      ${video}
      ${dayData.progress_check ? `<button class="btn secondary" data-progress-check style="margin-top:8px">📏 ${esc(dayData.progress_check)}</button>` : ''}
      ${program.guide?.length ? `<details style="margin-top:8px"><summary class="muted" style="font-size:12px;cursor:pointer">Habits & reminders</summary>
        ${program.guide.map(g => `<div style="font-size:12px;font-weight:600;margin:8px 0 2px">${esc(g.title)}</div>
          <ul class="muted" style="margin:0;padding-left:18px;font-size:12px;line-height:1.45">${g.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`).join('')}
      </details>` : ''}
      ${program.safety ? `<details style="margin-top:8px"><summary class="muted" style="font-size:12px;cursor:pointer">Safety</summary>
        <p class="muted" style="font-size:12px;line-height:1.45;margin:6px 0 0">${esc(program.safety)}</p></details>` : ''}
    </div>`;
}

/**
 * The warm-up as its own section, laid out like the workout's exercises: a section heading,
 * then one card per move with its target, ▶ Video and a check-off (no weights to log).
 */
// Hip warm-up check-offs for today (hip_logs), shared with the Hip tab.
let _hipDone = {};
/** The hip plan's warm-up as workout warm-up rows ("3 × 30 s per side" → 3 sets of 30 s each side). */
function hipWarmupRows() {
  const sec = HIP_SECTIONS.find(x => x.id === 'warmup');
  return (sec?.exercises || []).map(e => {
    const s = String(e.sets || '');
    const hold = /^(\d+)\s*×\s*(\d+)\s*s/.exec(s);
    const mins = /(\d+)(?:–\d+)?\s*min/.exec(s);
    const reps = /^(\d+)\s*reps?/.exec(s);
    return hold ? { name: e.name, hip_id: e.id, sets: +hold[1], time: `${hold[2]}s`, notes: /side/.test(s) ? 'Each side.' : null }
      : mins ? { name: e.name, hip_id: e.id, time: `${mins[1]}:00`, notes: `${s}, easy pace.` }
      : { name: e.name, hip_id: e.id, reps: reps ? reps[1] : s, notes: null };
  });
}

function _warmupBlockHtml(warmup, exMap) {
  const key = (n) => `wu:${today()}:${n}`;
  const done = (n, hipId) => { if (hipId && _hipDone[hipId]) return true; try { return sessionStorage.getItem(key(n)) === '1'; } catch { return false; } };
  const cards = warmup.exercises.map(ex => {
    const lookup = exMap[ex.name.toLowerCase()];
    const _wYtId = ytVideoId(lookup?.video_url);
    const _wLocal = playable(localFor(ex.name));
    const _wNameEsc = ex.name.replace(/"/g, '&quot;');
    const _attr = (v) => String(v ?? '').replace(/"/g, '&quot;');
    const target = [ex.sets ? `${ex.sets} ×` : '', ex.reps || ex.time || ''].join(' ').trim();
    const videoHtml = _wYtId || _wLocal
      ? `<button class="video-link has-video" data-ytid="${_wYtId || ''}" data-ytname="${_wNameEsc}"
          data-target="${_attr(target)}" data-notes="${_attr(ex.notes)}">▶ Video</button>`
      : lookup?.video_url
        ? `<a class="video-link has-video" href="${lookup.video_url}" target="_blank">▶ Video</a>`
        : `<a class="video-link" href="https://www.youtube.com/results?search_query=${encodeURIComponent(ex.name)}" target="_blank">🔍 Find</a>`;
    const secs = !ex.reps && parseSecs(ex.time);
    const where = !done(ex.name, ex.hip_id) && doneElsewhere(ex.name, _elsewhere, _sessionId);
    const isDone = done(ex.name, ex.hip_id) || !!where;
    return `
      <div class="exercise warmup-ex${isDone ? ' done' : ''}" style="padding:12px 14px">
        <div class="exercise-header" style="align-items:center">
          <div style="flex:1;min-width:0">
            <div class="exercise-name" style="font-size:16px">${ex.name}</div>
            ${lookup?.pattern ? `<div style="font-size:11px;color:var(--fg-dim);margin-top:1px;text-transform:capitalize">${tagLine(lookup)}</div>` : ''}
            ${target ? `<div class="exercise-target">${target}</div>` : ''}
            ${ex.notes ? `<div class="muted" style="font-size:12px;margin-top:2px">${ex.notes}</div>` : ''}
            ${where ? `<div style="font-size:12px;margin-top:2px;color:var(--accent)">✓ Done today in ${esc(where.label)}</div>` : ''}
          </div>
          <div style="display:flex;gap:6px;align-items:center">
            ${secs ? `<button class="video-link hold-timer" data-secs="${secs}" data-sides="${sidesOf(ex) || ''}">▶ ${fmtSecs(secs)}${sidesOf(ex) ? ' ×2' : ''}</button>` : ''}
            ${videoHtml}
            <button class="check warmup-check" data-wu="${_wNameEsc}"${ex.hip_id ? ` data-hip="${ex.hip_id}"` : ''} aria-label="Done">${isDone ? '✓' : '○'}</button>
          </div>
        </div>
      </div>`;
  }).join('');
  return `
    <div class="warmup-section">
      <div class="group-label" style="display:flex;justify-content:space-between"><span>🔥 ${warmup.name}</span><span>${warmup.exercises.length} moves</span></div>
      ${cards}
      ${warmup.note ? `<div class="muted" style="font-size:12px;margin:-2px 0 8px">${warmup.note}</div>` : ''}
    </div>`;
}

/** Equipment filters in the picker: true if the exercise needs only what the filter allows. */
const EQ_FILTERS = {
  Bodyweight: (eq) => eq.every(q => ['bodyweight', 'bench', 'box', 'pullup_bar'].includes(q)),
  Dumbbell: (eq) => eq.includes('dumbbell') || eq.includes('kettlebell'),
  Barbell: (eq) => eq.some(q => ['barbell', 'trap_bar', 'landmine', 'smith'].includes(q)),
  Band: (eq) => eq.includes('band') || eq.includes('mini_band'),
  'Cable & machine': (eq) => eq.some(q => ['cable', 'machine', 'suspension'].includes(q)),
};

async function pickExerciseFromLibrary(allExercises, { filterMuscle = null, title = 'Pick exercise' } = {}) {
  return new Promise(resolve => {
    openSheet((sheet, close) => {
      const muscleLabel = filterMuscle ? filterMuscle.replace(/_/g, ' ') : null;
      sheet.innerHTML = `
        <h2>${title}</h2>
        ${muscleLabel ? `<div class="muted" style="margin-bottom:8px">Showing ${muscleLabel} exercises first</div>` : ''}
        <div class="search-bar"><input type="text" id="ex-search" placeholder="Search exercises…" autocomplete="off"></div>
        ${[['m', 'Muscle', MUSCLE_GROUPS], ['t', 'Type', TYPE_GROUPS], ['q', 'Equipment', EQ_FILTERS]].map(([k, label, groups]) => `
          <div class="ex-filter" data-group="${k}" style="display:flex;gap:5px;overflow-x:auto;margin:6px 0;padding-bottom:2px">
            <span class="muted" style="font-size:11px;align-self:center;flex-shrink:0;width:62px">${label}</span>
            ${Object.keys(groups).map(g => `<button class="pill" data-val="${g}" style="flex-shrink:0;cursor:pointer;font-size:11px">${g}</button>`).join('')}
          </div>`).join('')}
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;margin:2px 0 8px"><input type="checkbox" id="ex-video" checked style="width:auto"> With video only</label>
        <div id="ex-list"></div>
      `;
      const pick = { m: null, t: null, q: null };
      sheet.querySelectorAll('.ex-filter button').forEach(b => b.onclick = () => {
        const k = b.parentElement.dataset.group;
        pick[k] = pick[k] === b.dataset.val ? null : b.dataset.val;
        b.parentElement.querySelectorAll('button').forEach(x => x.classList.toggle('accent', x.dataset.val === pick[k]));
        render();
      });
      sheet.querySelector('#ex-video').onchange = () => render();
      const $list = sheet.querySelector('#ex-list');
      const $search = sheet.querySelector('#ex-search');
      const sorted = [...allExercises].sort((a, b) => {
        // When filtering by muscle, put matching primary muscle first
        if (filterMuscle) {
          const aMatch = a.primary_muscle === filterMuscle ? 0 : (a.muscles || []).includes(filterMuscle) ? 1 : 2;
          const bMatch = b.primary_muscle === filterMuscle ? 0 : (b.muscles || []).includes(filterMuscle) ? 1 : 2;
          if (aMatch !== bMatch) return aMatch - bMatch;
        }
        return a.name.localeCompare(b.name);
      });
      function render() {
        const q = $search.value.trim().toLowerCase();
        const videoOnly = sheet.querySelector('#ex-video').checked;
        const pool = sorted.filter(e =>
          (!pick.m || MUSCLE_GROUPS[pick.m].includes(e.primary_muscle)) &&
          (!pick.t || TYPE_GROUPS[pick.t].includes(e.pattern)) &&
          (!pick.q || EQ_FILTERS[pick.q](e.equipment || [])) &&
          (!videoOnly || hasVideo(e)));
        const filtered = (q ? pool.filter(e =>
          e.name.toLowerCase().includes(q) ||
          (e.aliases || []).some(a => a.toLowerCase().includes(q)) ||
          (e.primary_muscle || '').includes(q) ||
          (e.category || '').toLowerCase().includes(q) ||
          (e.pattern || '').includes(q) ||
          (e.equipment || []).some(x => x.includes(q))
        ) : pool).slice(0, 80);
        $list.innerHTML = filtered.map(e => {
          const isMatch = filterMuscle && e.primary_muscle === filterMuscle;
          const muscle = e.pattern ? tagLine(e) : e.primary_muscle ? e.primary_muscle.replace(/_/g, ' ') : (e.category || null);
          return `
            <div class="list-item" data-name="${e.name.replace(/"/g, '&quot;')}">
              <div style="flex:1">
                <div class="list-item-title">${e.name}</div>
                <div class="list-item-meta" style="text-transform:capitalize">${muscle || ''}${hasVideo(e) ? ' · ▶' : ''}</div>
              </div>
              ${isMatch ? '<span class="pill accent" style="font-size:10px">same</span>' : ''}
            </div>
          `;
        }).join('');
        $list.querySelectorAll('.list-item').forEach(item => {
          item.onclick = () => {
            const ex = sorted.find(x => x.name === item.dataset.name);
            close();
            resolve(ex);
          };
        });
      }
      $search.oninput = render;
      render();
      setTimeout(() => $search.focus(), 100);
      sheet.parentElement.addEventListener('click', e => {
        if (e.target === sheet.parentElement) { close(); resolve(null); }
      });
    });
  });
}

/**
 * Swap key for a program day. Week-based programs key on the day number alone so a
 * saved swap holds every week ("every time on this day"), not just the week it was made.
 */
function _sessionDayKey(session) {
  if (session.day_index != null) return `di${session.day_index}`;
  if (session.day != null) return `d${session.day}`;
  return null;
}

function _applySwaps(exercises, programId, dayKey, allSwaps, { week, day } = {}) {
  const forProgram = allSwaps?.[programId] || {};
  // Swaps saved before v58 were per week (wk{w}_d{d}); they still apply to that week.
  const daySwaps = { ...(forProgram[`wk${week}_d${day}`] || {}), ...(forProgram[dayKey] || {}) };
  if (!Object.keys(daySwaps).length) return exercises;
  return exercises.map(ex => {
    const newName = daySwaps[ex.orig_name || ex.name];
    return newName ? { ...ex, name: newName, swapped: true } : ex;
  });
}

async function _saveSwap(programId, dayKey, originalName, newName) {
  const swaps = (await pref('swaps')) || {};
  if (!swaps[programId]) swaps[programId] = {};
  if (!swaps[programId][dayKey]) swaps[programId][dayKey] = {};
  swaps[programId][dayKey][originalName] = newName;
  await pref('swaps', swaps);
}

function _offerPermanentSwap(originalName, newName, session, saveKey = originalName) {
  const dayKey = _sessionDayKey(session);
  if (!session.program_id || !dayKey) {
    renderWorkout(document.getElementById('app'));
    return;
  }
  openSheet((s, closeOffer, hooks) => {
    // However the prompt closes (buttons, backdrop, back gesture), redraw the swapped card.
    hooks.onClose = () => renderWorkout(document.getElementById('app'));
    s.innerHTML = `
      <div style="margin-bottom:16px">
        <div style="font-weight:600;font-size:15px">Save this swap?</div>
        <div class="muted" style="margin-top:6px;font-size:13px">Use <b>${newName}</b> instead of <b>${originalName}</b> every time on this day?</div>
      </div>
      <div class="btn-row">
        <button class="btn" id="swap-yes">Save for this day</button>
        <button class="btn ghost" id="swap-no">Just today</button>
      </div>
    `;
    s.querySelector('#swap-yes').onclick = async () => {
      await _saveSwap(session.program_id, dayKey, saveKey, newName);
      closeOffer();
      toast('Swap saved');
    };
    s.querySelector('#swap-no').onclick = () => {
      closeOffer();
    };
  });
}

function openExerciseMenu(session, i, allExercises, exMap) {
  const ex = session.exercises[i];
  const lookup = exMap[ex.name.toLowerCase()];
  const primaryMuscle = lookup?.primary_muscle || null;
  const muscleLabel = primaryMuscle ? primaryMuscle.replace(/_/g, ' ') : null;
  const bwsAlts = lookup?.bws_alternates || [];
  // The plan's own alternatives for this slot (plus the original, once swapped away from it).
  const rowVideo = !ex.swapped && ex.video_url ? ex.video_url : null;
  const clipVideo = rowVideo || hasVideo(lookup) ? { url: rowVideo || lookup?.video_url || null, row: !!rowVideo } : null;
  const planAlts = [...new Set([...(ex.swapped && ex.orig_name ? [ex.orig_name] : []), ...(ex.alternates || [])])]
    .filter(n => n !== ex.name && exMap[n.toLowerCase()]);
  openSheet((sheet, close) => {
    sheet.innerHTML = `
      <h2>${ex.name}</h2>
      <div class="muted" style="margin-bottom:14px">${formatTarget(ex)}${muscleLabel ? ' · ' + muscleLabel : ''}</div>

      <button class="btn" id="swap-all" style="margin-bottom:8px">🔄 Swap exercise</button>
      <div class="btn-row" style="margin-bottom:8px">
        <button class="btn secondary" id="add-set">+ Set</button>
        <button class="btn secondary" id="rm-set">− Set</button>
      </div>
      <div class="btn-row" style="margin-bottom:8px">
        <button class="btn ghost" id="ex-note">📝 ${ex.user_note ? 'Edit note' : 'Add note'}</button>
        <button class="btn ghost" id="ex-hurt">${ex.hurt ? '✓ Hurt today' : '🤕 This hurts'}</button>
      </div>
      <button class="btn ghost" id="ex-fav" style="margin-bottom:8px">${isFav(ex.name) ? '♥ Favourite (tap to remove)' : '♡ Favourite'}</button>
      ${loadedLift(lookup) ? '<button class="btn ghost" id="ex-plates" style="margin-bottom:8px">🏋 Plates & warm-up sets</button>' : ''}
      <button class="btn ghost" id="progression" style="margin-bottom:8px">📈 Progression chart</button>
      <button class="btn ghost" id="edit-target" style="margin-bottom:8px">Edit target reps/sets</button>
      ${clipVideo ? '<button class="btn ghost" id="clip-video" style="margin-bottom:8px">✂ Clip video</button>' : ''}
      <button class="btn danger" id="remove" style="margin-top:6px">🗑 Remove exercise</button>
    `;

    sheet.querySelector('#progression').onclick = () => {
      close(false);
      openProgressionChart(ex.name);
    };
    sheet.querySelector('#ex-plates')?.addEventListener('click', () => { close(false); openPlates(ex, lookup); });
    sheet.querySelector('#ex-fav').onclick = async () => {
      const on = await toggleFav(ex.name);
      close();
      toast(on ? 'Favourite: new plans pick it first' : 'Removed from favourites', 1800);
      renderWorkout(document.getElementById('app'), { keepRest: true });
    };
    // A note stays with this exercise and shows next time it comes up ("Last note: …").
    sheet.querySelector('#ex-note').onclick = () => {
      close(false);
      openSheet((s2, close2) => {
        s2.innerHTML = `<h2>Note · ${ex.name}</h2>
          <textarea id="n-text" rows="3" placeholder="e.g. hip pinched at depth, use the blue band, seat on 4" style="width:100%">${(ex.user_note || '').replace(/</g, '&lt;')}</textarea>
          <div class="btn-row" style="margin-top:12px"><button class="btn" id="n-save">Save</button><button class="btn ghost" id="n-cancel">Cancel</button></div>`;
        s2.querySelector('#n-cancel').onclick = close2;
        s2.querySelector('#n-save').onclick = async () => {
          ex.user_note = s2.querySelector('#n-text').value.trim() || undefined;
          await saveSession(session); close2(); renderWorkout(document.getElementById('app'), { keepRest: true });
        };
      });
    };
    // "This hurts" is remembered: twice for the same exercise and new plans leave it out (src/lib/learn.js).
    sheet.querySelector('#ex-hurt').onclick = async () => {
      ex.hurt = !ex.hurt || undefined;
      await saveSession(session);
      close();
      if (ex.hurt) toast('Noted. Swap it (⋯ → Swap) if it keeps hurting.', 2600);
      renderWorkout(document.getElementById('app'), { keepRest: true });
    };
    // Demo shows other moves too: play only this one's part (a one-off, so it lives here).
    sheet.querySelector('#clip-video')?.addEventListener('click', () => {
      close(false);
      openExerciseDetail({ name: ex.name, video_url: clipVideo.url, rowVideo: clipVideo.row, sets: formatTarget(ex) }, { startClip: true });
    });

    sheet.querySelector('#swap-all').onclick = () => {
      close(false);
      openSheet((s2, close2) => {
        // Same movement pattern first, then same main muscle (data/exercise_tags.json).
        const similarExercises = lookup?.pattern
          ? rankSimilar(lookup, allExercises)
          : primaryMuscle ? allExercises.filter(e => e.primary_muscle === primaryMuscle && e.name !== ex.name) : [];
        const planSection = planAlts.length ? `
          <div class="group-label" style="margin:0 0 6px">Plan alternatives</div>
          ${planAlts.map(name => {
            const alt = exMap[name.toLowerCase()];
            return `<div class="list-item" data-name="${name.replace(/"/g, '&quot;')}" style="cursor:pointer">
              <div style="flex:1">
                <div class="list-item-title">${name}${name === ex.orig_name ? ' <span class="pill" style="font-size:10px">original</span>' : ''}</div>
                <div class="list-item-meta" style="text-transform:capitalize">${alt?.pattern ? tagLine(alt) : (alt?.primary_muscle || '').replace(/_/g, ' ')}${hasVideo(alt) ? ' · ▶' : ''}</div>
              </div>
            </div>`;
          }).join('')}` : '';
        const bwsSection = bwsAlts.length ? `
          <div class="group-label" style="margin:0 0 6px">BWS alternates</div>
          ${bwsAlts.map(name => {
            const alt = exMap[name.toLowerCase()];
            const muscle = alt?.primary_muscle?.replace(/_/g, ' ') || '';
            return `<div class="list-item" data-name="${name.replace(/"/g, '&quot;')}" style="cursor:pointer">
              <div style="flex:1">
                <div class="list-item-title">${name}</div>
                <div class="list-item-meta">${muscle}${alt?.video_url ? ' · ▶' : ''}</div>
              </div>
            </div>`;
          }).join('')}` : '';
        const similarSection = similarExercises.length ? `
          <div class="group-label" style="margin:12px 0 6px">${lookup?.pattern ? 'Similar movement' : (muscleLabel || 'Similar')}</div>
          ${[...similarExercises].sort((a, b) => isFav(b.name) - isFav(a.name)).slice(0, 12).map(e =>
            `<div class="list-item" data-name="${e.name.replace(/"/g, '&quot;')}" style="cursor:pointer">
              <div style="flex:1">
                <div class="list-item-title">${isFav(e.name) ? '<span style="color:#f472b6">♥</span> ' : ''}${e.name}</div>
                <div class="list-item-meta" style="text-transform:capitalize">${e.pattern ? tagLine(e) : (e.primary_muscle?.replace(/_/g, ' ') || '')}${e.level ? ` · ${LEVEL_LABEL[e.level]}` : ''}${hasVideo(e) ? ' · ▶' : ''}</div>
              </div>
            </div>`
          ).join('')}` : '';
        // Moves that progress by variation (Griffith's way) offer the same movement one level easier / harder.
        const lv = (e) => (e?.level ? ` · ${LEVEL_LABEL[e.level]}` : '');
        const nb = progressesBy(lookup) === 'variation' ? levelNeighbors(lookup, allExercises) : { easier: [], harder: [] };
        const stepRow = (e) => `<div class="list-item" data-name="${e.name.replace(/"/g, '&quot;')}" style="cursor:pointer">
              <div style="flex:1">
                <div class="list-item-title">${e.name}</div>
                <div class="list-item-meta" style="text-transform:capitalize">${tagLine(e)}${lv(e)}${hasVideo(e) ? ' · ▶' : ''}</div>
              </div>
            </div>`;
        const levelSection = (nb.harder.length || nb.easier.length) ? `
          <div class="group-label" style="margin:0 0 6px">This move is ${LEVEL_LABEL[lookup.level || 2]} · progress with a harder version</div>
          ${nb.harder.length ? `<div class="list-item-meta" style="margin:4px 0">Harder</div>${nb.harder.map(stepRow).join('')}` : ''}
          ${nb.easier.length ? `<div class="list-item-meta" style="margin:8px 0 4px">Easier</div>${nb.easier.map(stepRow).join('')}` : ''}` : '';
        s2.innerHTML = `
          <h2>Swap: ${ex.name}</h2>
          ${planSection}
          ${levelSection}
          ${bwsSection}
          ${similarSection}
          <div class="group-label" style="margin:12px 0 6px">Any exercise</div>
          <input type="text" id="ex-filter" placeholder="Search all exercises…" autocomplete="off">
          <div id="ex-filter-results"></div>
        `;
        const doSwap = async (name) => {
          // Key saved swaps on the program's own name, so re-swapping a swap still sticks.
          const originalName = ex.orig_name || ex.name;
          if ((ex.sets || []).some(st => st?.done)) {
            // Logged sets belong to the old movement — keep it, add the swap after it.
            session.exercises.splice(i + 1, 0, {
              ...ex, name, orig_name: originalName, swapped: true, sets: [],
            });
          } else {
            ex.orig_name = originalName;
            ex.name = name;
            ex.swapped = true;
            ex.sets = [];
          }
          await saveSession(session);
          // The save-this-swap prompt opens straight after — close without syncing history,
          // or the back-navigation dismisses that prompt the moment it appears.
          close2(!(session.program_id && _sessionDayKey(session)));
          _offerPermanentSwap(originalName, name, session);
        };
        s2.querySelectorAll('.list-item[data-name]').forEach(item => {
          item.onclick = () => doSwap(item.dataset.name);
        });
        const $filter = s2.querySelector('#ex-filter');
        const $filterResults = s2.querySelector('#ex-filter-results');
        $filter.oninput = () => {
          const q = $filter.value.trim().toLowerCase();
          if (!q) { $filterResults.innerHTML = ''; return; }
          const hits = allExercises.filter(e => e.name.toLowerCase().includes(q)).slice(0, 10);
          $filterResults.innerHTML = hits.map(e =>
            `<div class="list-item" data-name="${e.name.replace(/"/g, '&quot;')}" style="cursor:pointer">
              <div class="list-item-title">${e.name}</div>
            </div>`
          ).join('');
          $filterResults.querySelectorAll('.list-item').forEach(item => {
            item.onclick = () => doSwap(item.dataset.name);
          });
        };
      });
    };

    sheet.querySelector('#add-set').onclick = async () => {
      ex.target_sets = (parseInt(ex.target_sets) || ex.sets.length) + 1;
      await saveSession(session);
      close();
      renderWorkout(document.getElementById('app'));
    };

    sheet.querySelector('#rm-set').onclick = async () => {
      if (parseInt(ex.target_sets) > 1) {
        ex.target_sets = parseInt(ex.target_sets) - 1;
        if (ex.sets.length > ex.target_sets) ex.sets.length = ex.target_sets;
      }
      await saveSession(session);
      close();
      renderWorkout(document.getElementById('app'));
    };

    sheet.querySelector('#edit-target').onclick = () => {
      openSheet((s2, close2) => {
        s2.innerHTML = `
          <h2>Edit target</h2>
          <label>Reps / rep range</label>
          <input type="text" id="t-reps" value="${ex.target_reps || ''}" placeholder="e.g. 8-12">
          <label>Sets</label>
          <input type="number" id="t-sets" inputmode="numeric" value="${parseInt(ex.target_sets) || 3}" min="1">
          <div class="btn-row" style="margin-top:14px">
            <button class="btn" id="t-save">Save</button>
            <button class="btn ghost" id="t-cancel">Cancel</button>
          </div>
        `;
        s2.querySelector('#t-cancel').onclick = close2;
        s2.querySelector('#t-save').onclick = async () => {
          const newReps = s2.querySelector('#t-reps').value.trim();
          const newSets = parseInt(s2.querySelector('#t-sets').value);
          if (newReps) ex.target_reps = newReps;
          if (newSets > 0) ex.target_sets = newSets;
          await saveSession(session);
          close2();
          close();
          renderWorkout(document.getElementById('app'));
        };
        setTimeout(() => s2.querySelector('#t-reps').focus(), 100);
      });
    };

    sheet.querySelector('#remove').onclick = () => {
      openSheet((s2, close2) => {
        s2.innerHTML = `
          <h2>Remove exercise?</h2>
          <div class="muted" style="margin-bottom:14px">${ex.name} and all its logged sets will be removed from this session.</div>
          <div class="btn-row">
            <button class="btn danger" id="confirm-rm">Remove</button>
            <button class="btn ghost" id="cancel-rm">Cancel</button>
          </div>
        `;
        s2.querySelector('#cancel-rm').onclick = close2;
        s2.querySelector('#confirm-rm').onclick = async () => {
          session.exercises.splice(i, 1);
          await saveSession(session);
          close2();
          close();
          renderWorkout(document.getElementById('app'));
        };
      });
    };
  });
}

function weekKey(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const thu = new Date(d);
  thu.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 3);
  const jan4 = new Date(thu.getFullYear(), 0, 4);
  const wn = 1 + Math.round((thu - jan4) / 604800000);
  return `${thu.getFullYear()}-W${String(wn).padStart(2, '0')}`;
}

function weekLabel(wk) {
  const [yr, wp] = wk.split('-W');
  return `Wk ${parseInt(wp)}, ${yr}`;
}

function progressionSparkline(points) {
  if (points.length < 2) return '';
  const w = 320, h = 72, pad = 6;
  const vals = points.map(p => p.e1rm);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const xs = (i) => pad + (i / (points.length - 1)) * (w - pad * 2);
  const ys = (v) => h - pad - ((v - min) / range) * (h - pad * 2);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xs(i).toFixed(1)} ${ys(p.e1rm).toFixed(1)}`).join(' ');
  const dots = points.map((p, i) => `<circle cx="${xs(i).toFixed(1)}" cy="${ys(p.e1rm).toFixed(1)}" r="3" fill="#4ade80"/>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;margin-top:4px">
    <path d="${path}" fill="none" stroke="#4ade80" stroke-width="2"/>
    ${dots}
  </svg>`;
}

export async function openProgressionChart(exName) {
  const all = await getAll('sessions');
  const weekBests = {};
  for (const s of all) {
    if (!s.done || !s.date) continue;
    for (const ex of (s.exercises || [])) {
      if (ex.name !== exName) continue;
      for (const set of (ex.sets || [])) {
        if (!set?.done || !set?.weight || !set?.reps) continue;   // typed but never ticked doesn't count
        const e = rpeE1RM(set.weight, set.reps, set.rpe);
        if (e <= 0) continue;
        const wk = weekKey(s.date);
        if (e > (weekBests[wk] ?? 0)) weekBests[wk] = e;
      }
    }
  }
  const sortedKeys = Object.keys(weekBests).sort().slice(-16);

  openSheet((sheet, close) => {
    if (!sortedKeys.length) {
      sheet.innerHTML = `
        <h2>${exName}</h2>
        <div class="muted" style="margin-top:8px">No logged sets yet — check back after your first session.</div>
      `;
      return;
    }

    const points = sortedKeys.map(wk => ({ wk, e1rm: weekBests[wk] }));
    const allTime = Math.max(...points.map(p => p.e1rm));
    const latest = points[points.length - 1].e1rm;
    const change = latest - points[0].e1rm;

    sheet.innerHTML = `
      <h2>${exName}</h2>
      <div class="muted" style="margin-bottom:12px">e1RM · last ${points.length} week${points.length !== 1 ? 's' : ''}</div>

      <div class="card-row" style="margin-bottom:4px">
        <div>
          <div class="muted" style="font-size:11px">All-time best</div>
          <div style="font-size:22px;font-weight:700">${allTime} lb</div>
        </div>
        <div>
          <div class="muted" style="font-size:11px">Change</div>
          <div style="font-size:22px;font-weight:700;color:${change >= 0 ? 'var(--accent)' : 'var(--warn)'}">${change >= 0 ? '+' : ''}${change} lb</div>
        </div>
        <div>
          <div class="muted" style="font-size:11px">Latest</div>
          <div style="font-size:22px;font-weight:700">${latest} lb</div>
        </div>
      </div>

      ${progressionSparkline(points)}

      <div style="margin-top:16px">
        <div class="group-label" style="margin-bottom:6px">Weekly bests</div>
        ${points.slice().reverse().map(p => `
          <div class="list-item" style="cursor:default">
            <div style="flex:1;font-size:14px">${weekLabel(p.wk)}</div>
            <div style="font-size:14px;font-weight:600;color:${p.e1rm === allTime ? 'var(--accent)' : 'var(--fg)'}">${p.e1rm} lb${p.e1rm === allTime ? ' ★' : ''}</div>
          </div>
        `).join('')}
      </div>
    `;
  });
}

async function buildPrevReference(programId, currentSessionId, todayStr) {
  const all = await getAll('sessions');

  // All-time best e1RM per exercise across every completed session (all programs)
  const bestE1RM = {};
  for (const s of all) {
    if (!s.done || s.id === currentSessionId) continue;
    for (const ex of (s.exercises || [])) {
      for (const set of (ex.sets || [])) {
        if (!set?.done || !set.weight || !set.reps) continue;
        const e = rpeE1RM(set.weight, set.reps, set.rpe);
        if (e > (bestE1RM[ex.name] ?? 0)) bestE1RM[ex.name] = e;
      }
    }
  }

  // Most recent same-program sets per exercise (for the "Last: …" reference display)
  const past = all
    .filter(s => s.program_id === programId && s.id !== currentSessionId && s.date < todayStr && s.done && !s.skipped)
    .sort((a, b) => b.date.localeCompare(a.date));

  // Every program's sessions, newest first, up to 3 per exercise: what the next-session targets
  // (src/lib/adapt.js) work from. The same lift logged in another plan still counts.
  const history = {};
  const allDone = all.filter(s => s.id !== currentSessionId && s.date < todayStr && s.done && !s.skipped)
    .sort((a, b) => b.date.localeCompare(a.date));
  _notes = {};
  for (const s of allDone) for (const ex of (s.exercises || [])) if (ex.user_note && !(ex.name in _notes)) _notes[ex.name] = ex.user_note;
  for (const s of allDone) for (const ex of (s.exercises || [])) {
    const sets = (ex.sets || []).filter(st => st?.done && st.reps);
    if (!sets.length) continue;
    const h = (history[ex.name] ||= []);
    if (h.length < 3 && h[h.length - 1]?.date !== s.date) h.push({ date: s.date, sets });
  }

  const ref = {};
  for (const s of past) {
    for (const ex of (s.exercises || [])) {
      if (ref[ex.name]) continue;
      // Keep set positions so last time's set 2 pre-fills set 2; only sets actually done.
      const sets = (ex.sets || []).map(st => (st?.done && (st.weight || st.reps)) ? st : {});
      if (sets.some(st => st.weight || st.reps)) {
        ref[ex.name] = { sets, date: s.date };
      }
    }
  }
  return { ref, bestE1RM, history, profile: learnProfile(all, { today: todayStr }) };
}

let _history = {};
let _profile = null;
// Moves done today somewhere else (another workout, the hip plan): src/lib/same_move.js.
let _elsewhere = new Map();
let _sessionId = null;
function elsewhereHtml(ex) {
  const credit = (ex.sets || []).find(st => st?.done && st.credit)?.credit;
  if (credit) return `<div style="font-size:12px;margin-top:3px;color:var(--fg-dim)">✓ Counted from ${esc(credit)}</div>`;
  if ((ex.sets || []).some(st => st?.done)) return '';
  const hit = doneElsewhere(ex.name, _elsewhere, _sessionId);
  if (!hit) return '';
  return `<div class="done-elsewhere" style="font-size:12px;margin-top:3px;color:var(--accent)">✓ Done today in ${esc(hit.label)}
    <button type="button" class="pill accent credit-btn" data-where="${esc(hit.label)}" style="cursor:pointer;font-size:11px;padding:3px 8px;margin-left:4px">Mark done</button></div>`;
}
let _notes = {};   // last note written on each exercise
let _clock = null;
let _learned = null;   // coach-program numbers (data/learned_patterns.json), for gym swaps
const _loadLearned = async () => (_learned ||= await fetch('data/learned_patterns.json').then(r => r.json()).catch(() => ({})));
let _tickClock = () => {};
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
/** Next-session target for a lift from its logged history (null for timed work or nothing logged). */
function targetFor(ex, lookup) {
  if (isTimed(ex) || ex.intervals) return null;
  return nextTarget({ history: _history[ex.name] || [], target: ex.target_reps, sets: parseInt(ex.target_sets) || 3,
                      equipment: lookup?.equipment || [], today: today(), profile: _profile });
}

function formatPrevSets(sets) {
  return sets
    .filter(s => s && (s.weight || s.reps))
    .map(s => [s.weight ? `${s.weight}lb` : null, s.reps ? `×${s.reps}` : null].filter(Boolean).join(''))
    .join('  ');
}

/**
 * The rest timer. Logging a set starts it. With a prescribed rest it counts down with FKH's
 * cues (Rest, a warning at 15 s, 5-4-3-2-1, Begin) and then counts the overtime; without one
 * it counts up. It draws into every `.rest-live` element on screen, so it keeps going on the
 * next exercise's sheet after Next →, and on the card again if the sheet is closed.
 */
let _rest = null;   // { start, target, last, i, key }
let _restKey = null;  // which workout the Lift tab shows
function stopRestTimer() {
  if (_restInterval) { clearInterval(_restInterval); _restInterval = null; }
  _rest = null;
  document.querySelectorAll('.rest-timer-line, .rest-live').forEach(el => { el.innerHTML = ''; });
  document.getElementById('rest-float')?.remove();
}

/** −15 s / +15 s: a countdown moves its target; a count-up (no prescribed rest) gets one. */
function adjustRest(delta) {
  if (!_rest) return;
  const elapsed = Math.floor((Date.now() - _rest.start) / 1000);
  _rest.target = Math.max(elapsed + 1, (_rest.target || Math.max(elapsed, 60)) + delta);
  _rest.last = null;
  paintRest();
}
const REST_BTN = 'class="btn ghost" style="width:auto;min-height:0;padding:2px 8px;font-size:11px;margin-left:4px"';
const restControls = () => `<button type="button" data-rest="-15" ${REST_BTN}>−15</button><button type="button" data-rest="15" ${REST_BTN}>+15</button><button type="button" data-rest="skip" ${REST_BTN}>Skip</button>`;
function wireRestControls(el) {
  el.querySelectorAll('[data-rest]').forEach(b => b.onclick = (e) => {
    e.stopPropagation();
    if (b.dataset.rest === 'skip') stopRestTimer(); else adjustRest(+b.dataset.rest);
  });
}

function paintRest() {
  if (!_rest) return;
  const sec = Math.floor((Date.now() - _rest.start) / 1000);
  let text;
  if (_rest.target) {
    const left = _rest.target - sec;
    if (left !== _rest.last) {
      _rest.last = left;
      if (left === TIMER_REST_WARN_SECS && _rest.target > TIMER_REST_WARN_SECS) timerAlert('warn');
      else if (left >= 1 && left <= TIMER_WARN_SECS) timerAlert('count', left);
      else if (left === 0) timerAlert('begin');
    }
    text = left > 0 ? `rest ${fmtSecs(left)}` : `go! · rest +${fmtSecs(-left)}`;
  } else {
    text = `rest ${fmtSecs(sec)}`;
  }
  // Away from the Lift tab (meals, a chart…), the timer keeps going in a pill above the tab bar.
  const away = !/workout/.test(location.hash);
  let $float = document.getElementById('rest-float');
  if (away && !$float) {
    $float = document.createElement('div');
    $float.id = 'rest-float';
    $float.className = 'rest-live rest-float';
    document.body.appendChild($float);
    $float.addEventListener('click', (e) => { if (!e.target.closest('[data-rest]')) location.hash = '#/workout'; });
  } else if (!away && $float) { $float.remove(); }
  document.querySelectorAll('.rest-live').forEach(el => {
    let $t = el.querySelector('.rest-timer-text');
    if (!$t) {
      el.innerHTML = `<span class="rest-timer-text"></span>${restControls()}`;
      wireRestControls(el);
      $t = el.querySelector('.rest-timer-text');
    }
    $t.textContent = el.id === 'rest-float' ? `⏱ ${text}` : text;
    el.classList.toggle('rest-over', !!_rest.target && sec >= _rest.target);
  });
}

function startRestTimer(card, ex) {
  stopRestTimer();
  document.querySelectorAll('.rest-timer-line.rest-live').forEach(el => el.classList.remove('rest-live'));
  card.querySelector('.rest-timer-line')?.classList.add('rest-live');
  _rest = { start: Date.now(), target: parseRestSeconds(ex?.rest), last: null, i: +card.dataset.i, key: _restKey };
  if (_rest.target) timerAlert('rest');
  paintRest();
  _restInterval = setInterval(paintRest, 250);
}

// ── Plates and warm-up sets ──────────────────────────────────────────────────────────────
const BAR_LB = { barbell: 45, smith: 25, trap_bar: 55, landmine: 0 };
const PLATES_LB = [45, 35, 25, 10, 5, 2.5];
const loadedLift = (lookup) => (lookup?.equipment || []).some(q => q in BAR_LB || q === 'dumbbell' || q === 'kettlebell' || q === 'machine' || q === 'cable');
/** Plates per side for a bar weight: [45, 25, 2.5] for 190 on a 45 lb bar. */
function platesFor(total, bar = 45) {
  let side = Math.max(0, (total - bar) / 2);
  const out = [];
  for (const p of PLATES_LB) while (side >= p - 1e-9) { out.push(p); side -= p; }
  return { plates: out, leftover: Math.round(side * 2 * 10) / 10 };
}
/** Ramp to the working weight (BWS/Nippard: lighter sets with fewer reps as load climbs). */
function warmupRamp(work, step = 5, bar = 0) {
  const r = (x) => Math.max(bar, Math.round(x / step) * step);
  const ramp = work >= 135 ? [[0.5, 8], [0.7, 4], [0.85, 2], [0.95, 1]] : work >= 60 ? [[0.5, 8], [0.75, 3], [0.9, 1]] : [[0.6, 8]];
  return ramp.map(([f, reps]) => ({ weight: r(work * f), reps })).filter((x, i, a) => x.weight < work && (!i || x.weight > a[i - 1].weight));
}
function openPlates(ex, lookup) {
  const eq = lookup?.equipment || [];
  const barKey = Object.keys(BAR_LB).find(q => eq.includes(q));
  const bar = barKey ? BAR_LB[barKey] : 0;
  const t = targetFor(ex, lookup);
  const lastW = Math.max(0, ...(_history[ex.name]?.[0]?.sets || []).map(st => +st.weight || 0));
  let work = (ex.sets || []).find(st => st?.weight)?.weight || t?.weight || lastW || (bar ? 135 : 30);
  openSheet((sheet, close) => {
    const paint = () => {
      const step = barKey ? 5 : eq.includes('dumbbell') && work < 15 ? 2.5 : 5;
      const ramp = warmupRamp(work, step, bar);
      const plateStr = (w) => { if (!barKey || !bar) return ''; const { plates, leftover } = platesFor(w, bar);
        return plates.length ? ` · <span class="muted">${plates.join(' + ')} a side${leftover ? ` (+${leftover})` : ''}</span>` : ' · <span class="muted">empty bar</span>'; };
      sheet.innerHTML = `<h2>${esc(ex.name)}</h2>
        <label>Working weight (lb)</label>
        <div style="display:flex;gap:6px;align-items:center"><button class="btn ghost" data-w="-5" style="width:auto">−5</button>
          <input type="number" id="pl-w" inputmode="decimal" value="${work}" style="text-align:center;font-size:18px">
          <button class="btn ghost" data-w="5" style="width:auto">+5</button></div>
        ${barKey && bar ? `<div style="margin:12px 0;font-size:16px"><b>${work} lb</b> on a ${bar} lb ${barKey.replace('_', ' ')}${plateStr(work)}</div>` : '<div style="height:10px"></div>'}
        <div class="group-label">Warm-up sets</div>
        ${ramp.length ? ramp.map(x => `<div class="list-item" style="padding:8px 0"><div style="flex:1">${x.weight} lb × ${x.reps}${plateStr(x.weight)}</div></div>`).join('')
          : '<div class="muted">Light enough to start with a set of 8 at about half.</div>'}
        <div class="muted" style="font-size:12px;margin-top:8px">Short rest between warm-up sets. They don't count as working sets.</div>
        <button class="btn" id="pl-close" style="margin-top:14px">Done</button>`;
      sheet.querySelector('#pl-close').onclick = close;
      sheet.querySelector('#pl-w').onchange = (e) => { work = Math.max(0, +e.target.value || 0); paint(); };
      sheet.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { work = Math.max(0, work + +b.dataset.w); paint(); });
    };
    paint();
  });
}

/** "Set 2 logged · Undo" for a few seconds: a mis-tap shouldn't land in the logs the app learns from. */
let _undoTimer = null;
function showUndo(btn, session, i, setIdx) {
  document.getElementById('undo-toast')?.remove();
  clearTimeout(_undoTimer);
  const el = document.createElement('div');
  el.id = 'undo-toast';
  el.className = 'undo-toast';
  el.innerHTML = `<span>Set ${setIdx + 1} logged</span><button type="button">Undo</button>`;
  document.body.appendChild(el);
  el.querySelector('button').onclick = async () => {
    el.remove();
    if (btn.isConnected && btn.closest('.set-row')?.classList.contains('done')) { btn.click(); return; }   // the normal un-check path
    const set = session.exercises[i]?.sets?.[setIdx];
    if (!set?.done) return;
    set.done = false; delete set.at;
    if (_rest?.i === i) stopRestTimer();
    await saveSession(session);
    renderWorkout(document.getElementById('app'), { keepRest: true });
  };
  _undoTimer = setTimeout(() => el.remove(), 5000);
}

function applyCompactState(card, ex) {
  const targetSets = parseInt(ex.target_sets) || 3;
  const doneCount = (ex.sets || []).filter(s => s?.done).length;
  if (doneCount < targetSets) return;
  const $summary = card.querySelector('.exercise-summary');
  if ($summary) {
    const doneSets = (ex.sets || []).filter(s => s?.done && s.weight && s.reps);
    if (doneSets.length) {
      const best = doneSets.reduce((b, s) => {
        const e = rpeE1RM(s.weight, s.reps, s.rpe);
        return e > b.e1rm ? { set: s, e1rm: e } : b;
      }, { set: doneSets[0], e1rm: 0 });
      const e1rmPart = best.e1rm > 0 ? ` · ~${best.e1rm} lb` : '';
      $summary.textContent = `${doneCount} sets · ${best.set.weight} × ${best.set.reps}${e1rmPart}`;
    } else {
      $summary.textContent = `${doneCount} sets`;
    }
    $summary.style.display = 'block';
  }
  card.classList.add('exercise--compact');
}

function exerciseCard(ex, i, exMap, prevRef = {}, allTimeBestE1RM = {}) {
  const sets = Math.max(parseInt(ex.target_sets) || 3, ex.sets.length);
  const lookup = exMap[ex.name.toLowerCase()];
  const ytSearch = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(ex.name);
  // A row's own video (e.g. the follow-along it comes from) wins, unless the exercise was swapped.
  const rowVideo = !ex.swapped && ex.video_url ? ex.video_url : null;
  const _ytId = ytVideoId(rowVideo || lookup?.video_url);
  const _start = (String(rowVideo || '').match(/[?&](?:t|start)=(\d+)/) || [])[1] || '';
  const videoLink = (rowVideo && _ytId) ? `<button class="video-link has-video" data-row="1" data-ytid="${_ytId}" data-start="${_start}" data-ytname="${ex.name.replace(/"/g, '&quot;')}"
        data-target="${formatTarget(ex).replace(/"/g, '&quot;')}" data-notes="${String(ex.notes || '').replace(/"/g, '&quot;')}">▶ Video</button>`
    : _ytId || playable(localFor(ex.name))
    ? `<button class="video-link has-video" data-ytid="${_ytId || ''}" data-ytname="${ex.name.replace(/"/g, '&quot;')}"
        data-target="${formatTarget(ex).replace(/"/g, '&quot;')}"
        data-last="${prevRef[ex.name] ? ('Last: ' + formatPrevSets(prevRef[ex.name].sets) + ' (' + prevRef[ex.name].date + ')').replace(/"/g, '&quot;') : ''}"
        data-notes="${String(ex.notes || '').replace(/"/g, '&quot;')}">▶ Video</button>`
    : lookup?.video_url
      ? `<a class="video-link has-video" href="${lookup.video_url}" target="_blank">▶ Video</a>`
      : `<a class="video-link" href="${lookup?.fallback_search || ytSearch}" target="_blank">🔍 Find</a>`;

  const prevSets = prevRef[ex.name]?.sets || [];
  let setRows = '';
  const timed = isTimed(ex);
  const next = targetFor(ex, lookup);
  const target = parseSecs(ex.time);
  for (let s = 0; s < sets && timed; s++) {
    const set = ex.sets[s] || {};
    setRows += `
      <div class="set-row timed ${set.done ? 'done' : ''}">
        <span class="set-num">${s + 1}</span>
        <span class="timed-target">${set.secs ? fmtSecs(set.secs) : fmtSecs(target)}${ex.intervals ? '<small class="muted"> round</small>' : sidesOf(ex) ? `<small class="muted"> each ${sidesOf(ex)}</small>` : ''}</span>
        <button class="timer-btn" data-set="${s}" data-secs="${target}">▶ Start</button>
        <button class="check" data-set="${s}">${set.done ? '✓' : '○'}</button>
      </div>`;
  }
  for (let s = 0; s < sets && !timed; s++) {
    const set = ex.sets[s] || {};
    const prev = prevSets[s] || {};
    const done = set.done ? 'done' : '';
    // Pre-fill with the next-session target (src/lib/adapt.js), else the previous session's set
    const wVal = set.weight ?? (next?.weight ?? prev.weight) ?? '';
    const rVal = set.reps   ?? (next ? next.reps : prev.reps) ?? '';
    const wPh  = wVal === '' ? 'lb'   : '';
    const rPh  = rVal === '' ? 'reps' : '';
    setRows += `
      <div class="set-row ${done}">
        <span class="set-num">${s+1}</span>
        <input class="set-input" type="number" inputmode="decimal" placeholder="${wPh}" data-set="${s}" data-field="weight" value="${wVal}">
        <button class="inc-btn" data-set="${s}">+5</button>
        <input class="set-input" type="number" inputmode="numeric" placeholder="${rPh}" data-set="${s}" data-field="reps" value="${rVal}">
        <button class="rpe-btn" data-set="${s}">${set.rpe ? '@' + set.rpe : 'RPE'}</button>
        <button class="check" data-set="${s}">${set.done ? '✓' : '○'}</button>
      </div>
    `;
  }

  // Pre-compute e1RM from any already-done sets (resumed session)
  const existingDone = (ex.sets || []).filter(s => s?.done && s.weight && s.reps);
  let initialE1RM = '';
  if (existingDone.length) {
    const bestE = Math.max(...existingDone.map(s => rpeE1RM(s.weight, s.reps, s.rpe)));
    if (bestE > 0) {
      const isPR = (allTimeBestE1RM[ex.name] ?? 0) > 0 && bestE > allTimeBestE1RM[ex.name];
      initialE1RM = isPR
        ? `<span style="color:var(--accent)">~${bestE} lb e1RM ★ PR</span>`
        : `<span style="color:var(--fg-dim)">~${bestE} lb e1RM</span>`;
    }
  }

  const card = document.createElement('div');
  card.className = 'exercise';
  card.dataset.i = i;
  card.innerHTML = `
    <div class="exercise-header">
      <div style="flex:1">
        <div class="exercise-name">${ex.name}${isFav(ex.name) ? ' <span style="color:#f472b6;font-size:13px">♥</span>' : ''}${ex.swapped ? ' <span class="pill" style="font-size:10px">swapped</span>' : ''}${ex.added ? ' <span class="pill accent" style="font-size:10px">added</span>' : ''}${ex.hurt ? ' <span class="pill" style="font-size:10px;color:var(--danger)">hurt</span>' : ''}</div>
        ${lookup?.pattern ? `<div class="ex-tagline" style="font-size:11px;color:var(--fg-dim);margin-top:1px;text-transform:capitalize">${tagLine(lookup)}</div>` : ''}
        <div class="exercise-target">${formatTarget(ex)}</div>
        ${elsewhereHtml(ex)}
        ${prevRef[ex.name] ? `<div class="muted" style="font-size:11px;margin-top:2px">Last: ${formatPrevSets(prevRef[ex.name].sets)} <span style="opacity:0.6">(${prevRef[ex.name].date})</span></div>` : ''}
        ${ex.user_note ? `<div style="font-size:12px;margin-top:2px">📝 ${esc(ex.user_note)}</div>`
          : _notes[ex.name] ? `<div class="muted" style="font-size:11px;margin-top:2px">📝 Last note: ${esc(_notes[ex.name])}</div>` : ''}
        ${next ? `<div class="next-line" style="font-size:11px;margin-top:2px;color:${next.kind === 'down' || next.kind === 'back' ? 'var(--fg-dim)' : 'var(--accent)'}">Today: ${next.weight ? `${next.weight} lb × ` : ''}${next.reps} · ${next.note}${
          next.addSet && !ex.set_added ? ' <button type="button" class="pill accent add-set-sugg" style="cursor:pointer;font-size:11px;padding:3px 8px;margin-left:4px">+1 set</button>' : ''}</div>` : ''}
        <div class="e1rm-line" style="font-size:12px;margin-top:2px">${initialE1RM}</div>
        <div class="rest-timer-line" style="min-height:14px"></div>
        <div class="exercise-summary"></div>
      </div>
      <div style="display:flex;gap:6px">
        ${videoLink}
        <button class="ex-menu" style="background:var(--bg-input);border:1px solid var(--border);color:var(--fg);border-radius:8px;padding:6px 10px;font-size:14px">⋯</button>
      </div>
    </div>
    ${setRows}
    ${ex.notes ? `<div class="muted ex-notes" style="margin-top:6px">${ex.notes}</div>` : ''}
  `;
  applyCompactState(card, ex);
  return card;
}

/** "2 × 5 each way", "5 × 0:08", "4 × 50 ft": what the FKH row and detail show. */
function bandRx(ex) {
  const n = +ex.target_sets || 1;
  const secs = isTimed(ex) ? parseSecs(ex.time) : 0;
  return `${n} × ${secs ? fmtSecs(secs) : (ex.target_reps || 'Done')}`;
}

const bandSetsDone = (ex) => Array.from({ length: +ex.target_sets || 1 }, (_, k) => !!ex.sets?.[k]?.done);

function renderBandList($ex, session, exMap) {
  const asEx = (ex, i) => {
    const lib = exMap[ex.name.toLowerCase()] || {};
    return { id: `b${i}`, name: ex.name, video_url: lib.video_url, subtitle: lib.category,
      notes: ex.notes, source: 'PJF band' };
  };
  const paint = () => {
    let html = '', lastGroup = null;
    session.exercises.forEach((ex, i) => {
      const grp = ex.round_group;
      if (grp && grp !== lastGroup) html += `<div class="group-label">${prettyGroup(grp)}</div>`;
      lastGroup = grp || null;
      const sets = bandSetsDone(ex);
      html += `<div style="margin-bottom:8px">${exerciseRowHTML(asEx(ex, i), {
        key: String(i), rx: bandRx(ex), sets, done: sets.every(Boolean), accent: '#22c55e' })}</div>`;
    });
    $ex.innerHTML = html;
    wireExerciseRows($ex, { open: (k) => openDetail(+k), check: (k) => toggleAll(+k) });
  };
  const setAll = async (i, v) => {
    const ex = session.exercises[i];
    for (let k = 0; k < (+ex.target_sets || 1); k++) setAt(ex, k).done = v;
    await saveSession(session);
  };
  const toggleAll = async (i) => { await setAll(i, !bandSetsDone(session.exercises[i]).every(Boolean)); paint(); };
  function openDetail(i) {
    const ex = session.exercises[i];
    const secs = isTimed(ex) ? parseSecs(ex.time) : 0;
    openExerciseDetail(asEx(ex, i), {
      accent: '#22c55e',
      rx: bandRx(ex),
      sets: {
        get: () => bandSetsDone(ex),
        save: async (arr) => { arr.forEach((d, k) => { setAt(ex, k).done = d; }); await saveSession(session); paint(); },
      },
      isDone: () => bandSetsDone(ex).every(Boolean),
      setDone: async (v) => { await setAll(i, v); paint(); },
      next: () => {
        const order = [...session.exercises.keys()];
        const j = [...order.slice(i + 1), ...order.slice(0, i)]
          .find(k => !bandSetsDone(session.exercises[k]).every(Boolean));
        return j == null ? null : { name: session.exercises[j].name, open: () => openDetail(j) };
      },
      completeLabel: 'Every exercise done. Tap Finish workout',
      autoNext: true,
      extraHTML: secs ? `<button class="btn ghost hold-timer" data-secs="${secs}" data-sides="${sidesOf(ex) || ''}" style="margin-top:10px">▶ Start ${fmtSecs(secs)}${sidesOf(ex) ? ' each ' + sidesOf(ex) : ''}</button>` : '',
    });
  }
  paint();
  // Start workout on a band day: the first exercise not yet done.
  return () => {
    const j = session.exercises.findIndex(x => !bandSetsDone(x).every(Boolean));
    openDetail(j < 0 ? 0 : j);
  };
}

// Hold / interval countdown inside a band exercise's detail sheet.
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.hold-timer');
  if (!btn) return;
  if (_setTimer?.btn === btn) { stopSetTimer(); return; }   // tap again = stop
  btn.dataset.idle ??= btn.textContent;
  runWorkTimer(btn, { secs: +btn.dataset.secs || 0, unit: btn.dataset.sides || null, idle: btn.dataset.idle,
    onDone: () => { btn.textContent = '✓ Done · ▶ again'; } });
});

function formatTarget(ex) {
  if (ex.intervals) {
    return [`${ex.target_sets} rounds`, ex.intervals.map(p => `${fmtSecs(p.secs)} ${p.label}`).join(' / '),
      ex.rest ? `rest ${ex.rest}` : ''].filter(Boolean).join(' · ');
  }
  const parts = [];
  if (ex.target_sets) parts.push(`${ex.target_sets} set${+ex.target_sets === 1 ? '' : 's'}`);
  if (ex.target_reps) parts.push(`× ${ex.target_reps}`);
  if (ex.time) parts.push((parseSecs(ex.time) ? fmtSecs(parseSecs(ex.time)) : ex.time) + (sidesOf(ex) ? ` each ${sidesOf(ex)}` : ''));
  if (ex.rest) parts.push(`rest ${ex.rest}`);
  return parts.join(' · ');
}

function prettyGroup(g) {
  if (!g) return '';
  if (typeof g === 'string') {
    if (/^\d+\s*round/i.test(g.trim()) || /^-\s*\d+\s*round/i.test(g.trim())) return g.trim().replace(/^-\s*/, '');
    return g;
  }
  return String(g);
}

async function openRPEPicker(card, setIdx, session, i) {
  openSheet((sheet, close) => {
    sheet.innerHTML = `
      <h2>RPE</h2>
      <div class="muted" style="margin-bottom:10px">How hard was that set?</div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px">
        ${[6, 7, 7.5, 8, 8.5, 9, 9.5, 10].map(n => `<button class="btn ghost" data-rpe="${n}">@${n}</button>`).join('')}
      </div>
    `;
    sheet.querySelectorAll('button[data-rpe]').forEach(b => {
      b.onclick = async () => {
        const set = setAt(session.exercises[i], setIdx);
        set.rpe = +b.dataset.rpe;
        await saveSession(session);
        const btn = card.querySelector(`button.rpe-btn[data-set="${setIdx}"]`);
        if (btn) btn.textContent = `@${set.rpe}`;
        close();
      };
    });
  });
}

function pickDay(program, week, day, day_index) {
  if (program.weeks) {
    const w = program.weeks.find(x => x.week_num === week);
    if (!w) return null;
    return w.days.find(d => d.day_num === day) || w.days[Math.min(day - 1, w.days.length - 1)];
  }
  if (program.days) {
    if (day_index != null) return program.days[day_index] || program.days[0];
    return program.days[(day - 1) % program.days.length];
  }
  return null;
}

async function renderTagDay(app, today_w) {
  const map = {
    'Rest':   { icon: '😴', txt: 'Rest day', sub: 'Recovery, stretching, walking — anything light is fine.' },
    'Cardio': { icon: '🏃', txt: 'Zone 2 cardio', sub: 'Log steady-state on the Move tab.' },
    'Custom': { icon: '✏️', txt: 'Free-form session', sub: 'Add exercises and log as you go.' },
    'Basketball': { icon: '🏀', txt: 'Basketball day', sub: 'Warm up, play, then mark it Played or Didn\'t play on Today.' },
  };
  const m = map[today_w.tag] || { icon: '·', txt: today_w.tag, sub: '' };
  app.innerHTML = `
    <h1>${m.icon} ${m.txt}</h1>
    <div class="muted">${m.sub}</div>
    <div class="btn-row" style="margin-top:14px">
      ${today_w.tag === 'Basketball' ? '<button class="btn" id="mob-hoops">🏀 Basketball warm-up →</button>' : ''}
      ${(await dailyWorkout()) ? `<button class="btn${today_w.tag === 'Basketball' ? ' ghost' : ''}" id="mob-daily">Daily Mobility →</button>` : ''}
      <button class="btn ghost" id="mob-move">Move tab</button>
      <button class="btn ghost" id="back">Today</button>
    </div>
  `;
  app.querySelector('#mob-hoops')?.addEventListener('click', () => navigate('routine/basketball_warmup'));
  const $daily = app.querySelector('#mob-daily');
  if ($daily) $daily.onclick = () => navigate('daily');
  app.querySelector('#back').onclick = () => navigate('home');
  app.querySelector('#mob-move').onclick = () => navigate('cardio');
}

function computeSessionStats(session, allSessions) {
  // All-time best e1RM per exercise from every other completed session
  const allTimeBest = {};
  for (const s of allSessions) {
    if (!s.done || s.id === session.id) continue;
    for (const ex of (s.exercises || [])) {
      for (const set of (ex.sets || [])) {
        if (!set?.done || !set.weight || !set.reps) continue;
        const e = rpeE1RM(set.weight, set.reps, set.rpe);
        if (e > (allTimeBest[ex.name] ?? 0)) allTimeBest[ex.name] = e;
      }
    }
  }

  let totalSets = 0, totalVolume = 0;
  const exerciseSummaries = [], prs = [];

  for (const ex of session.exercises) {
    const checked = (ex.sets || []).filter(s => s?.done);
    if (!checked.length) continue;
    totalSets += checked.length;
    const doneSets = checked.filter(s => s.weight || s.reps);
    if (!doneSets.length) {
      exerciseSummaries.push({ name: ex.name, bestSet: null, bestE1RM: 0, setsCompleted: checked.length });
      continue;
    }
    totalVolume += doneSets.reduce((sum, s) => sum + (s.weight || 0) * (s.reps || 0), 0);

    let bestSet = null, bestE1RM = 0;
    for (const set of doneSets) {
      const e = rpeE1RM(set.weight, set.reps, set.rpe);
      if (e > bestE1RM) { bestE1RM = e; bestSet = set; }
    }

    exerciseSummaries.push({ name: ex.name, bestSet, bestE1RM, setsCompleted: doneSets.length });

    const prev = allTimeBest[ex.name] ?? null;
    if (bestE1RM > 0 && (prev === null || bestE1RM > prev)) {
      prs.push({ name: ex.name, todayE1RM: bestE1RM, prevE1RM: prev });
    }
  }

  return { totalSets, totalVolume, exerciseSummaries, prs };
}

/** Minutes from the first to the last logged set, plus a few for warm-up (sets store their time since v117). */
function sessionMinutes(session) {
  const ts = (session.exercises || []).flatMap(x => (x.sets || []).map(st => st?.done && st.at)).filter(Boolean);
  return ts.length >= 2 ? Math.round((Math.max(...ts) - Math.min(...ts)) / 60000) + 4 : null;
}

function renderWorkoutComplete(app, session, stats, program, week, day) {
  const programLabel = program.name || program.program_name || program.id;
  const weekDayLabel = program?.days && !program.weeks
    ? `Day ${(session.day_index ?? 0) + 1} of ${program.days.length}`
    : (week && day) ? `Wk ${week}, Day ${day}` : '';
  const prNames = new Set(stats.prs.map(p => p.name));

  const prSection = stats.prs.length ? `
    <div style="margin-bottom:14px;padding:12px 14px;background:rgba(74,222,128,0.06);border:1px solid rgba(74,222,128,0.2);border-radius:12px">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--accent);font-weight:600;margin-bottom:8px">Personal records</div>
      ${stats.prs.map(pr => `
        <div style="font-size:14px;margin-top:4px;display:flex;justify-content:space-between;align-items:baseline">
          <span>${pr.name}</span>
          <span style="color:var(--accent);font-weight:600">${pr.todayE1RM} lb e1RM${pr.prevE1RM ? '<span style="color:var(--fg-dim);font-weight:400"> (was ' + pr.prevE1RM + ')</span>' : ' <span style="color:var(--fg-dim);font-weight:400;font-size:12px">first time</span>'}</span>
        </div>
      `).join('')}
    </div>
  ` : '';

  const exRows = stats.exerciseSummaries.map(ex => {
    const isPR = prNames.has(ex.name);
    const setStr = ex.bestSet
      ? `${ex.bestSet.weight ?? '—'} × ${ex.bestSet.reps ?? '—'}`
      : `${ex.setsCompleted} sets`;
    const e1rmStr = ex.bestE1RM > 0 ? `~${ex.bestE1RM} lb` : '';
    return `
      <div style="display:flex;align-items:baseline;padding:9px 0;border-bottom:1px solid var(--border)">
        <div style="flex:1;font-size:14px;font-weight:500">
          ${ex.name}${isPR ? ' <span style="color:var(--accent);font-size:12px">★</span>' : ''}
        </div>
        <div style="font-size:14px;color:var(--fg);margin-right:12px;white-space:nowrap">${setStr}</div>
        <div style="font-size:12px;color:var(--fg-dim);white-space:nowrap;min-width:60px;text-align:right">${e1rmStr}</div>
      </div>
    `;
  }).join('');

  const mins = sessionMinutes(session);
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const statsLine = [plural(stats.exerciseSummaries.length, 'exercise'), plural(stats.totalSets, 'set'),
    stats.totalVolume > 0 ? `${Math.round(stats.totalVolume).toLocaleString()} lb` : null, mins ? `${mins} min` : null].filter(Boolean).join(' · ');
  // How it felt (RP-style check-in): feeds the deload advice and what the app learns (src/lib/learn.js).
  const feel = session.feel || {};
  const energyNow = energyOf(feel);
  const chip = (k, v, label) => `<button class="pill ${(k === 'energy5' ? energyNow === v : feel[k] === v) ? 'accent' : ''}" data-feel="${k}" data-v="${v}" style="cursor:pointer;font-size:13px;padding:${k === 'energy5' ? '6px 2px;border-radius:12px;text-align:center' : '7px 11px'}">${label}</button>`;
  const doneNames = session.exercises.filter(x => (x.sets || []).some(st => st?.done)).map(x => x.name);
  const feelCard = session.skipped ? '' : `
    <div class="card" id="feel-card" style="padding:12px 14px;margin-bottom:14px">
      <div style="font-weight:600;margin-bottom:8px">How did it feel?</div>
      <div class="muted" style="font-size:12px;margin-bottom:4px">The workout was</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">${chip('effort', 'easy', 'Easy')}${chip('effort', 'right', 'About right')}${chip('effort', 'hard', 'Too much')}</div>
      <div class="muted" style="font-size:12px;margin-bottom:4px">Energy</div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin-bottom:10px">${ENERGY.map(x => chip('energy5', x.v, `<div style="font-size:18px;line-height:1.1">${x.emoji}</div><div style="font-size:11px">${x.label}</div>`)).join('')}</div>
      ${doneNames.length ? `<div class="muted" style="font-size:12px;margin-bottom:4px">Anything hurt? (tap)</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">${doneNames.map(n => `<button class="pill ${session.exercises.find(x => x.name === n)?.hurt ? 'accent' : ''}" data-hurt="${esc(n)}" style="cursor:pointer;font-size:12px;padding:6px 10px">${esc(n)}</button>`).join('')}</div>` : ''}
      ${doneNames.length ? `<div class="muted" style="font-size:12px;margin:10px 0 4px">Helped or felt great? (tap)</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">${doneNames.map(n => `<button class="pill ${session.exercises.find(x => x.name === n)?.helped ? 'accent' : ''}" data-helped="${esc(n)}" style="cursor:pointer;font-size:12px;padding:6px 10px">${esc(n)}</button>`).join('')}</div>` : ''}
      <textarea id="feel-note" rows="2" placeholder="Anything to note? e.g. quads sore from yesterday, slept badly" style="width:100%;margin-top:10px">${esc(session.note || '')}</textarea>
      <div id="note-read" class="muted" style="font-size:12px;margin-top:4px">${esc(noteSummary(readNote(session.note)))}</div>
      <div id="feel-saved" class="muted" style="font-size:11px;margin-top:4px;min-height:14px">Saves as you tap and type.</div>
    </div>`;

  app.innerHTML = `
    <div style="padding-top:8px">
      <div style="font-size:32px;font-weight:700;letter-spacing:-0.5px;margin-bottom:6px">Done.</div>
      <div style="font-size:17px;font-weight:600;margin-bottom:2px">${session.focus || 'Workout'}</div>
      <div class="muted" style="margin-bottom:20px">${programLabel}${weekDayLabel ? ' · ' + weekDayLabel : ''}</div>

      ${prSection}

      <div class="card" style="padding:0 16px">
        ${exRows || '<div class="muted" style="padding:14px 0">No sets logged.</div>'}
      </div>

      <div class="muted" style="text-align:center;margin:14px 0 20px;font-size:13px">${statsLine}</div>
      ${feelCard}
      <button class="btn" id="done-home">Save &amp; finish</button>
      <div class="btn-row" style="margin-top:8px">
        <button class="btn ghost" id="done-body">Log weight</button>
        <button class="btn ghost" id="done-share" title="Send a text summary of this workout">↗ Share summary</button>
      </div>
      ${session.skipped ? '' : `<button class="btn ghost" id="done-next" style="margin-top:8px;font-size:13px">
        Do the next workout today →</button>`}
    </div>
  `;

  const $saved = app.querySelector('#feel-saved');
  const savedTick = () => { if ($saved) $saved.textContent = 'Saved ✓'; };
  app.querySelectorAll('[data-feel]').forEach(b => b.onclick = async () => {
    const v = isNaN(+b.dataset.v) ? b.dataset.v : +b.dataset.v;
    session.feel = { ...(session.feel || {}), [b.dataset.feel]: v };
    if (b.dataset.feel === 'energy5') delete session.feel.energy;   // the old 3-level answer
    await saveSession(session);
    savedTick();
    app.querySelectorAll(`[data-feel="${b.dataset.feel}"]`).forEach(x => x.classList.toggle('accent', x === b));
  });
  app.querySelectorAll('[data-helped]').forEach(b => b.onclick = async () => {
    const x = session.exercises.find(q => q.name === b.dataset.helped);
    if (!x) return;
    x.helped = !x.helped || undefined;
    await saveSession(session);
    savedTick();
    b.classList.toggle('accent', !!x.helped);
  });
  app.querySelectorAll('[data-hurt]').forEach(b => b.onclick = async () => {
    const x = session.exercises.find(q => q.name === b.dataset.hurt);
    if (!x) return;
    x.hurt = !x.hurt || undefined;
    await saveSession(session);
    savedTick();
    b.classList.toggle('accent', !!x.hurt);
  });
  // The note saves as you type (no submit needed) and shows what the app read from it.
  let noteTimer = null;
  const saveNote = async () => {
    const el = app.querySelector('#feel-note');
    if (!el) return;
    session.note = el.value.trim() || undefined;
    await saveSession(session);
    savedTick();
  };
  app.querySelector('#feel-note')?.addEventListener('input', (e) => {
    const r = app.querySelector('#note-read');
    if (r) r.textContent = noteSummary(readNote(e.target.value));
    if ($saved) $saved.textContent = 'Saving…';
    clearTimeout(noteTimer); noteTimer = setTimeout(saveNote, 500);
  });
  app.querySelector('#done-share').onclick = async () => {
    const lines = [`${session.focus || 'Workout'} · ${session.date}${mins ? ` · ${mins} min` : ''}`,
      ...stats.exerciseSummaries.map(x => `${x.name}: ${x.bestSet ? `${x.bestSet.weight ?? 'BW'} × ${x.bestSet.reps ?? '—'}` : `${x.setsCompleted} sets`}${prNames.has(x.name) ? ' ★ PR' : ''}`),
      statsLine];
    const text = lines.join('\n');
    try {
      if (navigator.share) await navigator.share({ title: session.focus || 'Workout', text });
      else { await navigator.clipboard.writeText(text); toast('Copied'); }
    } catch (err) { if (err?.name !== 'AbortError') { try { await navigator.clipboard.writeText(text); toast('Copied'); } catch { toast('Could not share'); } } }
  };
  app.querySelector('#done-home').onclick = async () => {
    clearTimeout(noteTimer);
    await saveNote();
    toast('Workout saved');
    navigate('home');
  };
  app.querySelector('#done-body').onclick = async () => { clearTimeout(noteTimer); await saveNote(); navigate('body'); };
  app.querySelector('#done-next')?.addEventListener('click', () => {
    allowNextWorkoutToday(program.id);
    renderWorkout(app);
  });
}

async function changeDay(delta) {
  // Manually move the program cursor (follow mode only — the buttons are hidden otherwise).
  const today_w = await whichWorkout();
  if (today_w.type !== 'program' || today_w.mode !== 'follow') return;
  const program = today_w.program;
  const programId = program.id;
  // Browsing days means moving on from anything already finished today.
  allowNextWorkoutToday(programId);
  if (program.weeks) {
    let week = today_w.week || 1;
    let day = (today_w.day || 1) + delta;
    const daysIn = (w) => program.weeks.find(x => x.week_num === w)?.days?.length || 1;
    if (day > daysIn(week)) {
      if (week >= program.weeks.length) { toast('That is the last day of the program'); return; }
      week += 1; day = 1;
    }
    if (day < 1) {
      if (week <= 1) { toast('That is the first day of the program'); return; }
      week -= 1; day = daysIn(week);
    }
    await pref(`cursor:${programId}`, { week, day });
  } else if (program.days) {
    // Rotations loop by design.
    const n = program.days.length;
    const di = (((today_w.day_index ?? 0) + delta) % n + n) % n;
    await pref(`cursor:${programId}`, { day_index: di });
  }
  renderWorkout(document.getElementById('app'));
}
