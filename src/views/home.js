/**
 * Home/Today view: snapshot of macros + active workout + body weight + quick actions.
 */
import { pref, getByIndex, get, getAll, exportAllData, importAllData } from '../db.js';
import { profile, actualTdeeForWeek } from '../lib/tdee.js';
import { navigate, openSheet, toast } from '../app.js';
import { openScheduleEditor, todaysWorkout } from './schedule.js';
import { loadCatalogs } from '../lib/static_data.js';
import { burnCalories } from './cardio.js';
import { getActivePlan, currentWeek, planProgress } from '../lib/plans.js';
import { rpeE1RM } from '../lib/e1rm.js';

const today = () => new Date().toISOString().slice(0, 10);

function computeActualTdee(allBody, allMeals) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const recentBody = allBody.filter(e => e.date >= cutoffStr).sort((a, b) => a.date.localeCompare(b.date));
  if (recentBody.length < 2) return null;
  const weightChange = recentBody[recentBody.length - 1].weight_lb - recentBody[0].weight_lb;
  const calByDay = {};
  for (const m of allMeals) {
    if (m.date < cutoffStr) continue;
    calByDay[m.date] = (calByDay[m.date] || 0) + (m.calories || 0);
  }
  const days = Object.values(calByDay);
  if (days.length < 3) return null;
  return actualTdeeForWeek(days.reduce((s, c) => s + c, 0) / days.length, weightChange);
}

function getExercisePreview(today_w) {
  if (today_w.type !== 'program' || !today_w.program) return [];
  const p = today_w.program;
  const { week, day, day_index } = today_w;
  let dayData = null;
  if (p.weeks) {
    const w = p.weeks.find(x => x.week_num === week);
    dayData = w?.days?.find(d => d.day_num === day) || w?.days?.[Math.min((day || 1) - 1, w.days.length - 1)];
  } else if (p.days) {
    dayData = day_index != null ? p.days[day_index] : p.days[((day || 1) - 1) % p.days.length];
  }
  return (dayData?.exercises || []).filter(e => !e.is_alternate).slice(0, 4);
}

async function computeWeeklySummary() {
  if (new Date().getDay() !== 1) return null; // Mondays only

  const now = new Date();
  const lastMon = new Date(now); lastMon.setDate(now.getDate() - 7);
  const lastSun = new Date(now); lastSun.setDate(now.getDate() - 1);
  const startStr = lastMon.toISOString().slice(0, 10);
  const endStr   = lastSun.toISOString().slice(0, 10);

  const [allSessions, allMeals, allBody] = await Promise.all([
    getAll('sessions'),
    getAll('meals'),
    getAll('body'),
  ]);

  const wkSessions = allSessions.filter(s => s.done && s.date >= startStr && s.date <= endStr);
  const wkMeals    = allMeals.filter(m => m.date >= startStr && m.date <= endStr);
  const wkBody     = allBody.filter(b => b.date >= startStr && b.date <= endStr)
                            .sort((a, b) => a.date.localeCompare(b.date));

  const calByDay = {};
  for (const m of wkMeals) calByDay[m.date] = (calByDay[m.date] || 0) + (m.calories || 0);
  const calDays = Object.values(calByDay);
  const avgCal = calDays.length
    ? Math.round(calDays.reduce((s, c) => s + c, 0) / calDays.length)
    : null;

  const weightChange = wkBody.length >= 2
    ? +(wkBody[wkBody.length - 1].weight_lb - wkBody[0].weight_lb).toFixed(1)
    : null;

  // Best e1RM per exercise from all sessions before last week
  const priorBest = {};
  for (const s of allSessions) {
    if (!s.done || s.date >= startStr) continue;
    for (const ex of (s.exercises || [])) {
      for (const set of (ex.sets || [])) {
        if (!set?.weight || !set?.reps) continue;
        const e = rpeE1RM(set.weight, set.reps, set.rpe);
        if (e > (priorBest[ex.name] ?? 0)) priorBest[ex.name] = e;
      }
    }
  }

  const seenPR = new Set();
  const prs = [];
  for (const s of wkSessions) {
    for (const ex of (s.exercises || [])) {
      if (seenPR.has(ex.name)) continue;
      let bestE = 0;
      for (const set of (ex.sets || [])) {
        if (!set?.weight || !set?.reps) continue;
        const e = rpeE1RM(set.weight, set.reps, set.rpe);
        if (e > bestE) bestE = e;
      }
      if (bestE > 0 && bestE > (priorBest[ex.name] ?? 0)) {
        prs.push({ name: ex.name, e1rm: bestE });
        seenPR.add(ex.name);
      }
    }
  }

  if (!wkSessions.length && avgCal === null && weightChange === null) return null;
  return { sessionsCount: wkSessions.length, avgCal, weightChange, prs };
}

