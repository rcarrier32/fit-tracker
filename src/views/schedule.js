/**
 * Hybrid weekly schedule editor.
 *
 * schedule = {
 *   type: 'weekly',
 *   slots: [ // 7 entries indexed by day-of-week (0=Sun..6=Sat)
 *     null | {label} | {program_id, mode: 'follow' | 'fixed', day_index?, week?, day?}
 *   ]
 * }
 *
 * Cursors per program live in pref('cursor:<program_id>') = {week, day} or {day_index}.
 * 'follow' mode: each slot uses that program's current cursor and advances it after completion.
 * 'fixed'  mode: always loads the same (week, day) — useful for dedicated mobility/zone-2 days.
 */
import { pref } from '../db.js';
import { openSheet, toast } from '../app.js';
import { loadCatalogs, getAllPrograms } from '../lib/static_data.js';

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export async function openScheduleEditor() {
  const programs = await getAllPrograms();
  const current = (await pref('schedule')) || { type: 'weekly', slots: [null,null,null,null,null,null,null] };
  const isEmpty = current.slots.every(s => !s);

  return new Promise((resolve) => {
    openSheet((sheet, close) => {
      let editing = JSON.parse(JSON.stringify(current.slots));
      const expandedSet = new Set([new Date().getDay()]);

      // Quick setup state
      let setupDays = 4;
      let setupBwsId = _defaultBws(4, programs);
      let setupPjf = false;
      let setupSelectedDays = null; // null = all days (follow mode), array = specific days (fixed mode)
      let showSetup = isEmpty;

      sheet.innerHTML = `
        <h2>Mixed Week schedule</h2>
        <div id="setup-panel"></div>
        <div id="slots"></div>
        <div class="btn-row" style="margin-top:14px">
          <button class="btn" id="save">Save schedule</button>
          <button class="btn ghost" id="cancel">Cancel</button>
        </div>
        <button class="btn ghost" id="toggle-setup" style="margin-top:8px">${isEmpty ? '' : 'Quick Setup'}</button>
      `;

      function renderSetupPanel() {
        const $p = sheet.querySelector('#setup-panel');
        if (!showSetup) { $p.innerHTML = ''; return; }

        const bwsOpts = _bwsOptionsForDays(setupDays, programs);
        if (!setupBwsId || !bwsOpts.find(p => p.id === setupBwsId)) {
          setupBwsId = bwsOpts[0]?.id || null;
        }
        const bwsProg = programs.find(p => p.id === setupBwsId);
        const pjfProg = programs.find(p => p.id === 'pjf_durability_code_prime') || programs.find(p => p.source === 'PJF');

        const dayFilterHtml = (bwsProg?.days?.length > 1) ? `
          <div class="group-label" style="margin-bottom:8px">Days to include</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px">
            ${bwsProg.days.map((d, i) => {
              const sel = setupSelectedDays === null || setupSelectedDays.includes(i);
              const short = d.day_name.replace(/\s*\(.*\)$/, '');
              return `<button class="pill${sel ? ' accent' : ''}" data-day-idx="${i}" style="padding:7px 10px;font-size:12px">${short}</button>`;
            }).join('')}
          </div>
        ` : '';

        $p.innerHTML = `
          <div style="background:var(--bg-input);border-radius:12px;padding:14px;margin-bottom:14px">
            <div style="font-weight:600;font-size:15px;margin-bottom:14px">Quick Setup</div>

            <div class="group-label" style="margin-bottom:8px">Training days per week</div>
            <div style="display:flex;gap:8px;margin-bottom:14px">
              ${[3,4,5,6].map(n => `
                <button class="pill${setupDays===n?' accent':''}" data-days="${n}"
                  style="flex:1;padding:9px 0;font-size:13px">${n}</button>
              `).join('')}
            </div>

            <div class="group-label" style="margin-bottom:8px">Strength program</div>
            <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px">
              ${bwsOpts.map(p => `
                <button class="btn${setupBwsId===p.id?'':' ghost'}" data-bws="${p.id}"
                  style="text-align:left;padding:10px 12px;display:flex;flex-direction:column;align-items:flex-start;gap:2px">
                  <span style="font-size:13px">${p.name || p.program_name || p.id}</span>
                  <span style="font-size:11px;opacity:0.6">${p.days?.length}-day rotation</span>
                </button>
              `).join('')}
            </div>

            ${dayFilterHtml}

            ${pjfProg ? `
              <div class="group-label" style="margin-bottom:8px">Mix in PJF mobility?</div>
              <div style="display:flex;gap:8px;margin-bottom:16px">
                <button class="pill${!setupPjf?' accent':''}" data-pjf="no" style="flex:1;padding:9px 0;font-size:13px">Strength only</button>
                <button class="pill${setupPjf?' accent':''}" data-pjf="yes" style="flex:1;padding:9px 0;font-size:13px">Alternate PJF days</button>
              </div>
            ` : ''}

            <button class="btn" id="build-btn" style="width:100%">Build my week →</button>
          </div>
        `;

        $p.querySelectorAll('[data-days]').forEach(btn => {
          btn.onclick = () => {
            setupDays = +btn.dataset.days;
            setupBwsId = _defaultBws(setupDays, programs);
            setupSelectedDays = null;
            renderSetupPanel();
          };
        });
        $p.querySelectorAll('[data-bws]').forEach(btn => {
          btn.onclick = () => { setupBwsId = btn.dataset.bws; setupSelectedDays = null; renderSetupPanel(); };
        });
        $p.querySelectorAll('[data-pjf]').forEach(btn => {
          btn.onclick = () => { setupPjf = btn.dataset.pjf === 'yes'; renderSetupPanel(); };
        });
        $p.querySelectorAll('[data-day-idx]').forEach(btn => {
          btn.onclick = () => {
            const idx = +btn.dataset.dayIdx;
            const allIndices = (bwsProg?.days || []).map((_, i) => i);
            if (setupSelectedDays === null) {
              setupSelectedDays = allIndices.filter(i => i !== idx);
            } else if (setupSelectedDays.includes(idx)) {
              const next = setupSelectedDays.filter(i => i !== idx);
              setupSelectedDays = next.length === 0 ? [idx] : next.length === allIndices.length ? null : next;
            } else {
              const next = [...setupSelectedDays, idx].sort((a, b) => a - b);
              setupSelectedDays = next.length === allIndices.length ? null : next;
            }
            renderSetupPanel();
          };
        });
        $p.querySelector('#build-btn').onclick = () => {
          editing = buildGuided(setupDays, setupBwsId, setupPjf, programs, setupSelectedDays);
          showSetup = false;
          sheet.querySelector('#toggle-setup').textContent = 'Quick Setup';
          renderSetupPanel();
          renderSlots();
          // Expand all days so user can review what was built
          for (let d = 0; d < 7; d++) expandedSet.add(d);
          renderSlots();
        };
      }

      function renderSlots() {
        const $slots = sheet.querySelector('#slots');
        $slots.innerHTML = '';
        for (let dow = 1; dow <= 7; dow++) {
          const idx = dow % 7;
          const rowEl = slotRow(idx, editing[idx], programs,
            (newSlot) => { editing[idx] = newSlot; },
            () => renderSlots(),
            expandedSet.has(idx),
          );
          rowEl.querySelector('.slot-header').addEventListener('click', () => {
            if (expandedSet.has(idx)) expandedSet.delete(idx); else expandedSet.add(idx);
          });
          $slots.appendChild(rowEl);
        }
      }

      renderSetupPanel();
      renderSlots();

      sheet.querySelector('#cancel').onclick = () => { close(); resolve(null); };
      sheet.querySelector('#save').onclick = async () => {
        await pref('schedule', { type: 'weekly', slots: editing });
        toast('Schedule saved');
        close();
        resolve(editing);
      };
      sheet.querySelector('#toggle-setup').onclick = () => {
        showSetup = !showSetup;
        renderSetupPanel();
      };
    });
  });
}

