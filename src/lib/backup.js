/**
 * Local backup in localStorage — survives service-worker / HTTP cache clears.
 * Does NOT survive Safari "Clear Website Data" (that wipes everything).
 */
import { exportAllData, importAllData, pref } from '../db.js';

const BACKUP_KEY = 'fit-data-backup';
const BACKUP_AT_KEY = 'fit-data-backup-at';

let _timer = null;

function hasMeaningfulData(data) {
  if (!data) return false;
  if (data.meals?.length || data.sessions?.length || data.body?.length) return true;
  const profile = data.prefs?.find(p => p.key === 'profile');
  return !!profile?.value?.weight_lb;
}

export function scheduleLocalBackup() {
  clearTimeout(_timer);
  _timer = setTimeout(async () => {
    try {
      const data = await exportAllData();
      if (!hasMeaningfulData(data)) return;
      localStorage.setItem(BACKUP_KEY, JSON.stringify(data));
      localStorage.setItem(BACKUP_AT_KEY, new Date().toISOString());
    } catch (err) {
      console.warn('[backup] failed', err);
    }
  }, 1500);
}

/** Call after writes so backup stays current. */
export function touchLocalBackup() {
  scheduleLocalBackup();
}

export async function offerBackupRestore() {
  const profile = await pref('profile');
  if (profile) return false;

  const raw = localStorage.getItem(BACKUP_KEY);
  if (!raw || sessionStorage.getItem('fit-restore-offered')) return false;

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return false;
  }
  if (!hasMeaningfulData(data)) return false;

  sessionStorage.setItem('fit-restore-offered', '1');
  const when = localStorage.getItem(BACKUP_AT_KEY);
  const whenLabel = when
    ? new Date(when).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : 'a previous visit';

  const { openSheet, toast } = await import('../app.js');

  return new Promise(resolve => {
    openSheet((sheet, close) => {
      sheet.innerHTML = `
        <h2>Restore your data?</h2>
        <p class="muted" style="margin:12px 0 16px;line-height:1.45">
          Your logs look empty, but a backup was saved on ${whenLabel}.
          This can happen after clearing Safari website data. Restore now?
        </p>
        <div class="btn-row">
          <button class="btn" id="restore-yes">Restore backup</button>
          <button class="btn ghost" id="restore-no">Start fresh</button>
        </div>
      `;
      sheet.querySelector('#restore-yes').onclick = async () => {
        await importAllData(data);
        close();
        toast('Data restored');
        resolve(true);
        setTimeout(() => window.location.reload(), 400);
      };
      sheet.querySelector('#restore-no').onclick = () => {
        close();
        resolve(false);
      };
    });
  });
}
