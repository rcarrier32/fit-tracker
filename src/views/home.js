/**
 * Home/Today view: snapshot of macros + active workout + body weight + quick actions.
 */
import { pref, getByIndex, get, getAll, exportAllData, importAllData } from '../db.js';
import { localDateStr } from '../lib/date.js';

function macroPercents(p, c, f) {
  const pCal = (p || 0) * 4;
  const cCal = (c || 0) * 4;
  const fCal = (f || 0) * 9;
  const total = pCal + cCal + fCal;
  if (!total) return null;
  return {
    p: Math.round(pCal / total * 100),
    c: Math.round(cCal / total * 100),
    f: Math.round(fCal / total * 100),
  };
}
import { profile, actualTdeeForWeek } from '../lib/tdee.js';
import { navigate, openSheet, toast } from '../app.js';
import { openScheduleEditor, todaysWorkout, dailyWorkout, DAILY_ID, selectSingleProgram, positionLabel, programName } from './schedule.js';
import { dailyStreak, activeStreak, dailyState, rowTarget, prevDay } from '../lib/daily_card.js';
import { yesterdayLoad, adjustDaily, soreFromNotes, helpedMoves } from '../lib/daily_adjust.js';
import { buildIcs } from '../lib/calendar.js';
import { learnProfile } from '../lib/learn.js';
import { getAllPrograms } from '../lib/static_data.js';
import { loadCatalogs, isHeaderRow } from '../lib/static_data.js';
import { burnCalories } from './cardio.js';
import { getActivePlan, currentWeek, planProgress } from '../lib/plans.js';
import { rpeE1RM } from '../lib/e1rm.js';
import { hipToday } from '../lib/hip_protocol.js';
import { hipCredits } from '../lib/moves_today.js';
import { HOME_CARDS, resolveLayout, moveCard, layoutToSave } from '../lib/home_layout.js';
import { weekSummary, weightTrend, feelingSummary } from '../lib/home_extras.js';
import { mountWeightChart } from '../lib/weight_chart.js';

const today = () => localDateStr();

function computeActualTdee(allBody, allMeals) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffStr = localDateStr(cutoff);
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
  return (dayData?.exercises || []).filter(e => !e.is_alternate && !isHeaderRow(e.name)).slice(0, 4);
}