function renderWeeklySummary(s) {
  if (!s) return '';
  const parts = [];
  if (s.sessionsCount) parts.push(`${s.sessionsCount} session${s.sessionsCount !== 1 ? 's' : ''}`);
  if (s.avgCal)        parts.push(`avg ${s.avgCal} kcal/day`);
  if (s.weightChange !== null) {
    parts.push(`${s.weightChange >= 0 ? '+' : ''}${s.weightChange} lb`);
  }
  const prHtml = s.prs.length
    ? `<div style="margin-top:8px">${s.prs.map(p =>
        `<div style="font-size:13px;color:var(--accent)">★ ${p.name} — ${p.e1rm} lb e1RM</div>`
      ).join('')}</div>`
    : '';
  return `
    <div class="card" style="border-color:var(--accent);margin-bottom:12px">
      <div class="card-row">
        <h2 style="margin:0">Last week</h2>
        <span class="pill accent">Review</span>
      </div>
      <div class="muted" style="margin-top:4px">${parts.join(' · ') || 'No data logged last week.'}</div>
      ${prHtml}
    </div>
  `;
}

export async function renderHome(app) {
  const userProfile = await pref('profile');
  if (!userProfile) {
    return showOnboarding(app);
  }

  const tdee = profile(userProfile);
  const [todays_meals, todays_cardio] = await Promise.all([
    getByIndex('meals', 'date', today()),
    getByIndex('cardio', 'date', today()),
  ]);
  const eaten = todays_meals.reduce((acc, m) => ({
    cal:  acc.cal  + (m.calories || 0),
    p:    acc.p    + (m.protein  || 0),
    c:    acc.c    + (m.carbs    || 0),
    f:    acc.f    + (m.fat      || 0),
  }), { cal: 0, p: 0, c: 0, f: 0 });
  const cardio_burned = todays_cardio.reduce((s, l) => s + (l.calories_burned || 0), 0);

  const target = tdee.target_calories;
  const macroT = tdee.macros;
  const remaining = target + cardio_burned - eaten.cal;

  const [today_w, schedule, bodyToday, activePlan, allBody, allMeals, weeklySummary] = await Promise.all([
    todaysWorkout(),
    pref('schedule'),
    get('body', today()),
    getActivePlan(),
    getAll('body'),
    getAll('meals'),
    computeWeeklySummary(),
  ]);
  const actualTdee = computeActualTdee(allBody, allMeals);

  app.innerHTML = `
    <h1>Today</h1>
    <div class="muted">${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</div>
    ${renderCoachMessage({ eaten, target, cardio_burned, macroT, today_w, bodyToday, activePlan })}
    ${renderWeeklySummary(weeklySummary)}

    <div class="card">
      <div class="card-row">
        <h2 style="margin:0">Calories</h2>
        <span class="pill ${remaining >= 0 ? 'accent' : ''}">${remaining >= 0 ? remaining + ' left' : Math.abs(remaining) + ' over'}</span>
      </div>
      <div class="bar"><div class="bar-fill ${eaten.cal > target + cardio_burned ? 'warn' : ''}" style="width:${Math.min(100, eaten.cal / (target + cardio_burned) * 100)}%"></div></div>
      <div class="muted">${eaten.cal} eaten${cardio_burned ? ` · ${cardio_burned} burned` : ''} · budget ${target + cardio_burned} kcal</div>

      <div class="macro-grid">
        ${macroBox('Protein', eaten.p, macroT.protein_g, 'g')}
        ${macroBox('Carbs',   eaten.c, macroT.carb_g,    'g')}
        ${macroBox('Fat',     eaten.f, macroT.fat_g,     'g')}
        ${macroBox('Cal',     eaten.cal, target,         '')}
      </div>

      <div class="btn-row" style="margin-top:8px">
        <button class="btn" data-action="log-meal">+ Log Meal</button>
        <button class="btn secondary" data-action="log-activity">+ Activity</button>
      </div>
    </div>

    <div class="card">
      <div class="card-row">
        <h2 style="margin:0">Today's Workout</h2>
        ${renderTodayBadge(today_w, activePlan)}
      </div>
      ${activePlan ? renderPlanProgress(activePlan) : ''}
      ${renderTodayBody(today_w, schedule)}
    </div>

    <div class="card">
      <div class="card-row">
        <h2 style="margin:0">Body weight</h2>
        ${bodyToday ? `<span class="pill accent">Logged</span>` : ''}
      </div>
      <div class="muted">Latest: ${userProfile.weight_lb} lb · target ${tdee.weekly_change_lb > 0 ? '+' : ''}${tdee.weekly_change_lb} lb/week · ${actualTdee ? `actual TDEE ~${actualTdee} kcal` : `maintenance ~${tdee.maintenance} kcal`}</div>
      <div class="btn-row" style="margin-top:8px">
        <button class="btn ghost" data-action="log-weight">${bodyToday ? 'Update' : 'Log'} today's weight</button>
        <button class="btn ghost" data-action="edit-profile">Edit profile</button>
        <button class="btn ghost" data-action="export-data">Export data</button>
        <button class="btn ghost" data-action="import-data">Import data</button>
      </div>
    </div>
  `;

  app.querySelector('[data-action="log-meal"]').onclick = () => navigate('meals');
  app.querySelector('[data-action="log-activity"]').onclick = () => navigate('cardio');
  const startOverBtn = app.querySelector('[data-action="program-start-over"]');
  if (startOverBtn) startOverBtn.onclick = async () => {
    await pref('completed:' + startOverBtn.dataset.programId, null);
    renderHome(app);
  };
  const cpBtn = app.querySelector('[data-action="change-program"]');
  if (cpBtn) cpBtn.onclick = () => openProgramPicker();
  const startBtn = app.querySelector('[data-action="start-workout"]');
  if (startBtn) startBtn.onclick = () => navigate('workout');
  const schedBtn = app.querySelector('[data-action="schedule"]');
  if (schedBtn) schedBtn.onclick = async () => {
    await openScheduleEditor();
    renderHome(app);
  };
  app.querySelector('[data-action="log-weight"]').onclick = () => navigate('body');
  app.querySelector('[data-action="edit-profile"]').onclick = () => showOnboarding(app);

  app.querySelector('[data-action="export-data"]').onclick = async () => {
    const data = await exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fit-tracker-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Data exported');
  };

  app.querySelector('[data-action="import-data"]').onclick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.sessions && !data.meals && !data.prefs) throw new Error('Invalid backup file');
        if (!confirm('This will replace all current data with the backup. Continue?')) return;
        await importAllData(data);
        toast('Data restored — reloading…');
        setTimeout(() => window.location.reload(), 800);
      } catch (e) {
        toast(`Import failed: ${e.message}`);
      }
    };
    input.click();
  };
}

