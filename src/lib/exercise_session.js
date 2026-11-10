/**
 * Rest timing and timer cues, ported from FitKidHooper's src/lib/exerciseSession.js so a
 * fit-tracker workout sounds and feels the same: "Rest" when a set is logged, a warning
 * 15 s out, 5-4-3-2-1, then "Begin".
 */
export const TIMER_WARN_SECS = 5;
export const TIMER_REST_WARN_SECS = 15;

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

/** Haptic + beep + voice for timer alerts (best-effort on mobile). Same cues as FKH. */
export function timerAlert(kind, countValue) {
  const isBegin = kind === 'go' || kind === 'begin';
  try { navigator.vibrate?.(isBegin ? [80, 40, 80] : [40]); } catch { /* ignore */ }
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
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
