/**
 * Program browser + Start a Plan flow.
 * Opens as a full-screen view (not a sheet) so there's room to browse.
 */
import { loadCatalogs } from '../lib/static_data.js';
import { startPlan, getActivePlan, getAllPlans, endPlan, currentWeek, planProgress } from '../lib/plans.js';
import { toast, openSheet, navigate } from '../app.js';
import { SPLIT_TEMPLATES, AB_SLOTS, suggestForSlot, autoFillDay } from '../lib/plan_builder.js';
import { pref } from '../db.js';
import { programName, selectSingleProgram, programKind } from './schedule.js';
import { localDateStr } from '../lib/date.js';
import { openBandDatabase } from './band_db.js';
import { generatePlan, swapInPlan, estimateMinutes, FOCUS_GROUPS } from '../lib/generator.js';
import { hasVideo, rankSimilar, tagLine, EQUIPMENT_LABEL, muscleLabel } from '../lib/taxonomy.js';

// Filter chips: matched on a program's name, group and source only (descriptions mention too much).
const CATEGORIES = [
  ['All', () => true],
  ['Strength', (t) => /strength|split|upper|lower|full body|lean|bws|ab routine|muscle/.test(t)],
  ['Hip & mobility', (t) => /hip|mobility|recovery|durability|griffith|trainheroic/.test(t)],
  ['Plyo & athletic', (t) => /plyo|agility|court|athlet|speed|jump/.test(t)],
  ['Home', (t) => /home|band/.test(t)],
  ['Rehab', (t) => /rehab|tos|playbook|hip plan/.test(t)],
];
let _filter = 'All';
let _query = '';
const _closed = new Set(['BWS Strength', 'PJF Performance']);   // collapsed sections (big lists start closed)

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const haystack = (p) => [programName(p), p.group, p.source, p.description, p.goal, p.level].filter(Boolean).join(' ').toLowerCase();

function metaLine(p) {
  const weeks = p.weeks ? `${p.weeks.length} wk` : `${p.days?.length || '?'}-day rotation`;
  return [weeks, p.sessions_per_week ? `${p.sessions_per_week}×/wk` : null,
    p.session_length_min ? `${p.session_length_min} min` : null, p.level || null].filter(Boolean).join(' · ');
}

