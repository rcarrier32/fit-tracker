/**
 * Dashboard: e1RM trends per exercise, volume per muscle group, weekly recap.
 */
import { getAll, getByIndex, put, del, pref } from '../db.js';
import { openSheet, toast } from '../app.js';
import { retreatCursor, programName } from './schedule.js';
import { loadCatalogs } from '../lib/static_data.js';
import { rpeE1RM, setVolume } from '../lib/e1rm.js';
import { openProgressionChart } from './workout.js';
import { localDateStr } from '../lib/date.js';

export async function renderDashboard(app) {
  const sessions = await getAll('sessions');
  const meals = await getAll('meals');
  const weights = await getAll('body');

  if (!sessions.length) {
    app.innerHTML = `
      <h1>Stats</h1>
      <div class="empty"><div class="icon">📊</div><div>Log a workout to start seeing trends</div></div>
    `;
    return;
  }

  // Best e1RM per exercise across all sessions
  const e1rmByEx = {};
  for (const s of sessions) {
    for (const ex of (s.exercises || [])) {
      for (const set of (ex.sets || [])) {
        if (!set?.done || !set.weight || !set.reps) continue;
        const e1 = rpeE1RM(set.weight, set.reps, set.rpe);
        const cur = e1rmByEx[ex.name];
        if (!cur || e1 > cur.e1rm) {
          e1rmByEx[ex.name] = { e1rm: e1, weight: set.weight, reps: set.reps, date: s.date };
        }
      }
    }
  }

  const totalSessions = sessions.filter(s => s.done && !s.skipped).length;
  const last7Sessions = sessions.filter(s => s.date >= daysAgoStr(7) && s.done && !s.skipped).length;
  const last7TotalVolume = sessions
    .filter(s => s.date >= daysAgoStr(7))
    .reduce((sum, s) => sum + (s.exercises || []).reduce((a, ex) =>
      a + (ex.sets || []).reduce((b, set) => b + (set?.done ? setVolume(set) : 0), 0), 0), 0);

  const sortedE1rm = Object.entries(e1rmByEx)
    .sort((a, b) => b[1].e1rm - a[1].e1rm)
    .slice(0, 12);

  const { programById } = await loadCatalogs();
  const progName = (id) => { const p = programById.get(id); return p ? programName(p) : String(id || '').replace(/_/g, ' '); };
  app.innerHTML = `
    <h1>Stats</h1>
    <div class="card">
      <div class="card-row">
        <div>
          <div class="muted" style="font-size:11px">Sessions</div>
          <div style="font-size:22px;font-weight:700">${totalSessions}</div>
          <div class="muted" style="font-size:11px">${last7Sessions} this week</div>
        </div>
        <div>
          <div class="muted" style="font-size:11px">Volume (7d)</div>
          <div style="font-size:22px;font-weight:700">${Math.round(last7TotalVolume).toLocaleString()}</div>
          <div class="muted" style="font-size:11px">lb × reps</div>
        </div>
        <div>
          <div class="muted" style="font-size:11px">Meals</div>
          <div style="font-size:22px;font-weight:700">${meals.filter(m => m.date >= daysAgoStr(7)).length}</div>
          <div class="muted" style="font-size:11px">last 7 days</div>
        </div>
      </div>
    </div>

    <h2>Top e1RM</h2>
    <div class="muted" style="font-size:12px;margin-bottom:8px">Tap any exercise to see progression chart</div>
    ${sortedE1rm.length ? `<div id="e1rm-list">` + sortedE1rm.map(([name, info]) => `
      <div class="list-item" style="cursor:pointer" data-ex="${name.replace(/"/g, '&quot;')}">
        <div style="flex:1">
          <div class="list-item-title">${name}</div>
          <div class="list-item-meta">${info.weight} lb × ${info.reps} reps · ${info.date}</div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:700;font-size:18px">${info.e1rm}</div>
          <div class="muted" style="font-size:11px">est. 1RM  📈</div>
        </div>
      </div>
    `).join('') + `</div>` : `<div class="muted">Log some sets with weight + reps to see e1RM</div>`}

    <h2 style="margin-top:20px">Past workouts</h2>
    <div class="muted" style="font-size:12px;margin-bottom:8px">Tap one to fix a set, change its date or delete it</div>
    <div id="past-list">${pastRows(sessions, progName)}</div>

    <h2 style="margin-top:20px">Exercise history</h2>
    <div class="search-bar"><input type="text" id="ex-search" placeholder="Search any exercise…" autocomplete="off"></div>
    <div id="ex-search-results"></div>
  `;

  app.querySelectorAll('#past-list [data-sid]').forEach(el => {
    el.onclick = () => openPastWorkout(sessions.find(x => String(x.id) === el.dataset.sid), () => renderDashboard(app));
  });

  // Top e1RM list — tap to open chart
  app.querySelectorAll('#e1rm-list [data-ex]').forEach(el => {
    el.onclick = () => openProgressionChart(el.dataset.ex);
  });

  // Exercise history search
  const allExNames = [...new Set(
    sessions.flatMap(s => (s.exercises || []).map(e => e.name))
  )].sort();

  const $search = app.querySelector('#ex-search');
  const $results = app.querySelector('#ex-search-results');
  $search.oninput = () => {
    const q = $search.value.trim().toLowerCase();
    if (!q) { $results.innerHTML = ''; return; }
    const matches = allExNames.filter(n => n.toLowerCase().includes(q)).slice(0, 10);
    $results.innerHTML = matches.map(n =>
      `<div class="list-item" style="cursor:pointer" data-ex="${n.replace(/"/g, '&quot;')}">${n}</div>`
    ).join('') || `<div class="muted" style="padding:8px 0">No results</div>`;
    $results.querySelectorAll('[data-ex]').forEach(el => {
      el.onclick = () => { $search.value = ''; $results.innerHTML = ''; openProgressionChart(el.dataset.ex); };
    });
  };
}