function slotRow(dow, slot, programs, onChange, onRefresh, startExpanded) {
  const row = document.createElement('div');
  row.className = 'card';
  row.style.marginBottom = '6px';
  row.style.padding = '0';
  row.style.overflow = 'hidden';

  const isToday = new Date().getDay() === dow;
  const assigned = slot?.program_id != null;
  const lbl = describe(slot, programs);

  let expanded = startExpanded ?? false;

  row.innerHTML = `
    <div class="slot-header" style="display:flex;align-items:center;padding:10px 12px;cursor:pointer;gap:8px">
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:14px;display:flex;align-items:center;gap:6px">
          ${DOW_LABELS[dow]}
          ${isToday ? `<span class="pill accent" style="font-size:10px">Today</span>` : ''}
        </div>
        <div style="font-size:13px;color:${assigned ? 'var(--fg)' : 'var(--fg-dim)'}">${lbl}</div>
      </div>
      <span class="chevron" style="color:var(--fg-dim);font-size:14px;transition:transform 0.2s;flex-shrink:0">${assigned ? '▼' : '＋'}</span>
    </div>
    <div class="slot-body" style="display:${expanded ? 'block' : 'none'};border-top:1px solid var(--border)">
      <div class="preview" style="padding:10px 12px;font-size:13px">${
        assigned
          ? buildExercisePreview(slot, programs)
          : '<div class="muted">No workout set for this day.</div>'
      }</div>
      <div style="padding:8px 12px 12px;display:flex;gap:8px">
        <button class="btn" style="flex:1" id="change-btn">Set workout</button>
        ${assigned ? `<button class="btn ghost" style="color:var(--danger);border-color:var(--danger)" id="clear-btn">Clear</button>` : ''}
      </div>
    </div>
  `;

  const $header = row.querySelector('.slot-header');
  const $body = row.querySelector('.slot-body');
  const $chevron = row.querySelector('.chevron');

  if (expanded) $chevron.style.transform = 'rotate(180deg)';

  $header.onclick = () => {
    expanded = !expanded;
    $body.style.display = expanded ? 'block' : 'none';
    $chevron.style.transform = expanded ? 'rotate(180deg)' : '';
  };

  row.querySelector('#change-btn').onclick = (e) => {
    e.stopPropagation();
    openSlotPicker(programs, slot, (newSlot) => {
      onChange(newSlot);
      onRefresh();
    });
  };

  const $clear = row.querySelector('#clear-btn');
  if ($clear) $clear.onclick = (e) => {
    e.stopPropagation();
    onChange(null);
    onRefresh();
  };

  return row;
}

