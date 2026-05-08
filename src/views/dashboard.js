/**
 * Dashboard: e1RM trends per exercise, volume per muscle group, weekly recap.
 */
import { getAll, getByIndex } from '../db.js';
import { rpeE1RM, setVolume } from '../lib/e1rm.js';
import { openProgressionChart } from './workout.js';

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
        if (!set.weight || !set.reps) continue;
        const e1 = rpeE1RM(set.weight, set.reps, set.rpe);
        const cur = e1rmByEx[ex.name];
        if (!cur || e1 > cur.e1rm) {
          e1rmByEx[ex.name] = { e1rm: e1, weight: set.weight, reps: set.reps, date: s.date };
        }
      }
    }
  }

  const totalSessions = sessions.filter(s => s.done).length;
  const last7Sessions = sessions.filter(s => s.date >= daysAgoStr(7) && s.done).length;
  const last7TotalVolume = sessions
    .filter(s => s.date >= daysAgoStr(7))
    .reduce((sum, s) => sum + (s.exercises || []).reduce((a, ex) =>
      a + (ex.sets || []).reduce((b, set) => b + setVolume(set), 0), 0), 0);

  const sortedE1rm = Object.entries(e1rmByEx)
    .sort((a, b) => b[1].e1rm - a[1].e1rm)
    .slice(0, 12);

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

    <h2 style="margin-top:20px">Exercise history</h2>
    <div class="search-bar"><input type="text" id="ex-search" placeholder="Search any exercise…" autocomplete="off"></div>
    <div id="ex-search-results"></div>
  `;

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
  return d.toISOString().slice(0, 10);
}
