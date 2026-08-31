/**
 * Main app: hash router, view loader, global state.
 */
import { loadCatalogs } from './lib/static_data.js';
import { renderHome } from './views/home.js';
import { renderWorkout } from './views/workout.js';
import { renderMeals } from './views/meals.js';
import { renderBody } from './views/body.js';
import { renderDashboard } from './views/dashboard.js';
import { renderCardio } from './views/cardio.js';
import { renderPrograms } from './views/programs.js';
import { renderTOS } from './views/tos.js';
import { renderHip } from './views/hip.js';
import { offerBackupRestore, scheduleLocalBackup, requestPersistence } from './lib/backup.js';

const ROUTES = {
  home:      renderHome,
  workout:   renderWorkout,
  meals:     renderMeals,
  body:      renderBody,
  dashboard: renderDashboard,
  cardio:    renderCardio,
  tos:       renderTOS,
  hip:       renderHip,
  programs:  renderPrograms,
};

export const $app = document.getElementById('app');

export function navigate(route) {
  location.hash = `#/${route}`;
}

async function render() {
  const route = (location.hash.replace('#/', '') || 'home').split('/')[0];
  const fn = ROUTES[route] || renderHome;
  document.querySelectorAll('#tabbar .tab').forEach(b => {
    b.classList.toggle('active', b.dataset.route === route);
  });
  $app.innerHTML = '<div class="empty"><div class="icon">⏳</div><div>Loading…</div></div>';
  try {
    await fn($app);
  } catch (err) {
    console.error(err);
    $app.innerHTML = `<div class="card"><h2>Error</h2><pre style="white-space:pre-wrap;color:var(--danger)">${err.message}\n${err.stack||''}</pre></div>`;
  }
}

document.querySelectorAll('#tabbar .tab').forEach(b => {
  b.addEventListener('click', () => navigate(b.dataset.route));
});

window.addEventListener('hashchange', render);

// Toast helper
export function toast(msg, ms = 1800) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

// Every sheet used to push the *same* constant history state ({fitSheet: 1}), so every
// still-open sheet's popstate listener would react to ANY sheet's dismissal — closing two
// or more nested sheets in the same tick (e.g. a "close this, then close its parent too"
// flow, or even just a plain backdrop-tap/Cancel while sheets are nested 2+ deep) fired a
// burst of popstate events that got misattributed to sheets that were never meant to
// close, silently discarding whatever the user had in progress underneath (e.g. a combo
// mid-build). Each sheet now gets a unique, monotonically increasing token and only
// dismisses when the *current* history state's token has dropped below its own — a
// comparison that stays correct even across orphaned entries left by sheets that closed
// with syncHistory=false to open a follow-up sheet immediately.
let _sheetToken = 0;

// Sheet helper — hooks.onClose on dismiss; device back closes sheet first
export function openSheet(contentBuilder) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  backdrop.appendChild(sheet);
  document.body.appendChild(backdrop);
  const hooks = { onClose: null };
  let closed = false;
  const token = ++_sheetToken;

  const dismiss = (syncHistory = true) => {
    if (closed) return;
    closed = true;
    hooks.onClose?.();
    backdrop.remove();
    window.removeEventListener('popstate', onPopState);
    if (syncHistory && history.state?.fitSheet === token) history.back();
  };

  function onPopState() {
    if (closed || !document.body.contains(backdrop)) return;
    // Dismiss only once navigation has moved back to or past this sheet's own entry —
    // not on every popstate regardless of whose entry it actually belongs to.
    if ((history.state?.fitSheet ?? 0) < token) dismiss(false);
  }

  // Keep full path + hash (empty url breaks iOS Safari → wrong path → GitHub 404)
  history.pushState({ fitSheet: token }, '', location.pathname + location.search + location.hash);
  window.addEventListener('popstate', onPopState);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) dismiss(true); });

  /** @param {boolean} [syncHistory=true] pass false when opening another sheet immediately */
  const close = (syncHistory = true) => dismiss(syncHistory);
  contentBuilder(sheet, close, hooks);
  return close;
}

// Boot
(async () => {
  const { initUpdates } = await import(`./lib/updates.js?v=${window.__FIT_V ?? ''}`);
  initUpdates();
  requestPersistence();   // ask iOS to stop evicting our storage (fire-and-forget)
  loadCatalogs().catch(err => console.error('[boot] catalogs failed', err));
  await offerBackupRestore();
  if (!location.hash) location.hash = '#/home';
  await render();
  scheduleLocalBackup();
})();

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') scheduleLocalBackup();
});