function buildExercisePreview(slot, programs) {
  const p = programs.find(x => x.id === slot.program_id);
  if (!p) return '<div class="muted">Program not found</div>';

  let dayData = null;
  if (p.days) {
    const idx = slot.day_index ?? 0;
    dayData = p.days[idx];
  } else if (p.weeks) {
    const wk = p.weeks.find(w => w.week_num === (slot.week || 1));
    dayData = wk?.days?.find(d => d.day_num === (slot.day || 1));
  }

  if (!dayData) return '<div class="muted">No exercises found</div>';

  const exs = (dayData.exercises || []).filter(e => !e.is_alternate).slice(0, 12);
  if (!exs.length) return '<div class="muted">No exercises listed</div>';

  return exs.map(e => `
    <div style="display:flex;justify-content:space-between;align-items:baseline;padding:4px 0;border-bottom:1px solid var(--border)">
      <div style="font-size:13px">${e.name}</div>
      <div class="muted" style="font-size:12px;white-space:nowrap;margin-left:8px">${e.sets ? `${e.sets}×` : ''}${e.reps || e.set_targets?.[0] || ''}</div>
    </div>
  `).join('') + (exs.length === 12 ? `<div class="muted" style="font-size:12px;padding-top:6px">+ more…</div>` : '');
}

