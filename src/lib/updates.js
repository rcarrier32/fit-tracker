/**
 * In-app update check via version.json only (avoids SW reload loops).
 *
 * The running build's version is whatever version.json said when this page booted — app
 * code always loads from the network (sw.js), so the page and that first read match.
 * Comparing against a hand-bumped constant instead is what left "Update now" showing
 * forever when index.html's __FIT_V fell behind version.json (36 vs 57).
 */
export const LOCAL_V = 33; // floor only; window.__FIT_V and the boot-time read win

const VERSION_URL = new URL('version.json', location.href).href;
const RELOAD_GUARD_KEY = 'fit-update-reload-ts';
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

let _banner = null;
let _lastCheck = 0;
let _bootV = null;   // version.json `v` as of this page load

function getLocalV() {
  const htmlV = Number(window.__FIT_V);
  const floor = Number.isFinite(htmlV) && htmlV > 0 ? htmlV : LOCAL_V;
  return Math.max(floor, _bootV ?? 0);
}

function showUpdateBanner() {
  if (_banner) return;
  _banner = document.createElement('div');
  _banner.className = 'update-banner';
  _banner.innerHTML = `
    <span>New version ready</span>
    <button type="button" class="btn" id="fit-apply-update">Update now</button>
  `;
  document.body.appendChild(_banner);
  _banner.querySelector('#fit-apply-update').onclick = () => applyUpdate();
}

function hideUpdateBanner() {
  _banner?.remove();
  _banner = null;
}

async function fetchRemoteVersion() {
  const url = VERSION_URL + (VERSION_URL.includes('?') ? '&' : '?') + 't=' + Date.now();
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) return null;
  return r.json();
}

/** Server has a newer build than this page was loaded with. */
export async function checkForAppUpdate() {
  const now = Date.now();
  if (now - _lastCheck < CHECK_INTERVAL_MS) return false;
  _lastCheck = now;

  try {
    const remote = await fetchRemoteVersion();
    // First successful read is the build this page is running.
    if (_bootV == null && remote?.v != null) _bootV = Number(remote.v);
    const localV = getLocalV();
    if (remote?.v != null && Number(remote.v) > localV) {
      const reloadedAt = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || 0);
      if (reloadedAt && now - reloadedAt < 15000) {
        console.warn('[updates] still on v', localV, 'after reload; server has', remote.v);
        hideUpdateBanner();
        return false;
      }
      showUpdateBanner();
      return true;
    }
    hideUpdateBanner();
    sessionStorage.removeItem(RELOAD_GUARD_KEY);
  } catch (err) {
    console.warn('[updates] version check failed', err);
  }
  return false;
}

/** Reload to pick up a new build. */
export async function applyUpdate() {
  const btn = _banner?.querySelector('#fit-apply-update');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Updating…';
  }

  sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));

  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg?.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
  } catch (err) {
    console.warn('[updates] SW skip failed', err);
  }

  hideUpdateBanner();
  const url = new URL(location.href);
  url.searchParams.set('_fit', String(Date.now()));
  location.replace(url.pathname + url.search + url.hash);
}

function registerServiceWorkerQuiet() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').catch(err => console.warn('SW register failed', err));
}

export function initUpdates() {
  registerServiceWorkerQuiet();
  checkForAppUpdate();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForAppUpdate();
  });
}
