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
import { offerBackupRestore, scheduleLocalBackup } from './lib/backup.js';

const ROUTES = {
  home:      renderHome,
  workout:   renderWorkout,
  meals:     renderMeals,
  body:      renderBody,
  dashboard: renderDashboard,
  cardio:    renderCardio,
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

  const dismiss = (syncHistory = true) => {
    if (closed) return;
    closed = true;
    hooks.onClose?.();
    backdrop.remove();
    window.removeEventListener('popstate', onPopState);
    if (syncHistory && history.state?.fitSheet) history.back();
  };

  function onPopState() {
    if (!closed && document.body.contains(backdrop)) dismiss(false);
  }

  // Keep full path + hash (empty url breaks iOS Safari → wrong path → GitHub 404)
  history.pushState({ fitSheet: 1 }, '', location.pathname + location.search + location.hash);
  window.addEventListener('popstate', onPopState);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) dismiss(true); });

  /** @param {boolean} [syncHistory=true] pass false when opening another sheet immediately */
  const close = (syncHistory = true) => dismiss(syncHistory);
  contentBuilder(sheet, close, hooks);
  return close;
}

// Boot
(async () => {
  loadCatalogs().catch(err => console.error('[boot] catalogs failed', err));
  await offerBackupRestore();
  if (!location.hash) location.hash = '#/home';
  await render();
  scheduleLocalBackup();
})();

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') scheduleLocalBackup();
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(err => console.warn('SW register failed', err));
}