function describe(slot, programs) {
  if (!slot) return 'Tap edit to set';
  if (slot.label === 'Rest') return '😴 Rest day';
  if (slot.label === 'Cardio') return '🏃 Zone 2 / cardio (untracked)';
  if (slot.label === 'Custom') return '✏️ Free-form (log whatever)';
  if (slot.program_id) {
    const p = programs.find(x => x.id === slot.program_id);
    if (!p) return slot.program_id;
    const tag = p.source === 'PJF' ? '🧘' : p.source === 'custom' ? '⭐' : '🏋️';
    if (slot.mode === 'follow') return `${tag} ${p.name || p.program_name || p.id} (follow progression)`;
    if (slot.mode === 'fixed') {
      if (slot.week && slot.day) return `${tag} ${p.name || p.program_name} — Wk ${slot.week} Day ${slot.day}`;
      if (slot.day_index != null) {
        const dayName = p.days?.[slot.day_index]?.day_name || `Day ${slot.day_index + 1}`;
        return `${tag} ${p.name || p.id} — ${dayName}`;
      }
    }
  }
  return 'Tap edit to set';
}

function openSlotPicker(programs, current, onPick) {
  openSheet((sheet, close) => {
    const custom = programs.filter(p => p.source === 'custom');
    sheet.innerHTML = `
      <h2>Choose workout</h2>
      <div class="group-label">Quick options</div>
      <div class="card list-item" data-pick="rest">😴 Rest day</div>
      <div class="card list-item" data-pick="cardio">🏃 Zone 2 / cardio (untracked)</div>
      <div class="card list-item" data-pick="custom">✏️ Free-form (log whatever)</div>
      ${custom.length ? `<div class="group-label">My plans</div><div id="custom-list"></div>` : ''}
      <div class="group-label">PJF programs</div>
      <div id="pjf-list"></div>
      <div class="group-label">BWS programs</div>
      <div id="bws-list"></div>
    `;
    sheet.querySelectorAll('[data-pick]').forEach(el => {
      el.onclick = () => {
        const k = el.dataset.pick;
        const labelMap = { rest: 'Rest', cardio: 'Cardio', custom: 'Custom' };
        onPick({ label: labelMap[k] });
        close();
      };
    });
    const pjf = programs.filter(p => p.source === 'PJF');
    const bws = programs.filter(p => p.source === 'BWS');
    const groups = [
      [custom, sheet.querySelector('#custom-list')],
      [pjf, sheet.querySelector('#pjf-list')],
      [bws, sheet.querySelector('#bws-list')],
    ];
    groups.forEach(([list, el]) => {
      if (!el) return;
      for (const p of list) {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `
          <div style="flex:1">
            <div class="list-item-title">${p.name || p.program_name || p.id}</div>
            <div class="list-item-meta">${describeProgram(p)}</div>
          </div>
        `;
        item.onclick = () => openProgramDayPicker(p, current, onPick, close);
        el.appendChild(item);
      }
    });
  });
}

function openProgramDayPicker(program, current, onPick, parentClose) {
  openSheet((sheet, close) => {
    sheet.innerHTML = `
      <h2>${program.name || program.program_name}</h2>
      <div class="muted" style="margin-bottom:10px">How should this slot use the program?</div>
      <div class="list-item" data-mode="follow">
        <div style="flex:1">
          <div class="list-item-title">Rotate through all days in order</div>
          <div class="list-item-meta">Each session advances to the next day in the program</div>
        </div>
        <span class="pill accent">▶</span>
      </div>
      <div class="group-label">Always use one specific day</div>
      <div id="days"></div>
    `;
    sheet.querySelector('[data-mode="follow"]').onclick = () => {
      onPick({ program_id: program.id, mode: 'follow' });
      close();
      parentClose();
    };
    const $days = sheet.querySelector('#days');
    if (program.weeks) {
      // Show first week's days as quick pins (full picker would be huge for 8wk PJF programs)
      const w1 = program.weeks[0];
      $days.innerHTML = `<div class="muted" style="margin-bottom:6px">Pin Wk 1 day:</div>`;
      w1.days.forEach(d => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `<div style="flex:1"><div class="list-item-title">Day ${d.day_num}: ${d.focus}</div></div>`;
        item.onclick = () => {
          onPick({ program_id: program.id, mode: 'fixed', week: 1, day: d.day_num });
          close(); parentClose();
        };
        $days.appendChild(item);
      });
    } else if (program.days) {
      program.days.forEach((d, i) => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `<div style="flex:1"><div class="list-item-title">${d.day_name}</div></div>`;
        item.onclick = () => {
          onPick({ program_id: program.id, mode: 'fixed', day_index: i });
          close(); parentClose();
        };
        $days.appendChild(item);
      });
    }
  });
}