function renderTodayBadge(today_w, activePlan) {
  if (activePlan) {
    const { week, weeksLeft } = planProgress(activePlan);
    return `<span class="pill accent">Week ${week} of ${activePlan.total_weeks}</span>`;
  }
  if (today_w.type === 'program' && today_w.program) {
    return `<span class="pill ${today_w.program.source.toLowerCase()}">${today_w.program.source}</span>`;
  }
  return '';
}

function renderPlanProgress(plan) {
  const { week, pct, weeksLeft } = planProgress(plan);
  return `
    <div class="bar" style="margin:8px 0 4px">
      <div class="bar-fill" style="width:${pct}%"></div>
    </div>
    <div class="muted" style="font-size:12px;margin-bottom:8px">${weeksLeft} week${weeksLeft !== 1 ? 's' : ''} left · ${pct}% complete</div>
  `;
}

function renderTodayBody(today_w, schedule) {
  const editLine = `<button class="btn ghost" data-action="schedule" style="margin-top:8px">${schedule ? 'Edit weekly schedule' : 'Set up Mixed Week'}</button>`;
  if (today_w.type === 'completed') {
    const name = today_w.program?.name || today_w.program?.program_name || today_w.programId || 'Program';
    return `
      <div style="margin-top:8px">
        <div style="font-size:20px;font-weight:700;margin-bottom:4px">Program complete.</div>
        <div class="muted" style="margin-bottom:12px">${name} · finished ${today_w.completedAt}</div>
        <div class="btn-row">
          <button class="btn" data-action="program-start-over" data-program-id="${today_w.programId}">Start over</button>
          <button class="btn secondary" data-action="change-program">New program</button>
        </div>
      </div>
    `;
  }
  if (today_w.type === 'tag') {
    const map = {
      'Rest':   { icon: '😴', txt: 'Rest day. Recover.' },
      'Cardio': { icon: '🏃', txt: 'Zone 2 / cardio (untracked).' },
      'Custom': { icon: '✏️', txt: 'Free-form session.' },
    };
    const m = map[today_w.tag] || { icon: '·', txt: today_w.tag };
    return `
      <div style="margin-top:6px;font-size:18px">${m.icon} ${m.txt}</div>
      <div class="btn-row" style="margin-top:10px">
        <button class="btn" data-action="start-workout">${today_w.tag === 'Rest' ? 'Just log something' : 'Open log'}</button>
        <button class="btn ghost" data-action="schedule">Edit week</button>
      </div>
    `;
  }
  if (today_w.type === 'program' && today_w.program) {
    const p = today_w.program;
    const detail = today_w.day_index != null
      ? `${p.days?.[today_w.day_index]?.day_name || `Day ${today_w.day_index + 1}`}`
      : `Wk ${today_w.week}, Day ${today_w.day}`;
    const preview = getExercisePreview(today_w);
    const totalEx = today_w.program.days
      ? (today_w.program.days[today_w.day_index ?? 0]?.exercises || []).filter(e => !e.is_alternate).length
      : null;
    const previewHtml = preview.length ? `
      <div style="margin:8px 0 2px">
        ${preview.map(e => `
          <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--fg-dim);padding:3px 0">
            <span>${e.name}</span>
            <span style="opacity:0.55">${e.sets ? `${e.sets}×${e.reps || e.set_targets?.[0] || ''}` : ''}</span>
          </div>
        `).join('')}
        ${totalEx > 4 ? `<div style="font-size:12px;color:var(--fg-dim);opacity:0.5;padding-top:2px">+ ${totalEx - 4} more</div>` : ''}
      </div>
    ` : '';
    return `
      <div style="margin-top:6px">${p.name || p.program_name || p.id} — ${detail}</div>
      <div class="muted" style="font-size:12px">${today_w.mode === 'follow' ? 'Following progression' : 'Pinned day'}</div>
      ${previewHtml}
      <div class="btn-row" style="margin-top:10px">
        <button class="btn" data-action="start-workout">Start workout</button>
        <button class="btn ghost" data-action="schedule">Edit week</button>
      </div>
    `;
  }
  return `
    <div class="muted">No workout assigned for today.</div>
    <div class="btn-row" style="margin-top:10px">
      <button class="btn" data-action="schedule">Set up Mixed Week</button>
      <button class="btn ghost" data-action="change-program">Single program</button>
    </div>
  `;
}