export async function renderPrograms(app) {
  const [{ programs }, activePlan, tosProgress, hipProgress, customPrograms] = await Promise.all([
    loadCatalogs(),
    getActivePlan(),
    pref('tos_progress'),
    pref('hip_progress'),
    pref('custom_programs').then(v => v || []),
  ]);

  const hipWeek = hipProgress?.started
    ? Math.max(1, Math.floor(Math.floor((Date.now() - new Date(hipProgress.started + 'T12:00:00')) / 864e5) / 7) + 1)
    : null;

  // Sections, in order: my plans, rehab & references, built groups, BWS, PJF.
  const groups = new Map();
  for (const p of programs.filter(p => p.source !== 'BWS' && p.source !== 'PJF')) {
    const g = p.group || p.source;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(p);
  }
  const rows = [];   // { section, key, title, meta, text, active, open }
  const add = (section, p, open, extra = {}) => rows.push({ section, title: programName(p), meta: metaLine(p),
    text: haystack(p), cat: [programName(p), p.group, p.source === 'BWS' ? 'bws' : ''].join(' ').toLowerCase(), active: activePlan?.program_id === p.id, open, ...extra });
  for (const p of customPrograms) rows.push({ section: 'My Plans', title: p.name, active: activePlan?.program_id === p.id,
    meta: p.weeks ? `${p.weeks.length} wk · ${p.sessions_per_week || p.weeks[0].days.length}×/wk · ${p.generated ? 'Generated' : 'Custom'}` : `${p.days.length}-day rotation · Custom`,
    text: `${p.name} my plan custom generated`.toLowerCase(), open: () => openCustomPlanActions(p, activePlan, () => renderPrograms(app)), custom: p });
  for (const [g, list] of groups) for (const p of list) add(g, p, () => openStartPlanSheet(p, () => renderPrograms(app)));
  for (const p of programs.filter(p => p.source === 'BWS')) add('BWS Strength', p, () => openStartPlanSheet(p, () => renderPrograms(app)));
  for (const p of programs.filter(p => p.source === 'PJF')) add('PJF Performance', p, () => openStartPlanSheet(p, () => renderPrograms(app)));
  rows.push({ section: 'Rehab & References', title: 'TOS + Scapular Dyskinesis', meta: '12 weeks · 5 phases · swimming inclusive',
    text: 'tos rehab thoracic outlet scapular shoulder swim', cat: 'tos rehab', open: () => navigate('tos'), badge: tosProgress ? 'Active' : null });
  rows.push({ section: 'Rehab & References', title: 'Hip Recovery Playbook', meta: `Warm-up · Pelvic Reset · Recovery · Pool${hipWeek ? ` · Week ${hipWeek}` : ''}`,
    text: 'hip recovery playbook rehab mobility pool pelvic', cat: 'hip rehab playbook mobility', open: () => navigate('hip') });
  rows.push({ section: 'Rehab & References', title: 'PJF Band Exercise Database', meta: 'Every PJF band move with its demo',
    text: 'pjf band database mobility strength agility speed home', cat: 'band home', open: () => openBandDatabase() });

  app.innerHTML = `
    <h1>Programs</h1>
    ${activePlan ? renderActivePlanCard(activePlan, [...programs, ...customPrograms]) : ''}
    ${tosProgress ? renderActiveTOSCard(tosProgress) : ''}

    <input type="text" inputmode="search" id="prog-search" placeholder="🔍  Search programs…" value="${esc(_query)}" autocomplete="off" style="margin-bottom:8px">
    <div id="prog-chips" style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;margin-bottom:6px;scrollbar-width:none">
      ${CATEGORIES.map(([c]) => `<button class="pill${c === _filter ? ' accent' : ''}" data-cat="${c}" style="white-space:nowrap;cursor:pointer;padding:6px 12px;font-size:13px">${c}</button>`).join('')}
    </div>
    <div id="prog-sections"></div>

    <div class="list-item" style="margin-top:14px;cursor:default">
      <div style="flex:1;min-width:0">
        <div class="list-item-title">Build my own plan</div>
        <div class="list-item-meta">From every exercise in the app</div>
      </div>
      <button class="btn" id="gen-plan" style="width:auto;padding:0 12px;min-height:36px;font-size:13px">✨ Generate</button>
      <button class="btn secondary" id="build-plan" style="width:auto;padding:0 12px;min-height:36px;font-size:13px">Manual</button>
    </div>
  `;

  const $sections = app.querySelector('#prog-sections');
  function draw() {
    const q = _query.trim().toLowerCase();
    const test = CATEGORIES.find(([c]) => c === _filter)[1];
    const shown = rows.filter(r => (q ? q.split(/\s+/).every(w => (r.title + ' ' + r.text + ' ' + r.section).toLowerCase().includes(w)) : true)
      && (_filter === 'All' || test((r.cat || r.text).toLowerCase())));
    const bySection = new Map();
    for (const r of shown) { if (!bySection.has(r.section)) bySection.set(r.section, []); bySection.get(r.section).push(r); }
    const filtering = !!q || _filter !== 'All';
    $sections.innerHTML = shown.length ? [...bySection].map(([sec, list]) => {
      const open = filtering || !_closed.has(sec);
      return `<details ${open ? 'open' : ''} data-sec="${esc(sec)}" style="margin-top:6px">
        <summary class="group-label" style="cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center">
          <span>${esc(sec)}</span><span class="muted" style="font-size:12px">${list.length} ${open ? '▾' : '▸'}</span>
        </summary>
        ${list.map(r => `<div class="list-item" data-row="${rows.indexOf(r)}" style="padding:9px 12px;margin-bottom:6px">
          <div style="flex:1;min-width:0">
            <div class="list-item-title" style="font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.title)}${r.active || r.badge ? ` <span class="pill accent" style="font-size:10px;margin-left:4px">${r.badge || 'Active'}</span>` : ''}</div>
            <div class="list-item-meta" style="font-size:12px">${esc(r.meta)}</div>
          </div>
          <span class="muted" style="font-size:18px">›</span>
        </div>`).join('')}
      </details>`;
    }).join('') : `<div class="empty" style="padding:24px">No programs match. Try another word or filter.</div>`;
    $sections.querySelectorAll('[data-row]').forEach(el => { el.onclick = () => rows[+el.dataset.row].open(); });
    $sections.querySelectorAll('details').forEach(d => d.addEventListener('toggle', () => {
      if (filtering) return;
      d.open ? _closed.delete(d.dataset.sec) : _closed.add(d.dataset.sec);
      d.querySelector('summary .muted').textContent = `${d.querySelectorAll('[data-row]').length} ${d.open ? '▾' : '▸'}`;
    }));
  }
  draw();

  app.querySelector('#prog-search').oninput = (e) => { _query = e.target.value; draw(); };
  app.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => {
    _filter = b.dataset.cat;
    app.querySelectorAll('[data-cat]').forEach(x => x.classList.toggle('accent', x.dataset.cat === _filter));
    draw();
  });

  app.querySelector('#gen-plan').onclick = () => openGeneratorWizard(() => renderPrograms(app));
  app.querySelector('#build-plan').onclick = async () => {
    const { exercises } = await loadCatalogs();
    openPlanBuilder(exercises, () => renderPrograms(app));
  };

  if (activePlan) {
    app.querySelector('[data-action="continue-plan"]')?.addEventListener('click', () => navigate('workout'));
    app.querySelector('[data-action="plan-menu"]')?.addEventListener('click', () => openSheet((sheet, close) => {
      const prog = [...programs, ...customPrograms].find(p => p.id === activePlan.program_id);
      sheet.innerHTML = `<h2>${esc(prog ? programName(prog) : 'Plan')}</h2>
        ${prog ? '<button class="btn secondary" id="pm-details">Plan details</button>' : ''}
        <button class="btn ghost" id="pm-end" style="margin-top:8px;color:var(--danger);border-color:var(--danger)">${planProgress(activePlan).over ? 'Close plan' : 'End plan early'}</button>
        <button class="btn ghost" id="pm-cancel" style="margin-top:8px">Cancel</button>`;
      sheet.querySelector('#pm-details')?.addEventListener('click', () => { close(); prog.name && !prog.program_name ? openStartCustomPlanSheet(prog, () => renderPrograms(app)) : openStartPlanSheet(prog, () => renderPrograms(app)); });
      sheet.querySelector('#pm-end').onclick = async () => { await endPlan(activePlan.id); close(); toast('Plan ended'); renderPrograms(app); };
      sheet.querySelector('#pm-cancel').onclick = close;
    }));
  }

  if (tosProgress) {
    app.querySelector('[data-action="end-tos"]')?.addEventListener('click', async () => {
      await pref('tos_progress', null);
      toast('TOS protocol ended');
      renderPrograms(app);
    });
    app.querySelector('[data-action="open-tos"]')?.addEventListener('click', () => navigate('tos'));
  }
}