function describeProgram(p) {
  if (p.weeks) {
    const totalDays = p.weeks.reduce((s, w) => s + (w.days?.length || 0), 0);
    return `${p.weeks.length} weeks · ${totalDays} day-templates`;
  }
  if (p.days) return `${p.days.length} day rotation`;
  return '';
}

function _defaultBws(n, programs) {
  const preferred = {
    3: ['bws_3day_full_body', 'ryhan_3day_personal'],
    4: ['bws_4day_upper_lower', 'ryhan_4day_personal', 'bws_4day_30min'],
    5: ['bws_5day_split_v1', 'ryhan_5day_personal', 'bws_5day_30min'],
    6: ['bws_5day_split_v1', 'bws_5day_split_v3', 'ryhan_5day_personal'],
  };
  const ids = preferred[n] || preferred[5];
  for (const id of ids) {
    if (programs.find(p => p.id === id)) return id;
  }
  const match = programs.find(p => p.source === 'BWS' && p.days?.length === n);
  if (match) return match.id;
  return programs.find(p => p.source === 'BWS')?.id || null;
}

function _bwsOptionsForDays(n, programs) {
  const bws = programs.filter(p => p.source === 'BWS' || p.source === 'custom');
  const exact = bws.filter(p => p.days?.length === n);
  if (exact.length) return exact;
  const nearby = bws.filter(p => p.days?.length >= n - 1 && p.days?.length <= n + 1);
  if (nearby.length) return nearby;
  return bws.slice(0, 4);
}

function buildGuided(nDays, bwsId, includePjf, programs, selectedDayIndices) {
  const slots = Array(7).fill(null).map(() => ({ label: 'Rest' }));
  const dayPatterns = { 3: [1,3,5], 4: [1,2,4,5], 5: [1,2,3,4,5], 6: [1,2,3,4,5,6] };
  const trainingDows = dayPatterns[nDays] || dayPatterns[5];
  const pjfProg = programs.find(p => p.id === 'pjf_durability_code_prime') || programs.find(p => p.source === 'PJF');
  const bwsProg = programs.find(p => p.id === bwsId);
  const useFixed = selectedDayIndices && selectedDayIndices.length > 0 &&
                   bwsProg?.days && selectedDayIndices.length < bwsProg.days.length;

  let bwsSlotCount = 0;
  trainingDows.forEach((dow, i) => {
    const isPjf = includePjf && pjfProg && i % 2 === 1;
    if (isPjf) {
      slots[dow] = { program_id: pjfProg.id, mode: 'follow' };
    } else if (bwsId) {
      if (useFixed) {
        const di = selectedDayIndices[bwsSlotCount % selectedDayIndices.length];
        slots[dow] = { program_id: bwsId, mode: 'fixed', day_index: di };
      } else {
        slots[dow] = { program_id: bwsId, mode: 'follow' };
      }
      bwsSlotCount++;
    }
  });

  if (!trainingDows.includes(6)) {
    slots[6] = { label: 'Cardio' };
  }

  return slots;
}

