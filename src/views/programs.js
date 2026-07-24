/**
 * Program browser + Start a Plan flow.
 * Opens as a full-screen view (not a sheet) so there's room to browse.
 */
import { loadCatalogs } from '../lib/static_data.js';
import { startPlan, getActivePlan, getAllPlans, endPlan, currentWeek, planProgress } from '../lib/plans.js';
import { toast, openSheet, navigate } from '../app.js';
import { SPLIT_TEMPLATES, AB_SLOTS, suggestForSlot, autoFillDay } from '../lib/plan_builder.js';
import { pref } from '../db.js';

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

  const bws = programs.filter(p => p.source === 'BWS');
  const pjf = programs.filter(p => p.source === 'PJF');

  app.innerHTML = `
    <h1>Programs</h1>

    ${activePlan    ? renderActivePlanCard(activePlan, programs) : ''}
    ${tosProgress   ? renderActiveTOSCard(tosProgress)           : ''}

    <div class="card" style="padding:12px 14px">
      <div style="font-weight:600;margin-bottom:2px">Build My Own Plan</div>
      <div class="muted" style="font-size:12px;margin-bottom:10px">Custom split from the exercise database · add ab finishers to any day</div>
      <button class="btn" id="build-plan" style="width:100%">Build</button>
    </div>

    ${customPrograms.length ? `<div class="group-label">My Plans</div><div id="custom-list"></div>` : ''}

    <div class="group-label">Rehab Protocols</div>
    <div class="card" style="padding:12px 14px;border-color:rgba(167,139,250,0.3);cursor:pointer" id="tos-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div style="font-weight:600;margin-bottom:2px">TOS + Scapular Dyskinesis</div>
          <div class="muted" style="font-size:12px">
            Thoracic outlet syndrome · 12-week motor control protocol · Swimming inclusive
          </div>
        </div>
        <span class="pill" style="color:#a78bfa;border-color:rgba(167,139,250,0.4);flex-shrink:0;margin-left:8px">
          5 phases
        </span>
      </div>
    </div>

    <div class="card" style="padding:12px 14px;border-color:rgba(34,211,238,0.3);cursor:pointer;margin-top:10px" id="hip-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div style="font-weight:600;margin-bottom:2px">Hip Recovery Playbook</div>
          <div class="muted" style="font-size:12px">
            PT program · Pool mobility &amp; strength · Deep-water aerobic progression
          </div>
        </div>
        <span class="pill" style="color:#22d3ee;border-color:rgba(34,211,238,0.4);flex-shrink:0;margin-left:8px">
          ${hipWeek ? `Week ${hipWeek}` : '6 sections'}
        </span>
      </div>
    </div>

    <div class="group-label">BWS Strength</div>
    <div id="bws-list"></div>

    <div class="group-label">PJF Performance</div>
    <div id="pjf-list"></div>
  `;

  renderProgramList(app.querySelector('#bws-list'), bws, activePlan, () => renderPrograms(app));
  renderProgramList(app.querySelector('#pjf-list'), pjf, activePlan, () => renderPrograms(app));

  if (customPrograms.length) {
    renderCustomProgramList(app.querySelector('#custom-list'), customPrograms, activePlan, () => renderPrograms(app));
  }

  app.querySelector('#tos-card').onclick = () => navigate('tos');
  app.querySelector('#hip-card').onclick = () => navigate('hip');

  app.querySelector('#build-plan').onclick = async () => {
    const { exercises } = await loadCatalogs();
    openPlanBuilder(exercises, () => renderPrograms(app));
  };

  if (activePlan) {
    app.querySelector('[data-action="end-plan"]')?.addEventListener('click', async () => {
      await endPlan(activePlan.id);
      toast('Plan ended');
      renderPrograms(app);
    });
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
  const { week, pct, weeksLeft } = planProgress(plan);
  const name = prog?.name || plan.program_id;
  return `
    <div class="card" style="border-color:var(--accent)">
      <div class="card-row">
        <h2 style="margin:0;color:var(--accent)">Active Plan</h2>
        <span class="pill accent">Week ${week} of ${plan.total_weeks}</span>
      </div>
      <div style="font-weight:600;margin:6px 0 4px">${name}</div>
      <div class="bar"><div class="bar-fill" style="width:${pct}%"></div></div>
      <div class="muted" style="margin-top:4px">${pct}% complete · ${weeksLeft} week${weeksLeft !== 1 ? 's' : ''} left</div>
      <button class="btn ghost danger-text" data-action="end-plan" style="margin-top:10px;color:var(--danger);border-color:var(--danger)">End plan early</button>
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

function renderProgramList(el, programs, activePlan, onRefresh) {
  for (const p of programs) {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.marginBottom = '10px';
    const isActive = activePlan?.program_id === p.id;
    const weeks = p.recommended_weeks;
    const tags = [
      p.sessions_per_week ? `${p.sessions_per_week} days/wk` : null,
      p.session_length_min ? `~${p.session_length_min} min` : null,
      p.level || null,
    ].filter(Boolean);

    card.innerHTML = `
      <div class="card-row" style="align-items:flex-start">
        <div style="flex:1">
          <div style="font-weight:600;font-size:16px">${p.name || p.program_name || p.id}
            ${isActive ? `<span class="pill accent" style="margin-left:6px;font-size:10px">Active</span>` : ''}
          </div>
          ${p.description ? `<div class="muted" style="margin-top:3px;font-size:13px">${p.description}</div>` : ''}
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">
            ${tags.map(t => `<span class="pill">${t}</span>`).join('')}
            ${weeks ? `<span class="pill" style="color:var(--accent);border-color:var(--accent)">${weeks} weeks recommended</span>` : ''}
          </div>
        </div>
      </div>
      <div style="margin-top:10px">
        <button class="btn ${isActive ? 'secondary' : ''}" data-start>
          ${isActive ? 'Restart plan' : 'Start this plan'}
        </button>
      </div>
    `;

    card.querySelector('[data-start]').onclick = () => openStartPlanSheet(p, onRefresh);
    el.appendChild(card);
  }
}

function openStartPlanSheet(program, onConfirm) {
  openSheet((sheet, close) => {
    const recommended = program.recommended_weeks || 12;
    sheet.innerHTML = `
      <h2>${program.name || program.program_name}</h2>
      ${program.description ? `<div class="muted" style="margin-bottom:12px">${program.description}</div>` : ''}

      <div class="card" style="margin-bottom:14px">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center">
          ${program.sessions_per_week ? infoBox(`${program.sessions_per_week}`, 'days/week') : ''}
          ${program.session_length_min ? infoBox(`~${program.session_length_min}`, 'min/session') : ''}
          ${recommended ? infoBox(`${recommended}`, 'weeks') : ''}
        </div>
      </div>

      <div class="group-label">Duration</div>
      <div class="muted" style="margin-bottom:8px">
        ${recommended ? `We recommend <strong style="color:var(--fg)">${recommended} weeks</strong> — enough time to see real strength gains.` : 'Set how many weeks you want to run this program.'}
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <input type="number" id="weeks-input" value="${recommended || 12}" min="4" max="52" inputmode="numeric" style="flex:1">
        <span class="muted">weeks</span>
      </div>

      <div class="group-label">Start date</div>
      <input type="date" id="start-date" value="${new Date().toISOString().slice(0, 10)}">

      <div id="end-date-preview" class="muted" style="margin-top:6px;font-size:13px"></div>

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

    sheet.querySelector('#confirm-btn').onclick = async () => {
      const w = parseInt($weeks.value);
      if (!w || w < 1) { toast('Enter number of weeks'); return; }
      await startPlan(program.id, w, $start.value);
      // Also set the legacy active_program pref so workout view still works
      const { pref } = await import('../db.js');
      await pref('active_program', program.id);
      toast(`${program.name} started — Week 1 of ${w}`);
      close();
      onConfirm();
    };

    sheet.querySelector('#cancel-btn').onclick = close;
  });
}