function renderCoachMessage({ eaten, target, cardio_burned, macroT, today_w, bodyToday, activePlan }) {
  const budget = target + cardio_burned;
  const remaining = budget - eaten.cal;
  const hour = new Date().getHours();
  const msgs = [];

  // Calorie nudges — only meaningful if some food has been logged
  if (eaten.cal > 0) {
    if (remaining > 400 && hour >= 18) {
      msgs.push(`You have ${remaining} kcal left today — room for a high-protein snack.`);
    } else if (remaining < -150) {
      msgs.push(`You're ${Math.abs(remaining)} kcal over budget. Not a problem — just stay consistent tomorrow.`);
    } else if (remaining >= 0 && remaining <= 150 && hour >= 19) {
      msgs.push(`Nearly perfect on calories today.`);
    }
  }

  // Protein nudge
  const proteinLeft = macroT.protein_g - eaten.p;
  if (proteinLeft > 40 && hour >= 15) {
    msgs.push(`${Math.round(proteinLeft)}g protein still to hit — add a shake or chicken with dinner.`);
  }

  // Workout nudge
  if (today_w.type === 'program' || today_w.type === 'tag') {
    const tag = today_w.tag;
    if (tag === 'Rest') msgs.push(`Rest day. Let the muscles recover.`);
    else if (today_w.type === 'program' && today_w.program) {
      const dayLabel = today_w.day_index != null
        ? today_w.program.days?.[today_w.day_index]?.day_name || `Day ${today_w.day_index + 1}`
        : `Day ${today_w.day}`;
      msgs.push(`Lift day: ${dayLabel}. Get it done.`);
    }
  }

  // Body weight nudge
  if (!bodyToday && hour >= 7) {
    msgs.push(`Haven't logged weight yet today.`);
  }

  if (!msgs.length) return '';

  return `<div class="card" style="border-color:var(--accent);padding:12px 14px;margin-bottom:12px">
    <div style="font-size:13px;line-height:1.6;color:var(--fg)">
      ${msgs.map(m => `<div>· ${m}</div>`).join('')}
    </div>
  </div>`;
}

