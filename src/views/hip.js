/**
 * Comprehensive Hip Recovery Playbook.
 * Standalone view at #/hip — accessible from Programs → Rehab Protocols.
 *
 * Self-contained: the playbook's weekly schedule is shown here as reference and does
 * NOT touch pref('schedule') or the lifting program rotation.
 */
import { pref } from '../db.js';
import { navigate, toast, openSheet } from '../app.js';
import {
  SECTIONS, WEEKLY_SCHEDULE, AEROBIC_PROGRESSION, POST_POOL,
  PROTOCOL_PHASES, PROTOCOL_GAPS, PROTOCOL_SOURCE,
} from '../lib/hip_protocol.js';
import { localDateStr } from '../lib/date.js';

const todayKey = () => localDateStr();
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const PAIN_COLORS = ['#34d399', '#34d399', '#34d399', '#a3e635', '#fbbf24', '#fbbf24',
                     '#fb923c', '#fb923c', '#f87171', '#f87171', '#ef4444'];

export async function renderHip(app) {
  const day = todayKey();

  // ── Persisted state ────────────────────────────────────────────────────────
  const [savedProgress, allLogs, savedRx, allPain, allNotes] = await Promise.all([
    pref('hip_progress'),
    pref('hip_logs').then(v => v || {}),
    pref('hip_prescriptions').then(v => v || {}),
    pref('hip_pain').then(v => v || {}),
    pref('hip_notes').then(v => v || {}),
  ]);
  let surgeryDate = (await pref('hip_surgery_date')) || '';
  let surgerySide = (await pref('hip_surgery_side')) || '';        // 'left' | 'right' | ''
  let surgeryProc = (await pref('hip_surgery_procedure')) || '';   // free text

  let started    = savedProgress?.started || null;
  let activeId   = SECTIONS[0].id;
  let completed  = { ...(allLogs[day] || {}) };
  let rx         = { ...savedRx };          // exercise id → custom "sets" string
  // The pain/note card can step back through history to backfill a missed day. Exercise
  // check-offs always apply to today — only this log is date-navigable.
  let logDate    = day;
  let pain       = allPain[logDate] ?? null;   // 0–10 or null
  let note       = allNotes[logDate] || '';    // free-text symptom note

  // Open on the section that matches today's schedule, when there is one.
  const todaySched = WEEKLY_SCHEDULE[new Date().getDay()];
  const firstToday = todaySched.sections.find(id => SECTIONS.some(s => s.id === id));
  if (firstToday) activeId = firstToday;

  // ── Persistence ────────────────────────────────────────────────────────────
  async function begin() {
    started = day;
    await pref('hip_progress', { started: day });
  }

  async function toggle(exId) {
    completed[exId] = !completed[exId];
    const logs = (await pref('hip_logs')) || {};
    logs[day] = { ...(logs[day] || {}), [exId]: completed[exId] };
    await pref('hip_logs', logs);
    mount();
  }

  async function setRx(exId, value) {
    const all = (await pref('hip_prescriptions')) || {};
    if (value) all[exId] = value; else delete all[exId];
    rx = all;
    await pref('hip_prescriptions', all);
  }

  async function setPain(score) {
    pain = score;
    const all = (await pref('hip_pain')) || {};
    if (score === null) delete all[logDate]; else all[logDate] = score;
    allPain[logDate] = all[logDate];
    await pref('hip_pain', all);
    mount();
  }

  /** Saved on blur, not per keystroke — re-rendering mid-typing would drop focus. */
  async function saveNote(text) {
    note = text;
    const all = (await pref('hip_notes')) || {};
    if (text.trim()) all[logDate] = text.trim(); else delete all[logDate];
    allNotes[logDate] = all[logDate];
    await pref('hip_notes', all);
  }

  /** Step the pain/note card to another day. Never past today. */
  function shiftLogDate(deltaDays) {
    const d = new Date(logDate + 'T12:00:00');
    d.setDate(d.getDate() + deltaDays);
    const next = localDateStr(d);
    if (next > day) return;
    logDate = next;
    pain = allPain[logDate] ?? null;
    note = allNotes[logDate] || '';
    mount();
  }

  /**
   * Plain-text digest for a PT or surgeon visit: pain trend, adherence, and dated
   * symptom notes. Built from what's actually logged — no interpretation added.
   */
  function buildSummary() {
    const start = started ? new Date(started + 'T12:00:00') : null;
    const dates = [...new Set([...Object.keys(allPain), ...Object.keys(allNotes)])].sort();
    const painDates = dates.filter(d => allPain[d] != null);

    const lines = [];
    lines.push('HIP RECOVERY — LOG SUMMARY');
    lines.push(`Generated ${day}`);
    const who = [
      surgerySide ? `${surgerySide.charAt(0).toUpperCase()}${surgerySide.slice(1)} hip` : null,
      surgeryProc || null,
    ].filter(Boolean).join(' — ');
    if (who) lines.push(who);
    if (surgeryDate) {
      const wk = weeksPostOp();
      const ph = wk == null ? null : PROTOCOL_PHASES.find(p => wk >= p.from && wk <= p.to);
      lines.push(`Surgery ${surgeryDate}${wk != null ? ` — ${wk} weeks post-op` : ''}${ph ? ` (${ph.label})` : ''}`);
    }
    if (start) lines.push(`Protocol started ${started} (week ${weekNum()})`);
    lines.push('');

    if (painDates.length) {
      const vals = painDates.map(d => allPain[d]);
      const avg = (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1);
      lines.push(`PAIN (0-10) — ${painDates.length} days logged, average ${avg}`);
      if (painDates.length >= 4) {
        const mid = Math.floor(painDates.length / 2);
        const a = vals.slice(0, mid), b = vals.slice(mid);
        const avgA = a.reduce((s, v) => s + v, 0) / a.length;
        const avgB = b.reduce((s, v) => s + v, 0) / b.length;
        const delta = (avgB - avgA).toFixed(1);
        const dir = avgB < avgA ? 'improving' : avgB > avgA ? 'worsening' : 'flat';
        lines.push(`  First half ${avgA.toFixed(1)} -> second half ${avgB.toFixed(1)} (${dir}, ${delta > 0 ? '+' : ''}${delta})`);
      }
      lines.push(`  Range ${Math.min(...vals)}-${Math.max(...vals)}`);
      lines.push('');
      lines.push('  Daily: ' + painDates.map(d => `${d.slice(5)}=${allPain[d]}`).join('  '));
      lines.push('');
    } else {
      lines.push('PAIN — nothing logged yet.');
      lines.push('');
    }

    const sessionDays = Object.keys(allLogs).filter(d => Object.values(allLogs[d] || {}).some(Boolean));
    if (sessionDays.length) {
      lines.push(`ADHERENCE — exercises checked off on ${sessionDays.length} day(s)`);
      const tally = {};
      for (const d of sessionDays) {
        for (const [exId, done] of Object.entries(allLogs[d] || {})) {
          if (done) tally[exId] = (tally[exId] || 0) + 1;
        }
      }
      const named = Object.entries(tally)
        .map(([exId, n]) => {
          const ex = SECTIONS.flatMap(s => s.exercises || []).find(e => e.id === exId);
          return [ex ? ex.name : exId, n];
        })
        .sort((a, b) => b[1] - a[1]);
      for (const [name, n] of named) lines.push(`  ${n}x  ${name}`);
      lines.push('');
    }

    const noteDates = dates.filter(d => allNotes[d]);
    if (noteDates.length) {
      lines.push('SYMPTOM NOTES');
      for (const d of noteDates) lines.push(`  ${d}: ${allNotes[d]}`);
      lines.push('');
    }

    const edited = Object.keys(rx);
    if (edited.length) {
      lines.push('PRESCRIPTIONS CHANGED FROM DEFAULT');
      for (const exId of edited) {
        const ex = SECTIONS.flatMap(s => s.exercises || []).find(e => e.id === exId);
        lines.push(`  ${ex ? ex.name : exId}: ${rx[exId]}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /** Clipboard fallback — show the text so it can be selected and copied by hand. */
  function openSummarySheet(text) {
    openSheet((sheet) => {
      sheet.innerHTML = `
        <h2>Summary for PT visit</h2>
        <div class="muted" style="font-size:12px;margin-bottom:10px">
          Copy couldn't reach the clipboard here. Select the text below.
        </div>
        <textarea readonly rows="16" style="width:100%;background:var(--bg-input);
          border:1px solid var(--border);border-radius:8px;padding:10px;color:var(--fg);
          font-size:11px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
          line-height:1.5;resize:vertical"></textarea>
      `;
      const $ta = sheet.querySelector('textarea');
      $ta.value = text;   // via value, never innerHTML — the notes are user text
      $ta.focus();
      $ta.select();
    });
  }

  function weekNum() {
    if (!started) return null;
    const days = Math.floor((Date.now() - new Date(started + 'T12:00:00')) / 864e5);
    return Math.max(1, Math.floor(days / 7) + 1);
  }

  /** Prescription actually shown for an exercise — user override wins. */
  const rxFor = (ex) => rx[ex.id] || ex.sets;

  // ── Sub-renderers ──────────────────────────────────────────────────────────
  function tabHTML(s) {
    const viewing = s.id === activeId;
    const onToday = todaySched.sections.includes(s.id);
    const border  = viewing ? s.accent : onToday ? s.accent + '55' : 'rgba(255,255,255,0.1)';
    const color   = viewing || onToday ? s.accent : '#cbd5e1';
    return `
      <button data-section="${s.id}" style="flex-shrink:0;background:${viewing ? s.bg : 'transparent'};
        border:1px solid ${border};border-radius:8px;padding:7px 12px;cursor:pointer;
        display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-width:88px;
        transition:all 0.15s ease">
        <span style="font-size:13px;font-weight:600;color:${color}">${s.label}</span>
        <span style="font-size:10px;color:#475569;letter-spacing:0.02em">
          ${onToday && !viewing ? '● today' : s.tag.split('·')[0].trim()}
        </span>
      </button>`;
  }

  function thumbHTML(ex) {
    if (ex.videoId) {
      return `
        <a href="https://www.youtube.com/watch?v=${ex.videoId}" target="_blank" rel="noopener noreferrer"
          style="position:relative;flex-shrink:0;width:130px;display:block;overflow:hidden;
            background:#0f172a;text-decoration:none">
          <img src="https://img.youtube.com/vi/${ex.videoId}/mqdefault.jpg" alt="" loading="lazy"
            style="width:130px;height:90px;object-fit:cover;display:block">
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-60%);
            width:26px;height:26px;border-radius:50%;background:rgba(0,0,0,0.65);
            display:flex;align-items:center;justify-content:center;font-size:9px;color:#fff;
            border:1px solid rgba(255,255,255,0.3)">▶</div>
          ${ex.videoTitle ? `<div style="position:absolute;bottom:0;left:0;right:0;padding:3px 5px;
            font-size:9px;line-height:1.3;color:#cbd5e1;background:rgba(0,0,0,0.75);
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(ex.videoTitle)}</div>` : ''}
        </a>`;
    }
    const q = encodeURIComponent(ex.search || ex.name);
    return `
      <a href="https://www.youtube.com/results?search_query=${q}" target="_blank" rel="noopener noreferrer"
        style="flex-shrink:0;width:130px;height:90px;display:flex;flex-direction:column;
          align-items:center;justify-content:center;gap:4px;background:#0f172a;
          text-decoration:none;color:#475569;border-right:1px solid rgba(255,255,255,0.06)">
        <span style="font-size:16px">▶</span>
        <span style="font-size:9px;letter-spacing:0.06em">SEARCH YOUTUBE</span>
      </a>`;
  }

  function cardHTML(ex, section) {
    const done = !!completed[ex.id];
    const edited = !!rx[ex.id];
    return `
      <div style="background:rgba(255,255,255,0.03);
        border:1px solid ${done ? section.accent : 'rgba(255,255,255,0.08)'};
        border-radius:12px;overflow:hidden;display:flex;flex-direction:row;
        transition:border-color 0.2s ease;${done ? 'opacity:0.65' : ''}">

        ${thumbHTML(ex)}

        <div style="flex:1;padding:10px 12px;min-width:0">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:7px">
            <div style="min-width:0">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
                <div style="font-size:13px;font-weight:700;color:#f1f5f9;line-height:1.3">${esc(ex.name)}</div>
                ${ex.optional ? `<span style="font-size:9px;padding:1px 5px;border-radius:3px;
                  background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);
                  color:#475569;letter-spacing:0.06em;flex-shrink:0">CAUTION</span>` : ''}
              </div>
              <div style="font-size:11px;color:#64748b;line-height:1.35">${esc(ex.subtitle)}</div>
            </div>
            <button data-exid="${ex.id}"
              style="flex-shrink:0;width:26px;height:26px;border-radius:50%;
                border:1.5px solid ${done ? section.accent : 'rgba(255,255,255,0.25)'};
                background:${done ? section.accent : 'transparent'};
                color:${done ? '#0f172a' : 'rgba(255,255,255,0.4)'};
                display:flex;align-items:center;justify-content:center;cursor:pointer;
                font-size:12px;font-weight:700">${done ? '✓' : '○'}</button>
          </div>

          <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px">
            <button data-editrx="${ex.id}" style="font-size:10px;padding:2px 7px;
              background:rgba(255,255,255,${edited ? '0.09' : '0.05'});border-radius:4px;
              color:${edited ? section.accent : '#94a3b8'};letter-spacing:0.02em;cursor:pointer;
              border:1px solid ${edited ? section.accent + '55' : 'transparent'};text-align:left">
              <span style="opacity:0.55">SETS </span>${esc(rxFor(ex))}
              <span style="opacity:0.5;margin-left:3px">✎</span>
            </button>
            <span style="font-size:10px;padding:2px 7px;background:rgba(255,255,255,0.05);
              border-radius:4px;color:#94a3b8;letter-spacing:0.02em">
              <span style="opacity:0.55">FREQ </span>${esc(ex.freq)}
            </span>
          </div>

          <div style="display:flex;flex-direction:column;gap:3px">
            ${ex.cues.map(c => `
              <div style="font-size:11.5px;color:#94a3b8;display:flex;gap:5px;line-height:1.4">
                <span style="flex-shrink:0;font-weight:700;color:${section.accent};margin-top:1px">→</span>
                <span>${esc(c)}</span>
              </div>`).join('')}
          </div>

          ${ex.warning ? `
            <div style="margin-top:8px;font-size:11px;padding:5px 9px;
              background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);
              border-radius:6px;color:#fca5a5;line-height:1.4">${esc(ex.warning)}</div>` : ''}

          ${ex.askPt ? `
            <div style="margin-top:8px;font-size:11px;padding:5px 9px;
              background:rgba(56,189,248,0.08);border:1px solid rgba(56,189,248,0.22);
              border-radius:6px;color:#7dd3fc;line-height:1.4">
              <span style="font-weight:700;letter-spacing:0.04em">ASK YOUR PT · </span>${esc(ex.askPt)}
            </div>` : ''}
        </div>
      </div>`;
  }

  function guidanceHTML(item, section) {
    return `
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);
        border-radius:12px;padding:11px 13px">
        <div style="display:flex;gap:7px;align-items:flex-start;margin-bottom:4px">
          <span style="color:${section.accent};font-weight:700;flex-shrink:0;margin-top:1px">→</span>
          <div style="font-size:13px;font-weight:700;color:#f1f5f9;line-height:1.35">${esc(item.title)}</div>
        </div>
        <div style="font-size:11.5px;color:#94a3b8;line-height:1.5;padding-left:16px">${esc(item.detail)}</div>
      </div>`;
  }

  function logDateLabel() {
    if (logDate === day) return 'today';
    const d = new Date(logDate + 'T12:00:00');
    const yest = new Date(day + 'T12:00:00'); yest.setDate(yest.getDate() - 1);
    if (logDate === localDateStr(yest)) return 'yesterday';
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function painHTML() {
    const swatches = Array.from({ length: 11 }, (_, i) => {
      const on = pain === i;
      return `<button data-pain="${i}" style="flex:1;min-width:0;padding:7px 0;border-radius:6px;
        cursor:pointer;font-size:12px;font-weight:${on ? '700' : '500'};
        background:${on ? PAIN_COLORS[i] : 'rgba(255,255,255,0.04)'};
        color:${on ? '#0f172a' : '#64748b'};
        border:1px solid ${on ? PAIN_COLORS[i] : 'rgba(255,255,255,0.07)'}">${i}</button>`;
    }).join('');

    return `
      <div style="padding:12px 14px;background:rgba(255,255,255,0.03);
        border:1px solid rgba(255,255,255,0.08);border-radius:10px;margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px">
          <div style="min-width:0">
            <div style="font-size:12px;font-weight:700;color:#f1f5f9">Hip pain — ${esc(logDateLabel())}</div>
            <div style="font-size:10.5px;color:#475569;margin-top:1px">0 = none · 10 = worst it gets</div>
          </div>
          <div style="display:flex;align-items:center;gap:4px;flex-shrink:0">
            ${pain !== null ? `<button id="pain-clear" style="font-size:10px;padding:3px 8px;
              border-radius:5px;background:transparent;border:1px solid rgba(255,255,255,0.12);
              color:#64748b;cursor:pointer">Clear</button>` : ''}
            <button id="log-prev" title="Previous day" style="font-size:13px;line-height:1;padding:4px 8px;
              border-radius:5px;background:transparent;border:1px solid rgba(255,255,255,0.12);
              color:#94a3b8;cursor:pointer">‹</button>
            <button id="log-next" title="Next day" ${logDate >= day ? 'disabled' : ''}
              style="font-size:13px;line-height:1;padding:4px 8px;border-radius:5px;background:transparent;
              border:1px solid rgba(255,255,255,0.12);color:#94a3b8;
              ${logDate >= day ? 'opacity:0.3;cursor:default' : 'cursor:pointer'}">›</button>
          </div>
        </div>
        <div style="display:flex;gap:3px">${swatches}</div>

        <div style="margin-top:10px">
          <div style="font-size:10px;color:#475569;letter-spacing:0.06em;margin-bottom:4px">
            WHAT IT FELT LIKE (optional)
          </div>
          <textarea id="hip-note" rows="2" placeholder="e.g. walking to the car the hip rolled outward, landed on the outside of my foot"
            style="width:100%;background:var(--bg-input);border:1px solid rgba(255,255,255,0.08);
              border-radius:7px;padding:7px 9px;color:var(--fg);font-size:12px;line-height:1.45;
              font-family:inherit;resize:vertical">${esc(note)}</textarea>
        </div>

        ${renderPainTrend()}

        <button id="hip-summary" style="width:100%;margin-top:10px;padding:8px;border-radius:7px;
          cursor:pointer;background:transparent;border:1px solid rgba(255,255,255,0.14);
          color:#94a3b8;font-size:11.5px;font-weight:600">
          Copy summary for PT visit
        </button>
      </div>`;
  }

  function renderPainTrend() {
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = localDateStr(d);
      // allPain is kept in sync by setPain, so it's the single source for the trend —
      // reading `pain` here would misattribute a backfilled day to today.
      days.push({ k, v: allPain[k] ?? null });
    }
    const logged = days.filter(d => d.v !== null);
    if (logged.length < 2) return '';
    const avg = (logged.reduce((s, d) => s + d.v, 0) / logged.length).toFixed(1);
    const bars = days.map(d => {
      if (d.v === null) {
        return `<div style="flex:1;height:26px;display:flex;align-items:flex-end">
          <div style="width:100%;height:2px;background:rgba(255,255,255,0.06);border-radius:2px"></div>
        </div>`;
      }
      const h = Math.max(3, (d.v / 10) * 26);
      return `<div style="flex:1;height:26px;display:flex;align-items:flex-end">
        <div style="width:100%;height:${h}px;background:${PAIN_COLORS[d.v]};border-radius:2px;opacity:0.85"></div>
      </div>`;
    }).join('');
    return `
      <div style="margin-top:10px;padding-top:9px;border-top:1px solid rgba(255,255,255,0.06)">
        <div style="display:flex;justify-content:space-between;font-size:10px;color:#475569;margin-bottom:5px">
          <span>LAST 14 DAYS</span><span>avg ${avg}</span>
        </div>
        <div style="display:flex;gap:2px;align-items:flex-end">${bars}</div>
      </div>`;
  }

  /** Week-by-week aerobic ramp, with the current week called out. */
  function progressionHTML(section) {
    const week = weekNum();
    return `
      <div style="padding:12px 14px;background:rgba(255,255,255,0.03);
        border:1px solid rgba(255,255,255,0.08);border-radius:10px;margin-bottom:12px">
        <div style="font-size:11px;font-weight:700;color:#cbd5e1;letter-spacing:0.05em;margin-bottom:8px">
          AEROBIC RAMP
        </div>
        ${AEROBIC_PROGRESSION.map(p => {
          const now = week === p.week;
          return `
            <div style="display:flex;gap:10px;align-items:baseline;padding:3px 0;
              ${now ? 'color:#f1f5f9;font-weight:600' : 'color:#64748b'}">
              <span style="width:52px;flex-shrink:0;font-size:11px;
                color:${now ? section.accent : '#475569'}">Week ${p.week}</span>
              <span style="font-size:11.5px;flex:1">${esc(p.minutes)}</span>
              ${now ? `<span style="font-size:9px;color:${section.accent};letter-spacing:0.06em">NOW</span>` : ''}
            </div>`;
        }).join('')}
        ${!week ? `<div style="font-size:10.5px;color:#475569;margin-top:7px">
          Start tracking below to see which week you're on.</div>` : ''}
        ${week && week > AEROBIC_PROGRESSION.length ? `<div style="font-size:10.5px;color:#475569;margin-top:7px">
          Past week ${AEROBIC_PROGRESSION.length} — hold at 45–60 min as tolerated.</div>` : ''}
      </div>`;
  }

  /** Section-level reference clip, for sections where per-exercise demos don't exist. */
  function sectionVideoHTML(section) {
    const v = section.sectionVideo;
    if (!v) return '';
    return `
      <a href="https://www.youtube.com/watch?v=${v.videoId}" target="_blank" rel="noopener noreferrer"
        style="display:flex;gap:11px;align-items:center;padding:9px 11px;margin-bottom:10px;
          background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);
          border-radius:10px;text-decoration:none">
        <div style="position:relative;flex-shrink:0">
          <img src="https://img.youtube.com/vi/${v.videoId}/mqdefault.jpg" alt="" loading="lazy"
            style="width:86px;height:60px;object-fit:cover;border-radius:6px;display:block">
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
            width:22px;height:22px;border-radius:50%;background:rgba(0,0,0,0.65);
            display:flex;align-items:center;justify-content:center;font-size:8px;color:#fff;
            border:1px solid rgba(255,255,255,0.3)">▶</div>
        </div>
        <div style="min-width:0">
          <div style="font-size:12px;font-weight:600;color:#f1f5f9;line-height:1.3">${esc(v.videoTitle)}</div>
          <div style="font-size:10.5px;color:#64748b;margin-top:2px">${esc(v.channel)}</div>
          <div style="font-size:10.5px;color:#475569;margin-top:3px;line-height:1.4">${esc(v.note)}</div>
        </div>
      </a>`;
  }

  /** Weeks since surgery, or null when no date is set. */
  function weeksPostOp() {
    if (!surgeryDate) return null;
    const d = new Date(surgeryDate + 'T12:00:00');
    if (isNaN(d)) return null;
    return Math.max(0, Math.floor((Date.now() - d) / 864e5 / 7));
  }

  /** Published-protocol comparison. Reference only — see PROTOCOL_SOURCE. */
  function benchmarksHTML(section) {
    const wk = weeksPostOp();
    const current = wk == null ? null : PROTOCOL_PHASES.find(p => wk >= p.from && wk <= p.to);

    const phases = PROTOCOL_PHASES.map(p => {
      const isNow = current && p.id === current.id;
      const past = wk != null && wk > p.to;
      return `
        <div style="border:1px solid ${isNow ? section.accent : 'rgba(255,255,255,0.08)'};
          background:${isNow ? section.bg : 'rgba(255,255,255,0.02)'};
          border-radius:10px;padding:10px 12px;margin-bottom:8px;${past && !isNow ? 'opacity:0.5' : ''}">
          <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:6px">
            <div style="font-size:12.5px;font-weight:700;color:${isNow ? section.accent : '#cbd5e1'}">
              ${esc(p.label)}
            </div>
            <div style="font-size:10px;color:#475569;white-space:nowrap">
              ${esc(p.weeks)}${isNow ? ' · YOU' : ''}
            </div>
          </div>
          <div style="font-size:9px;letter-spacing:0.1em;color:#475569;margin-bottom:3px">CRITERIA TO ADVANCE</div>
          ${p.criteria.map(c => `
            <div style="font-size:11px;color:#94a3b8;display:flex;gap:5px;line-height:1.4;margin-bottom:2px">
              <span style="color:${section.accent};opacity:0.7;flex-shrink:0">→</span><span>${esc(c)}</span>
            </div>`).join('')}
          ${isNow && p.precautions.length ? `
            <div style="font-size:9px;letter-spacing:0.1em;color:#475569;margin:7px 0 3px">PRECAUTIONS AT THIS PHASE</div>
            ${p.precautions.map(c => `
              <div style="font-size:11px;color:#94a3b8;display:flex;gap:5px;line-height:1.4;margin-bottom:2px">
                <span style="color:#f87171;opacity:0.8;flex-shrink:0">✕</span><span>${esc(c)}</span>
              </div>`).join('')}` : ''}
        </div>`;
    }).join('');

    return `
      <div style="padding:12px 14px;background:rgba(255,255,255,0.03);
        border:1px solid rgba(255,255,255,0.08);border-radius:10px;margin-bottom:12px">
        <div style="font-size:11px;font-weight:700;color:#cbd5e1;letter-spacing:0.05em;margin-bottom:7px">
          YOUR SURGERY
        </div>
        <input type="date" id="hip-surgery-date" value="${esc(surgeryDate)}"
          style="width:100%;background:var(--bg-input);border:1px solid rgba(255,255,255,0.08);
            border-radius:7px;padding:8px 9px;color:var(--fg);font-size:13px;font-family:inherit">
        <div style="display:flex;gap:6px;margin-top:7px">
          ${['left', 'right'].map(side => `
            <button data-side="${side}" style="flex:1;padding:7px;border-radius:7px;cursor:pointer;
              font-size:12px;font-weight:${surgerySide === side ? '700' : '500'};
              background:${surgerySide === side ? section.accent : 'rgba(255,255,255,0.04)'};
              color:${surgerySide === side ? '#0f172a' : '#94a3b8'};
              border:1px solid ${surgerySide === side ? section.accent : 'rgba(255,255,255,0.08)'};
              text-transform:capitalize">${side} hip</button>`).join('')}
        </div>
        <input type="text" id="hip-surgery-proc" value="${esc(surgeryProc)}"
          placeholder="Procedure — e.g. labral repair + bone trim for impingement"
          style="width:100%;margin-top:7px;background:var(--bg-input);
            border:1px solid rgba(255,255,255,0.08);border-radius:7px;padding:8px 9px;
            color:var(--fg);font-size:12.5px;font-family:inherit">
        ${wk != null ? `<div style="font-size:11.5px;color:#94a3b8;margin-top:7px">
          ${wk} weeks post-op${current ? ` · ${esc(current.label)}` : ''}</div>` : ''}
      </div>

      ${phases}

      <div style="padding:12px 14px;background:rgba(56,189,248,0.07);
        border:1px solid rgba(56,189,248,0.2);border-radius:10px;margin-bottom:12px">
        <div style="font-size:11px;font-weight:700;color:#7dd3fc;letter-spacing:0.05em;margin-bottom:4px">
          IN THE PUBLISHED PROTOCOL, NOT IN YOUR PLAN
        </div>
        <div style="font-size:11px;color:#94a3b8;line-height:1.45;margin-bottom:8px">
          Mostly rotation and single-leg control work. Bring this list to your PT — do not add it
          to a repaired hip on your own.
        </div>
        ${PROTOCOL_GAPS.map(g => `
          <div style="font-size:11px;color:#94a3b8;display:flex;gap:6px;line-height:1.5">
            <span style="color:#7dd3fc;opacity:0.7;flex-shrink:0">·</span>
            <span style="flex:1">${esc(g.name)}</span>
            <span style="color:#475569;font-size:10px;flex-shrink:0">Ph ${esc(g.phase)}</span>
          </div>`).join('')}
      </div>

      <div style="font-size:10.5px;color:#475569;line-height:1.5;margin-bottom:12px">
        Source: <a href="${PROTOCOL_SOURCE.url}" target="_blank" rel="noopener noreferrer"
          style="color:#64748b">${esc(PROTOCOL_SOURCE.name)}</a>.
        A general FAI protocol, not your surgeon's. Your own operative details — labral repair vs.
        reconstruction, whether the capsule was closed — change the timeline.
      </div>`;
  }

  /** Post-pool cooldown — shown on the pool and aerobic sections. */
  function postPoolHTML(section) {
    return `
      <div style="padding:12px 14px;background:rgba(255,255,255,0.03);
        border:1px solid rgba(255,255,255,0.08);border-radius:10px;margin-bottom:12px">
        <div style="font-size:11px;font-weight:700;color:#cbd5e1;letter-spacing:0.05em;margin-bottom:8px">
          AFTER THE POOL
        </div>
        ${POST_POOL.map(item => `
          <div style="font-size:11.5px;color:#94a3b8;display:flex;gap:6px;padding:2px 0;line-height:1.45">
            <span style="color:${section.accent};flex-shrink:0;opacity:0.7">→</span>
            <span>${esc(item)}</span>
          </div>`).join('')}
      </div>`;
  }

  function scheduleHTML() {
    const dow = new Date().getDay();
    return `
      <div style="padding:12px 14px;background:rgba(255,255,255,0.03);
        border:1px solid rgba(255,255,255,0.08);border-radius:10px;margin-bottom:12px">
        <div style="font-size:11px;font-weight:700;color:#cbd5e1;letter-spacing:0.05em;margin-bottom:8px">
          WEEKLY SCHEDULE
        </div>
        ${WEEKLY_SCHEDULE.map((d, i) => `
          <div style="display:flex;gap:9px;align-items:baseline;padding:3px 0;
            ${i === dow ? 'color:#f1f5f9;font-weight:600' : 'color:#64748b'}">
            <span style="width:30px;flex-shrink:0;font-size:11px;
              color:${i === dow ? '#22d3ee' : '#475569'}">${d.day}</span>
            <span style="font-size:11.5px;line-height:1.4">${esc(d.focus)}</span>
            ${i === dow ? '<span style="font-size:9px;color:#22d3ee;letter-spacing:0.06em">TODAY</span>' : ''}
          </div>`).join('')}
      </div>`;
  }

  // ── Main render ────────────────────────────────────────────────────────────
  function mount() {
    const section = SECTIONS.find(s => s.id === activeId);
    const items   = section.exercises || [];
    const done    = items.filter(e => completed[e.id]).length;
    const total   = items.length;
    const pct     = total ? Math.round((done / total) * 100) : 0;
    const week    = weekNum();

    app.innerHTML = `
      <div style="margin-bottom:4px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
          <button id="hip-back" class="btn ghost" style="width:auto;padding:5px 10px;font-size:13px">← Plans</button>
          <div>
            <h1 style="margin:0;font-size:20px">Hip Recovery</h1>
            <div style="font-size:11px;color:var(--fg-dim);margin-top:1px">
              PT program · Pool progression · Driving strategy${week ? ` · Week ${week}` : ''}
            </div>
          </div>
        </div>

        <div style="display:flex;gap:3px;flex-wrap:wrap;margin-bottom:10px">
          ${['Pool-Based Aerobic', 'Psoas Focus', 'Pain Guides Load'].map(t =>
            `<span class="pill" style="font-size:10px;padding:2px 8px">${t}</span>`
          ).join('')}
        </div>

        <div style="padding:9px 12px;background:rgba(56,189,248,0.07);
          border:1px solid rgba(56,189,248,0.2);border-radius:8px;margin-bottom:10px">
          <div style="font-size:10px;letter-spacing:0.1em;color:#7dd3fc;font-weight:700;margin-bottom:3px">
            WORKING THEORY
          </div>
          <div style="font-size:11.5px;color:#94a3b8;line-height:1.45">
            PT thinks a tight psoas is driving this. That makes the hip flexor stretches the
            treatment rather than a warm-up afterthought — and makes the exercises that load the
            psoas worth a conversation. Surgeon said to come back if it is still bothering you at
            three months; the pain log below is what you bring to that visit.
          </div>
        </div>

        <div id="hip-tabs" style="display:flex;overflow-x:auto;gap:4px;padding-bottom:2px;scrollbar-width:none;
          -webkit-overflow-scrolling:touch">
          ${SECTIONS.map(tabHTML).join('')}
        </div>
      </div>

      <div style="padding:12px 14px;border-radius:10px;background:${section.bg};
        border-left:3px solid ${section.accent};margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
          <div style="flex:1">
            <div style="font-size:10px;letter-spacing:0.12em;font-weight:600;
              color:${section.accent};margin-bottom:3px;text-transform:uppercase">${esc(section.tag)}</div>
            <p style="font-size:12.5px;color:#94a3b8;margin:0;line-height:1.5">${esc(section.description)}</p>
            ${section.criteria ? `
              <div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.07)">
                <div style="font-size:9px;letter-spacing:0.1em;color:#475569;margin-bottom:5px">PROGRESS WHEN</div>
                ${section.criteria.map(c => `
                  <div style="font-size:11px;color:#64748b;display:flex;gap:5px;margin-bottom:3px;line-height:1.4">
                    <span style="color:${section.accent};flex-shrink:0;opacity:0.7">→</span>
                    <span>${esc(c)}</span>
                  </div>`).join('')}
              </div>` : ''}
          </div>
          ${total ? `
            <div style="text-align:right;flex-shrink:0">
              <div style="font-size:20px;font-weight:700;line-height:1;color:${section.accent}">${done}/${total}</div>
              <div style="font-size:10px;color:#475569;margin-top:1px;margin-bottom:5px">done today</div>
              <div style="width:56px;height:3px;background:rgba(255,255,255,0.08);
                border-radius:99px;overflow:hidden;margin-left:auto">
                <div style="height:100%;border-radius:99px;background:${section.accent};
                  width:${pct}%;transition:width 0.3s ease"></div>
              </div>
            </div>` : ''}
        </div>
      </div>

      ${sectionVideoHTML(section)}

      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:12px">
        ${items.map(ex => cardHTML(ex, section)).join('')}
        ${(section.guidance || []).map(g => guidanceHTML(g, section)).join('')}
      </div>

      ${section.benchmarks ? benchmarksHTML(section) : ''}

      ${activeId === 'aerobic' ? progressionHTML(section) : ''}
      ${['pool-mobility', 'pool-strength', 'aerobic'].includes(activeId) ? postPoolHTML(section) : ''}
      ${painHTML()}
      ${scheduleHTML()}

      ${!started ? `
        <button id="hip-begin" style="width:100%;padding:11px;border-radius:8px;cursor:pointer;
          background:rgba(8,145,178,0.10);border:1px solid #22d3ee;color:#22d3ee;
          font-size:13px;font-weight:600;margin-bottom:12px">▶ Start tracking this protocol</button>` : ''}

      <div style="padding-top:12px;border-top:1px solid rgba(255,255,255,0.06)">
        <div style="font-size:11px;color:#475569;line-height:1.55">
          From your Comprehensive Hip Recovery Playbook v4. Sets and reps are starting defaults —
          tap any SETS chip to match what your PT prescribed. Pain above 3/10 during or after a
          session means reduce load, not push through. Follow your physical therapist over this app.
        </div>
      </div>
    `;

    app.querySelector('#hip-back').onclick = () => navigate('programs');

    // The strip re-renders on every mount, so re-center the active tab — otherwise
    // picking a right-hand section scrolls back to the start and hides the selection.
    const $tabs = app.querySelector('#hip-tabs');
    const $activeTab = $tabs?.querySelector(`[data-section="${activeId}"]`);
    if ($tabs && $activeTab) {
      $tabs.scrollLeft = $activeTab.offsetLeft - ($tabs.clientWidth - $activeTab.offsetWidth) / 2;
    }

    app.querySelectorAll('[data-section]').forEach(btn => {
      btn.onclick = () => { activeId = btn.dataset.section; window.scrollTo(0, 0); mount(); };
    });

    app.querySelectorAll('[data-exid]').forEach(btn => {
      btn.onclick = () => toggle(btn.dataset.exid);
    });

    app.querySelectorAll('[data-pain]').forEach(btn => {
      btn.onclick = () => setPain(+btn.dataset.pain);
    });
    app.querySelector('#pain-clear')?.addEventListener('click', () => setPain(null));
    app.querySelector('#log-prev')?.addEventListener('click', () => shiftLogDate(-1));
    app.querySelector('#log-next')?.addEventListener('click', () => shiftLogDate(1));

    const $surgery = app.querySelector('#hip-surgery-date');
    if ($surgery) $surgery.addEventListener('change', async () => {
      surgeryDate = $surgery.value;
      await pref('hip_surgery_date', surgeryDate || null);
      mount();
    });

    app.querySelectorAll('[data-side]').forEach(btn => {
      btn.onclick = async () => {
        surgerySide = surgerySide === btn.dataset.side ? '' : btn.dataset.side;
        await pref('hip_surgery_side', surgerySide || null);
        mount();
      };
    });

    const $proc = app.querySelector('#hip-surgery-proc');
    if ($proc) $proc.addEventListener('blur', async () => {
      surgeryProc = $proc.value.trim();
      await pref('hip_surgery_procedure', surgeryProc || null);
    });

    const $note = app.querySelector('#hip-note');
    if ($note) $note.addEventListener('blur', () => saveNote($note.value));

    app.querySelector('#hip-summary')?.addEventListener('click', async () => {
      // Flush an unblurred edit so the summary reflects what's on screen.
      if ($note && $note.value !== note) await saveNote($note.value);
      const text = buildSummary();
      try {
        await navigator.clipboard.writeText(text);
        toast('Summary copied');
      } catch {
        // Clipboard needs a secure context / permission — fall back to a selectable sheet.
        openSummarySheet(text);
      }
    });

    app.querySelector('#hip-begin')?.addEventListener('click', async () => {
      await begin();
      toast('Hip protocol started');
      mount();
    });

    app.querySelectorAll('[data-editrx]').forEach(btn => {
      btn.onclick = () => {
        const ex = (section.exercises || []).find(e => e.id === btn.dataset.editrx);
        if (!ex) return;
        const next = prompt(`Sets / reps for ${ex.name}`, rxFor(ex));
        if (next === null) return;
        const trimmed = next.trim();
        // Clearing the field (or typing the original) drops back to the default.
        setRx(ex.id, trimmed && trimmed !== ex.sets ? trimmed : '').then(mount);
      };
    });
  }

  mount();
}
