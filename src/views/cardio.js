/**
 * Cardio / activity log — walking, cycling, pickleball, basketball.
 * Separate from lifting sessions. Duration + intensity → estimated kcal burn.
 */
import { getAll, getByIndex, put, del, pref } from '../db.js';
import { toast, openSheet } from '../app.js';

const today = () => new Date().toISOString().slice(0, 10);
const ymd = (d) => d.toISOString().slice(0, 10);

let _cardioDate = null;

const PICKLEBALL_SVG = `<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden style="display:inline-block;vertical-align:middle">
  <rect x="1.5" y="0.5" width="12" height="12" rx="4" fill="#0d9488"/>
  <rect x="1.5" y="0.5" width="12" height="12" rx="4" fill="none" stroke="#042f2e" stroke-width="1.2"/>
  <rect x="5.8" y="3.5" width="3.4" height="3.4" rx="0.5" fill="none" stroke="white" stroke-width="0.8" opacity="0.5" transform="rotate(45 7.5 5.2)"/>
  <rect x="5.5" y="11.5" width="4" height="6.5" rx="1.5" fill="#0a0a0a"/>
  <line x1="5.5" y1="13.5" x2="9.5" y2="13.5" stroke="#374151" stroke-width="0.6"/>
  <line x1="5.5" y1="15.2" x2="9.5" y2="15.2" stroke="#374151" stroke-width="0.6"/>
  <line x1="5.5" y1="16.8" x2="9.5" y2="16.8" stroke="#374151" stroke-width="0.6"/>
  <circle cx="17.5" cy="17" r="5" fill="#bbf7d0" fill-opacity="0.85" stroke="#22c55e" stroke-width="1.2"/>
  <circle cx="15.8" cy="15.5" r="0.9" fill="#15803d"/>
  <circle cx="19.2" cy="15.5" r="0.9" fill="#15803d"/>
  <circle cx="15.2" cy="18.3" r="0.9" fill="#15803d"/>
  <circle cx="19.2" cy="18.5" r="0.9" fill="#15803d"/>
  <circle cx="17.5" cy="16.8" r="0.9" fill="#15803d"/>
</svg>`;

function activityIcon(act) {
  if (act.id === 'pickleball') return PICKLEBALL_SVG;
  return `<span style="font-size:20px">${act.icon}</span>`;
}

const ACTIVITIES = [
  { id: 'walking',    label: 'Walking',    icon: '🚶', met: { low: 2.0, moderate: 3.5, high: 5.0 } },
  { id: 'cycling',    label: 'Cycling',    icon: '🚴', met: { low: 4.0, moderate: 7.5, high: 10.0 } },
  { id: 'strength',   label: 'Strength',   icon: '🏋️', met: { low: 3.0, moderate: 5.0, high: 6.0 } },
  { id: 'pickleball', label: 'Pickleball', icon: null, met: { low: 4.0, moderate: 5.0, high: 6.5 } },
  { id: 'basketball', label: 'Basketball', icon: '🏀', met: { low: 4.0, moderate: 6.5, high: 8.0 } },
];

export function burnCalories(activity_id, intensity, duration_min, weight_lb) {
  const act = ACTIVITIES.find(a => a.id === activity_id);
  if (!act) return 0;
  const met = act.met[intensity] || act.met.moderate;
  const weight_kg = weight_lb / 2.20462;
  return Math.round(met * weight_kg * (duration_min / 60));
}

