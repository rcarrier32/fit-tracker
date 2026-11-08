/**
 * Progress check-ins: weight, waist, hips, lower belly, energy, how clothes fit,
 * workouts done this week, and progress photos.
 *
 * Check-ins live in prefs('progress_checks') so they ride along with backup/export.
 * Photos live in the 'photos' store, on this device only, and are left out of the
 * backup (localStorage can't hold images).
 */
import { pref, put, get, getAll, del } from '../db.js';
import { toast, openSheet } from '../app.js';
import { localDateStr } from '../lib/date.js';

const FIELDS = [
  ['weight_lb', 'Weight', 'lb', 0.1],
  ['waist_in', 'Waist', 'in', 0.25],
  ['hips_in', 'Hips', 'in', 0.25],
  ['belly_in', 'Lower belly', 'in', 0.25],
];
const POSES = ['front', 'side', 'back'];
const CLOTHES = ['Looser', 'Same', 'Tighter'];
const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const fmtDate = (d) => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export async function getChecks() {
  return ((await pref('progress_checks')) || []).slice().sort((a, b) => a.date.localeCompare(b.date));
}

async function saveCheck(check) {
  const all = ((await pref('progress_checks')) || []).filter(c => c.date !== check.date);
  await pref('progress_checks', [...all, check]);
}

/** Phone photos are several MB; shrink to ~1280px JPEG before storing. */
async function shrink(file) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise(res => c.toBlob(res, 'image/jpeg', 0.82));
}

const _urls = new Map();
async function photoUrl(id) {
  if (_urls.has(id)) return _urls.get(id);
  const p = await get('photos', id);
  if (!p?.blob) return null;
  const u = URL.createObjectURL(p.blob);
  _urls.set(id, u);
  return u;
}

async function workoutsDoneLast7() {
  const from = new Date(); from.setDate(from.getDate() - 6);
  const cut = localDateStr(from);
  const [sessions, cardio] = await Promise.all([getAll('sessions'), getAll('cardio')]);
  const days = new Set([
    ...sessions.filter(s => s.done && s.date >= cut).map(s => s.date),
    ...cardio.filter(c => c.date >= cut).map(c => c.date),
  ]);
  return days.size;
}

function delta(a, b) {
  if (a == null || b == null) return '';
  const d = +(b - a).toFixed(2);
  if (!d) return '<span class="muted">0</span>';
  return `<span style="color:${d < 0 ? 'var(--accent)' : 'var(--warn)'}">${d > 0 ? '+' : ''}${d}</span>`;
}

