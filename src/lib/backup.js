/**
 * Local backup in localStorage — survives service-worker / HTTP cache clears.
 * Does NOT survive Safari "Clear Website Data" (that wipes everything).
 */
import { exportAllData, importAllData, pref } from '../db.js';

const BACKUP_KEY = 'fit-data-backup';
const BACKUP_AT_KEY = 'fit-data-backup-at';
const BACKUP_PREV_KEY = 'fit-data-backup-prev';       // rolling second copy
const BACKUP_PREV_AT_KEY = 'fit-data-backup-prev-at';

let _timer = null;

function hasMeaningfulData(data) {
  if (!data) return false;
  if (data.meals?.length || data.sessions?.length || data.body?.length) return true;
  const profile = data.prefs?.find(p => p.key === 'profile');
  return !!profile?.value?.weight_lb;
}

/** Total user-record count — used to detect a backup that shrank (i.e. a wipe). */
function recordCount(data) {
  if (!data) return 0;
  return ['meals', 'sessions', 'body', 'cardio', 'prefs', 'user_meals', 'plans']
    .reduce((n, k) => n + (data[k]?.length || 0), 0);
}

/**
 * Ask iOS/WebKit to make storage persistent so it isn't evicted under pressure or by
 * the platform's IndexedDB instability. Safe to call repeatedly; no-ops where unsupported.
 * This is the single most important defence against the "data cleared itself" failure.
 */
export async function requestPersistence() {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted?.()) return true;   // already granted
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

export function scheduleLocalBackup() {
  clearTimeout(_timer);
  _timer = setTimeout(async () => {
    try {
      const data = await exportAllData();
      if (!hasMeaningfulData(data)) return;

      // Shrink guard: if the new snapshot has far fewer records than the current
      // backup, a wipe likely just happened and we're about to save the empty
      // aftermath. Preserve the existing (larger) backup as -prev before overwriting,
      // so a transient IndexedDB eviction followed by a re-log can't destroy history.
      const prevRaw = localStorage.getItem(BACKUP_KEY);
      if (prevRaw) {
        let prevCount = 0;
        try { prevCount = recordCount(JSON.parse(prevRaw)); } catch { /* corrupt; ignore */ }
        if (prevCount > recordCount(data) + 3) {
          localStorage.setItem(BACKUP_PREV_KEY, prevRaw);
          localStorage.setItem(BACKUP_PREV_AT_KEY, localStorage.getItem(BACKUP_AT_KEY) || '');
        }
      }

      localStorage.setItem(BACKUP_KEY, JSON.stringify(data));
      localStorage.setItem(BACKUP_AT_KEY, new Date().toISOString());
    } catch (err) {
      console.warn('[backup] failed', err);
    }
  }, 1500);
}

/** Best available backup — whichever of the two rolling copies holds more records. */
function bestBackup() {
  const read = (k, atK) => {
    const raw = localStorage.getItem(k);
    if (!raw) return null;
    try { return { data: JSON.parse(raw), at: localStorage.getItem(atK), count: recordCount(JSON.parse(raw)) }; }
    catch { return null; }
  };
  const cur = read(BACKUP_KEY, BACKUP_AT_KEY);
  const prev = read(BACKUP_PREV_KEY, BACKUP_PREV_AT_KEY);
  if (cur && prev) return prev.count > cur.count ? prev : cur;
  return cur || prev;
}

/** Call after writes so backup stays current. */
export function touchLocalBackup() {
  scheduleLocalBackup();
}

export async function offerBackupRestore() {
  const profile = await pref('profile');
  if (profile) return false;

  const backup = bestBackup();
  if (!backup || sessionStorage.getItem('fit-restore-offered')) return false;
  const { data, at, count } = backup;
  if (!hasMeaningfulData(data)) return false;

  sessionStorage.setItem('fit-restore-offered', '1');
  const whenLabel = at
    ? new Date(at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : 'a previous visit';

  // What's in the backup, so the user can see it's really their data.
  const summary = [
    data.body?.length ? `${data.body.length} weigh-in${data.body.length === 1 ? '' : 's'}` : null,
    data.sessions?.filter(s => s.done).length ? `${data.sessions.filter(s => s.done).length} workouts` : null,
    data.meals?.length ? `${data.meals.length} meals` : null,
  ].filter(Boolean).join(' · ');

  const { openSheet, toast } = await import('../app.js');

  return new Promise(resolve => {
    openSheet((sheet, close) => {
      sheet.innerHTML = `
        <h2>Restore your data</h2>
        <p class="muted" style="margin:12px 0 8px;line-height:1.45">
          Your logs are empty, but a backup from ${whenLabel} is safe on this device.
          iOS sometimes clears app storage on its own — this is why. Restore it now.
        </p>
        ${summary ? `<div style="margin:0 0 16px;padding:10px 12px;background:var(--bg-input);
          border-radius:8px;font-size:13px">Contains: ${summary}${count ? ` · ${count} records` : ''}</div>` : ''}
        <div class="btn-row">
          <button class="btn" id="restore-yes">Restore backup</button>
        </div>
        <button class="btn ghost" id="restore-no" style="margin-top:8px;width:100%">Start fresh instead</button>
      `;
      sheet.querySelector('#restore-yes').onclick = async () => {
        await importAllData(data);
        close();
        toast('Data restored');
        resolve(true);
        setTimeout(() => window.location.reload(), 400);
      };
      sheet.querySelector('#restore-no').onclick = () => {
        // Do NOT let "start fresh" strand the backup for silent overwrite. Confirm,
        // and keep the backup untouched so it's still recoverable if this was a mistake.
        if (!confirm('Start fresh and ignore the backup? Your saved data stays on the device and can still be restored later.')) return;
        close();
        resolve(false);
      };
    });
  });
}
