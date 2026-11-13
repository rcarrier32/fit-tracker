/**
 * Rest timing and timer cues, ported from FitKidHooper's src/lib/exerciseSession.js so a
 * fit-tracker workout sounds and feels the same: "Rest" when a set is logged, a warning
 * 15 s out, 5-4-3-2-1, then "Begin".
 */
export const TIMER_WARN_SECS = 5;
export const TIMER_REST_WARN_SECS = 15;
/** Seconds to change sides on a one-side-at-a-time hold (FKH uses 3; 10 gives time to reset a bench setup). */
export const SIDE_SWITCH_SECS = 10;

/**
 * 'leg' | 'arm' | 'side' when a timed exercise is done one side at a time (the time is per
 * side), else null. Reads the plan's own words ("Each side.", "Right side, then left.",
 * PJF's "Perform each side") and names that are one-sided by definition (Copenhagen,
 * side plank, single-leg, B-stance).
 */
export function sidesOf(ex) {
  const txt = [ex?.name, ex?.notes, ex?.rest, ex?.reps, ex?.target_reps].filter(Boolean).join(' ');
  const said = /\b(?:each|per)\s+(side|leg|arm|hand)\b|\bright(?: side)?,? then left\b|\bone side,? then the other\b/i.exec(txt);
  const named = /copenhagen|side plank|single[- ]leg|single[- ]arm|b-stance/i.test(ex?.name || '');
  if (!said && !named) return null;
  const word = (said?.[1] || '').toLowerCase();
  if (word === 'leg' || /copenhagen|single[- ]leg|b-stance/i.test(ex?.name || '')) return 'leg';
  if (word === 'arm' || word === 'hand' || /single[- ]arm/i.test(ex?.name || '')) return 'arm';
  return 'side';
}

/** "Right leg", "Left side"… Right first, as the plans write it ("Right side, then left"). */
export const sideLabel = (unit, sideIdx) => `${sideIdx ? 'Left' : 'Right'} ${unit}`;
/** FKH's switch call: "Switch legs — Left leg". */
export const switchSpeech = (unit) => `Switch ${unit}s — ${sideLabel(unit, 1)}`;

/**
 * Rest in seconds from a program's rest field, or null when it doesn't say.
 * Handles "60s", "45 sec", "1:30 min", "2-3 min" (the low end), "60-90s", and PJF's
 * "00:00:45 1:00 min" (work time first, then rest). "--:-- min", "0s" → null.
 * (FKH's version took the first number, which reads "2-3 min" as 2 seconds.)
 */
export function parseRestSeconds(rest) {
  if (rest == null || rest === 'N/A') return null;
  const s = String(rest).replace(/^\s*\d{1,2}:\d{2}:\d{2}\s*/, '').trim();
  let m = s.match(/^(\d+):(\d{2})\b/);
  let secs = m ? +m[1] * 60 + +m[2] : null;
  if (secs == null) {
    m = s.match(/^(\d+)(?:\s*-\s*\d+)?\s*(s|secs?|seconds?|m|mins?|minutes?)\b/i);
    if (m) secs = /^m/i.test(m[2]) ? +m[1] * 60 : +m[1];
  }
  return secs > 0 && secs <= 600 ? secs : null;
}

/**
 * One AudioContext for every beep, woken by the user's taps. Browsers only let a context made or
 * resumed inside a tap play sound, and cap how many can exist: a new one per beep went silent.
 */
let _ac = null;
export function audioCtx() {
  try {
    _ac ??= new (window.AudioContext || window.webkitAudioContext)();
    if (_ac.state === 'suspended') _ac.resume().catch(() => {});
  } catch { _ac = null; }
  return _ac;
}
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', () => audioCtx(), { passive: true, capture: true });
}

/** "Rest over" as a phone notification, for when the app isn't on screen (needs permission). */
export function notifyRestOver() {
  try {
    if (!document.hidden || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    navigator.serviceWorker?.ready.then(r => r.showNotification('Rest over · next set', {
      tag: 'fit-rest', renotify: true, vibrate: [200, 100, 200, 100, 200], icon: 'icons/icon-192-v2.png', silent: false,
    })).catch(() => {});
  } catch { /* no notifications */ }
}
/** Ask once (inside a tap) whether rest-over notifications may show. */
export function askRestNotifications() {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'default') return;
    if (localStorage.getItem('fit-notif-asked')) return;
    localStorage.setItem('fit-notif-asked', '1');
    Notification.requestPermission().catch(() => {});
  } catch { /* ignore */ }
}

/** Haptic + beep + voice for timer alerts (best-effort on mobile). Same cues as FKH. */
export function timerAlert(kind, countValue) {
  const isBegin = kind === 'go' || kind === 'begin';
  try { navigator.vibrate?.(isBegin ? [200, 80, 200] : [40]); } catch { /* ignore */ }
  try {
    const ctx = audioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = isBegin ? 880 : kind === 'warn' ? 660 : 520;
    gain.gain.value = 0.12;
    osc.start();
    osc.stop(ctx.currentTime + (isBegin ? 0.25 : 0.12));
  } catch { /* ignore */ }
  const speech =
    kind === 'rest' ? 'Rest'
    : isBegin ? 'Begin'
    : kind === 'switch' ? (typeof countValue === 'string' ? countValue : 'Switch')
    : kind === 'count' ? String(countValue)
    : null;
  if (!speech) return;
  try {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(speech);
    u.rate = 1.05;
    u.volume = 1;
    window.speechSynthesis.speak(u);
  } catch { /* ignore */ }
}
