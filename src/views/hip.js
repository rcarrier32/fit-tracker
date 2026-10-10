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
  SECTIONS, EXERCISE_INDEX, weeklySchedule, hipToday, sideHipCount, plannedSideHip,
  AEROBIC_PROGRESSION, POST_POOL,
  PROTOCOL_PHASES, PROTOCOL_GAPS, PROTOCOL_SOURCE, FLARE,
  HIP_LADDERS, LADDER_UNLOCK_SESSIONS,
} from '../lib/hip_protocol.js';
import { localDateStr } from '../lib/date.js';
import { esc, setCount, exerciseRowHTML, wireExerciseRows, openExerciseDetail } from '../lib/exercise_ui.js';

const todayKey = () => localDateStr();

const PAIN_COLORS = ['#34d399', '#34d399', '#34d399', '#a3e635', '#fbbf24', '#fbbf24',
                     '#fb923c', '#fb923c', '#f87171', '#f87171', '#ef4444'];

export async function renderHip(app) {
  const day = todayKey();

  // ── Persisted state ────────────────────────────────────────────────────────
  const [savedProgress, allLogs, savedRx, allPain, allNotes, savedFlare, savedPaused, savedCustom, allSets, savedLevels] = await Promise.all([
    pref('hip_progress'),
    pref('hip_logs').then(v => v || {}),
    pref('hip_prescriptions').then(v => v || {}),
    pref('hip_pain').then(v => v || {}),
    pref('hip_notes').then(v => v || {}),
    pref('hip_flare'),
    pref('hip_paused').then(v => v || {}),
    pref('hip_custom').then(v => v || []),
    pref('hip_sets').then(v => v || {}),
    pref('hip_levels').then(v => v || {}),
  ]);
  let surgeryDate = (await pref('hip_surgery_date')) || '';
  let surgerySide = (await pref('hip_surgery_side')) || '';        // 'left' | 'right' | ''
  let surgeryProc = (await pref('hip_surgery_procedure')) || '';   // free text

  let started    = savedProgress?.started || null;
  let activeId   = SECTIONS[0].id;
  let completed  = { ...(allLogs[day] || {}) };
  let setsDone   = { ...(allSets[day] || {}) };
  let levels     = { ...savedLevels };      // plan exercise id → { step, since } on its ladder   // exercise id → [bool per set], today only
  let rx         = { ...savedRx };          // exercise id → custom "sets" string
  let flare      = savedFlare || null;      // { since } while flare mode is on
  let paused     = { ...savedPaused };      // exercise id → { since, reason }
  let custom     = [...savedCustom];        // your own exercises: { id, sectionId, name, sets, link, notes, sideHip }
  // The pain/note card can step back through history to backfill a missed day. Exercise
  // check-offs always apply to today — only this log is date-navigable.
  let logDate    = day;
  let pain       = allPain[logDate] ?? null;   // 0–10 or null
  let note       = allNotes[logDate] || '';    // free-text symptom note

  // Open on the section that matches today's schedule, when there is one.
  const week7 = weeklySchedule(new Date());
  const todaySched = week7[new Date().getDay()];
  // Open on today's main work: the strength session, or Pelvic Reset on easy/flare days.
  activeId = hipToday({ flare, paused, custom }).sectionId;

  // ── Persistence ────────────────────────────────────────────────────────────
  async function begin() {
    started = day;
    await pref('hip_progress', { started: day });
  }

  /** Check an exercise off (or back on) for today; celebrates the last one in a section. */
  async function setDone(exId, value) {
    const section = SECTIONS.find(s => s.id === activeId);
    const live = sectionItems(section).filter(e => !paused[e.id]);
    const wasComplete = live.length && live.every(e => completed[e.id]);
    completed[exId] = value;
    const logs = (await pref('hip_logs')) || {};
    logs[day] = { ...(logs[day] || {}), [exId]: value };
    await pref('hip_logs', logs);
    if (!value && setsDone[exId]?.every(Boolean)) await saveSets(exId, setsDone[exId].map(() => false));
    mount();
    if (!wasComplete && live.length && live.every(e => completed[e.id])) {
      toast(`🎉 ${section.label} complete`, 2600);
    }
  }

  const toggle = (exId) => setDone(exId, !completed[exId]);

  async function saveSets(exId, arr) {
    setsDone[exId] = arr;
    const all = (await pref('hip_sets')) || {};
    // Only today's entry is ever read back, so older days are dropped on write.
    all[day] = { ...(all[day] || {}), [exId]: arr };
    await pref('hip_sets', { [day]: all[day] });
  }

  async function setRx(exId, value) {
    const all = (await pref('hip_prescriptions')) || {};
    if (value) all[exId] = value; else delete all[exId];
    rx = all;
    await pref('hip_prescriptions', all);
  }

  /** Turning flare mode on seeds the known aggravators; turning it off leaves pauses alone. */
  async function setFlare(on) {
    flare = on ? { since: day } : null;
    await pref('hip_flare', flare);
    if (on) {
      for (const p of FLARE.defaultPauses) {
        if (!paused[p.id]) paused[p.id] = { since: day, reason: p.reason };
      }
      await pref('hip_paused', paused);
    }
    mount();
  }

  async function setPaused(exId, reason) {
    if (reason === null) delete paused[exId];
    else paused[exId] = { since: day, reason };
    await pref('hip_paused', paused);
    mount();
  }

  /** A custom entry shaped like a protocol exercise so the normal card renders it. */
  function customEx(c) {
    return {
      id: c.id, name: c.name, subtitle: 'Your exercise', sets: c.sets || '—', freq: 'Your addition',
      cues: (c.notes || '').split('\n').map(t => t.trim()).filter(Boolean),
      link: c.link || null, search: c.name, source: 'Custom', custom: true,
    };
  }

  /**
   * The version of an exercise you're on. Shown with the harder step's name/dose/cues,
   * but it keeps the plan exercise's id so logs, pauses and side-hip counts don't move.
   */
  function atLevel(ex) {
    const ladder = HIP_LADDERS[ex.id];
    const step = levels[ex.id]?.step || 0;
    if (!ladder || !step) return ex;
    const lv = EXERCISE_INDEX[ladder.steps[step]];
    if (!lv) return ex;
    return { ...lv, id: ex.id, levelId: lv.id, freq: ex.freq, source: ex.source };
  }

  /** Pain-free sessions (≤ 3/10 or unlogged) with this exercise done since reaching its step. */
  function sessionsAtLevel(exId) {
    const since = levels[exId]?.since || '';
    const logs = { ...allLogs, [day]: completed };
    return Object.entries(logs).filter(([d, l]) => d >= since && l?.[exId] && !((allPain[d] ?? 0) > 3)).length;
  }

  async function setLevel(exId, step) {
    if (step) levels[exId] = { step, since: day }; else delete levels[exId];
    await pref('hip_levels', levels);
    // The old SETS override was for the old version.
    if (rx[exId]) await setRx(exId, '');
    mount();
  }

  /** A section's protocol exercises plus any you've added to it. */
  const sectionItems = (section) => [
    ...(section.exercises || []).map(atLevel),
    ...custom.filter(c => c.sectionId === section.id).map(customEx),
  ];

  const nameOf = (exId) => EXERCISE_INDEX[exId]?.name || custom.find(c => c.id === exId)?.name || exId;

  async function saveCustom(next) {
    custom = next;
    await pref('hip_custom', custom);
    mount();
  }

  /** Only http(s) links are kept — anything else is dropped rather than rendered as a href. */
  function safeLink(raw) {
    try {
      const u = new URL(raw.trim());
      return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
    } catch { return null; }
  }

  function openAddSheet(section) {
    openSheet((sheet, close) => {
      sheet.innerHTML = `
        <h2>Add to ${esc(section.label)}</h2>
        <label>Name</label>
        <input type="text" id="cx-name" autocomplete="off" placeholder="e.g. Sidelying grounding">
        <label>Sets / reps (optional)</label>
        <input type="text" id="cx-sets" placeholder="e.g. 3 × 5 breaths">
        <label>Video or post link (optional)</label>
        <input type="url" id="cx-link" placeholder="https://…">
        <label>Notes / cues (optional, one per line)</label>
        <textarea id="cx-notes" rows="3" style="width:100%;background:var(--bg-input);border:1px solid var(--border);
          border-radius:8px;padding:8px;color:var(--fg);font-family:inherit;font-size:13px"></textarea>
        <label style="display:flex;gap:8px;align-items:center;margin-top:10px">
          <input type="checkbox" id="cx-side" style="width:auto"> Side-hip work (counts toward the weekly side-hip total)
        </label>
        <button class="btn" id="cx-save" style="margin-top:14px">Add</button>
      `;
      sheet.querySelector('#cx-name').focus();
      sheet.querySelector('#cx-save').onclick = async () => {
        const name = sheet.querySelector('#cx-name').value.trim();
        if (!name) { toast('Give it a name'); return; }
        const rawLink = sheet.querySelector('#cx-link').value;
        const link = rawLink.trim() ? safeLink(rawLink) : null;
        if (rawLink.trim() && !link) { toast('That link needs to start with http:// or https://'); return; }
        const entry = {
          id: `custom-${Date.now().toString(36)}`,
          sectionId: section.id,
          name,
          sets: sheet.querySelector('#cx-sets').value.trim(),
          link,
          notes: sheet.querySelector('#cx-notes').value.trim(),
          sideHip: sheet.querySelector('#cx-side').checked,
        };
        close();
        await saveCustom([...custom, entry]);
        toast(`Added to ${section.label}`);
      };
    });
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

    if (flare) {
      lines.push(`FLARE MODE — on since ${flare.since}`);
      lines.push('  ' + FLARE.summary);
      lines.push('');
    }
    const leveled = Object.entries(levels).filter(([id, l]) => l?.step && HIP_LADDERS[id]);
    if (leveled.length) {
      lines.push('PROGRESSED TO HARDER VERSIONS');
      for (const [id, l] of leveled) {
        const lv = EXERCISE_INDEX[HIP_LADDERS[id].steps[l.step]];
        lines.push(`  ${EXERCISE_INDEX[id]?.name || id} → ${lv?.name || '?'} — since ${l.since}`);
      }
      lines.push('');
    }

    const pausedIds = Object.keys(paused);
    if (pausedIds.length) {
      lines.push('PAUSED EXERCISES');
      for (const exId of pausedIds) {
        const ex = { name: nameOf(exId) };
        lines.push(`  ${ex ? ex.name : exId} — since ${paused[exId].since}${paused[exId].reason ? `: ${paused[exId].reason}` : ''}`);
      }
      lines.push('');
    }

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
          const ex = { name: nameOf(exId) };
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
        const ex = { name: nameOf(exId) };
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

  function setsFor(ex) {
    const n = setCount(rxFor(ex));
    const saved = setsDone[ex.id] || [];
    const arr = Array.from({ length: n }, (_, i) => !!saved[i]);
    return completed[ex.id] ? arr.map(() => true) : arr;
  }

  const cardHTML = (ex, section) => exerciseRowHTML(ex, {
    accent: section.accent, rx: rxFor(ex), edited: !!rx[ex.id],
    done: !!completed[ex.id], sets: setsFor(ex),
    badge: HIP_LADDERS[ex.id] && levels[ex.id]?.step
      ? `LEVEL ${levels[ex.id].step + 1} OF ${HIP_LADDERS[ex.id].steps.length}` : '',
  });

  function ladderFor(ex) {
    const ladder = HIP_LADDERS[ex.id];
    if (!ladder) return null;
    const step = levels[ex.id]?.step || 0;
    const last = step >= ladder.steps.length - 1;
    const n = sessionsAtLevel(ex.id);
    const ready = !flare && !last && n >= LADDER_UNLOCK_SESSIONS;
    return {
      name: ladder.name,
      current: step,
      steps: ladder.steps.map(id => ({ name: EXERCISE_INDEX[id]?.name || id })),
      ready,
      note: flare ? 'Flare mode — stay at this level (or drop one) until it settles.'
        : last ? 'Top of this ladder. Progress with load, range, or slower tempo.'
        : ready ? `${n} pain-free sessions at this level — ready to try the next one if it feels right (and your PT agrees).`
        : `${n} of ${LADDER_UNLOCK_SESSIONS} pain-free sessions at this level before moving up. Drop back any time it hurts.`,
      onChange: async (next, close) => {
        const target = EXERCISE_INDEX[ladder.steps[next]]?.name;
        if (next > step && !confirm(`Move up to ${target}? Go back down if it hurts above 3/10.`)) return;
        close(false);
        await setLevel(ex.id, next);
        openExerciseSheet(ex.id);
      },
    };
  }

  /** FKH-style exercise detail: video on top, then sets, then how-to. */
  function openExerciseSheet(exId) {
    const section = SECTIONS.find(s => s.id === activeId);
    const list = () => sectionItems(section).filter(e => !paused[e.id]);
    const ex = list().find(e => e.id === exId);
    if (!ex) return;
    openExerciseDetail(ex, {
      accent: section.accent,
      rx: rxFor(ex),
      editRx: async () => {
        const v = prompt(`Sets / reps for ${ex.name}`, rxFor(ex));
        if (v === null) return null;
        const t = v.trim();
        // Clearing the field (or typing the original) drops back to the default.
        await setRx(ex.id, t && t !== ex.sets ? t : '');
        mount();
        return rxFor(ex);
      },
      sets: { get: () => setsDone[ex.id] || [], save: (arr) => saveSets(ex.id, arr) },
      isDone: () => !!completed[ex.id],
      setDone: (v) => setDone(ex.id, v),
      next: () => {
        const items = list();
        const i = items.findIndex(e => e.id === ex.id);
        const n = [...items.slice(i + 1), ...items.slice(0, i)].find(e => !completed[e.id]);
        return n ? { name: n.name, open: () => openExerciseSheet(n.id) } : null;
      },
      completeLabel: `${section.label} complete`,
      ladder: ladderFor(ex),
      actions: [
        { label: 'Pause — it provokes the hip', onClick: (close) => {
          const reason = prompt(`Pause ${ex.name}? Why (optional)`, 'Provokes the hip');
          if (reason === null) return;
          close();
          setPaused(ex.id, reason.trim());
        } },
        ...(ex.custom ? [{ label: 'Remove', danger: true, onClick: (close) => {
          const c = custom.find(x => x.id === ex.id);
          if (!c || !confirm(`Remove ${c.name}?`)) return;
          close();
          saveCustom(custom.filter(x => x.id !== c.id));
        } }] : []),
      ],
    });
  }

  /** Shown above the list once every live exercise in the section is checked off. */
  function completeHTML(section, total) {
    const isToday = hipToday({ flare, paused, custom }).sectionId === section.id;
    return `
      <div style="padding:14px;border-radius:12px;text-align:center;
        background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.3)">
        <div style="font-size:26px;line-height:1">🎉</div>
        <div style="font-size:15px;font-weight:700;color:#22c55e;margin-top:6px">
          ${isToday ? "Today's session complete" : `${esc(section.label)} complete`}</div>
        <div style="font-size:11.5px;color:#94a3b8;margin-top:4px;line-height:1.45">
          ${total} exercise${total === 1 ? '' : 's'} done. Log how the hip feels below — that is what guides next time.</div>
        <button id="hip-to-pain" class="btn ghost" style="width:auto;margin-top:10px;padding:6px 14px;font-size:12px">
          Log pain ↓</button>
      </div>`;
  }

  function pausedDays(since) {
    const n = Math.round((new Date(day + 'T12:00:00') - new Date(since + 'T12:00:00')) / 864e5);
    return n <= 0 ? 'Paused today' : `Paused ${n} day${n === 1 ? '' : 's'}`;
  }

  /** Collapsed card for a paused exercise — out of the session, one tap to resume. */
  function pausedCardHTML(ex) {
    const p = paused[ex.id];
    return `
      <div style="background:rgba(255,255,255,0.02);border:1px dashed rgba(251,146,60,0.35);
        border-radius:12px;padding:10px 12px;display:flex;gap:10px;align-items:flex-start">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:3px">
            <span style="font-size:13px;font-weight:700;color:#94a3b8;line-height:1.3">${esc(ex.name)}</span>
            <span style="font-size:9px;padding:1px 5px;border-radius:3px;letter-spacing:0.06em;
              background:rgba(251,146,60,0.12);border:1px solid rgba(251,146,60,0.3);color:#fdba74">
              PAUSED · ${esc(p.since.slice(5))}</span>
          </div>
          ${p.reason ? `<div style="font-size:11px;color:#64748b;line-height:1.4">${esc(p.reason)}</div>` : ''}
          <div style="font-size:10.5px;color:#64748b;line-height:1.4;margin-top:4px">
            <span style="color:#94a3b8;font-weight:600">${pausedDays(p.since)} · </span>${esc(FLARE.returnRule)}
          </div>
        </div>
        <button data-resume="${ex.id}" style="flex-shrink:0;font-size:11px;padding:5px 10px;
          border-radius:6px;cursor:pointer;background:transparent;border:1px solid rgba(255,255,255,0.15);
          color:#94a3b8">Resume</button>
      </div>`;
  }

  function flareListHTML(label, items, color) {
    return `
      <div style="font-size:10px;letter-spacing:0.1em;color:${color};font-weight:700;margin:10px 0 5px">${label}</div>
      ${items.map(i => `
        <div style="font-size:11.5px;color:#94a3b8;display:flex;gap:5px;line-height:1.45;margin-bottom:4px">
          <span style="flex-shrink:0;font-weight:700;color:${color}">→</span>
          <span><span style="color:#e2e8f0;font-weight:600">${esc(i.title)}.</span> ${esc(i.detail)}</span>
        </div>`).join('')}`;
  }

  /** Replaces the working-theory banner while flare mode is on. */
  function flareHTML() {
    const pausedHere = Object.keys(paused).length;
    return `
      <div style="padding:11px 13px;background:rgba(251,146,60,0.07);
        border:1px solid rgba(251,146,60,0.3);border-radius:8px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:4px">
          <div style="font-size:10px;letter-spacing:0.1em;color:#fdba74;font-weight:700">
            FLARE MODE · SINCE ${esc(flare.since.slice(5))}
          </div>
          <button id="flare-off" style="font-size:10px;padding:2px 8px;border-radius:5px;cursor:pointer;
            background:transparent;border:1px solid rgba(255,255,255,0.12);color:#64748b">End flare</button>
        </div>
        <div style="font-size:11.5px;color:#94a3b8;line-height:1.45">${esc(FLARE.summary)}</div>
        <div style="font-size:11px;color:#64748b;line-height:1.45;margin-top:5px">
          Psoas theory is on hold until this is reassessed.
          ${pausedHere ? `${pausedHere} exercise${pausedHere === 1 ? '' : 's'} paused — open any exercise that provokes it and tap Pause.` : ''}
        </div>

        <details style="margin-top:8px">
          <summary style="font-size:11px;color:#fdba74;cursor:pointer;font-weight:600">
            Calm-down plan · pelvis & positions</summary>
          ${flareListHTML('CALM IT DOWN', FLARE.calm, '#fdba74')}
          ${flareListHTML('PELVIS & POSITIONS', FLARE.positions, '#fdba74')}
        </details>

        <div style="margin-top:10px;font-size:11px;padding:6px 9px;background:rgba(239,68,68,0.08);
          border:1px solid rgba(239,68,68,0.22);border-radius:6px;color:#fca5a5;line-height:1.45">
          <span style="font-weight:700;letter-spacing:0.04em">STOP IF · </span>${esc(FLARE.stopIf)}
        </div>
        <div style="margin-top:6px;font-size:11px;padding:6px 9px;background:rgba(239,68,68,0.12);
          border:1px solid rgba(239,68,68,0.35);border-radius:6px;color:#fecaca;line-height:1.45">
          <span style="font-weight:700;letter-spacing:0.04em">GET SEEN · </span>${esc(FLARE.urgent)}
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
      <div id="hip-pain" style="padding:12px 14px;background:rgba(255,255,255,0.03);
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

  /** This week's side-hip exercises vs last week and vs the A/B plan. */
  function sideHipHTML() {
    const extra = custom.filter(c => c.sideHip).map(c => c.id);
    // allLogs is the load-time snapshot; overlay today's live check-offs.
    const logs = { ...allLogs, [day]: completed };
    const now = new Date();
    const lastWeek = new Date(now); lastWeek.setDate(now.getDate() - 7);
    const thisN = sideHipCount(logs, now, extra);
    const lastN = sideHipCount(logs, lastWeek, extra);
    const planned = plannedSideHip(now);
    return `
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;
        padding:2px 0 10px;margin-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.06)">
        <div style="font-size:11.5px;color:#94a3b8;line-height:1.4">
          <span style="color:#f1f5f9;font-weight:600">Side-hip exercises this week</span><br>
          <span style="font-size:10.5px;color:#64748b">Last week ${lastN} · plan ~${planned}${flare ? ' · flaring: stay below last week' : ''}</span>
        </div>
        <div style="font-size:20px;font-weight:700;color:${flare && lastN && thisN > lastN ? '#fdba74' : '#e2e8f0'}">${thisN}</div>
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
        ${sideHipHTML()}
        ${flare ? `<div style="font-size:11px;color:#fdba74;line-height:1.45;margin-bottom:6px">
          Flare mode: today is Pelvic Reset + a short easy walk, whatever the schedule says.</div>` : ''}
        ${week7.map((d, i) => `
          <div style="display:flex;gap:9px;align-items:baseline;padding:3px 0;
            ${i === dow ? 'color:#f1f5f9;font-weight:600' : 'color:#64748b'}">
            <span style="width:30px;flex-shrink:0;font-size:11px;
              color:${i === dow ? '#38bdf8' : '#475569'}">${d.day}</span>
            <span style="font-size:11.5px;line-height:1.4">${esc(d.focus)}</span>
            ${i === dow ? '<span style="font-size:9px;color:#38bdf8;letter-spacing:0.06em">TODAY</span>' : ''}
          </div>`).join('')}
      </div>`;
  }

  // ── Main render ────────────────────────────────────────────────────────────
  function mount() {
    const section = SECTIONS.find(s => s.id === activeId);
    const all     = sectionItems(section);
    const items   = all.filter(e => !paused[e.id]);
    const pausedItems = all.filter(e => paused[e.id]);
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
              Sessions A/B · Pelvic Reset · Driving strategy${week ? ` · Week ${week}` : ''}
            </div>
          </div>
        </div>

        <div style="display:flex;gap:3px;flex-wrap:wrap;margin-bottom:10px">
          ${['3× / week · A/B', flare ? 'Flare — Calm Down' : 'Psoas Focus', 'Pain Guides Load'].map(t =>
            `<span class="pill" style="font-size:10px;padding:2px 8px">${t}</span>`
          ).join('')}
        </div>

        ${flare ? flareHTML() : `
        <div style="padding:9px 12px;background:rgba(56,189,248,0.07);
          border:1px solid rgba(56,189,248,0.2);border-radius:8px;margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:3px">
            <div style="font-size:10px;letter-spacing:0.1em;color:#7dd3fc;font-weight:700">
              WORKING THEORY
            </div>
            <button id="flare-on" style="font-size:10px;padding:2px 8px;border-radius:5px;cursor:pointer;
              background:transparent;border:1px solid rgba(251,146,60,0.35);color:#fdba74">Flare mode</button>
          </div>
          <div style="font-size:11.5px;color:#94a3b8;line-height:1.45">
            PT thinks a tight psoas is driving this. That makes the hip flexor stretches the
            treatment rather than a warm-up afterthought — and makes the exercises that load the
            psoas worth a conversation. Surgeon said to come back if it is still bothering you at
            three months; the pain log below is what you bring to that visit.
          </div>
        </div>`}

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

      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px">
        ${total && done === total ? completeHTML(section, total) : ''}
        ${items.map(ex => cardHTML(ex, section)).join('')}
        ${pausedItems.map(pausedCardHTML).join('')}
        ${(section.guidance || []).map(g => guidanceHTML(g, section)).join('')}
        ${section.exercises?.length ? `
          <button id="hip-add" style="width:100%;padding:9px;border-radius:10px;cursor:pointer;
            background:transparent;border:1px dashed rgba(255,255,255,0.18);color:#94a3b8;
            font-size:12px;font-weight:600">+ Add your own exercise to ${esc(section.label)}</button>` : ''}
      </div>

      ${section.benchmarks ? benchmarksHTML(section) : ''}

      ${activeId === 'aerobic' ? progressionHTML(section) : ''}
      ${['pool-mobility', 'pool-strength', 'aerobic'].includes(activeId) ? postPoolHTML(section) : ''}
      ${painHTML()}
      ${scheduleHTML()}

      ${!started ? `
        <button id="hip-begin" style="width:100%;padding:11px;border-radius:8px;cursor:pointer;
          background:rgba(2,132,199,0.10);border:1px solid #38bdf8;color:#38bdf8;
          font-size:13px;font-weight:600;margin-bottom:12px">▶ Start tracking this protocol</button>` : ''}

      <div style="padding-top:12px;border-top:1px solid rgba(255,255,255,0.06)">
        <div style="font-size:11px;color:#475569;line-height:1.55">
          From your Comprehensive Hip Recovery Playbook v4, merged with your Motion RC plan into
          Sessions A and B. Tap any SETS chip to match what your PT or coach prescribed. Pain above 3/10 during or after a
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

    wireExerciseRows(app, { open: openExerciseSheet, check: toggle });
    app.querySelector('#hip-to-pain')?.addEventListener('click', () => {
      app.querySelector('#hip-pain')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    app.querySelector('#flare-on')?.addEventListener('click', () => {
      setFlare(true);
      toast('Flare mode on — known aggravators paused');
    });
    app.querySelector('#flare-off')?.addEventListener('click', () => {
      if (!confirm('End flare mode? Paused exercises stay paused until you resume each one.')) return;
      setFlare(false);
    });

    app.querySelector('#hip-add')?.addEventListener('click', () => openAddSheet(section));

    app.querySelectorAll('[data-resume]').forEach(btn => {
      btn.onclick = () => {
        const ex = sectionItems(section).find(e => e.id === btn.dataset.resume);
        if (!ex) return;
        if (!confirm(`Resume ${ex.name}? Best once your PT has OK'd it or the flare has settled.`)) return;
        setPaused(ex.id, null);
      };
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

  }

  mount();
}