function renderCustomProgramList(el, customProgs, activePlan, onRefresh) {
  for (const p of customProgs) {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.marginBottom = '10px';
    const isActive = activePlan?.program_id === p.id;
    card.innerHTML = `
      <div class="card-row" style="align-items:flex-start">
        <div style="flex:1">
          <div style="font-weight:600;font-size:16px">${p.name}
            ${isActive ? `<span class="pill accent" style="margin-left:6px;font-size:10px">Active</span>` : ''}
          </div>
          <div class="muted" style="font-size:13px;margin-top:3px">${p.days.length}-day rotation · Custom</div>
        </div>
      </div>
      <div style="margin-top:10px;display:flex;gap:8px">
        <button class="btn ${isActive ? 'secondary' : ''}" data-start>
          ${isActive ? 'Restart' : 'Start plan'}
        </button>
        <button class="btn ghost danger-text" data-delete style="color:var(--danger);border-color:var(--danger)">Delete</button>
      </div>
    `;
    card.querySelector('[data-start]').onclick = () => openStartCustomPlanSheet(p, onRefresh);
    card.querySelector('[data-delete]').onclick = async () => {
      if (!confirm(`Delete "${p.name}"?`)) return;
      const all = (await pref('custom_programs')) || [];
      await pref('custom_programs', all.filter(x => x.id !== p.id));
      toast('Deleted');
      onRefresh();
    };
    el.appendChild(card);
  }
}

async function openStartCustomPlanSheet(program, onConfirm) {
  openSheet((sheet, close) => {
    sheet.innerHTML = `
      <h2>${program.name}</h2>
      <div class="muted" style="margin-bottom:12px">${program.days.length}-day rotation</div>
      <div class="group-label">Duration</div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
        <input type="number" id="weeks-input" value="8" min="4" max="52" inputmode="numeric" style="flex:1">
        <span class="muted">weeks</span>
      </div>
      <div class="group-label">Start date</div>
      <input type="date" id="start-date" value="${new Date().toISOString().slice(0, 10)}">
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
    sheet.querySelector('#confirm').onclick = async () => {
      const w = parseInt($w.value);
      if (!w) { toast('Enter weeks'); return; }
      await startPlan(program.id, w, $s.value);
      await pref('active_program', program.id);
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
        close();
        const template = SPLIT_TEMPLATES[item.dataset.key];
        openPlanCustomizer(template, allExercises, onSave);
      };
    });
  });
}

function openPlanCustomizer(template, allExercises, onSave) {
  // Build initial exercise picks for all days
  const daySlots = template.days.map(day => autoFillDay(day, allExercises));
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
          const options = suggestForSlot(slot.muscle, allExercises);
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
        close();
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