function renderActivePlanCard(plan, programs) {
  const prog = programs.find(p => p.id === plan.program_id);
  const { week, pct, weeksLeft, over } = planProgress(plan);
  const name = prog ? programName(prog) : 'Deleted plan';
  return `
    <div class="card" style="border-color:var(--accent);padding:12px 14px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <div style="min-width:0">
          <div class="muted" style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--accent)">Active plan</div>
          <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(name)}</div>
          <div class="muted" style="font-size:12px">${over ? `Finished · all ${plan.total_weeks} weeks done` : `Week ${week} of ${plan.total_weeks} · ${pct}% · ${weeksLeft} wk left`}</div>
        </div>
        <button class="btn ghost" data-action="plan-menu" aria-label="Plan options" style="width:auto;padding:0 10px;min-height:34px;flex-shrink:0">⋯</button>
      </div>
      <div class="bar" style="margin-top:8px"><div class="bar-fill" style="width:${pct}%"></div></div>
      ${over ? '' : '<button class="btn" data-action="continue-plan" style="margin-top:10px;min-height:40px">Continue today\'s workout</button>'}
    </div>
  `;
}

function renderActiveTOSCard(progress) {
  const start = new Date(progress.started + 'T12:00:00');
  const days  = Math.floor((Date.now() - start) / 864e5);
  const week  = Math.max(1, Math.floor(days / 7) + 1);
  const accent = progress.accent || '#a78bfa';
  return `
    <div class="card" style="border-color:${accent}55">
      <div class="card-row">
        <h2 style="margin:0;color:${accent}">Active Rehab</h2>
        <span class="pill" style="color:${accent};border-color:${accent}55">Week ${week}</span>
      </div>
      <div style="font-weight:600;margin:6px 0 1px">TOS + Scapular Dyskinesis</div>
      <div class="muted" style="font-size:12px;margin-bottom:10px">${progress.label} · ${progress.tag}</div>
      <div style="display:flex;gap:8px">
        <button class="btn" data-action="open-tos" style="flex:1">Open</button>
        <button class="btn ghost" data-action="end-tos"
          style="width:auto;padding:0 14px;color:var(--danger);border-color:var(--danger)">End</button>
      </div>
    </div>
  `;
}

