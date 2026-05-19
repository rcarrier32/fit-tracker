/**
 * In-app update checks — no manual cache clearing needed.
 * Bump `LOCAL_V` and version.json `v` (and sw.js CACHE) on each release.
 */
export const LOCAL_V = 24;

const VERSION_URL = new URL('version.json', location.href).href;

let _banner = null;

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

/** Server has a newer build than this tab is running. */
export async function checkForAppUpdate() {
  try {
    const remote = await fetchRemoteVersion();
    if (remote?.v != null && Number(remote.v) > LOCAL_V) {
      showUpdateBanner();
      return true;
    }
  } catch (err) {
    console.warn('[updates] version check failed', err);
  }
  return false;
}

/** Activate waiting service worker and reload. */
export async function applyUpdate() {
  const btn = _banner?.querySelector('#fit-apply-update');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Updating…';
  }

  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.update();
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    }
  } catch (err) {
    console.warn('[updates] SW apply failed', err);
  }

  hideUpdateBanner();
  location.reload();
}

function watchServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register('./sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      const installing = reg.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          showUpdateBanner();
        }
      });
    });

    if (reg.waiting) showUpdateBanner();

    reg.update().catch(() => {});
  }).catch(err => console.warn('SW register failed', err));
}

export function initUpdates() {
  watchServiceWorker();
  checkForAppUpdate();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkForAppUpdate();
      navigator.serviceWorker?.getRegistration()?.update().catch(() => {});
    }
  });
}