export async function renderCardio(app, date) {
  if (date) _cardioDate = date;
  const dateKey = _cardioDate || today();
  const isToday = dateKey === today();
  const dateLabel = isToday
    ? 'Today'
    : new Date(dateKey + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

  const [logs, userProfile] = await Promise.all([
    getByIndex('cardio', 'date', dateKey),
    pref('profile'),
  ]);
  const weight_lb = userProfile?.weight_lb || 180;
  const totalBurned = logs.reduce((s, l) => s + (l.calories_burned || 0), 0);

  app.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
      <h1 style="margin:0;flex:1">Activity</h1>
      <button class="btn ghost" id="prev-day" style="width:auto;padding:6px 10px">‹</button>
      <span style="font-size:14px;font-weight:600;min-width:80px;text-align:center">${dateLabel}</span>
      <button class="btn ghost" id="next-day" style="width:auto;padding:6px 10px" ${isToday ? 'disabled' : ''}>›</button>
    </div>

    <div class="card">
      <div class="card-row">
        <h2 style="margin:0">${dateLabel}</h2>
        ${totalBurned ? `<span class="pill accent">−${totalBurned} kcal</span>` : ''}
      </div>
      <div id="today-list"></div>
      <button class="btn" id="log-btn" style="margin-top:${logs.length ? '10px' : '0'}">+ Log activity</button>
    </div>

    ${isToday ? `<h2>Recent</h2><div id="history-list"><div class="muted">Loading…</div></div>` : ''}
  `;

  renderTodayList(app.querySelector('#today-list'), logs);
  app.querySelector('#log-btn').onclick = () => openLogSheet(weight_lb, dateKey, () => renderCardio(app));

  app.querySelector('#prev-day').onclick = () => {
    const d = new Date(dateKey + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    _cardioDate = ymd(d);
    renderCardio(app);
  };
  app.querySelector('#next-day').onclick = () => {
    if (isToday) return;
    const d = new Date(dateKey + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    _cardioDate = ymd(d);
    renderCardio(app);
  };

  if (isToday) loadHistory(app.querySelector('#history-list'), weight_lb);
}

function renderTodayList(el, logs) {
  if (!logs.length) {
    el.innerHTML = `<div class="muted" style="padding:8px 0">No activity logged yet</div>`;
    return;
  }
  el.innerHTML = '';
  for (const log of logs) {
    const act = ACTIVITIES.find(a => a.id === log.activity) || { id: log.activity, icon: '🏃', label: log.activity };
    const node = document.createElement('div');
    node.className = 'list-item';
    node.style.marginBottom = '6px';
    node.innerHTML = `
      <div style="flex:1">
        <div class="list-item-title" style="display:flex;align-items:center;gap:6px">${activityIcon(act)} ${act.label}</div>
        <div class="list-item-meta">${log.duration_min} min · ${log.intensity} · ~${log.calories_burned} kcal</div>
      </div>
      <button class="btn ghost" data-id="${log.id}" style="width:auto;padding:6px 10px">✕</button>
    `;
    node.querySelector('button').onclick = async (e) => {
      e.stopPropagation();
      await del('cardio', log.id);
      toast('Removed');
      renderCardio(document.getElementById('app'));
    };
    el.appendChild(node);
  }
}

async function loadHistory(el, weight_lb) {
  const all = await getAll('cardio');
  const todayStr = today();

  // Group by date, skip today
  const byDate = {};
  for (const log of all) {
    if (log.date === todayStr) continue;
    if (!byDate[log.date]) byDate[log.date] = [];
    byDate[log.date].push(log);
  }

  const dates = Object.keys(byDate).sort().reverse().slice(0, 14);
  if (!dates.length) {
    el.innerHTML = `<div class="muted">No past activity yet</div>`;
    return;
  }

  el.innerHTML = '';
  for (const date of dates) {
    const logs = byDate[date];
    const burned = logs.reduce((s, l) => s + (l.calories_burned || 0), 0);
    const summary = logs.map(l => {
      const act = ACTIVITIES.find(a => a.id === l.activity) || { id: l.activity, icon: '🏃' };
      return `${activityIcon(act)} ${l.duration_min}m`;
    }).join('  ');
    const label = new Date(date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

    const node = document.createElement('div');
    node.className = 'list-item';
    node.style.cursor = 'default';
    node.innerHTML = `
      <div style="flex:1">
        <div class="list-item-title">${label}</div>
        <div class="list-item-meta">${summary} · ${burned} kcal</div>
      </div>
    `;
    el.appendChild(node);
  }
}

function openLogSheet(weight_lb, dateKey, onSaved) {
  openSheet((sheet, close) => {
    let selectedActivity = 'walking';
    let selectedIntensity = 'moderate';

    sheet.innerHTML = `
      <h2>Log activity</h2>

      <div class="group-label">Activity</div>
      <div id="act-picker" style="display:flex;flex-direction:column;gap:6px;margin-bottom:4px"></div>

      <div class="group-label">Duration</div>
      <div style="display:flex;align-items:center;gap:8px">
        <input type="number" id="duration" value="30" inputmode="numeric" min="1" max="360" style="flex:1">
        <span style="color:var(--fg-dim);white-space:nowrap">minutes</span>
      </div>

      <div class="group-label">Intensity</div>
      <div id="int-picker" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px"></div>

      <div class="group-label">Calories burned</div>
      <div style="display:flex;align-items:center;gap:8px">
        <input type="number" id="calories" inputmode="numeric" min="0" placeholder="auto" style="flex:1">
        <span style="color:var(--fg-dim);white-space:nowrap">kcal</span>
      </div>
      <div class="muted" id="estimate" style="margin:4px 0 12px;font-size:12px"></div>

      <button class="btn" id="save-btn">Save</button>
    `;

    // Activity buttons
    const $act = sheet.querySelector('#act-picker');
    for (const act of ACTIVITIES) {
      const btn = document.createElement('button');
      btn.className = 'btn ghost';
      btn.dataset.id = act.id;
      btn.innerHTML = `${activityIcon(act)}<span>${act.label}</span>`;
      btn.style.cssText = 'display:flex;align-items:center;justify-content:flex-start;gap:12px;padding:12px 14px;text-align:left;';
      if (act.id === selectedActivity) btn.style.borderColor = 'var(--accent)';
      btn.onclick = () => {
        selectedActivity = act.id;
        $act.querySelectorAll('button').forEach(b => b.style.borderColor = '');
        btn.style.borderColor = 'var(--accent)';
        updateEstimate();
      };
      $act.appendChild(btn);
    }

    // Intensity buttons
    const $int = sheet.querySelector('#int-picker');
    for (const level of ['low', 'moderate', 'high']) {
      const btn = document.createElement('button');
      btn.className = 'btn ghost';
      btn.dataset.level = level;
      btn.textContent = level.charAt(0).toUpperCase() + level.slice(1);
      if (level === selectedIntensity) btn.style.borderColor = 'var(--accent)';
      btn.onclick = () => {
        selectedIntensity = level;
        $int.querySelectorAll('button').forEach(b => b.style.borderColor = '');
        btn.style.borderColor = 'var(--accent)';
        updateEstimate();
      };
      $int.appendChild(btn);
    }

    const $dur = sheet.querySelector('#duration');
    const $cal = sheet.querySelector('#calories');
    const $est = sheet.querySelector('#estimate');

    function updateEstimate() {
      const dur = parseInt($dur.value) || 0;
      const estimated = dur ? burnCalories(selectedActivity, selectedIntensity, dur, weight_lb) : 0;
      $est.textContent = estimated ? `App estimate: ~${estimated} kcal — leave blank to use this` : '';
      // Only auto-fill if user hasn't typed a value
      if (!$cal.dataset.userEdited && estimated) $cal.value = estimated;
    }

    $cal.oninput = () => { $cal.dataset.userEdited = '1'; };
    $dur.oninput = updateEstimate;
    updateEstimate();

    sheet.querySelector('#save-btn').onclick = async () => {
      const dur = parseInt($dur.value);
      if (!dur || dur < 1) { toast('Enter a duration'); return; }
      const calInput = parseInt($cal.value);
      const kcal = calInput > 0 ? calInput : burnCalories(selectedActivity, selectedIntensity, dur, weight_lb);
      await put('cardio', {
        date: dateKey,
        activity: selectedActivity,
        duration_min: dur,
        intensity: selectedIntensity,
        calories_burned: kcal,
      });
      toast('Activity logged');
      close();
      onSaved();
    };
  });
}