/** The Body-tab card: start vs latest, photo compare, history. */
export async function renderProgressCard(el, onChange) {
  const checks = await getChecks();
  const first = checks[0], last = checks[checks.length - 1];
  const firstFront = first?.photos?.front, lastFront = last?.photos?.front;
  const [u1, u2] = await Promise.all([
    firstFront ? photoUrl(firstFront) : null,
    lastFront && last !== first ? photoUrl(lastFront) : null,
  ]);
  el.innerHTML = `
    <div class="card">
      <div class="card-row">
        <h2 style="margin:0">Progress Check</h2>
        ${checks.length ? `<span class="pill">${checks.length} check-in${checks.length === 1 ? '' : 's'}</span>` : ''}
      </div>
      <div class="muted" style="margin:4px 0 10px">Once a week (Sunday): measurements, energy, how clothes fit and photos. Measure first thing in the morning.</div>
      ${checks.length ? `
        <div style="display:grid;grid-template-columns:1.3fr 1fr 1fr 0.8fr;gap:6px 8px;font-size:13px;align-items:baseline">
          <div class="muted" style="font-size:11px"></div>
          <div class="muted" style="font-size:11px">Start · ${fmtDate(first.date)}</div>
          <div class="muted" style="font-size:11px">Latest · ${fmtDate(last.date)}</div>
          <div class="muted" style="font-size:11px">Change</div>
          ${FIELDS.map(([k, label, unit]) => `
            <div>${label}</div>
            <div>${first[k] != null ? `${first[k]} ${unit}` : '—'}</div>
            <div>${last[k] != null ? `${last[k]} ${unit}` : '—'}</div>
            <div>${delta(first[k], last[k])}</div>`).join('')}
        </div>
        ${u1 ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">
          <figure style="margin:0"><img src="${u1}" style="width:100%;border-radius:8px;aspect-ratio:3/4;object-fit:cover"><figcaption class="muted" style="font-size:11px;text-align:center">${fmtDate(first.date)}</figcaption></figure>
          ${u2 ? `<figure style="margin:0"><img src="${u2}" style="width:100%;border-radius:8px;aspect-ratio:3/4;object-fit:cover"><figcaption class="muted" style="font-size:11px;text-align:center">${fmtDate(last.date)}</figcaption></figure>`
            : `<div class="muted" style="font-size:12px;display:flex;align-items:center;justify-content:center;text-align:center;border:1px dashed var(--border);border-radius:8px">Your next front photo shows here</div>`}
        </div>` : ''}
        <div style="margin-top:12px">
          ${checks.slice().reverse().map(c => `
            <div class="list-item" data-check="${c.date}" style="cursor:pointer">
              <div>
                <div class="list-item-title">${fmtDate(c.date)}${c.energy ? ` · Energy ${c.energy}/5` : ''}${c.clothes ? ` · Clothes ${c.clothes.toLowerCase()}` : ''}</div>
                <div class="list-item-meta">${FIELDS.filter(([k]) => c[k] != null).map(([k, l, u]) => `${l} ${c[k]}${u === 'lb' ? ' lb' : '"'}`).join(' · ') || 'No measurements'}${c.photos && Object.keys(c.photos).length ? ' · 📷' : ''}</div>
              </div>
              <span class="muted">›</span>
            </div>`).join('')}
        </div>` : ''}
      <button class="btn" id="pc-new" style="margin-top:10px">${checks.some(c => c.date === localDateStr()) ? "Edit today's check-in" : checks.length ? 'Do a check-in' : 'Take starting measurements'}</button>
    </div>`;
  el.querySelector('#pc-new').onclick = () => openProgressCheck(localDateStr(), onChange);
  el.querySelectorAll('[data-check]').forEach(r => r.onclick = () => openProgressCheck(r.dataset.check, onChange));
}

/** Check-in sheet for one date (new or existing). */
export async function openProgressCheck(date = localDateStr(), onSaved) {
  const checks = await getChecks();
  const existing = checks.find(c => c.date === date);
  const body = await get('body', date);
  const c = existing || { date, weight_lb: body?.weight_lb ?? null, workouts: await workoutsDoneLast7(), photos: {} };
  const pending = { ...(c.photos || {}) };      // pose -> photo id, or Blob for new ones
  const thumbs = {};
  for (const pose of POSES) if (pending[pose]) thumbs[pose] = await photoUrl(pending[pose]);

  openSheet((sheet, close) => {
    sheet.innerHTML = `
      <h2>Progress check · ${fmtDate(date)}</h2>
      <div class="muted" style="margin-bottom:6px">Leave anything blank you don't want to track. Same time of day, same spot on the tape each week.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 8px">
        ${FIELDS.map(([k, label, unit, step]) => `
          <div><label>${label} (${unit})</label>
          <input type="number" data-f="${k}" inputmode="decimal" step="${step}" value="${c[k] ?? ''}"></div>`).join('')}
      </div>
      <div class="muted" style="font-size:11px;margin-top:4px">Waist: at your belly button. Hips: widest part of your glutes. Lower belly: about 2 inches below your belly button.</div>

      <label>Energy this week</label>
      <div style="display:flex;gap:6px" id="pc-energy">
        ${[1, 2, 3, 4, 5].map(n => `<button class="btn ${c.energy === n ? '' : 'ghost'}" data-energy="${n}" style="flex:1;padding:8px 0">${n}</button>`).join('')}
      </div>

      <label>How do your clothes fit?</label>
      <div style="display:flex;gap:6px" id="pc-clothes">
        ${CLOTHES.map(o => `<button class="btn ${c.clothes === o ? '' : 'ghost'}" data-clothes="${o}" style="flex:1;padding:8px 0">${o}</button>`).join('')}
      </div>

      <label>Workouts completed this week</label>
      <input type="number" id="pc-workouts" inputmode="numeric" min="0" max="7" value="${c.workouts ?? ''}">

      <label>Progress photos <span style="font-size:11px">(saved on this phone only)</span></label>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
        ${POSES.map(pose => `
          <label style="margin:0;cursor:pointer;display:block">
            <div data-thumb="${pose}" style="aspect-ratio:3/4;border:1px dashed var(--border);border-radius:8px;display:flex;align-items:center;justify-content:center;background-size:cover;background-position:center;${thumbs[pose] ? `background-image:url(${thumbs[pose]})` : ''}">
              ${thumbs[pose] ? '' : '<span style="font-size:22px">📷</span>'}
            </div>
            <div class="muted" style="font-size:11px;text-align:center;margin-top:2px;text-transform:capitalize">${pose}</div>
            <input type="file" accept="image/*" data-photo="${pose}" style="display:none">
          </label>`).join('')}
      </div>

      <label>Notes</label>
      <input type="text" id="pc-notes" value="${esc(c.notes)}" placeholder="e.g. jeans fit better, slept badly">

      <button class="btn" id="pc-save" style="margin-top:16px">Save check-in</button>
      ${existing ? `<button class="btn ghost" id="pc-del" style="margin-top:8px;color:var(--danger);border-color:var(--danger)">Delete check-in</button>` : ''}
    `;

    let energy = c.energy ?? null, clothes = c.clothes ?? null;
    sheet.querySelectorAll('[data-energy]').forEach(b => b.onclick = () => {
      energy = +b.dataset.energy;
      sheet.querySelectorAll('[data-energy]').forEach(x => x.classList.toggle('ghost', x !== b));
    });
    sheet.querySelectorAll('[data-clothes]').forEach(b => b.onclick = () => {
      clothes = b.dataset.clothes;
      sheet.querySelectorAll('[data-clothes]').forEach(x => x.classList.toggle('ghost', x !== b));
    });
    sheet.querySelectorAll('[data-photo]').forEach(inp => inp.onchange = async () => {
      const f = inp.files?.[0];
      if (!f) return;
      try {
        const blob = await shrink(f);
        pending[inp.dataset.photo] = blob;
        const t = sheet.querySelector(`[data-thumb="${inp.dataset.photo}"]`);
        t.style.backgroundImage = `url(${URL.createObjectURL(blob)})`;
        t.innerHTML = '';
      } catch { toast("Couldn't read that photo"); }
    });

    sheet.querySelector('#pc-save').onclick = async (e) => {
      e.currentTarget.disabled = true;
      const out = { date, photos: {} };
      sheet.querySelectorAll('[data-f]').forEach(i => {
        const v = parseFloat(i.value);
        out[i.dataset.f] = Number.isFinite(v) ? v : null;
      });
      const w = parseInt(sheet.querySelector('#pc-workouts').value);
      out.workouts = Number.isFinite(w) ? w : null;
      out.energy = energy;
      out.clothes = clothes;
      out.notes = sheet.querySelector('#pc-notes').value.trim() || null;
      for (const pose of POSES) {
        const p = pending[pose];
        if (p instanceof Blob) {
          if (c.photos?.[pose]) await del('photos', c.photos[pose]);
          out.photos[pose] = await put('photos', { date, pose, blob: p });
        } else if (p) out.photos[pose] = p;
      }
      await saveCheck(out);
      // A weight here is also that morning's weigh-in, unless one is already logged.
      if (out.weight_lb && !body) await put('body', { date, weight_lb: out.weight_lb });
      toast('Check-in saved');
      close();
      onSaved?.();
    };
    sheet.querySelector('#pc-del')?.addEventListener('click', async () => {
      if (!confirm('Delete this check-in and its photos? This cannot be undone.')) return;
      for (const id of Object.values(c.photos || {})) await del('photos', id);
      await pref('progress_checks', ((await pref('progress_checks')) || []).filter(x => x.date !== date));
      toast('Deleted');
      close();
      onSaved?.();
    });
  });
}
