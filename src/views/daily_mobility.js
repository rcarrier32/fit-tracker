/**
 * Daily mobility / durability routine — BWS catalog + custom exercises per day.
 */
import { pref } from '../db.js';
import { toast, openSheet } from '../app.js';
import { loadCatalogs } from '../lib/static_data.js';

async function getLog(dateKey) {
  const all = (await pref('mobility_logs')) || {};
  return all[dateKey] || { completed: [], extra: [] };
}

async function saveLog(dateKey, log) {
  const all = (await pref('mobility_logs')) || {};
  all[dateKey] = log;
  await pref('mobility_logs', all);
}

function defaultRoutine(warmups) {
  return warmups?.bws_daily_mobility
    || Object.values(warmups || {}).find(w => w.day_types?.includes('any'))
    || null;
}

/** Render mobility block into a parent element. */
export async function renderDailyMobility(el, dateKey, { compact = false } = {}) {
  const { warmups, exercises: allExercises, exerciseByName } = await loadCatalogs();
  const routine = defaultRoutine(warmups);
  if (!routine) {
    el.innerHTML = '';
    return null;
  }

  let log = await getLog(dateKey);
  const completed = new Set(log.completed || []);
  let extra = [...(log.extra || [])];

  function allItems() {
    return [
      ...routine.exercises.map(ex => ({ ...ex, id: ex.name, builtin: true })),
      ...extra.map((ex, i) => ({ ...ex, id: `extra-${i}`, builtin: false })),
    ];
  }

  function mount() {
    const items = allItems();
    const doneCount = items.filter(ex => completed.has(ex.id)).length;

    el.innerHTML = `
      <div class="card" style="margin-bottom:12px;padding:12px 14px">
        <div class="card-row">
          <h2 style="margin:0;font-size:${compact ? '15px' : '17px'}">Daily mobility</h2>
          <span class="pill mob-pill ${doneCount === items.length && items.length ? 'accent' : ''}">${doneCount}/${items.length}</span>
        </div>
        ${routine.note ? `<div class="muted" style="font-size:12px;margin-bottom:10px">${routine.note}</div>` : ''}
        <div id="mob-list"></div>
        <div class="btn-row" style="margin-top:10px;margin-bottom:0">
          <button class="btn secondary" id="mob-add" style="flex:1">+ Add exercise</button>
          ${doneCount < items.length ? `<button class="btn ghost" id="mob-done-all">All done</button>` : ''}
        </div>
      </div>
    `;

    const $list = el.querySelector('#mob-list');
    $list.innerHTML = items.map(ex => {
      const done = completed.has(ex.id);
      const lookup = exerciseByName.get(ex.name?.toLowerCase());
      const target = ex.reps || ex.time || '';
      return `
        <label class="list-item" style="cursor:pointer;padding:10px 0;margin:0;gap:10px;align-items:flex-start;display:flex">
          <input type="checkbox" data-id="${ex.id}" ${done ? 'checked' : ''} style="width:auto;min-height:auto;margin-top:3px">
          <div style="flex:1;min-width:0">
            <div style="font-size:14px;font-weight:500;${done ? 'opacity:0.55;text-decoration:line-through' : ''}">${ex.name}</div>
            ${ex.notes ? `<div class="muted" style="font-size:12px">${ex.notes}</div>` : ''}
          </div>
          ${target ? `<span class="muted" style="font-size:12px;white-space:nowrap">${target}</span>` : ''}
          ${lookup?.video_url ? `<a href="${lookup.video_url}" target="_blank" class="pill" style="flex-shrink:0" onclick="event.stopPropagation()">▶</a>` : ''}
          ${!ex.builtin ? `<button type="button" class="btn ghost mob-del" data-id="${ex.id}" style="width:auto;padding:4px 8px">✕</button>` : ''}
        </label>
      `;
    }).join('');

    $list.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.onchange = async () => {
        if (cb.checked) completed.add(cb.dataset.id);
        else completed.delete(cb.dataset.id);
        await saveLog(dateKey, { completed: [...completed], extra });
        mount();
      };
    });

    $list.querySelectorAll('.mob-del').forEach(btn => {
      btn.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = btn.dataset.id;
        const idx = extra.findIndex((_, i) => `extra-${i}` === id);
        if (idx >= 0) extra.splice(idx, 1);
        completed.delete(id);
        await saveLog(dateKey, { completed: [...completed], extra });
        mount();
      };
    });

    el.querySelector('#mob-add').onclick = () => openAddSheet();
    el.querySelector('#mob-done-all')?.addEventListener('click', async () => {
      for (const ex of items) completed.add(ex.id);
      await saveLog(dateKey, { completed: [...completed], extra });
      toast('All marked done');
      mount();
    });
  }

  function openAddSheet() {
    openSheet((sheet, close) => {
      sheet.innerHTML = `
        <h2>Add mobility exercise</h2>
        <label>Name</label>
        <input type="text" id="ex-name" autocomplete="off" placeholder="e.g. Hip CARs">
        <label>Duration / reps (optional)</label>
        <input type="text" id="ex-time" placeholder="e.g. 30s per side">
        <label>Notes (optional)</label>
        <input type="text" id="ex-notes">
        <div class="group-label" style="margin-top:14px">From library (mobility / durability)</div>
        <div id="lib-pick" style="max-height:180px;overflow-y:auto"></div>
        <button class="btn" id="ex-save" style="margin-top:14px">Add</button>
      `;

      const $pick = sheet.querySelector('#lib-pick');
      const mobilityNames = allExercises
        .filter(e => /mobility|durability|stretch|warm/i.test(e.name || '') || /mobility|durability/i.test(e.id || ''))
        .slice(0, 40);
      $pick.innerHTML = mobilityNames.map(e => `
        <div class="list-item" data-name="${e.name.replace(/"/g, '&quot;')}" style="padding:8px 12px;cursor:pointer">
          <div class="list-item-title" style="font-size:13px">${e.name}</div>
        </div>
      `).join('') || `<div class="muted">Type a custom name above</div>`;
      $pick.innerHTML = $pick.innerHTML.replace(/<\/motion>/g, '</div>');`;

      $pick.querySelectorAll('[data-name]').forEach(row => {
        row.onclick = () => { sheet.querySelector('#ex-name').value = row.dataset.name; };
      });
      sheet.querySelector('#ex-save').onclick = async () => {
        const name = sheet.querySelector('#ex-name').value.trim();
        if (!name) { toast('Enter a name'); return; }
        extra.push({
          name,
          time: sheet.querySelector('#ex-time').value.trim() || undefined,
          notes: sheet.querySelector('#ex-notes').value.trim() || undefined,
        });
        await saveLog(dateKey, { completed: [...completed], extra });
        toast('Added');
        close();
        mount();
      };
    });
  }

  mount();
  return routine;
}