function openStartPlanSheet(program, onConfirm) {
  openSheet((sheet, close) => {
    // A fixed-length program (PJF) is exactly its own length; rotations run as long as you like.
    const recommended = program.weeks?.length || program.recommended_weeks || 12;
    sheet.innerHTML = `
      <h2>${programName(program)}</h2>
      ${program.description ? `<div class="muted" style="margin-bottom:12px">${program.description}</div>` : ''}

      <div class="card" style="margin-bottom:14px">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center">
          ${program.sessions_per_week ? infoBox(`${program.sessions_per_week}`, 'days/week') : ''}
          ${program.session_length_min ? infoBox(`~${program.session_length_min}`, 'min/session') : ''}
          ${recommended ? infoBox(`${recommended}`, 'weeks') : ''}
        </div>
      </div>

      ${programGuideHtml(program)}
      ${(program.weeks?.[0]?.days || program.days || []).length ? `<div class="group-label">${program.weeks ? 'Week 1' : 'Workouts'}</div>
        <div style="font-size:13px;line-height:1.6">${(program.weeks?.[0]?.days || program.days).map(d => `<div>· ${esc(d.focus || d.day_name || `Day ${d.day_num}`)} <span class="muted">(${(d.exercises || []).length} exercises)</span></div>`).join('')}</div>` : ''}

      <div class="group-label">Duration</div>
      <div class="muted" style="margin-bottom:8px">
        ${program.weeks
          ? `<strong style="color:var(--fg)">Progression.</strong> ${recommended} week${recommended === 1 ? '' : 's'}, and each workout you finish moves you to the next day — Week 1 Day 1 through to the end.`
          : `<strong style="color:var(--fg)">Rotation.</strong> The same ${program.days?.length || ''} workouts in order, then back to the first. It doesn't change week to week — you progress by adding weight. Pick how long to run it before reassessing (${recommended} weeks is a good block).`}
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <input type="number" id="weeks-input" value="${recommended || 12}" min="1" max="52" inputmode="numeric" style="flex:1">
        <span class="muted">weeks</span>
      </div>

      <div class="group-label">Start date</div>
      <input type="date" id="start-date" value="${localDateStr()}">

      <div id="end-date-preview" class="muted" style="margin-top:6px;font-size:13px"></div>

      ${program.suggested_week ? `
        <label style="display:flex;gap:10px;align-items:flex-start;margin-top:14px;font-size:14px;color:var(--fg)">
          <input type="checkbox" id="use-week" checked style="width:auto;margin-top:3px">
          <span><strong>Set up my week</strong><br><span class="muted" style="font-size:12px">${suggestedWeekLabel(program.suggested_week)}</span></span>
        </label>` : ''}

      <button class="btn" id="confirm-btn" style="margin-top:18px">Start plan</button>
      <button class="btn ghost" id="cancel-btn" style="margin-top:8px">Cancel</button>
    `;

    const $weeks = sheet.querySelector('#weeks-input');
    const $start = sheet.querySelector('#start-date');
    const $preview = sheet.querySelector('#end-date-preview');

    function updatePreview() {
      const w = parseInt($weeks.value) || 0;
      const s = $start.value;
      if (!w || !s) { $preview.textContent = ''; return; }
      const end = new Date(s + 'T12:00:00');
      end.setDate(end.getDate() + w * 7);
      $preview.textContent = `Estimated finish: ${end.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}`;
    }

    $weeks.oninput = updatePreview;
    $start.oninput = updatePreview;
    updatePreview();

    sheet.querySelector('#confirm-btn').onclick = async (e) => {
      const w = parseInt($weeks.value);
      if (!w || w < 1) { toast('Enter number of weeks'); return; }
      const btn = e.currentTarget;
      if (btn.disabled) return;
      btn.disabled = true;
      // Starting (or restarting) always begins at Week 1, Day 1 and makes this today's program.
      if (!(await selectSingleProgram(program.id, { restart: true }))) { btn.disabled = false; return; }
      await startPlan(program.id, w, $start.value);
      // Optional companion week (e.g. Recovery & Mobility on off days) as a Mixed Week schedule.
      if (program.suggested_week && sheet.querySelector('#use-week')?.checked) {
        const sw = program.suggested_week;
        const slots = sw.days.map(d => d === 'train' ? { program_id: program.id, mode: 'follow' }
          : d === 'rest' ? { label: 'Rest' }
          : { program_id: d, mode: 'follow' });
        await pref('schedule', { type: 'weekly', slots });
      }
      toast(`${programName(program)} started — Week 1 of ${w}`);
      close();
      onConfirm();
    };

    sheet.querySelector('#cancel-btn').onclick = close;
  });
}

/** Equipment, goal and guide sections a program can carry (home plans). */
export function programGuideHtml(p) {
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const parts = [];
  if (p.equipment?.length) parts.push(`<div class="group-label">Equipment</div>
    <div style="display:flex;flex-wrap:wrap;gap:4px">${p.equipment.map(e => `<span class="pill">${esc(e)}</span>`).join('')}</div>`);
  if (p.goal) parts.push(`<div class="group-label">Goal</div><div style="font-size:14px">${esc(p.goal)}</div>`);
  for (const g of p.guide || []) parts.push(`<div class="group-label">${esc(g.title)}</div>
    <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.5">${g.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`);
  return parts.join('');
}

/** "Mon Tue Thu Fri: train · Wed Sat: Recovery & Mobility · Sun: rest" for a suggested_week. */
function suggestedWeekLabel(sw) {
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const groups = new Map();
  sw.days.forEach((d, i) => { const k = d === 'train' ? 'train' : d === 'rest' ? 'rest' : (sw.labels?.[d] || d); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(DOW[i]); });
  return [...groups].map(([k, days]) => `${days.join(' ')}: ${k}`).join(' · ') + '. Change it any time in Mixed Week.';
}

/** A saved custom/generated plan: start it or delete it. */
function openCustomPlanActions(p, activePlan, onRefresh) {
  openSheet((sheet, close) => {
    const isActive = activePlan?.program_id === p.id;
    sheet.innerHTML = `<h2>${esc(p.name)}</h2>
      <div class="muted" style="margin-bottom:12px">${p.weeks ? `${p.weeks.length}-week progression` : `${p.days.length}-day rotation`} · ${p.generated ? 'Generated' : 'Custom'}</div>
      <button class="btn" id="cp-start">${isActive ? 'Restart' : 'Start plan'}</button>
      <button class="btn ghost" id="cp-delete" style="margin-top:8px;color:var(--danger);border-color:var(--danger)">Delete</button>
      <button class="btn ghost" id="cp-cancel" style="margin-top:8px">Cancel</button>`;
    sheet.querySelector('#cp-cancel').onclick = close;
    sheet.querySelector('#cp-start').onclick = () => { close(); openStartCustomPlanSheet(p, onRefresh); };
    sheet.querySelector('#cp-delete').onclick = async () => {
      const sched = await pref('schedule');
      const inSchedule = sched?.slots?.some(sl => sl?.program_id === p.id);
      const inUse = isActive || inSchedule || (await pref('active_program')) === p.id;
      if (!confirm(inUse
        ? `Delete "${p.name}"? It is your current plan — it will be removed from your schedule too.`
        : `Delete "${p.name}"?`)) return;
      const all = (await pref('custom_programs')) || [];
      await pref('custom_programs', all.filter(x => x.id !== p.id));
      if (isActive) await endPlan(activePlan.id);
      if (inSchedule) await pref('schedule', { ...sched, slots: sched.slots.map(sl => (sl?.program_id === p.id ? null : sl)) });
      if ((await pref('active_program')) === p.id) await pref('active_program', null);
      await pref(`cursor:${p.id}`, null);
      toast('Deleted');
      close();
      onRefresh();
    };
  });
}

async function openStartCustomPlanSheet(program, onConfirm) {
  openSheet((sheet, close) => {
    sheet.innerHTML = `
      <h2>${program.name}</h2>
      <div class="muted" style="margin-bottom:12px">${program.weeks
        ? `Progression: ${program.weeks.length} weeks, and each workout you finish moves you to the next day.`
        : `Rotation — these ${program.days.length} workouts in order, then back to the first. You progress by adding weight, not by moving through weeks.`}</div>
      <div class="group-label">Duration</div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
        <input type="number" id="weeks-input" value="${program.weeks?.length || 8}" min="1" max="52" inputmode="numeric" style="flex:1">
        <span class="muted">weeks</span>
      </div>
      <div class="group-label">Start date</div>
      <input type="date" id="start-date" value="${localDateStr()}">
      <div id="end-preview" class="muted" style="margin-top:6px;font-size:13px"></div>
      <button class="btn" id="confirm" style="margin-top:18px">Start plan</button>
      <button class="btn ghost" id="cancel" style="margin-top:8px">Cancel</button>
    `;
    const $w = sheet.querySelector('#weeks-input');
    const $s = sheet.querySelector('#start-date');
    const $p = sheet.querySelector('#end-preview');
    const updatePreview = () => {
      const w = parseInt($w.value) || 0, s = $s.value;
      if (!w || !s) { $p.textContent = ''; return; }
      const end = new Date(s + 'T12:00:00');
      end.setDate(end.getDate() + w * 7);
      $p.textContent = `Finish: ${end.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}`;
    };
    $w.oninput = updatePreview; $s.oninput = updatePreview; updatePreview();
    sheet.querySelector('#confirm').onclick = async (e) => {
      const w = parseInt($w.value);
      if (!w) { toast('Enter weeks'); return; }
      const btn = e.currentTarget;
      if (btn.disabled) return;
      btn.disabled = true;
      if (!(await selectSingleProgram(program.id, { restart: true }))) { btn.disabled = false; return; }
      await startPlan(program.id, w, $s.value);
      toast(`${program.name} started`);
      close(); onConfirm();
    };
    sheet.querySelector('#cancel').onclick = close;
  });
}

function openPlanBuilder(allExercises, onSave) {
  // Step 1: pick split
  openSheet((sheet, close) => {
    const splitKeys = Object.keys(SPLIT_TEMPLATES);
    sheet.innerHTML = `
      <h2>Build My Plan</h2>
      <div class="muted" style="margin-bottom:16px">Choose a split to start from. You'll customize every exercise before saving.</div>
      ${splitKeys.map(k => `
        <div class="list-item" data-key="${k}" style="cursor:pointer">
          <div>
            <div class="list-item-title">${SPLIT_TEMPLATES[k].name}</div>
            <div class="list-item-meta">${SPLIT_TEMPLATES[k].days.length} days · ${SPLIT_TEMPLATES[k].days.map(d => d.day_name).join(', ')}</div>
          </div>
        </div>
      `).join('')}
    `;
    sheet.querySelectorAll('.list-item').forEach(item => {
      item.onclick = () => {
        close(false);   // the customizer opens straight after — see openSheet's close() note
        const template = SPLIT_TEMPLATES[item.dataset.key];
        openPlanCustomizer(template, allExercises, onSave);
      };
    });
  });
}

function openPlanCustomizer(template, allExercises, onSave) {
  // Build initial exercise picks for all days
  // Only days that repeat the same slots (Full Body A/B/C) rotate picks; Upper and Lower days take the best fit.
  const daySlots = template.days.map((day, di) => autoFillDay(day, allExercises,
    template.days.filter(d => d.slots === day.slots).length > 1 ? di : 0));
  // per-day ab finisher: array of { label, muscle, sets, reps, picked }
  const abSlots = template.days.map(() => []);

  openSheet((sheet, close) => {
    let currentDay = 0;

    function renderSlotList($list, slots, isAb = false) {
      slots.forEach((slot, si) => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.style.cursor = 'pointer';
        const muscleLabel = slot.muscle.replace(/_/g, ' ');
        item.innerHTML = `
          <div style="flex:1">
            <div class="list-item-title">${slot.picked || '— not filled —'}</div>
            <div class="list-item-meta">${slot.label} · ${slot.sets}×${slot.reps}</div>
          </div>
          ${isAb ? `<span class="muted" style="font-size:18px;margin-right:4px" data-remove-ab="${si}">✕</span>` : ''}
          <span class="muted" style="font-size:18px">⇄</span>
        `;
        const removeBtn = item.querySelector(`[data-remove-ab="${si}"]`);
        if (removeBtn) removeBtn.onclick = (e) => {
          e.stopPropagation();
          abSlots[currentDay].splice(si, 1);
          render();
        };
        item.onclick = (e) => {
          if (e.target.dataset.removeAb != null) return;
          const options = suggestForSlot(slot.muscle, allExercises, new Set(), slot.label);
          openSheet((s2, close2) => {
            s2.innerHTML = `
              <h2>${slot.label}</h2>
              <div class="muted" style="margin-bottom:10px">${muscleLabel} exercises</div>
              ${options.map(e => `
                <div class="list-item" data-name="${e.name.replace(/"/g, '&quot;')}" style="cursor:pointer">
                  <div style="flex:1">
                    <div class="list-item-title">${e.name}</div>
                    <div class="list-item-meta">${e.video_url ? '▶ video' : ''}</div>
                  </div>
                  ${slot.picked === e.name ? '<span class="pill accent">current</span>' : ''}
                </div>
              `).join('')}
            `;
            s2.querySelectorAll('.list-item').forEach(opt => {
              opt.onclick = () => {
                slot.picked = opt.dataset.name;
                close2();
                render();
              };
            });
          });
        };
        $list.appendChild(item);
      });
    }

    function render() {
      const day = template.days[currentDay];
      const slots = daySlots[currentDay];
      const abs = abSlots[currentDay];
      sheet.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <button class="btn ghost" id="prev-day" ${currentDay === 0 ? 'disabled' : ''}>‹</button>
          <div style="font-weight:600;font-size:16px">${day.day_name}</div>
          <button class="btn ghost" id="next-day" ${currentDay === template.days.length - 1 ? 'disabled' : ''}>›</button>
        </div>
        <div class="muted" style="font-size:12px;margin-bottom:10px">Day ${currentDay + 1} of ${template.days.length} · Tap exercise to swap</div>
        <div id="slot-list"></div>
        ${abs.length ? `<div class="group-label" style="margin-top:10px">Ab Finisher</div><div id="ab-list"></div>` : ''}
        <button class="btn ghost" id="add-abs" style="margin-top:10px;width:100%">+ Add Ab Finisher</button>
        <div style="margin-top:14px;display:flex;gap:8px">
          ${currentDay === template.days.length - 1
            ? `<button class="btn" id="save-btn" style="flex:1">Name &amp; Save Plan</button>`
            : `<button class="btn" id="next-btn" style="flex:1">Next day ›</button>`
          }
          <button class="btn ghost" id="cancel-btn">Cancel</button>
        </div>
      `;

      renderSlotList(sheet.querySelector('#slot-list'), slots, false);
      const $abList = sheet.querySelector('#ab-list');
      if ($abList) renderSlotList($abList, abs, true);

      sheet.querySelector('#add-abs').onclick = () => {
        // Auto-fill 3 ab slots with distinct exercises
        const used = new Set(abs.map(s => s.picked).filter(Boolean));
        const newAbs = AB_SLOTS.map(s => {
          const options = suggestForSlot('abs', allExercises, used);
          const pick = options[0] || null;
          if (pick) used.add(pick.name);
          return { ...s, picked: pick?.name || null };
        });
        abSlots[currentDay].push(...newAbs);
        render();
      };

      const $prev = sheet.querySelector('#prev-day');
      if ($prev) $prev.onclick = () => { currentDay--; render(); };
      const $next = sheet.querySelector('#next-day');
      if ($next) $next.onclick = () => { currentDay++; render(); };
      const $nextBtn = sheet.querySelector('#next-btn');
      if ($nextBtn) $nextBtn.onclick = () => { currentDay++; render(); };
      sheet.querySelector('#cancel-btn').onclick = close;

      const $saveBtn = sheet.querySelector('#save-btn');
      if ($saveBtn) $saveBtn.onclick = async () => {
        const name = prompt('Name your plan:', template.name + ' (Custom)');
        if (!name) return;
        const id = `custom-${Date.now()}`;
        const program = {
          id,
          name,
          source: 'custom',
          days: template.days.map((day, di) => ({
            day_name: day.day_name,
            exercises: [
              ...daySlots[di].filter(s => s.picked).map(s => ({ name: s.picked, sets: s.sets, reps: s.reps })),
              ...abSlots[di].filter(s => s.picked).map(s => ({ name: s.picked, sets: s.sets, reps: s.reps })),
            ],
          })),
        };
        const existing = (await pref('custom_programs')) || [];
        await pref('custom_programs', [...existing, program]);
        close(false);
        openStartCustomPlanSheet(program, onSave);
      };
    }

    render();
  });
}

function infoBox(value, label) {
  return `
    <div>
      <div style="font-size:22px;font-weight:700">${value}</div>
      <div class="muted" style="font-size:11px">${label}</div>
    </div>
  `;
}


// ── Plan generator (src/lib/generator.js, rules in data/design_rules.json) ──────────────

const GEN_EQUIPMENT = ['dumbbell', 'kettlebell', 'barbell', 'trap_bar', 'bench', 'box', 'pullup_bar', 'cable', 'machine',
  'band', 'mini_band', 'landmine', 'med_ball', 'slider', 'bosu_pad', 'sled', 'smith', 'suspension'];
let _rules = null;
const loadRules = async () => (_rules ||= await fetch('data/design_rules.json').then(r => r.json()));

async function openGeneratorWizard(onSaved) {
  const rules = await loadRules();
  const saved = (await pref('gen_settings')) || {};
  const equipment = (await pref('equipment')) || ['dumbbell', 'bench', 'band', 'mini_band'];
  const st = { goal: 'muscle', days: 3, minutes: 60, weeks: 6, level: 2, plyo: false, focus: [], ...saved, equipment };
  openSheet((sheet, close) => {
    const chips = (key, options, multi = false) => options.map(([val, label]) => {
      const on = multi ? st[key].includes(val) : st[key] === val;
      return `<button class="pill ${on ? 'accent' : ''}" data-k="${key}" data-v="${val}" data-multi="${multi ? 1 : ''}" style="cursor:pointer;font-size:12px;padding:6px 10px">${label}</button>`;
    }).join('');
    const paint = () => {
      sheet.innerHTML = `
        <h2>Generate a plan</h2>
        <div class="muted" style="margin-bottom:6px">Built from every exercise in the app with a video, using the PJF and BWS design rules.</div>
        <div class="group-label">Goal</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">${chips('goal', Object.entries(rules.goals).map(([k, g]) => [k, g.label]))}</div>
        <div class="group-label">Days per week</div>
        <div style="display:flex;gap:6px">${chips('days', [2, 3, 4, 5, 6].map(n => [n, n]))}</div>
        <div class="group-label">Minutes per session</div>
        <div style="display:flex;gap:6px">${chips('minutes', [[30, '30'], [45, '45'], [60, '60']])}</div>
        <div class="group-label">Weeks</div>
        <div style="display:flex;gap:6px">${chips('weeks', [[4, '4'], [6, '6'], [8, '8']])}</div>
        <div class="group-label">Level</div>
        <div style="display:flex;gap:6px">${chips('level', [[1, 'Beginner'], [2, 'Intermediate'], [3, 'Advanced']])}</div>
        <div class="group-label">Focus (optional)</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">${chips('focus', Object.keys(FOCUS_GROUPS).map(f => [f, f]), true)}</div>
        <div class="group-label">Equipment you have</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">${chips('equipment', GEN_EQUIPMENT.map(q => [q, EQUIPMENT_LABEL[q]]), true)}</div>
        <label style="display:flex;align-items:center;gap:8px;margin-top:14px;font-size:14px">
          <input type="checkbox" id="g-plyo" ${st.plyo ? 'checked' : ''} style="width:auto"> Add jumps, sprints & agility</label>
        <button class="btn" id="g-go" style="margin-top:16px">Generate</button>
        <button class="btn ghost" id="g-cancel" style="margin-top:8px">Cancel</button>`;
      sheet.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
        const k = b.dataset.k, raw = b.dataset.v, v = isNaN(+raw) ? raw : +raw;
        if (b.dataset.multi) st[k] = st[k].includes(v) ? st[k].filter(x => x !== v) : [...st[k], v];
        else st[k] = v;
        paint();
      });
      sheet.querySelector('#g-plyo').onchange = (e) => { st.plyo = e.target.checked; };
      sheet.querySelector('#g-cancel').onclick = close;
      sheet.querySelector('#g-go').onclick = async () => {
        await pref('equipment', st.equipment);
        const { equipment: _e, ...rest } = st;
        await pref('gen_settings', rest);
        close(false);   // a follow-up sheet opens next
        const { exercises } = await loadCatalogs();
        const plan = generatePlan({ ...st, seed: Date.now() % 100000 }, { exercises, rules, hasVideo });
        openGeneratedPreview(plan, { exercises, rules }, onSaved);
      };
    };
    paint();
  });
}

function openGeneratedPreview(plan, ctx, onSaved) {
  const { exercises, rules } = ctx;
  const byName = new Map(exercises.map(e => [e.name, e]));
  let week = 1;
  openSheet((sheet, close) => {
    const paint = () => {
      const w = plan.weeks.find(x => x.week_num === week);
      const summary = Object.entries(plan.summary).sort((a, b) => b[1] - a[1])
        .map(([m, n]) => `<span class="pill" style="font-size:11px;text-transform:capitalize">${muscleLabel(m)} ${n}</span>`).join('');
      sheet.innerHTML = `
        <input type="text" id="gp-name" value="${plan.name.replace(/"/g, '&quot;')}" style="font-size:17px;font-weight:600">
        <div class="muted" style="margin:6px 0">${plan.description}</div>
        <div class="muted" style="font-size:11px;margin-bottom:4px">Week 1 working sets per muscle</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">${summary}</div>
        <div style="display:flex;gap:4px;overflow-x:auto;margin:12px 0 4px">
          ${plan.weeks.map(x => `<button class="pill ${x.week_num === week ? 'accent' : ''}" data-week="${x.week_num}" style="cursor:pointer;flex-shrink:0">Wk ${x.week_num}</button>`).join('')}
        </div>
        ${w.days.map(d => `
          <div class="card" style="padding:10px 12px;margin-bottom:8px">
            <div class="card-row"><div style="font-weight:600">Day ${d.day_num} · ${d.focus}</div>
              <span class="muted" style="font-size:11px">~${estimateMinutes(d, rules)} min</span></div>
            <div class="muted" style="font-size:11px;margin:2px 0 6px">${d.notes[0]}</div>
            <div class="muted" style="font-size:11px;margin-bottom:4px">Warm-up: ${d.warmup.map(x => x.name).join(', ')}</div>
            ${d.exercises.map(x => {
              const e = byName.get(x.name);
              return `<div class="list-item" data-day="${d.day_num}" data-name="${x.name.replace(/"/g, '&quot;')}" style="cursor:pointer;padding:6px 0">
                <div style="flex:1;min-width:0">
                  <div class="list-item-title" style="font-size:14px">${x.round_group ? `<span class="muted" style="font-size:10px">${x.round_group} · </span>` : ''}${x.name}</div>
                  <div class="list-item-meta">${x.sets} × ${x.reps || x.time}${x.rest ? ' · rest ' + x.rest : ''}${e ? ` · <span style="text-transform:capitalize">${tagLine(e)}</span>` : ''}</div>
                </div><span class="muted" style="font-size:12px">⇄</span></div>`;
            }).join('')}
          </div>`).join('')}
        <div class="muted" style="font-size:11px;margin:4px 0 10px">Tap an exercise to swap it (changes that day in every week).</div>
        <button class="btn" id="gp-save">Save & start</button>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button class="btn secondary" id="gp-again" style="flex:1">Regenerate</button>
          <button class="btn ghost" id="gp-cancel" style="flex:1">Discard</button>
        </div>`;
      sheet.querySelectorAll('[data-week]').forEach(b => b.onclick = () => { plan.name = sheet.querySelector('#gp-name').value; week = +b.dataset.week; paint(); });
      sheet.querySelectorAll('[data-name]').forEach(r => r.onclick = () => {
        plan.name = sheet.querySelector('#gp-name').value;
        const cur = byName.get(r.dataset.name);
        const have = plan.generated.equipment;
        const alts = rankSimilar(cur, exercises.filter(e => (e.equipment || []).every(q => q === 'bodyweight' || have.includes(q))), { have, limit: 15 });
        openSheet((s2, close2) => {
          s2.innerHTML = `<h2>Swap ${r.dataset.name}</h2><div class="muted" style="margin-bottom:8px">Same movement first, then same muscle · your equipment</div>
            ${alts.map(e => `<div class="list-item" data-alt="${e.name.replace(/"/g, '&quot;')}" style="cursor:pointer">
              <div style="flex:1"><div class="list-item-title">${e.name}</div><div class="list-item-meta" style="text-transform:capitalize">${tagLine(e)}</div></div></div>`).join('') || '<div class="empty">No close matches with your equipment</div>'}`;
          s2.querySelectorAll('[data-alt]').forEach(a => a.onclick = () => { swapInPlan(plan, +r.dataset.day, r.dataset.name, a.dataset.alt); close2(); paint(); });
        });
      });
      sheet.querySelector('#gp-again').onclick = () => {
        const g = plan.generated;
        const fresh = generatePlan({ ...g, seed: (g.seed || 1) + 1 }, { exercises, rules, hasVideo });
        Object.assign(plan, fresh, { name: sheet.querySelector('#gp-name').value });
        paint();
      };
      sheet.querySelector('#gp-cancel').onclick = close;
      sheet.querySelector('#gp-save').onclick = async () => {
        plan.name = sheet.querySelector('#gp-name').value.trim() || plan.name;
        const { summary, pool_size, ...program } = plan;
        const all = (await pref('custom_programs')) || [];
        await pref('custom_programs', [...all, program]);
        toast('Plan saved');
        close(false);
        openStartCustomPlanSheet(program, onSaved);
      };
    };
    paint();
  });
}