/** Suggested balanced week for "active and fit, not bulky": 3 PJF + 2 BWS + cardio + rest */
function suggestBalanced(programs) {
  const pjf = programs.find(p => p.id === 'pjf_durability_code_prime') || programs.find(p => p.source === 'PJF');
  const bws = programs.find(p => p.id === 'bws_3day_full_body') || programs.find(p => p.source === 'BWS' && (p.days?.length === 3 || p.days?.length === 4));
  // Sun=0, Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6
  return [
    { label: 'Rest' },                                                              // Sun
    pjf ? { program_id: pjf.id, mode: 'follow' } : { label: 'Custom' },             // Mon
    bws ? { program_id: bws.id, mode: 'fixed', day_index: 0 } : { label: 'Custom' },// Tue
    pjf ? { program_id: pjf.id, mode: 'follow' } : { label: 'Custom' },             // Wed
    bws ? { program_id: bws.id, mode: 'fixed', day_index: 1 } : { label: 'Custom' },// Thu
    pjf ? { program_id: pjf.id, mode: 'follow' } : { label: 'Custom' },             // Fri
    { label: 'Cardio' },                                                            // Sat
  ];
}

/** Used by Home + Workout views to figure out today's prescription. */
export async function todaysWorkout() {
  const sched = await pref('schedule');
  if (sched && sched.type === 'weekly') {
    const dow = new Date().getDay();
    const slot = sched.slots[dow];
    if (!slot) return { type: 'unset' };
    if (slot.label) return { type: 'tag', tag: slot.label };
    if (slot.program_id) {
      const { programById } = await loadCatalogs();
      let program = programById.get(slot.program_id);
      if (!program) {
        const customList = (await pref('custom_programs')) || [];
        program = customList.find(p => p.id === slot.program_id) || null;
      }
      if (!program) return { type: 'unset' };
      let week = 1, day = 1, day_index = null;
      if (slot.mode === 'follow') {
        const completed = await pref(`completed:${slot.program_id}`);
        if (completed) {
          return { type: 'completed', program, programId: slot.program_id, completedAt: completed.date };
        }
        const cur = (await pref(`cursor:${slot.program_id}`)) || { week: 1, day: 1, day_index: 0 };
        week = cur.week; day = cur.day; day_index = cur.day_index;
      } else {
        week = slot.week || 1;
        day = slot.day || 1;
        day_index = slot.day_index;
      }
      return { type: 'program', program, week, day, day_index, mode: slot.mode };
    }
  }
  // Fallback to legacy single-program mode
  const programId = await pref('active_program');
  if (!programId) return { type: 'unset' };
  const { programById } = await loadCatalogs();
  let program = programById.get(programId);
  if (!program) {
    const customList = (await pref('custom_programs')) || [];
    program = customList.find(p => p.id === programId) || null;
  }
  if (!program) return { type: 'unset' };
  return {
    type: 'program',
    program,
    week: (await pref('active_week')) || 1,
    day: (await pref('active_day')) || 1,
    mode: 'follow',
  };
}

/** Advance the cursor for whichever program was just completed. */
export async function advanceCursor(programId, mode) {
  if (mode !== 'follow') return; // fixed slots don't advance
  const { programById } = await loadCatalogs();
  let program = programById.get(programId);
  if (!program) {
    const customList = (await pref('custom_programs')) || [];
    program = customList.find(p => p.id === programId) || null;
  }
  if (!program) return;
  const cur = (await pref(`cursor:${programId}`)) || { week: 1, day: 1, day_index: 0 };
  if (program.weeks) {
    let { week, day } = cur;
    const wk = program.weeks.find(w => w.week_num === week);
    const maxDay = wk?.days?.length || 6;
    day += 1;
    if (day > maxDay) {
      week += 1;
      day = 1;
      if (week > program.weeks.length) {
        // Program finished — record completion and reset cursor for a clean "start over"
        await pref(`completed:${programId}`, { date: new Date().toISOString().slice(0, 10) });
        await pref(`cursor:${programId}`, { week: 1, day: 1 });
        return;
      }
    }
    await pref(`cursor:${programId}`, { week, day });
  } else if (program.days) {
    const di = ((cur.day_index || 0) + 1) % program.days.length;
    await pref(`cursor:${programId}`, { day_index: di });
  }
}