async function computeWeeklySummary() {
  if (new Date().getDay() !== 1) return null; // Mondays only

  const now = new Date();
  const lastMon = new Date(now); lastMon.setDate(now.getDate() - 7);
  const lastSun = new Date(now); lastSun.setDate(now.getDate() - 1);
  const startStr = localDateStr(lastMon);
  const endStr   = localDateStr(lastSun);

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

const escH = (t) => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dayLetter = (name, i) => (/Daily ([A-Z])/.exec(name || '') || [])[1] || String.fromCharCode(65 + i);

/**
 * Daily Mobility card: runs next to the active program (docs/mockups/daily_mobility_card.png).
 * Not started → Start / Skip today, with what it changed for yesterday's training.
 * Started → progress and the next move. Done or skipped → one line.
 */
async function dailyCardData(todaysSessions) {
  const dw = await dailyWorkout();
  if (!dw || dw.type !== 'program') return null;
  const program = dw.program;
  const n = program.days.length;
  const i = dw.day_index ?? 0;
  const day = program.days[i] || program.days[0];
  const rows = day.exercises.filter(e => !e.is_alternate && !isHeaderRow(e.name))
    .map(x => ({ name: x.name, target_sets: x.sets, target_reps: x.reps || '', time: x.time, notes: x.notes }));
  const skippedToday = (await pref('daily_skip')) === today();
  const st = dailyState(todaysSessions, { programId: DAILY_ID, skippedToday, dayRows: rows });
  const all = await getAll('sessions');
  const streak = dailyStreak(all, today(), DAILY_ID);
  let adjust = null;
  if (st.state === 'todo') {
    const yest = all.filter(x => x.date === prevDay(today()));
    const { exerciseByName } = await loadCatalogs();
    const lookup = (nm) => exerciseByName.get(String(nm).toLowerCase());
    // Notes from yesterday's and today's workouts: areas called sore get their stretches.
    const sore = soreFromNotes([...yest, ...todaysSessions]);
    adjust = adjustDaily(rows, yesterdayLoad(yest, lookup), lookup, { sore, helped: helpedMoves(all, today()) }).note;
  }
  const letters = program.days.map((d, k) => dayLetter(d.day_name, k));
  // Done: today is the finished session's day, whatever the cursor says (it has moved on, and
  // "next workout" on Daily Mobility's own finish screen shows the cursor's day on Lift).
  const finished = st.state === 'done'
    ? todaysSessions.filter(x => x.program_id === DAILY_ID && x.done && !x.skipped).sort((a, b) => (b.id || 0) - (a.id || 0))[0] : null;
  const todayIdx = finished ? (finished.day_index ?? 0) : i;
  return { program, day, rows, st, streak, adjust, letters, todayIdx, nextIdx: (todayIdx + 1) % n,
    minutes: program.session_length_min || 13 };
}

function renderDailyCard(d) {
  if (!d) return '';
  const { st, streak, letters, todayIdx, nextIdx } = d;
  const L = letters[todayIdx];
  const fire = '';   // the streak lives on Today's Workout (any training day counts)
  if (st.state === 'done' || st.state === 'skipped') {
    const done = st.state === 'done';
    return `
    <div class="card" style="padding:10px 14px">
      <div class="card-row">
        <div>
          <div style="font-weight:600">Daily Mobility ${done ? '✓' : '· skipped today'}</div>
          <div style="font-size:11px;color:var(--fg-dim)">${done ? `Day ${L}${st.minutes ? ` · ${st.minutes} min` : ''}${fire} · tomorrow: Day ${letters[nextIdx]}`
            : `Day ${L} waits for tomorrow`}</div>
        </div>
        <button class="btn ghost" id="daily-open" style="width:auto;padding:4px 10px;font-size:12px;flex-shrink:0">${done ? 'View' : 'Do it anyway'}</button>
      </div>
    </div>`;
  }
  if (st.state === 'started') {
    const pct = Math.round(st.done / Math.max(1, st.total) * 100);
    return `
    <div class="card" style="border-color:var(--accent);margin-bottom:12px">
      <div class="card-row"><h2 style="margin:0">Daily Mobility</h2><span class="pill accent">${st.done} of ${st.total}</span></div>
      <div class="bar"><div class="bar-fill" style="width:${pct}%"></div></div>
      ${st.next ? `<div class="muted" style="font-size:13px">Next up: <b style="color:var(--fg)">${escH(st.next.name)}</b> · ${escH(rowTarget(st.next))}</div>` : ''}
      <div class="btn-row" style="margin-top:10px;margin-bottom:0">
        <button class="btn" id="daily-open" style="flex:2">▶ Resume</button>
      </div>
    </div>`;
  }
  return `
    <div class="card" style="margin-bottom:12px">
      <div class="card-row"><h2 style="margin:0">Daily Mobility</h2><span class="pill accent">Day ${L} · ${d.minutes} min</span></div>
      ${d.adjust ? `<div class="muted" style="font-size:12px;margin-top:4px">↻ Adjusted for yesterday's training</div>` : ''}
      <div class="btn-row" style="margin-top:10px;margin-bottom:0">
        <button class="btn" id="daily-open" data-start="1" style="flex:2">▶ Start</button>
        <button class="btn ghost" id="daily-skip" style="flex:1">Skip today</button>
      </div>
    </div>`;
}

/** The hip plan on a day with no workout: one line. (On workout days its warm-up is the workout's warm-up.) */
function hipRow(hip) {
  const wu = hip.warmup || { done: 0, total: 0 };
  return `
        <div class="card-row" style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border)">
          <div style="font-size:13px">Hip warm-up <span class="muted">· ${wu.done}/${wu.total}</span></div>
          <button id="open-hip" class="btn ghost" style="width:auto;padding:4px 10px;font-size:12px;flex-shrink:0">Open →</button>
        </div>`;
}

/** Workouts planned this week: Mixed Week program days, else the program's days per week. */
function plannedThisWeek(schedule, today_w) {
  if (schedule?.type === 'weekly' && schedule.slots?.some(sl => sl?.program_id)) return schedule.slots.filter(sl => sl?.program_id).length;
  const p = today_w?.program;
  if (!p || p.id === DAILY_ID) return null;
  if (p.weeks) return p.weeks.find(w => w.week_num === today_w.week)?.days?.length || p.sessions_per_week || null;
  return p.sessions_per_week || null;
}

// Optional cards stay light: a title row and one or two quiet lines.
function renderWeekCard(w) {
  const L = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const dots = w.days.map((d, i) => `
    <div style="flex:1;text-align:center">
      <div style="width:22px;height:22px;margin:0 auto;border-radius:50%;font-size:10px;line-height:22px;
        ${d.workout ? 'background:var(--accent);color:#0f172a;font-weight:700' : `border:1px solid ${d.today ? 'var(--accent)' : 'var(--border)'};color:var(--fg-dim)`}">${L[i]}</div>
      <div style="height:4px;margin-top:3px">${d.daily ? '<span style="display:inline-block;width:4px;height:4px;border-radius:50%;background:var(--accent)"></span>' : ''}</div>
    </div>`).join('');
  const extra = [w.dailyDays ? `mobility ${w.dailyDays}×` : '', w.cardioMin ? `${w.cardioMin} min active` : ''].filter(Boolean).join(' · ');
  return `
    <div class="card" style="padding:12px 14px">
      <div class="card-row"><div style="font-weight:600">This week</div>
        <span class="muted" style="font-size:12px">${w.workouts}${w.planned ? ` of ${w.planned}` : ''} workout${(w.planned || w.workouts) === 1 ? '' : 's'}${extra ? ` · ${extra}` : ''}</span></div>
      <div style="display:flex;gap:2px;margin-top:8px">${dots}</div>
    </div>`;
}

function renderFeelingCard(f) {
  const face = (r) => r.heavy ? '😫' : (r.energy >= 4 || r.effort === 'easy') ? '💪' : '🙂';
  const line = !f ? 'Answer "How did it feel?" after a workout to see this.'
    : f.advice ? '2 of your last 3 felt like too much: try a lighter week (half the sets, same weights).'
    : 'Recovering fine. Keep building.';
  return `
    <div class="card" style="padding:12px 14px">
      <div class="card-row"><div style="font-weight:600">How you've been feeling</div>
        ${f ? `<span style="font-size:15px;letter-spacing:2px" title="Last workouts, oldest first">${f.recent.slice(-3).map(face).join('')}</span>` : ''}</div>
      <div class="muted" style="font-size:12px;margin-top:4px;${f?.advice ? 'color:var(--fg)' : ''}">${escH(line)}</div>
      ${f?.sore?.length ? `<div class="muted" style="font-size:12px;margin-top:2px">Sore: ${f.sore.map(escH).join(', ')} (Daily Mobility stretches them)</div>` : ''}
      ${f?.hurts.length ? `<div class="muted" style="font-size:12px;margin-top:2px">Hurt lately: ${f.hurts.map(escH).join(', ')}</div>` : ''}
    </div>`;
}

function renderTrendCard(t) {
  return `
    <div class="card" style="padding:12px 14px">
      <div class="card-row"><div style="font-weight:600">Weight</div>
        <span class="muted" style="font-size:12px">${t ? `${t.avg} lb 7-day avg${t.change != null ? ` · ${t.change > 0 ? '+' : ''}${t.change} vs last week` : ''}` : 'Weigh in 3× a week for a trend'}</span></div>
      <div id="home-wchart"></div>
    </div>`;
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
    fiber: acc.fiber + (m.fiber || 0),
    sat:   acc.sat   + (m.saturated_fat || 0),
  }), { cal: 0, p: 0, c: 0, f: 0, fiber: 0, sat: 0 });
  const cardio_burned = todays_cardio.reduce((s, l) => s + (l.calories_burned || 0), 0);

  const target = tdee.target_calories;
  const macroT = tdee.macros;
  const remaining = target + cardio_burned - eaten.cal;

  const [today_w, schedule, bodyToday, activePlan, allBody, allMeals, weeklySummary, todaysSessions, tosProgress, tosLogs] = await Promise.all([
    todaysWorkout(),
    pref('schedule'),
    get('body', today()),
    getActivePlan(),
    getAll('body'),
    getAll('meals'),
    computeWeeklySummary(),
    getByIndex('sessions', 'date', today()),
    pref('tos_progress'),
    pref('tos_logs'),
  ]);
  const [hipProgress, hipLogs, hipCustom] = await Promise.all([
    pref('hip_progress'),
    pref('hip_logs').then(v => v || {}),
    pref('hip_custom').then(v => v || []),
  ]);
  // Only once the hip plan is in use — started, flaring, or anything ever checked off.
  const hip = (hipProgress || Object.keys(hipLogs).length)
    ? hipToday({ custom: hipCustom, done: { ...(await hipCredits(hipCustom || [])), ...(hipLogs[today()] || {}) } })
    : null;

  const tosDoneToday = tosProgress
    ? Object.values((tosLogs || {})[today()] || {}).filter(Boolean).length
    : 0;
  const tosWeek = tosProgress ? (() => {
    const days = Math.floor((Date.now() - new Date(tosProgress.started + 'T12:00:00')) / 864e5);
    return Math.max(1, Math.floor(days / 7) + 1);
  })() : null;
  const workoutDoneToday = isWorkoutDoneToday(today_w, todaysSessions);
  // A workout still to do today: the hip warm-up goes first, above it (the hip plan says to warm up before any lift).
  const hipInWorkout = !!hip && today_w.type === 'program';
  const trainStreak = activeStreak(await getAll('sessions'), today());   // the workout starts with the hip warm-up
  // Daily Mobility is its own card unless it's already the program on the Today's Workout card.
  const daily = today_w.program?.id === DAILY_ID ? null : await dailyCardData(todaysSessions);
  const actualTdee = computeActualTdee(allBody, allMeals);

  // Cards in the order you chose (Customize Home, pref 'home_layout'; src/lib/home_layout.js).
  const cards = {
    tips: renderCoachMessage({ eaten, target, cardio_burned, macroT, today_w, bodyToday, activePlan, workoutDoneToday }),
    lastweek: renderWeeklySummary(weeklySummary),
    daily: renderDailyCard(daily),
    calories: `
    <div class="card">
      <div class="card-row">
        <h2 style="margin:0">Calories</h2>
        <span class="pill ${remaining >= 0 ? 'accent' : ''}">${remaining >= 0 ? remaining + ' left' : Math.abs(remaining) + ' over'}</span>
      </div>
      <div class="bar"><div class="bar-fill ${eaten.cal > target + cardio_burned ? 'warn' : ''}" style="width:${Math.min(100, eaten.cal / (target + cardio_burned) * 100)}%"></div></div>
      <div class="muted">${eaten.cal} eaten${cardio_burned ? ' · ' + cardio_burned + ' burned' : ''} · budget ${target + cardio_burned} kcal</div>

      <div class="macro-grid">
        ${macroBox('Protein', eaten.p, macroT.protein_g, 'g')}
        ${macroBox('Carbs',   eaten.c, macroT.carb_g,    'g')}
        ${macroBox('Fat',     eaten.f, macroT.fat_g,     'g')}
        ${macroBox('Cal',     eaten.cal, target,         '')}
      </div>
      ${renderMacroPct(eaten.p, eaten.c, eaten.f)}
      <div class="muted" style="font-size:11px;margin-top:6px">Fiber ${Math.round(eaten.fiber * 10) / 10}g · Sat. fat ${Math.round(eaten.sat * 10) / 10}g</div>

      <div class="btn-row" style="margin-top:8px">
        <button class="btn" data-action="log-meal">+ Log Meal</button>
        <button class="btn secondary" data-action="log-activity">+ Activity</button>
      </div>
    </div>
    `,
    workout: `
    <div class="card">
      <div class="card-row">
        <h2 style="margin:0">Today's Workout</h2>
        ${trainStreak >= 1 ? `<span class="pill accent" title="Days in a row you trained (workouts or Daily Mobility)">🔥 ${trainStreak} day${trainStreak === 1 ? '' : 's'}</span>` : renderTodayBadge(today_w, activePlan)}
      </div>
      ${activePlan && activePlan.program_id === today_w.program?.id ? renderPlanProgress(activePlan) : ''}
      ${renderTodayBody(today_w, schedule, workoutDoneToday, hipInWorkout)}
      ${tosProgress ? `
        <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
            <div>
              <div style="font-size:12px;font-weight:600;color:var(--fg)">TOS Rehab</div>
              <div style="font-size:11px;color:var(--fg-dim)">
                ${tosProgress.label} · Week ${tosWeek}${tosDoneToday > 0 ? ` · ${tosDoneToday} done today` : ''}
              </div>
            </div>
            <button id="open-tos" class="btn ghost" style="width:auto;padding:4px 10px;font-size:12px;flex-shrink:0">Open →</button>
          </div>
        </div>` : ''}
      ${hip && !hipInWorkout ? hipRow(hip) : ''}
    </div>
    `,
    body: `
    <div class="card">
      <div class="card-row">
        <h2 style="margin:0">Body weight</h2>
        ${bodyToday ? `<span class="pill accent">Logged</span>` : ''}
      </div>
      <div class="muted">Latest: ${userProfile.weight_lb} lb · target ${tdee.weekly_change_lb > 0 ? '+' : ''}${tdee.weekly_change_lb} lb/week · ${actualTdee ? ('actual TDEE ~' + actualTdee + ' kcal') : ('maintenance ~' + tdee.maintenance + ' kcal')}</div>
      <div class="btn-row" style="margin-top:8px">
        <button class="btn ghost" data-action="log-weight">${bodyToday ? 'Update' : 'Log'} today's weight</button>
      </div>
    </div>
    `,
  };
  const layout = resolveLayout(await pref('home_layout'));
  // Optional cards: only gather their data when they're on.
  const want = (id) => !layout.hidden.has(id);
  const allSessions = (want('week') || want('feeling')) ? await getAll('sessions') : [];
  if (want('week')) cards.week = renderWeekCard(weekSummary({ sessions: allSessions, cardio: await getAll('cardio'), today: today(), planned: plannedThisWeek(schedule, today_w) }));
  if (want('feeling')) cards.feeling = renderFeelingCard(feelingSummary(allSessions, today()));
  if (want('trend')) cards.trend = renderTrendCard(weightTrend(allBody, today()));
  app.innerHTML = `
    <h1>Today</h1>
    <div class="muted">${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</div>
    ${layout.order.filter(id => !layout.hidden.has(id)).map(id => cards[id] || '').join('\n')}
    <div class="btn-row" style="margin-top:4px">
      <button class="btn ghost" data-action="customize-home">↕ Customize Home</button>
      <button class="btn ghost" data-action="edit-profile">Edit profile</button>
      <button class="btn ghost" data-action="calendar">📅 Add to calendar</button>
      <button class="btn ghost" data-action="export-data">Export data</button>
      <button class="btn ghost" data-action="import-data">Import data</button>
    </div>
  `;

  const $hw = app.querySelector('#home-wchart');
  if ($hw && allBody.length >= 2) mountWeightChart($hw, allBody, { today: today(), range: (await pref('weight_chart_range')) || '1M',
    goalPerWeek: userProfile.weekly_change_lb ?? null, height: 120, onRange: (r) => pref('weight_chart_range', r) });
  app.querySelector('[data-action="customize-home"]').onclick = () => openHomeLayout(() => renderHome(app));
  const logMeal = app.querySelector('[data-action="log-meal"]');
  if (logMeal) logMeal.onclick = () => navigate('meals');
  const openTosBtn = app.querySelector('#open-tos');
  if (openTosBtn) openTosBtn.onclick = () => navigate('tos');
  const openHipBtn = app.querySelector('#open-hip');
  if (openHipBtn) openHipBtn.onclick = () => navigate('hip');
  const logAct = app.querySelector('[data-action="log-activity"]');
  if (logAct) logAct.onclick = () => navigate('cardio');
  const startOverBtn = app.querySelector('[data-action="program-start-over"]');
  if (startOverBtn) startOverBtn.onclick = async () => {
    await pref('completed:' + startOverBtn.dataset.programId, null);
    await pref('cursor:' + startOverBtn.dataset.programId, null);   // back to Week 1, Day 1
    renderHome(app);
  };
  const cpBtn = app.querySelector('[data-action="change-program"]');
  if (cpBtn) cpBtn.onclick = () => openProgramPicker();
  const startBtn = app.querySelector('[data-action="start-workout"]');
  if (startBtn) startBtn.onclick = () => {
    // "Start workout" opens the first exercise straight away; "View workout" just shows it.
    if (/^Start workout/.test(startBtn.textContent.trim())) {
      try { sessionStorage.setItem('lift-autostart', '1'); } catch { /* private mode */ }
    }
    navigate('workout');
  };
  const dailyBtn = app.querySelector('#daily-open');
  if (dailyBtn) dailyBtn.onclick = async () => {
    if (dailyBtn.dataset.start) { try { sessionStorage.setItem('lift-autostart', '1'); } catch { /* private mode */ } }
    if ((await pref('daily_skip')) === today()) await pref('daily_skip', null);   // "Do it anyway"
    navigate('daily');
  };
  const dailySkip = app.querySelector('#daily-skip');
  if (dailySkip) dailySkip.onclick = async () => {
    // Skipping keeps today's day for tomorrow (the rotation doesn't move) and ends the streak.
    await pref('daily_skip', today());
    renderHome(app);
  };
  const schedBtn = app.querySelector('[data-action="schedule"]');
  if (schedBtn) schedBtn.onclick = async () => {
    await openScheduleEditor();
    renderHome(app);
  };
  const logW = app.querySelector('[data-action="log-weight"]');
  if (logW) logW.onclick = () => navigate('body');
  app.querySelector('[data-action="edit-profile"]').onclick = () => showOnboarding(app);

  app.querySelector('[data-action="calendar"]').onclick = () => openCalendarExport();
  app.querySelector('[data-action="export-data"]').onclick = async () => {
    const data = await exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fit-tracker-backup-${localDateStr()}.json`;
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
        const lv = await import('../lib/local_videos.js');
        if (lv.isLocalVideosFile(data)) {   // PJF demo videos + notes, kept on this device only
          const n = await lv.importLocalVideos(data);
          const label = data.source === 'pjf' ? 'PJF' : data.source === 'trainheroic' ? 'TrainHeroic' : data.source;
          const progs = (data.programs || []).length;
          toast(`${n} ${label} videos${progs ? ` and ${progs} program${progs > 1 ? 's' : ''}` : ''} added on this device`);
          // Private programs and exercises join the catalog at load: reload to pick them up.
          if (progs || Object.values(data.videos).some(o => o.tags)) setTimeout(() => location.reload(), 1200);
          return;
        }
        if (!data.sessions && !data.meals && !data.prefs) throw new Error('Invalid backup file');
        if (!confirm('This will replace all current data with the backup. Continue?')) return;
        await importAllData(data);
        const { touchLocalBackup } = await import('../lib/backup.js');
        touchLocalBackup();
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
  // The plan badge only makes sense when today's workout is that plan's program.
  if (activePlan && activePlan.program_id === today_w.program?.id) {
    const { week } = planProgress(activePlan);
    return `<span class="pill accent">Week ${week} of ${activePlan.total_weeks}</span>`;
  }
  if (today_w.type === 'program' && today_w.program) {
    const src = today_w.program.source || 'Custom';
    return `<span class="pill ${src.toLowerCase()}">${src}</span>`;
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

function isWorkoutDoneToday(today_w, sessions) {
  const done = (sessions || []).filter(s => s.done);
  if (!done.length) return false;
  if (today_w.type === 'program' && today_w.program) {
    if (today_w.doneToday) return true;
    const p = today_w.program;
    return done.some(s =>
      s.program_id === p.id &&
      s.week === today_w.week &&
      s.day === today_w.day &&
      (today_w.day_index == null || s.day_index === today_w.day_index)
    );
  }
  return false;
}

function renderMacroPct(p, c, f) {
  const pct = macroPercents(p, c, f);
  if (!pct) return '';
  return `<div class="muted" style="font-size:11px;margin-top:8px">Macro split: ${pct.p}% P · ${pct.c}% C · ${pct.f}% F</div>`;
}

function renderTodayBody(today_w, schedule, workoutDoneToday = false, hipFirst = false) {
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
    const day = today_w.day_index != null ? p.days?.[today_w.day_index]
      : p.weeks?.find(w => w.week_num === today_w.week)?.days?.find(d => d.day_num === today_w.day);
    const title = String(day?.day_name || day?.focus || `Week ${today_w.week}, Day ${today_w.day}`).split(' · ')[0];
    const moves = (day?.exercises || []).filter(e => !e.is_alternate && !isHeaderRow(e.name)).length;
    const line = [p.program_name || p.name || p.id, moves ? `${moves} moves` : '', hipFirst ? 'hip warm-up first' : ''].filter(Boolean).join(' · ');
    return `
      <div style="font-size:17px;font-weight:600;margin-top:6px">${escH(title)}${workoutDoneToday ? ' ✓' : ''}</div>
      <div class="muted" style="font-size:12px">${escH(line)}</div>
      <div class="btn-row" style="margin-top:10px;margin-bottom:0">
        <button class="btn" data-action="start-workout" style="flex:2">${workoutDoneToday ? 'View workout' : 'Start workout'}</button>
        <button class="btn ghost" data-action="schedule" style="flex:1">Edit week</button>
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

function renderCoachMessage({ eaten, target, cardio_burned, macroT, today_w, bodyToday, activePlan, workoutDoneToday }) {
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
  // The workout card already says what today's workout is; tips only add what it doesn't.
  if (today_w.type === 'tag' && today_w.tag === 'Rest') msgs.push('Rest day. Let the muscles recover.');

  // Body weight nudge
  if (!bodyToday && hour >= 7) {
    msgs.push(`Haven't logged weight yet today.`);
  }

  if (!msgs.length) return '';

  return `<div class="card" style="padding:10px 14px;margin-bottom:12px">
    <div class="muted" style="font-size:12px;line-height:1.6">
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

/** Customize Home: move cards up and down, show or hide each. Saved as pref 'home_layout'. */
async function openHomeLayout(onDone) {
  let { order, hidden } = resolveLayout(await pref('home_layout'));
  const label = Object.fromEntries(HOME_CARDS.map(c => [c.id, c.label]));
  const save = () => pref('home_layout', layoutToSave(order, hidden));
  openSheet((sheet, close, hooks) => {
    hooks.onClose = onDone;   // Done, the backdrop or the back button: redraw Home in the new order
    const draw = () => {
      sheet.innerHTML = `
        <h2>Customize Home</h2>
        <div class="muted" style="margin-bottom:10px">Order the cards with ↑ ↓; tap Show / Hide to choose what's on Today.</div>
        ${order.map((id, i) => `
          <div class="list-item" style="cursor:default;gap:8px;${hidden.has(id) ? 'opacity:0.5' : ''}">
            <div style="flex:1"><div class="list-item-title">${label[id]}</div></div>
            <button class="pill" data-up="${id}" ${i === 0 ? 'disabled' : ''} style="cursor:pointer;padding:6px 10px" aria-label="Move up">↑</button>
            <button class="pill" data-down="${id}" ${i === order.length - 1 ? 'disabled' : ''} style="cursor:pointer;padding:6px 10px" aria-label="Move down">↓</button>
            <button class="pill ${hidden.has(id) ? '' : 'accent'}" data-vis="${id}" style="cursor:pointer;padding:6px 10px;min-width:58px">${hidden.has(id) ? 'Hidden' : 'Shown'}</button>
          </div>`).join('')}
        <div class="btn-row" style="margin-top:12px">
          <button class="btn" id="hl-done">Done</button>
          <button class="btn ghost" id="hl-reset">Reset to default</button>
        </div>`;
      sheet.querySelectorAll('[data-up]').forEach(b => b.onclick = async () => { order = moveCard(order, b.dataset.up, -1); await save(); draw(); });
      sheet.querySelectorAll('[data-down]').forEach(b => b.onclick = async () => { order = moveCard(order, b.dataset.down, 1); await save(); draw(); });
      sheet.querySelectorAll('[data-vis]').forEach(b => b.onclick = async () => {
        const id = b.dataset.vis; if (hidden.has(id)) hidden.delete(id); else hidden.add(id);
        await save(); draw();
      });
      sheet.querySelector('#hl-done').onclick = () => close();
      sheet.querySelector('#hl-reset').onclick = async () => { await pref('home_layout', null); ({ order, hidden } = resolveLayout(null)); draw(); };
    };
    draw();
  });
}

async function openProgramPicker() {
  const { programs } = await loadCatalogs();
  openSheet((sheet, close) => {
    sheet.innerHTML = `
      <h2>Choose a program</h2>
      <div class="muted" style="margin-bottom:12px">Tap ▶ on any exercise during a workout for its demo video.</div>
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
          if (!(await selectSingleProgram(p.id))) return;
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
    return `Progression · ${p.weeks.length} weeks, ${totalDays} workouts in order`;
  }
  if (p.days) return `Rotation · ${p.days.length} workouts that repeat`;
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
      <label>Height (in, optional — for BMI on Body tab)</label>
      <input type="number" id="height" value="${existing.height_in || ''}" inputmode="decimal" step="0.25" placeholder="e.g. 70">
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
    const heightVal = +app.querySelector('#height').value;
    const profileData = {
      ...(existing || {}),
      weight_lb: +app.querySelector('#weight').value,
      bf_pct: +app.querySelector('#bf').value,
      ...(heightVal ? { height_in: heightVal } : {}),
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


/**
 * Reminders through the phone's calendar (src/lib/calendar.js): weekly events for the training
 * days, with an alert before each. Days start from the weekly schedule, else the days the logs
 * show you train, else Mon/Wed/Fri; length from how long workouts really take.
 */
async function openCalendarExport() {
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const [schedule, sessions, programs, saved, activeId] = await Promise.all([pref('schedule'), getAll('sessions'), getAllPrograms(), pref('calendar_export'), pref('active_program')]);
  const active = programs.find(p => p.id === activeId);
  const fallbackTitle = active ? `Workout · ${programName(active)}` : 'Workout';
  const prof = learnProfile(sessions, { today: localDateStr() });
  const titles = {};
  (schedule?.slots || []).forEach((sl, i) => {
    if (!sl) return;
    const prog = sl.program_id && programs.find(p => p.id === sl.program_id);
    titles[i] = sl.label || (prog ? `Workout · ${programName(prog)}` : 'Workout');
  });
  let days = saved?.days || (Object.keys(titles).length ? Object.keys(titles).map(Number)
    : prof.days.per_week ? prof.days.trained.map((n, i) => [n, i]).filter(([n]) => n > 0).sort((a, b) => b[0] - a[0]).slice(0, Math.round(prof.days.per_week)).map(([, i]) => i)
    : [1, 3, 5]);
  let time = saved?.time || '18:00';
  let minutes = saved?.minutes || prof.duration?.median_min || 60;
  let alarm = saved?.alarm ?? 30;
  openSheet((sheet, close) => {
    const paint = () => {
      sheet.innerHTML = `<h2>Add workouts to your calendar</h2>
        <div class="muted" style="margin-bottom:10px">Weekly events with an alert before each, for the next 12 weeks. Your calendar does the reminding.</div>
        <div class="group-label">Days</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${DOW.map((d, i) => `<button class="pill ${days.includes(i) ? 'accent' : ''}" data-dow="${i}" style="cursor:pointer;padding:7px 11px">${d}</button>`).join('')}</div>
        <div class="group-label">Time</div><input type="time" id="cal-time" value="${time}">
        <div class="group-label">Length (min)</div><input type="number" id="cal-min" inputmode="numeric" value="${minutes}" min="10" max="180">
        <div class="group-label">Alert</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${[[0, 'None'], [15, '15 min before'], [30, '30 min'], [60, '1 hour']].map(([v, l]) => `<button class="pill ${alarm === v ? 'accent' : ''}" data-alarm="${v}" style="cursor:pointer;padding:7px 11px">${l}</button>`).join('')}</div>
        <button class="btn" id="cal-go" style="margin-top:16px" ${days.length ? '' : 'disabled'}>Add ${days.length} weekly event${days.length === 1 ? '' : 's'}</button>
        <button class="btn ghost" id="cal-cancel" style="margin-top:8px">Cancel</button>`;
      sheet.querySelectorAll('[data-dow]').forEach(b => b.onclick = () => { const d = +b.dataset.dow; days = days.includes(d) ? days.filter(x => x !== d) : [...days, d].sort(); paint(); });
      sheet.querySelectorAll('[data-alarm]').forEach(b => b.onclick = () => { alarm = +b.dataset.alarm; paint(); });
      sheet.querySelector('#cal-time').onchange = (e) => { time = e.target.value || time; };
      sheet.querySelector('#cal-min').onchange = (e) => { minutes = Math.max(10, Math.min(180, +e.target.value || 60)); };
      sheet.querySelector('#cal-cancel').onclick = close;
      sheet.querySelector('#cal-go').onclick = async () => {
        await pref('calendar_export', { days, time, minutes, alarm });
        const ics = buildIcs({ days: days.map(d => ({ dow: d, title: titles[d] || fallbackTitle, notes: 'Open Fit Tracker to start.' })), time, minutes, alarm });
        const file = new File([ics], 'workouts.ics', { type: 'text/calendar' });
        try {
          if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Workouts' });
          else {
            const url = URL.createObjectURL(file);
            const a = document.createElement('a'); a.href = url; a.download = 'workouts.ics'; a.click();
            setTimeout(() => URL.revokeObjectURL(url), 5000);
          }
          close();
          toast('Open it to add to your calendar', 2600);
        } catch (err) { if (err?.name !== 'AbortError') toast('Could not create the calendar file'); }
      };
    };
    paint();
  });
}