function daysAgoStr(n) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return localDateStr(d);
}

const escH = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const loggedSets = (s) => (s.exercises || []).reduce((n, ex) => n + (ex.sets || []).filter(x => x?.done).length, 0);

/** The last 40 workouts (finished or skipped), newest first. */
function pastRows(sessions, progName = (id) => id) {
  const list = sessions.filter(s => s.date && (s.done || loggedSets(s))).sort((a, b) => b.date.localeCompare(a.date) || (b.id || 0) - (a.id || 0)).slice(0, 40);
  if (!list.length) return '<div class="muted">No workouts yet</div>';
  return list.map(s => {
    const d = new Date(s.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const what = [s.focus ? String(s.focus).split(' · ')[0] : '', s.program_id ? progName(s.program_id) : ''].filter(Boolean).join(' · ');
    const state = s.skipped ? 'skipped' : s.done ? `${loggedSets(s)} sets` : 'not finished';
    return `<div class="list-item" style="cursor:pointer" data-sid="${s.id}">
      <div style="flex:1;min-width:0"><div class="list-item-title">${escH(d)}</div>
      <div class="list-item-meta" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escH(what)}</div></div>
      <div class="muted" style="font-size:12px">${state} ›</div></div>`;
  }).join('');
}

/** Fix a past workout: its date, each logged set's weight and reps, or delete it. */
function openPastWorkout(s, onDone) {
  if (!s) return;
  openSheet((sheet, close) => {
    const exs = (s.exercises || []).map((ex, i) => ({ ex, i })).filter(({ ex }) => (ex.sets || []).some(x => x?.done || x?.weight || x?.reps));
    sheet.innerHTML = `
      <h2>${escH(s.focus ? String(s.focus).split(' · ')[0] : 'Workout')}</h2>
      <div class="group-label">Date</div>
      <input type="date" id="pw-date" value="${s.date}">
      ${exs.length ? exs.map(({ ex, i }) => `
        <div class="group-label" style="margin-top:12px">${escH(ex.name)}</div>
        ${(ex.sets || []).map((st, j) => st && (st.done || st.weight || st.reps) ? `
          <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">
            <span class="muted" style="width:18px">${j + 1}</span>
            <input type="number" inputmode="decimal" data-e="${i}" data-s="${j}" data-f="weight" value="${st.weight ?? ''}" placeholder="lb" style="flex:1">
            <input type="number" inputmode="numeric" data-e="${i}" data-s="${j}" data-f="reps" value="${st.reps ?? ''}" placeholder="reps" style="flex:1">
          </div>` : '').join('')}`).join('') : '<div class="muted" style="margin-top:12px">No sets logged.</div>'}
      <button class="btn" id="pw-save" style="margin-top:14px">Save</button>
      <button class="btn ghost" id="pw-del" style="margin-top:8px;color:var(--danger);border-color:var(--danger)">Delete workout</button>
      <button class="btn ghost" id="pw-cancel" style="margin-top:8px">Cancel</button>`;
    sheet.querySelector('#pw-save').onclick = async () => {
      const date = sheet.querySelector('#pw-date').value || s.date;
      sheet.querySelectorAll('input[data-f]').forEach(inp => {
        const st = s.exercises[+inp.dataset.e].sets[+inp.dataset.s];
        st[inp.dataset.f] = inp.value === '' ? null : +inp.value;
      });
      await put('sessions', { ...s, date });
      toast(date !== s.date ? 'Saved and moved' : 'Saved');
      close(); onDone();
    };
    sheet.querySelector('#pw-del').onclick = async () => {
      // Today's finished or skipped workout moved its program on a day: deleting it steps back too.
      const isToday = s.date === localDateStr() && s.done && s.program_id && (await pref(`cursor:${s.program_id}`));
      if (!confirm(isToday ? 'Delete this workout? Its sets leave your history, and the program steps back to this day.'
        : 'Delete this workout? Its sets leave your history. This can\'t be undone.')) return;
      await del('sessions', s.id);
      if (isToday && !['daily_mobility', 'basketball_warmup'].includes(s.program_id)) {
        await retreatCursor(s.program_id);
        if (s.merged_day) await retreatCursor(s.program_id);
      }
      toast('Workout deleted');
      close(); onDone();
    };
    sheet.querySelector('#pw-cancel').onclick = () => close();
  });
}
