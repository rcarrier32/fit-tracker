/**
 * Shared exercise UI — the one way every plan shows an exercise (FKH pattern):
 *
 *   list   → exerciseRowHTML: compact row, 16:9 thumb, name, prescription, set dashes, check
 *   detail → openExerciseDetail: embedded video on top, then sets/log, then how-to
 *
 * Plans supply plain exercise objects; anything new (future programs included) only has
 * to fill in this shape to get the full experience:
 *
 *   { id, name, subtitle?, sets ('3 × 10 per leg'), freq?, cues: [], warning?, askPt?,
 *     videoId? | video_url?, videoTitle?, link?, search?, source?, optional? }
 */
import { openSheet } from '../app.js';
import { localFor, muxThumb, attachMuxVideos } from './local_videos.js';

export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** YouTube id from an id, a watch/short/embed URL, or null. */
export function ytId(v) {
  if (!v) return null;
  if (/^[A-Za-z0-9_-]{11}$/.test(v)) return v;
  const m = String(v).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

const videoOf = (ex) => ytId(ex.videoId) || ytId(ex.video_url);

/** Set circles for "3 × 10 per leg" → 3; timed or one-off work → 1. */
export function setCount(rx) {
  const m = String(rx ?? '').match(/^\s*(\d+)\s*[×x]\s*/i);
  return m ? Math.min(Math.max(+m[1], 1), 10) : 1;
}

/** What one set asks for: "3 × 10 per leg" → "10 per leg". */
export function perSetLabel(rx) {
  const text = String(rx ?? '');
  const m = text.match(/^\s*\d+\s*[×x]\s*(.+)$/i);
  return m ? m[1] : (text || 'Done');
}

function thumbHTML(ex) {
  const vid = videoOf(ex);
  const mux = localFor(ex.name)?.v;
  const box = 'flex-shrink:0;width:104px;aspect-ratio:16/9;border-radius:8px;overflow:hidden;position:relative;background:#0f172a';
  if (vid || mux) {
    return `
      <div style="${box}">
        <img src="${mux ? muxThumb(mux) : `https://img.youtube.com/vi/${vid}/mqdefault.jpg`}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"
          style="width:100%;height:100%;object-fit:cover;display:block">
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
          width:24px;height:24px;border-radius:50%;background:rgba(0,0,0,0.65);
          display:flex;align-items:center;justify-content:center;font-size:9px;color:#fff;
          border:1px solid rgba(255,255,255,0.3)">▶</div>
      </div>`;
  }
  return `
    <div style="${box};display:flex;flex-direction:column;align-items:center;justify-content:center;
      gap:2px;color:#475569;border:1px solid rgba(255,255,255,0.06)">
      <span style="font-size:13px">▶</span>
      <span style="font-size:8px;letter-spacing:0.06em">${ex.link ? 'LINK' : 'NO VIDEO'}</span>
    </div>`;
}

/**
 * Compact list row. Tapping the row fires [data-open=key]; the circle fires [data-check=key].
 * @param {object} ex
 * @param {{ key?: string, rx?: string, done?: boolean, sets?: boolean[], accent?: string,
 *           edited?: boolean, check?: boolean, badge?: string }} o
 */
export function exerciseRowHTML(ex, o = {}) {
  const key = esc(o.key ?? ex.id);
  const accent = o.accent || 'var(--accent)';
  const done = !!o.done;
  const sets = o.sets || [];
  const n = sets.filter(Boolean).length;
  const rx = o.rx ?? ex.sets ?? '';
  return `
    <div data-open="${key}" style="background:rgba(255,255,255,0.03);
      border:1px solid ${done ? accent : 'rgba(255,255,255,0.08)'};
      border-radius:12px;padding:8px;display:flex;align-items:center;gap:10px;cursor:pointer;
      transition:border-color 0.2s ease;${done ? 'opacity:0.65' : ''}">
      ${thumbHTML(ex)}
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:5px;min-width:0">
          <div style="font-size:13px;font-weight:700;color:#f1f5f9;line-height:1.25;
            overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(ex.name)}</div>
          ${ex.optional ? `<span style="font-size:8.5px;padding:1px 4px;border-radius:3px;
            border:1px solid rgba(255,255,255,0.12);color:#64748b;flex-shrink:0">OPTIONAL</span>` : ''}
          ${ex.warning ? `<span style="font-size:10px;color:#fca5a5;flex-shrink:0">⚠</span>` : ''}
        </div>
        ${o.badge ? `<div style="font-size:9.5px;color:${accent};margin-top:2px;letter-spacing:0.04em">${esc(o.badge)}</div>` : ''}
        ${rx ? `<div style="font-size:11px;color:#94a3b8;margin-top:3px;line-height:1.3;
          overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${esc(rx)}${o.edited ? ` <span style="color:${accent}">✎</span>` : ''}</div>` : ''}
        ${sets.length > 1 ? `
          <div style="display:flex;gap:3px;margin-top:5px;align-items:center">
            ${sets.map(d => `<span style="width:14px;height:3px;border-radius:2px;
              background:${d ? accent : 'rgba(255,255,255,0.12)'}"></span>`).join('')}
            <span style="font-size:9.5px;color:#64748b;margin-left:3px">${n}/${sets.length}</span>
          </div>` : ''}
      </div>
      ${o.check === false ? '' : `
      <button data-check="${key}" aria-label="${done ? 'Mark not done' : 'Mark done'}"
        style="flex-shrink:0;width:30px;height:30px;border-radius:50%;
          border:1.5px solid ${done ? accent : 'rgba(255,255,255,0.25)'};
          background:${done ? accent : 'transparent'};
          color:${done ? '#0f172a' : 'rgba(255,255,255,0.4)'};
          display:flex;align-items:center;justify-content:center;cursor:pointer;
          font-size:13px;font-weight:700">${done ? '✓' : '○'}</button>`}
    </div>`;
}

/**
 * Wire a list rendered with exerciseRowHTML. The check circle never opens the detail.
 * @param {Element} root
 * @param {{ open: (key: string) => void, check?: (key: string) => void }} h
 */
export function wireExerciseRows(root, h) {
  root.querySelectorAll('[data-check]').forEach(btn => {
    btn.onclick = (e) => { e.stopPropagation(); h.check?.(btn.dataset.check); };
  });
  root.querySelectorAll('[data-open]').forEach(row => {
    row.onclick = () => h.open(row.dataset.open);
  });
}

/**
 * Level switcher right under the name — the mid-workout control. One tap to the easier or
 * harder version; the full ladder (with the readiness note) sits further down.
 */
function levelBarHTML(l, accent) {
  const n = l.steps.length;
  const btn = (step, label, on) => `<button data-step="${step}" ${on ? '' : 'disabled'}
    style="flex-shrink:0;padding:7px 10px;border-radius:8px;font-size:12px;font-weight:700;
      cursor:${on ? 'pointer' : 'default'};opacity:${on ? 1 : 0.3};
      background:transparent;border:1px solid ${accent}55;color:${accent}">${label}</button>`;
  return `
    <div style="display:flex;align-items:center;gap:8px;margin-top:10px;padding:8px;border-radius:10px;
      background:${l.ready ? accent + '14' : 'rgba(255,255,255,0.03)'};
      border:1px solid ${l.ready ? accent + '88' : 'rgba(255,255,255,0.08)'}">
      ${btn(l.current - 1, '‹ Easier', l.current > 0)}
      <div style="flex:1;min-width:0;text-align:center">
        <div style="font-size:10px;letter-spacing:0.1em;color:${accent};font-weight:700">LEVEL ${l.current + 1} OF ${n}</div>
        ${l.ready ? `<div style="font-size:10.5px;color:${accent};margin-top:1px">Ready to move up ↑</div>`
          : `<div style="font-size:10.5px;color:#64748b;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(l.name)}</div>`}
      </div>
      ${btn(l.current + 1, 'Harder ›', l.current < n - 1)}
    </div>`;
}

/** Progression ladder: every step tappable, current one highlighted, harder ones to the right. */
function ladderHTML(l, accent) {
  return `
    <div style="margin-top:16px;padding:10px 12px;border-radius:10px;background:rgba(255,255,255,0.03);
      border:1px solid ${l.ready ? accent + '66' : 'rgba(255,255,255,0.08)'}">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
        <div style="font-size:10px;letter-spacing:0.12em;color:#64748b;font-weight:700">ALL VERSIONS</div>
        <div style="font-size:10.5px;color:#64748b">${esc(l.name)}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:5px;margin-top:8px">
        ${l.steps.map((st, i) => {
          const cur = i === l.current;
          return `<button data-step="${i}" style="display:flex;align-items:center;gap:8px;width:100%;text-align:left;
            padding:7px 9px;border-radius:8px;cursor:${cur ? 'default' : 'pointer'};
            background:${cur ? accent + '1f' : 'transparent'};
            border:1px solid ${cur ? accent + '88' : 'rgba(255,255,255,0.07)'};color:${cur ? '#f1f5f9' : '#94a3b8'}">
            <span style="width:18px;font-size:10px;font-weight:800;color:${cur ? accent : '#475569'}">${i + 1}</span>
            <span style="flex:1;font-size:12.5px;font-weight:${cur ? 700 : 500}">${esc(st.name)}</span>
            <span style="font-size:10px;color:${cur ? accent : '#475569'}">${cur ? 'NOW' : i < l.current ? 'easier' : 'harder'}</span>
          </button>`;
        }).join('')}
      </div>
      ${l.note ? `<div style="font-size:11.5px;color:${l.ready ? accent : '#94a3b8'};margin-top:8px;line-height:1.45">${esc(l.note)}</div>` : ''}
    </div>`;
}

function videoBlockHTML(ex) {
  // The user's own PJF demo (stored on this device only) beats a stand-in YouTube video.
  const mux = localFor(ex.name)?.v;
  if (mux) {
    return `
      <div class="ex-video">
        <video data-mux="${esc(mux)}" controls playsinline preload="metadata" poster="${muxThumb(mux)}"
          style="position:absolute;inset:0;width:100%;height:100%;background:#000"></video>
      </div>
      <div style="font-size:10.5px;color:#64748b;margin-top:5px">PJF Performance demo</div>`;
  }
  const vid = videoOf(ex);
  if (vid) {
    return `
      <div class="ex-video">
        <iframe src="https://www.youtube.com/embed/${vid}?playsinline=1&rel=0&modestbranding=1"
          title="${esc(ex.videoTitle || ex.name)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowfullscreen style="position:absolute;inset:0;width:100%;height:100%;border:none"></iframe>
      </div>
      ${ex.videoTitle ? `<div style="font-size:10.5px;color:#64748b;margin-top:5px;line-height:1.35">${esc(ex.videoTitle)}</div>` : ''}`;
  }
  const href = ex.link || ex.video_url
    || `https://www.youtube.com/results?search_query=${encodeURIComponent(ex.search || ex.name)}`;
  return `
    <a href="${esc(href)}" target="_blank" rel="noopener noreferrer"
      style="display:flex;align-items:center;justify-content:center;gap:8px;height:96px;
        width:100%;border-radius:10px;background:#0f172a;
        border:1px dashed rgba(255,255,255,0.15);color:#94a3b8;text-decoration:none;font-size:12px">
      ▶ ${ex.link || ex.video_url ? 'Open video link' : 'Search YouTube for a demo'}
    </a>`;
}

/** PJF's own coaching notes and easier alternates, when the user imported them. */
function pjfNotesHTML(ex, accent) {
  const l = localFor(ex.name);
  if (!l || (!l.notes.length && !l.alts.length)) return '';
  // PJF writes "-Do this -Then that" and "Level 1 = … Level 2 = …"; give each its own line.
  const lines = l.notes.flatMap(n => n.split(/\s(?=-[A-Z])|\s(?=Level \d+ =)/).map(t => t.replace(/^-/, '').trim()))
    .filter(Boolean);
  return `
    <div style="font-size:10px;letter-spacing:0.12em;color:#64748b;font-weight:700;margin:16px 0 6px">PJF COACHING NOTES</div>
    <div style="display:flex;flex-direction:column;gap:5px">
      ${lines.map(c => `
        <div style="font-size:13px;color:#cbd5e1;display:flex;gap:7px;line-height:1.45">
          <span style="flex-shrink:0;font-weight:700;color:${accent}">→</span><span>${esc(c)}</span>
        </div>`).join('')}
      ${l.alts.length ? `<div style="font-size:12px;color:#94a3b8;margin-top:4px">
        <span style="font-weight:700">EASIER OPTION · </span>${l.alts.map(esc).join(', ')}</div>` : ''}
    </div>`;
}

/**
 * The exercise detail sheet.
 *
 * @param {object} ex   exercise (shape in the file header)
 * @param {object} o
 * @param {string}   [o.accent]
 * @param {string}   [o.rx]           prescription to show (defaults to ex.sets)
 * @param {() => Promise<string|null>} [o.editRx]  prompt + save; returns the new rx
 * @param {{ get: () => boolean[], save: (arr: boolean[]) => Promise<void> }} [o.sets]
 *                                    per-set tracking; omit for view-only (e.g. Lift)
 * @param {() => boolean}  [o.isDone]
 * @param {(v: boolean) => Promise<void>} [o.setDone]
 * @param {() => ({ name: string, open: () => void } | null)} [o.next]  next undone exercise
 * @param {string}   [o.completeLabel] shown once nothing is left
 * @param {string}   [o.extraHTML]     plan-specific block under the sets (last time, notes…)
 * @param {{ label: string, danger?: boolean, onClick: (close: Function) => void }[]} [o.actions]
 * @param {{ name: string, steps: { name: string }[], current: number, note?: string,
 *           ready?: boolean, onChange: (step: number, close: Function) => void }} [o.ladder]
 *                                    progression ladder — easier/harder versions of this exercise
 */
/**
 * Turn the phone sideways while a demo plays and the video fills the screen; turn it back
 * and it returns to the card. When the app itself rotates, CSS (.ex-video in styles.css)
 * does it. When the app stays portrait (rotation lock, or an installed app still locked to
 * portrait), the motion sensor says which way gravity points and the video is turned 90°.
 */
let _gravitySign = 0;   // +1 spec (Android), -1 iOS: the sign of y when held upright

function startSidewaysVideo(sheet) {
  const box = sheet.querySelector('.ex-video');
  if (!box || !('DeviceMotionEvent' in window)) return () => {};
  const onMotion = (e) => {
    const g = e.accelerationIncludingGravity;
    if (!g || g.x == null) return;
    const ax = Math.abs(g.x), ay = Math.abs(g.y);
    const appPortrait = window.innerHeight > window.innerWidth;
    if (ay > 7 && ay > ax + 3) {                 // upright
      _gravitySign = Math.sign(g.y) || _gravitySign;
      box.classList.remove('sideways');
    } else if (ax > 7 && ax > ay + 3 && appPortrait) {   // on its side, app didn't rotate
      // Top of the phone toward the left → turn the video clockwise, and vice versa.
      const cw = Math.sign(g.x) * (_gravitySign || 1) > 0;
      box.style.setProperty('--turn', cw ? '90deg' : '-90deg');
      box.classList.add('sideways');
    }
    if (!appPortrait) box.classList.remove('sideways');   // the CSS landscape rule has it
  };
  // iOS asks once for motion access; this runs inside the tap that opened the video.
  const DME = window.DeviceMotionEvent;
  if (typeof DME.requestPermission === 'function') DME.requestPermission().catch(() => {});
  window.addEventListener('devicemotion', onMotion);
  return () => window.removeEventListener('devicemotion', onMotion);
}

export function openExerciseDetail(ex, o = {}) {
  const accent = o.accent || '#38bdf8';
  let rx = o.rx ?? ex.sets ?? '';

  openSheet((sheet, close, hooks) => {
    sheet.innerHTML = `
      ${videoBlockHTML(ex)}
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-top:12px">
        <div style="min-width:0">
          <h2 style="margin:0;font-size:18px;line-height:1.25">${esc(ex.name)}</h2>
          ${ex.subtitle ? `<div style="font-size:12px;color:#94a3b8;margin-top:3px;line-height:1.4">${esc(ex.subtitle)}</div>` : ''}
        </div>
        ${ex.source ? `<span style="font-size:9px;padding:2px 6px;border-radius:4px;flex-shrink:0;
          border:1px solid rgba(255,255,255,0.1);color:#64748b;white-space:nowrap">${esc(ex.source)}</span>` : ''}
      </div>

      ${o.ladder ? levelBarHTML(o.ladder, accent) : ''}
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin:10px 0 14px">
        ${rx ? `<button id="ex-rx" ${o.editRx ? '' : 'disabled'} style="font-size:11px;padding:4px 9px;border-radius:6px;
          ${o.editRx ? 'cursor:pointer;' : ''}background:rgba(255,255,255,0.06);border:1px solid transparent;color:#cbd5e1">
          <span style="opacity:0.55">SETS </span><span id="ex-rx-text">${esc(rx)}</span>${o.editRx ? ' ✎' : ''}</button>` : ''}
        ${ex.freq ? `<span style="font-size:11px;padding:4px 9px;border-radius:6px;background:rgba(255,255,255,0.06);color:#cbd5e1">
          <span style="opacity:0.55">FREQ </span>${esc(ex.freq)}</span>` : ''}
      </div>

      <div id="ex-sets"></div>
      ${o.extraHTML || ''}
      ${o.ladder ? ladderHTML(o.ladder, accent) : ''}

      ${ex.cues?.length ? `
        <div style="font-size:10px;letter-spacing:0.12em;color:#64748b;font-weight:700;margin:16px 0 6px">HOW TO</div>
        <div style="display:flex;flex-direction:column;gap:5px">
          ${ex.cues.map(c => `
            <div style="font-size:13px;color:#cbd5e1;display:flex;gap:7px;line-height:1.45">
              <span style="flex-shrink:0;font-weight:700;color:${accent}">→</span><span>${esc(c)}</span>
            </div>`).join('')}
        </div>` : ''}
      ${pjfNotesHTML(ex, accent)}
      ${ex.notes && !ex.cues?.length ? `<div style="font-size:13px;color:#cbd5e1;margin-top:12px;line-height:1.45">${esc(ex.notes)}</div>` : ''}

      ${ex.warning ? `
        <div style="margin-top:12px;font-size:12px;padding:7px 10px;background:rgba(239,68,68,0.1);
          border:1px solid rgba(239,68,68,0.25);border-radius:8px;color:#fca5a5;line-height:1.45">${esc(ex.warning)}</div>` : ''}
      ${ex.askPt ? `
        <div style="margin-top:8px;font-size:12px;padding:7px 10px;background:rgba(56,189,248,0.08);
          border:1px solid rgba(56,189,248,0.22);border-radius:8px;color:#7dd3fc;line-height:1.45">
          <span style="font-weight:700;letter-spacing:0.04em">ASK YOUR PT · </span>${esc(ex.askPt)}</div>` : ''}

      <div id="ex-foot" style="margin-top:16px"></div>
      ${o.actions?.length ? `
        <div style="display:flex;gap:6px;margin-top:10px">
          ${o.actions.map((a, i) => `<button data-action="${i}" class="btn ghost"
            style="flex:1;font-size:12px;padding:8px;${a.danger ? 'color:#fca5a5' : ''}">${esc(a.label)}</button>`).join('')}
        </div>` : ''}
    `;

    attachMuxVideos(sheet);
    const stopSideways = startSidewaysVideo(sheet);
    const prevClose = hooks.onClose;
    hooks.onClose = () => { stopSideways(); prevClose?.(); };

    const getSets = () => {
      const n = setCount(rx);
      const saved = o.sets?.get() || [];
      const arr = Array.from({ length: n }, (_, i) => !!saved[i]);
      // A check-off from the list counts as every set done.
      return o.isDone?.() ? arr.map(() => true) : arr;
    };

    function paint() {
      const $sets = sheet.querySelector('#ex-sets');
      const $foot = sheet.querySelector('#ex-foot');
      if (o.sets) {
        const sets = getSets();
        const per = perSetLabel(rx);
        $sets.innerHTML = `
          <div style="font-size:10px;letter-spacing:0.12em;color:#64748b;font-weight:700;margin-bottom:6px">
            ${sets.length > 1 ? `SETS · ${sets.filter(Boolean).length}/${sets.length}` : 'LOG IT'}</div>
          <div style="display:flex;flex-direction:column;gap:6px">
            ${sets.map((d, i) => `
              <button data-set="${i}" style="display:flex;align-items:center;gap:10px;padding:10px 12px;
                border-radius:10px;cursor:pointer;text-align:left;width:100%;
                background:${d ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.03)'};
                border:1px solid ${d ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)'}">
                <span style="width:18px;font-size:11px;font-weight:800;color:#475569">${sets.length > 1 ? i + 1 : ''}</span>
                <span style="flex:1;font-size:13px;font-weight:600;color:${d ? '#22c55e' : '#e2e8f0'}">${esc(per)}</span>
                <span style="width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;
                  font-size:14px;font-weight:800;border:1.5px solid ${d ? '#22c55e' : accent + '80'};
                  background:${d ? '#22c55e' : 'transparent'};color:${d ? '#fff' : accent}">${d ? '✓' : '○'}</span>
              </button>`).join('')}
          </div>`;
        $sets.querySelectorAll('[data-set]').forEach(btn => {
          btn.onclick = async () => {
            const arr = getSets();
            arr[+btn.dataset.set] = !arr[+btn.dataset.set];
            await o.sets.save(arr);
            const all = arr.every(Boolean);
            if (all !== !!o.isDone?.()) await o.setDone?.(all);
            paint();
          };
        });
      }

      if (!o.setDone) { $foot.innerHTML = ''; return; }
      const done = !!o.isDone?.();
      const next = done ? o.next?.() : null;
      $foot.innerHTML = !done
        ? `<button id="ex-all" class="btn" style="background:${accent};color:#0f172a">✓ Mark exercise done</button>`
        : next
          ? `<button id="ex-next" class="btn" style="background:${accent};color:#0f172a">Next: ${esc(next.name)} →</button>`
          : `<div style="text-align:center;padding:12px;border-radius:10px;background:rgba(34,197,94,0.08);
              border:1px solid rgba(34,197,94,0.3);color:#22c55e;font-weight:700;font-size:14px">
              🎉 ${esc(o.completeLabel || 'All done')}</div>
             <button id="ex-close" class="btn ghost" style="margin-top:8px">Done</button>`;
      $foot.querySelector('#ex-all')?.addEventListener('click', async () => {
        if (o.sets) await o.sets.save(getSets().map(() => true));
        await o.setDone(true);
        paint();
      });
      $foot.querySelector('#ex-next')?.addEventListener('click', () => { close(false); next.open(); });
      $foot.querySelector('#ex-close')?.addEventListener('click', () => close());
    }
    paint();

    sheet.querySelector('#ex-rx')?.addEventListener('click', async () => {
      if (!o.editRx) return;
      const v = await o.editRx();
      if (v == null) return;
      rx = v;
      sheet.querySelector('#ex-rx-text').textContent = rx;
      paint();
    });
    sheet.querySelectorAll('[data-action]').forEach(btn => {
      btn.onclick = () => o.actions[+btn.dataset.action].onClick(close);
    });
    sheet.querySelectorAll('[data-step]').forEach(btn => {
      btn.onclick = () => {
        const step = +btn.dataset.step;
        if (step !== o.ladder.current) o.ladder.onChange(step, close);
      };
    });
  });
}
