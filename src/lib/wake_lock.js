/**
 * Keep the screen on while the app is open (Screen Wake Lock API, best-effort).
 * The OS drops the lock whenever the page is hidden, so it is re-requested on return
 * and on the next tap (iOS can refuse a request made without a recent user gesture).
 */
let _sentinel = null;

async function request() {
  if (document.visibilityState !== 'visible') return;
  if (_sentinel && !_sentinel.released) return;
  try {
    _sentinel = await navigator.wakeLock.request('screen');
  } catch { /* unsupported context, low battery, etc. */ }
}

export function initWakeLock() {
  if (!('wakeLock' in navigator)) return;
  request();
  document.addEventListener('visibilitychange', request);
  document.addEventListener('pointerdown', request, { passive: true });
}