function macroBox(label, val, target, unit) {
  const pct = target ? Math.min(100, (val / target) * 100) : 0;
  return `
    <div class="macro">
      <div class="macro-label">${label}</div>
      <div class="macro-value">${Math.round(val)}${unit}</div>
      <div class="macro-target">/ ${target}${unit}</div>
      <div class="bar" style="margin-top:4px"><div class="bar-fill" style="width:${pct}%"></div></div>
    </div>
  `;
}

async function openProgramPicker() {
  const { programs } = await loadCatalogs();
  openSheet((sheet, close) => {
    sheet.innerHTML = `
      <h2>Choose a program</h2>
      <div class="muted" style="margin-bottom:12px">PJF programs link out to the PJF app for videos. BWS programs use embedded YouTube links.</div>
      <div id="prog-list"></div>
    `;
    const list = sheet.querySelector('#prog-list');
    const groups = { PJF: [], BWS: [] };
    for (const p of programs) (groups[p.source] || (groups[p.source] = [])).push(p);
    for (const src of ['PJF', 'BWS']) {
      list.insertAdjacentHTML('beforeend', `<div class="group-label">${src}</div>`);
      for (const p of groups[src]) {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `
          <div>
            <div class="list-item-title">${prettyName(p)}</div>
            <div class="list-item-meta">${describeProgram(p)}</div>
          </div>
          <span class="pill ${src.toLowerCase()}">${src}</span>
        `;
        item.onclick = async () => {
          await import('../db.js').then(({ pref }) => pref('active_program', p.id));
          await import('../db.js').then(({ pref }) => pref('active_week', 1));
          await import('../db.js').then(({ pref }) => pref('active_day', 1));
          close();
          toast(`Selected ${prettyName(p)}`);
          renderHome(document.getElementById('app'));
        };
        list.appendChild(item);
      }
    }
  });
}

function prettyName(p) {
  if (p.program_name) return p.program_name;
  return p.name || p.id;
}

function describeProgram(p) {
  if (p.weeks) {
    const totalDays = p.weeks.reduce((s, w) => s + (w.days?.length || 0), 0);
    return `${p.weeks.length} weeks · ${totalDays} day-templates`;
  }
  if (p.days) return `${p.days.length} day rotation`;
  return '';
}

async function showOnboarding(app) {
  const existing = (await pref('profile')) || {};
  const isEdit = !!existing.weight_lb;

  const RATE_OPTS = [
    [-2,    'Lose 2 lb/week — aggressive cut'],
    [-1.5,  'Lose 1.5 lb/week'],
    [-1,    'Lose 1 lb/week'],
    [-0.5,  'Lose 0.5 lb/week — slow cut / recomp'],
    [0,     'Maintain weight'],
    [0.25,  'Gain 0.25 lb/week — lean bulk'],
    [0.5,   'Gain 0.5 lb/week'],
  ];
  const curRate = existing.weekly_change_lb ?? -1;
  const closestRate = RATE_OPTS.reduce((p, [v]) => Math.abs(v - curRate) < Math.abs(p - curRate) ? v : p, RATE_OPTS[0][0]);

  app.innerHTML = `
    <h1>${isEdit ? 'Edit Profile' : 'Welcome'}</h1>
    <div class="muted" style="margin-bottom:14px">These set your calorie budget. A desk job + 4 gym days = Moderate.</div>
    <div class="card">
      <label>Current weight (lb)</label>
      <input type="number" id="weight" value="${existing.weight_lb || 200}" inputmode="decimal">
      <label>Body fat % (estimate ok)</label>
      <input type="number" id="bf" value="${existing.bf_pct || 20}" inputmode="decimal">
      <label>Goal</label>
      <select id="change">
        ${RATE_OPTS.map(([v, l]) => `<option value="${v}" ${v === closestRate ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
      <label>Daily activity level (outside the gym)</label>
      <select id="activity">
        <option value="sedentary" ${existing.activity_level==='sedentary'?'selected':''}>Sedentary — desk job, little movement</option>
        <option value="light" ${existing.activity_level==='light'?'selected':''}>Light — some walking, 1-3 gym days/week</option>
        <option value="moderate" ${(!existing.activity_level||existing.activity_level==='moderate')?'selected':''}>Moderate — 3-5 gym days/week</option>
        <option value="active" ${existing.activity_level==='active'?'selected':''}>Active — hard training 6-7 days/week</option>
        <option value="very_active" ${existing.activity_level==='very_active'?'selected':''}>Very Active — physical job + daily training</option>
      </select>
      <div id="cal-preview" class="muted" style="margin-top:10px;font-size:13px;padding:8px;background:var(--bg-input);border-radius:8px"></div>
      <button class="btn" id="save" style="margin-top:14px">Save</button>
      ${isEdit ? `<button class="btn ghost" id="cancel" style="margin-top:8px">Cancel</button>` : ''}
    </div>
  `;

  function updatePreview() {
    const w = +app.querySelector('#weight').value;
    const bf = +app.querySelector('#bf').value;
    const act = app.querySelector('#activity').value;
    const chg = +app.querySelector('#change').value;
    if (!w || !bf) return;
    const bmr = 370 + 21.6 * (w * (1 - bf/100) / 2.20462);
    const mult = { sedentary:1.20, light:1.375, moderate:1.55, active:1.725, very_active:1.90 }[act] ?? 1.55;
    const maint = Math.round(bmr * mult);
    const target = Math.round(maint + (chg * 3500 / 7));
    const delta = target - maint;
    const deltaStr = delta === 0 ? 'at maintenance' : `${delta > 0 ? '+' : ''}${delta} cal/day`;
    app.querySelector('#cal-preview').textContent = `Maintenance: ~${maint} kcal → Target: ${target} kcal (${deltaStr})`;
  }
  app.querySelectorAll('input, select').forEach(el => el.addEventListener('input', updatePreview));
  updatePreview();

  app.querySelector('#save').onclick = async () => {
    const rate = +app.querySelector('#change').value;
    const profileData = {
      ...(existing || {}),
      weight_lb: +app.querySelector('#weight').value,
      bf_pct: +app.querySelector('#bf').value,
      goal: rate < 0 ? 'Lose Fat' : rate > 0 ? 'Gain' : 'Maintain',
      activity_level: app.querySelector('#activity').value,
      weekly_change_lb: rate,
    };
    await pref('profile', profileData);
    toast('Profile saved');
    renderHome(app);
  };
  const $cancel = app.querySelector('#cancel');
  if ($cancel) $cancel.onclick = () => renderHome(app);
}
