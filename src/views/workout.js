/**
 * Workout view: today's session — exercises, sets logging, RPE, video links.
 */
import { pref, put, getByIndex, getAll } from '../db.js';
import { rpeE1RM } from '../lib/e1rm.js';
import { toast, openSheet, navigate } from '../app.js';
import { todaysWorkout, advanceCursor } from './schedule.js';
import { loadCatalogs } from '../lib/static_data.js';

const today = () => new Date().toISOString().slice(0, 10);
let _restInterval = null;

export async function renderWorkout(app) {
  if (_restInterval) { clearInterval(_restInterval); _restInterval = null; }
  const today_w = await todaysWorkout();
  if (today_w.type === 'unset') {
    app.innerHTML = `
      <div class="empty">
        <div class="icon">🏋️</div>
        <div>No program for today</div>
        <button class="btn" id="back" style="margin-top:14px;max-width:240px">Set up schedule</button>
      </div>`;
    app.querySelector('#back').onclick = () => navigate('home');
    return;
  }
  if (today_w.type === 'completed') {
    const name = today_w.program?.name || today_w.program?.program_name || 'Program';
    app.innerHTML = `
      <div class="empty">
        <div class="icon">🏆</div>
        <div>${name} — complete!</div>
        <div class="muted" style="margin-top:6px;font-size:14px">Head back to Today to start over or choose a new program.</div>
        <button class="btn ghost" id="back" style="margin-top:14px;max-width:240px">Back to today</button>
      </div>`;
    app.querySelector('#back').onclick = () => navigate('home');
    return;
  }
  if (today_w.type === 'tag') {
    return renderTagDay(app, today_w);
  }

  const program = today_w.program;
  const programId = program.id;
  const week = today_w.week;
  const day = today_w.day;
  const day_index = today_w.day_index;

  // Fetch the day's exercises
  const dayData = pickDay(program, week, day, day_index);
  if (!dayData) {
    app.innerHTML = `<div class="empty">No workout found for Wk ${week}, Day ${day}</div>`;
    return;
  }

  // Fetch or create today's session
  const todaysSessions = await getByIndex('sessions', 'date', today());
  let session = todaysSessions.find(s => s.program_id === programId && s.week === week && s.day === day && s.day_index === day_index);
  if (!session) {
    const allSwaps = (await pref('swaps')) || {};
    const dayKey = _sessionDayKey({ day_index, week, day });
    const rawExercises = dayData.exercises.filter(e => !e.is_alternate).map(ex => ({
      name: ex.name,
      target_reps: ex.reps || ex.set_targets?.[0] || '',
      target_sets: ex.sets || ex.set_targets?.length || 3,
      time: ex.time,
      rest: ex.rest,
      round_group: ex.round_group || ex.group || ex.superset || null,
      notes: ex.notes,
      sets: [],
    }));
    session = {
      date: today(),
      program_id: programId,
      week, day, day_index,
      focus: dayData.focus || dayData.day_name,
      exercises: dayKey ? _applySwaps(rawExercises, programId, dayKey, allSwaps) : rawExercises,
      done: false,
    };
    session.id = await put('sessions', session);
  }

  // Look up video URLs for each exercise
  const { exercises: allExercises, exerciseByName, warmups } = await loadCatalogs();
  const exMap = {};
  for (const [k, v] of exerciseByName) exMap[k] = v;

  const warmup = _pickWarmup(dayData.focus || dayData.day_name, warmups);

  // Build last-session reference weights + all-time best e1RM per exercise
  const { ref: prevRef, bestE1RM: allTimeBestE1RM } = await buildPrevReference(programId, session.id, today());

  app.innerHTML = `
    <h1>${dayData.focus || dayData.day_name}</h1>
    <div class="muted">${program.name || program.program_name || program.id} · Wk ${week}, Day ${day}</div>
    <div class="btn-row" style="margin:10px 0">
      <button class="btn ghost" data-action="prev">← Day</button>
      <button class="btn ghost" data-action="next">Day →</button>
    </div>
    ${warmup ? _warmupBlockHtml(warmup, exMap) : ''}
    <div id="exercises"></div>
    <div class="btn-row" style="margin-top:14px">
      <button class="btn secondary" id="add-ex">+ Add exercise</button>
      <button class="btn" id="finish">Finish workout</button>
    </div>
  `;

  // Warmup block toggle
  const $warmupToggle = app.querySelector('.warmup-toggle');
  if ($warmupToggle) {
    $warmupToggle.onclick = () => {
      const $body = app.querySelector('.warmup-body');
      const $chevron = app.querySelector('.warmup-chevron');
      const open = $body.style.display === 'none';
      $body.style.display = open ? '' : 'none';
      $chevron.textContent = open ? '▲' : '▼';
    };
  }

  const $ex = app.querySelector('#exercises');
  let lastGroup = null;
  session.exercises.forEach((ex, i) => {
    const grp = ex.round_group;
    if (grp && grp !== lastGroup) {
      $ex.insertAdjacentHTML('beforeend', `<div class="group-label">${prettyGroup(grp)}</div>`);
      lastGroup = grp;
    } else if (!grp && lastGroup) {
      lastGroup = null;
    }
    const node = exerciseCard(ex, i, exMap, prevRef, allTimeBestE1RM);
    $ex.appendChild(node);
  });

  app.querySelector('[data-action="prev"]').onclick = () => changeDay(-1);
  app.querySelector('[data-action="next"]').onclick = () => changeDay(+1);
  app.querySelector('#add-ex').onclick = async () => {
    const picked = await pickExerciseFromLibrary(allExercises);
    if (!picked) return;
    session.exercises.push({
      name: picked.name,
      target_reps: '8-12',
      target_sets: 3,
      sets: [],
      added: true,
    });
    await put('sessions', session);
    renderWorkout(app);
  };
  app.querySelector('#finish').onclick = async () => {
    session.done = true;
    await put('sessions', session);
    if (today_w.mode === 'follow') await advanceCursor(programId, 'follow');
    const allSessions = await getAll('sessions');
    const stats = computeSessionStats(session, allSessions);
    renderWorkoutComplete(app, session, stats, program, week, day);
  };

  // Wire up set logging
  $ex.addEventListener('input', async e => {
    if (!e.target.matches('input.set-input')) return;
    const card = e.target.closest('.exercise');
    const i = +card.dataset.i;
    const setIdx = +e.target.dataset.set;
    const field = e.target.dataset.field;
    if (!session.exercises[i].sets[setIdx]) session.exercises[i].sets[setIdx] = {};
    session.exercises[i].sets[setIdx][field] = +e.target.value || null;
    await put('sessions', session);
  });
  $ex.addEventListener('click', async e => {
    // Compact re-expansion: tap anywhere on a compact card except action buttons
    const compactCard = e.target.closest('.exercise--compact');
    if (compactCard && !e.target.matches('.check, .inc-btn, .rpe-btn, .ex-menu')) {
      compactCard.classList.remove('exercise--compact');
      const $sum = compactCard.querySelector('.exercise-summary');
      if ($sum) $sum.style.display = 'none';
      return;
    }

    if (e.target.matches('.inc-btn')) {
      const card = e.target.closest('.exercise');
      const i = +card.dataset.i;
      const setIdx = +e.target.dataset.set;
      const wInput = e.target.closest('.set-row').querySelector('[data-field="weight"]');
      const newVal = Math.round(((+wInput.value || 0) + 5) * 10) / 10;
      wInput.value = newVal;
      if (!session.exercises[i].sets[setIdx]) session.exercises[i].sets[setIdx] = {};
      session.exercises[i].sets[setIdx].weight = newVal;
      await put('sessions', session);
    }

    if (e.target.matches('.check')) {
      const card = e.target.closest('.exercise');
      const i = +card.dataset.i;
      const setIdx = +e.target.dataset.set;
      const set = session.exercises[i].sets[setIdx] = session.exercises[i].sets[setIdx] || {};

      // Reconcile pre-filled inputs that were never explicitly typed (input event never fired)
      if (!set.done) {
        const row = e.target.closest('.set-row');
        if (!set.weight) { const v = +row.querySelector('[data-field="weight"]')?.value; if (v) set.weight = v; }
        if (!set.reps)   { const v = +row.querySelector('[data-field="reps"]')?.value;   if (v) set.reps   = v; }
      }

      set.done = !set.done;
      await put('sessions', session);
      e.target.closest('.set-row').classList.toggle('done', !!set.done);

      // Update e1RM display inline — no re-render needed
      const ex = session.exercises[i];
      const doneSets = (ex.sets || []).filter(s => s?.done && s.weight && s.reps);
      const $e1rm = card.querySelector('.e1rm-line');
      if ($e1rm) {
        if (doneSets.length) {
          const bestE = Math.max(...doneSets.map(s => rpeE1RM(s.weight, s.reps, s.rpe)));
          if (bestE > 0) {
            const isPR = bestE > (allTimeBestE1RM[ex.name] ?? 0);
            $e1rm.innerHTML = isPR
              ? `<span style="color:var(--accent)">~${bestE} lb e1RM ★ PR</span>`
              : `<span style="color:var(--fg-dim)">~${bestE} lb e1RM</span>`;
          } else { $e1rm.innerHTML = ''; }
        } else { $e1rm.innerHTML = ''; }
      }

      if (set.done) {
        startRestTimer(card);
        applyCompactState(card, ex);
      } else {
        // Un-check: clear timer on this card and remove compact if present
        if (_restInterval) { clearInterval(_restInterval); _restInterval = null; }
        const $rt = card.querySelector('.rest-timer-line');
        if ($rt) $rt.textContent = '';
        card.classList.remove('exercise--compact');
        const $sum = card.querySelector('.exercise-summary');
        if ($sum) $sum.style.display = 'none';
      }
    }

    if (e.target.matches('.rpe-btn')) {
      const card = e.target.closest('.exercise');
      const i = +card.dataset.i;
      const setIdx = +e.target.dataset.set;
      openRPEPicker(card, setIdx, session, i);
    }
    if (e.target.matches('.ex-menu')) {
      const card = e.target.closest('.exercise');
      const i = +card.dataset.i;
      openExerciseMenu(session, i, allExercises, exMap);
    }
  });
}

function _pickWarmup(focus, warmups) {
  const f = (focus || '').toLowerCase();
  if (f.includes('full')) {
    const upper = Object.values(warmups).find(w => w.day_types.includes('upper'));
    const lower = Object.values(warmups).find(w => w.day_types.includes('lower'));
    if (upper && lower) return {
      name: 'Full Body Warm-Up',
      exercises: [...upper.exercises, ...lower.exercises],
      note: upper.note,
    };
  }
  for (const w of Object.values(warmups)) {
    if (w.day_types.includes('any')) continue;
    if (w.day_types.some(t => f.includes(t))) return w;
  }
  return null;
}

function _warmupBlockHtml(warmup, exMap) {
  const rows = warmup.exercises.map(ex => {
    const lookup = exMap[ex.name.toLowerCase()];
    const videoHtml = lookup?.video_url
      ? `<a class="video-link has-video" href="${lookup.video_url}" target="_blank" style="font-size:11px;padding:4px 8px;flex-shrink:0">▶</a>`
      : `<a class="video-link" href="https://www.youtube.com/results?search_query=${encodeURIComponent(ex.name)}" target="_blank" style="font-size:11px;padding:4px 8px;flex-shrink:0">🔍</a>`;
    const setsStr = ex.sets ? `${ex.sets}×` : '';
    const target = ex.reps || ex.time || '';
    return `
      <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:500">${ex.name}</div>
          ${ex.notes ? `<div class="muted" style="font-size:12px;margin-top:2px">${ex.notes}</div>` : ''}
        </div>
        <div style="font-size:12px;color:var(--fg-dim);white-space:nowrap">${setsStr}${target}</div>
        ${videoHtml}
      </div>`;
  }).join('');
  return `
    <div class="card" style="margin-bottom:12px;padding:12px 14px">
      <div class="warmup-toggle" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:8px">
        <span style="font-weight:600;font-size:14px">🔥 ${warmup.name}</span>
        <span style="font-size:12px;color:var(--fg-dim)">${warmup.exercises.length} exercises <span class="warmup-chevron">▼</span></span>
      </div>
      <div class="warmup-body" style="display:none">
        <div style="margin-top:10px">
          ${rows}
        </div>
        ${warmup.note ? `<div class="muted" style="font-size:12px;margin-top:8px">${warmup.note}</div>` : ''}
      </div>
    </div>`;
}

async function pickExerciseFromLibrary(allExercises, { filterMuscle = null, title = 'Pick exercise' } = {}) {
  return new Promise(resolve => {
    openSheet((sheet, close) => {
      const muscleLabel = filterMuscle ? filterMuscle.replace(/_/g, ' ') : null;
      sheet.innerHTML = `
        <h2>${title}</h2>
        ${muscleLabel ? `<div class="muted" style="margin-bottom:8px">Showing ${muscleLabel} exercises first</div>` : ''}
        <div class="search-bar"><input type="text" id="ex-search" placeholder="Search exercises…" autocomplete="off"></div>
        <div id="ex-list"></div>
      `;
      const $list = sheet.querySelector('#ex-list');
      const $search = sheet.querySelector('#ex-search');
      const sorted = [...allExercises].sort((a, b) => {
        // When filtering by muscle, put matching primary muscle first
        if (filterMuscle) {
          const aMatch = a.primary_muscle === filterMuscle ? 0 : (a.muscles || []).includes(filterMuscle) ? 1 : 2;
          const bMatch = b.primary_muscle === filterMuscle ? 0 : (b.muscles || []).includes(filterMuscle) ? 1 : 2;
          if (aMatch !== bMatch) return aMatch - bMatch;
        }
        return a.name.localeCompare(b.name);
      });
      function render() {
        const q = $search.value.trim().toLowerCase();
        const filtered = (q ? sorted.filter(e =>
          e.name.toLowerCase().includes(q) ||
          (e.aliases || []).some(a => a.toLowerCase().includes(q)) ||
          (e.primary_muscle || '').includes(q)
        ) : sorted).slice(0, 80);
        $list.innerHTML = filtered.map(e => {
          const isMatch = filterMuscle && e.primary_muscle === filterMuscle;
          const muscle = e.primary_muscle ? e.primary_muscle.replace(/_/g, ' ') : null;
          return `
            <div class="list-item" data-name="${e.name.replace(/"/g, '&quot;')}">
              <div style="flex:1">
                <div class="list-item-title">${e.name}</div>
                <div class="list-item-meta">${muscle ? muscle + ' · ' : ''}${(e.sources || []).join(', ')}${e.video_url ? ' · ▶' : ''}</div>
              </div>
              ${isMatch ? '<span class="pill accent" style="font-size:10px">same</span>' : ''}
            </div>
          `;
        }).join('');
        $list.querySelectorAll('.list-item').forEach(item => {
          item.onclick = () => {
            const ex = sorted.find(x => x.name === item.dataset.name);
            close();
            resolve(ex);
          };
        });
      }
      $search.oninput = render;
      render();
      setTimeout(() => $search.focus(), 100);
      sheet.parentElement.addEventListener('click', e => {
        if (e.target === sheet.parentElement) { close(); resolve(null); }
      });
    });
  });
}

function _sessionDayKey(session) {
  if (session.day_index != null) return `di${session.day_index}`;
  if (session.week != null && session.day != null) return `wk${session.week}_d${session.day}`;
  return null;
}

function _applySwaps(exercises, programId, dayKey, allSwaps) {
  const daySwaps = allSwaps?.[programId]?.[dayKey] || {};
  if (!Object.keys(daySwaps).length) return exercises;
  return exercises.map(ex => {
    const newName = daySwaps[ex.name];
    return newName ? { ...ex, name: newName, swapped: true } : ex;
  });
}

async function _saveSwap(programId, dayKey, originalName, newName) {
  const swaps = (await pref('swaps')) || {};
  if (!swaps[programId]) swaps[programId] = {};
  if (!swaps[programId][dayKey]) swaps[programId][dayKey] = {};
  swaps[programId][dayKey][originalName] = newName;
  await pref('swaps', swaps);
}

function _offerPermanentSwap(originalName, newName, session) {
  const dayKey = _sessionDayKey(session);
  if (!session.program_id || !dayKey) {
    renderWorkout(document.getElementById('app'));
    return;
  }
  openSheet((s, closeOffer) => {
    s.innerHTML = `
      <div style="margin-bottom:16px">
        <div style="font-weight:600;font-size:15px">Save this swap?</div>
        <div class="muted" style="margin-top:6px;font-size:13px">Use <b>${newName}</b> instead of <b>${originalName}</b> every time on this day?</div>
      </div>
      <div class="btn-row">
        <button class="btn" id="swap-yes">Save for this day</button>
        <button class="btn ghost" id="swap-no">Just today</button>
      </div>
    `;
    s.querySelector('#swap-yes').onclick = async () => {
      await _saveSwap(session.program_id, dayKey, originalName, newName);
      closeOffer();
      toast('Swap saved');
      renderWorkout(document.getElementById('app'));
    };
    s.querySelector('#swap-no').onclick = () => {
      closeOffer();
      renderWorkout(document.getElementById('app'));
    };
  });
}

function openExerciseMenu(session, i, allExercises, exMap) {
  const ex = session.exercises[i];
  const lookup = exMap[ex.name.toLowerCase()];
  const primaryMuscle = lookup?.primary_muscle || null;
  const muscleLabel = primaryMuscle ? primaryMuscle.replace(/_/g, ' ') : null;
  const bwsAlts = lookup?.bws_alternates || [];
  openSheet((sheet, close) => {
    sheet.innerHTML = `
      <h2>${ex.name}</h2>
      <div class="muted" style="margin-bottom:14px">${formatTarget(ex)}${muscleLabel ? ` · ${muscleLabel}` : ''}</div>

      ${bwsAlts.length ? `<button class="btn" id="bws-alts" style="margin-bottom:8px">Swap — BWS alternates (${bwsAlts.length})</button>` : ''}
      ${muscleLabel ? `<button class="btn ${bwsAlts.length ? 'secondary' : ''}" id="similar" style="margin-bottom:8px">Similar exercises (${muscleLabel})</button>` : ''}
      <button class="btn secondary" id="swap" style="margin-bottom:8px">🔄 Any exercise</button>
      <button class="btn secondary" id="add-set" style="margin-bottom:8px">+ Add a set</button>
      <button class="btn secondary" id="rm-set" style="margin-bottom:8px">− Remove last set</button>
      <button class="btn ghost" id="progression" style="margin-bottom:8px">📈 Progression chart</button>
      <button class="btn ghost" id="edit-target" style="margin-bottom:8px">Edit target reps/sets</button>
      <button class="btn danger" id="remove" style="margin-top:6px">🗑 Remove exercise</button>
    `;

    sheet.querySelector('#progression').onclick = () => {
      close();
      openProgressionChart(ex.name);
    };

    sheet.querySelector('#bws-alts')?.addEventListener('click', () => {
      close();
      openSheet((s2, close2) => {
        s2.innerHTML = `
          <h2>BWS alternates</h2>
          <div class="muted" style="margin-bottom:12px">Official alternates for ${ex.name}</div>
          ${bwsAlts.map(name => {
            const alt = exMap[name.toLowerCase()];
            const muscle = alt?.primary_muscle?.replace(/_/g, ' ') || '';
            return `<div class="list-item" data-name="${name.replace(/"/g, '&quot;')}">
              <div style="flex:1">
                <div class="list-item-title">${name}</div>
                <div class="list-item-meta">${muscle}${alt?.video_url ? ' · ▶' : ''}</div>
              </div>
            </div>`;
          }).join('')}
        `;
        s2.querySelectorAll('.list-item').forEach(item => {
          item.onclick = async () => {
            const originalName = ex.name;
            ex.name = item.dataset.name;
            ex.swapped = true;
            await put('sessions', session);
            close2();
            _offerPermanentSwap(originalName, ex.name, session);
          };
        });
      });
    });

    sheet.querySelector('#similar')?.addEventListener('click', async () => {
      close();
      const picked = await pickExerciseFromLibrary(allExercises, { filterMuscle: primaryMuscle, title: `${muscleLabel} exercises` });
      if (!picked) return;
      const originalName = ex.name;
      ex.name = picked.name;
      ex.swapped = true;
      await put('sessions', session);
      _offerPermanentSwap(originalName, ex.name, session);
    });

    sheet.querySelector('#swap').onclick = async () => {
      close();
      const picked = await pickExerciseFromLibrary(allExercises);
      if (!picked) return;
      const originalName = ex.name;
      ex.name = picked.name;
      ex.swapped = true;
      await put('sessions', session);
      _offerPermanentSwap(originalName, ex.name, session);
    };

    sheet.querySelector('#add-set').onclick = async () => {
      ex.target_sets = (parseInt(ex.target_sets) || ex.sets.length) + 1;
      await put('sessions', session);
      close();
      renderWorkout(document.getElementById('app'));
    };

    sheet.querySelector('#rm-set').onclick = async () => {
      if (parseInt(ex.target_sets) > 1) {
        ex.target_sets = parseInt(ex.target_sets) - 1;
        if (ex.sets.length > ex.target_sets) ex.sets.length = ex.target_sets;
      }
      await put('sessions', session);
      close();
      renderWorkout(document.getElementById('app'));
    };

    sheet.querySelector('#edit-target').onclick = () => {
      openSheet((s2, close2) => {
        s2.innerHTML = `
          <h2>Edit target</h2>
          <label>Reps / rep range</label>
          <input type="text" id="t-reps" value="${ex.target_reps || ''}" placeholder="e.g. 8-12">
          <label>Sets</label>
          <input type="number" id="t-sets" inputmode="numeric" value="${parseInt(ex.target_sets) || 3}" min="1">
          <div class="btn-row" style="margin-top:14px">
            <button class="btn" id="t-save">Save</button>
            <button class="btn ghost" id="t-cancel">Cancel</button>
          </div>
        `;
        s2.querySelector('#t-cancel').onclick = close2;
        s2.querySelector('#t-save').onclick = async () => {
          const newReps = s2.querySelector('#t-reps').value.trim();
          const newSets = parseInt(s2.querySelector('#t-sets').value);
          if (newReps) ex.target_reps = newReps;
          if (newSets > 0) ex.target_sets = newSets;
          await put('sessions', session);
          close2();
          close();
          renderWorkout(document.getElementById('app'));
        };
        setTimeout(() => s2.querySelector('#t-reps').focus(), 100);
      });
    };

    sheet.querySelector('#remove').onclick = () => {
      openSheet((s2, close2) => {
        s2.innerHTML = `
          <h2>Remove exercise?</h2>
          <div class="muted" style="margin-bottom:14px">${ex.name} and all its logged sets will be removed from this session.</div>
          <div class="btn-row">
            <button class="btn danger" id="confirm-rm">Remove</button>
            <button class="btn ghost" id="cancel-rm">Cancel</button>
          </div>
        `;
        s2.querySelector('#cancel-rm').onclick = close2;
        s2.querySelector('#confirm-rm').onclick = async () => {
          session.exercises.splice(i, 1);
          await put('sessions', session);
          close2();
          close();
          renderWorkout(document.getElementById('app'));
        };
      });
    };
  });
}

function weekKey(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const thu = new Date(d);
  thu.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 3);
  const jan4 = new Date(thu.getFullYear(), 0, 4);
  const wn = 1 + Math.round((thu - jan4) / 604800000);
  return `${thu.getFullYear()}-W${String(wn).padStart(2, '0')}`;
}

function weekLabel(wk) {
  const [yr, wp] = wk.split('-W');
  return `Wk ${parseInt(wp)}, ${yr}`;
}

function progressionSparkline(points) {
  if (points.length < 2) return '';
  const w = 320, h = 72, pad = 6;
  const vals = points.map(p => p.e1rm);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const xs = (i) => pad + (i / (points.length - 1)) * (w - pad * 2);
  const ys = (v) => h - pad - ((v - min) / range) * (h - pad * 2);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xs(i).toFixed(1)} ${ys(p.e1rm).toFixed(1)}`).join(' ');
  const dots = points.map((p, i) => `<circle cx="${xs(i).toFixed(1)}" cy="${ys(p.e1rm).toFixed(1)}" r="3" fill="#4ade80"/>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;margin-top:4px">
    <path d="${path}" fill="none" stroke="#4ade80" stroke-width="2"/>
    ${dots}
  </svg>`;
}

async function openProgressionChart(exName) {
  const all = await getAll('sessions');
  const weekBests = {};
  for (const s of all) {
    if (!s.done || !s.date) continue;
    for (const ex of (s.exercises || [])) {
      if (ex.name !== exName) continue;
      for (const set of (ex.sets || [])) {
        if (!set?.weight || !set?.reps) continue;
        const e = rpeE1RM(set.weight, set.reps, set.rpe);
        if (e <= 0) continue;
        const wk = weekKey(s.date);
        if (e > (weekBests[wk] ?? 0)) weekBests[wk] = e;
      }
    }
  }
  const sortedKeys = Object.keys(weekBests).sort().slice(-16);

  openSheet((sheet, close) => {
    if (!sortedKeys.length) {
      sheet.innerHTML = `
        <h2>${exName}</h2>
        <div class="muted" style="margin-top:8px">No logged sets yet — check back after your first session.</div>
      `;
      return;
    }

    const points = sortedKeys.map(wk => ({ wk, e1rm: weekBests[wk] }));
    const allTime = Math.max(...points.map(p => p.e1rm));
    const latest = points[points.length - 1].e1rm;
    const change = latest - points[0].e1rm;

    sheet.innerHTML = `
      <h2>${exName}</h2>
      <div class="muted" style="margin-bottom:12px">e1RM · last ${points.length} week${points.length !== 1 ? 's' : ''}</div>

      <div class="card-row" style="margin-bottom:4px">
        <div>
          <div class="muted" style="font-size:11px">All-time best</div>
          <div style="font-size:22px;font-weight:700">${allTime} lb</div>
        </div>
        <div>
          <div class="muted" style="font-size:11px">Change</div>
          <div style="font-size:22px;font-weight:700;color:${change >= 0 ? 'var(--accent)' : 'var(--warn)'}">${change >= 0 ? '+' : ''}${change} lb</div>
        </div>
        <div>
          <div class="muted" style="font-size:11px">Latest</div>
          <div style="font-size:22px;font-weight:700">${latest} lb</div>
        </div>
      </div>

      ${progressionSparkline(points)}

      <div style="margin-top:16px">
        <div class="group-label" style="margin-bottom:6px">Weekly bests</div>
        ${points.slice().reverse().map(p => `
          <div class="list-item" style="cursor:default">
            <div style="flex:1;font-size:14px">${weekLabel(p.wk)}</div>
            <div style="font-size:14px;font-weight:600;color:${p.e1rm === allTime ? 'var(--accent)' : 'var(--fg)'}">${p.e1rm} lb${p.e1rm === allTime ? ' ★' : ''}</div>
          </div>
        `).join('')}
      </div>
    `;
  });
}

async function buildPrevReference(programId, currentSessionId, todayStr) {
  const all = await getAll('sessions');

  // All-time best e1RM per exercise across every completed session (all programs)
  const bestE1RM = {};
  for (const s of all) {
    if (!s.done || s.id === currentSessionId) continue;
    for (const ex of (s.exercises || [])) {
      for (const set of (ex.sets || [])) {
        if (!set?.weight || !set?.reps) continue;
        const e = rpeE1RM(set.weight, set.reps, set.rpe);
        if (e > (bestE1RM[ex.name] ?? 0)) bestE1RM[ex.name] = e;
      }
    }
  }

  // Most recent same-program sets per exercise (for the "Last: …" reference display)
  const past = all
    .filter(s => s.program_id === programId && s.id !== currentSessionId && s.date < todayStr && s.done)
    .sort((a, b) => b.date.localeCompare(a.date));

  const ref = {};
  for (const s of past) {
    for (const ex of (s.exercises || [])) {
      if (ref[ex.name]) continue;
      const doneSets = (ex.sets || []).filter(s => s && (s.weight || s.reps));
      if (doneSets.length) {
        ref[ex.name] = { sets: doneSets, date: s.date };
      }
    }
  }
  return { ref, bestE1RM };
}

function formatPrevSets(sets) {
  return sets
    .filter(s => s && (s.weight || s.reps))
    .map(s => [s.weight ? `${s.weight}lb` : null, s.reps ? `×${s.reps}` : null].filter(Boolean).join(''))
    .join('  ');
}

function startRestTimer(card) {
  if (_restInterval) { clearInterval(_restInterval); _restInterval = null; }
  document.querySelectorAll('.rest-timer-line').forEach(el => { el.textContent = ''; });
  const $el = card.querySelector('.rest-timer-line');
  if (!$el) return;
  const start = Date.now();
  _restInterval = setInterval(() => {
    const sec = Math.floor((Date.now() - start) / 1000);
    $el.textContent = `rest ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  }, 1000);
}

function applyCompactState(card, ex) {
  const targetSets = parseInt(ex.target_sets) || 3;
  const doneCount = (ex.sets || []).filter(s => s?.done).length;
  if (doneCount < targetSets) return;
  const $summary = card.querySelector('.exercise-summary');
  if ($summary) {
    const doneSets = (ex.sets || []).filter(s => s?.done && s.weight && s.reps);
    if (doneSets.length) {
      const best = doneSets.reduce((b, s) => {
        const e = rpeE1RM(s.weight, s.reps, s.rpe);
        return e > b.e1rm ? { set: s, e1rm: e } : b;
      }, { set: doneSets[0], e1rm: 0 });
      const e1rmPart = best.e1rm > 0 ? ` · ~${best.e1rm} lb` : '';
      $summary.textContent = `${doneCount} sets · ${best.set.weight} × ${best.set.reps}${e1rmPart}`;
    } else {
      $summary.textContent = `${doneCount} sets`;
    }
    $summary.style.display = 'block';
  }
  card.classList.add('exercise--compact');
}

function exerciseCard(ex, i, exMap, prevRef = {}, allTimeBestE1RM = {}) {
  const sets = Math.max(parseInt(ex.target_sets) || 3, ex.sets.length, 3);
  const lookup = exMap[ex.name.toLowerCase()];
  const videoLink = lookup?.video_url
    ? `<a class="video-link has-video" href="${lookup.video_url}" target="_blank">▶ Video</a>`
    : `<a class="video-link" href="${lookup?.fallback_search || `https://www.youtube.com/results?search_query=${encodeURIComponent(ex.name)}`}" target="_blank">🔍 Find</a>`;

  const prevSets = prevRef[ex.name]?.sets || [];
  let setRows = '';
  for (let s = 0; s < sets; s++) {
    const set = ex.sets[s] || {};
    const prev = prevSets[s] || {};
    const done = set.done ? 'done' : '';
    // Pre-fill from previous session when this set hasn't been logged yet
    const wVal = set.weight ?? prev.weight ?? '';
    const rVal = set.reps   ?? prev.reps   ?? '';
    const wPh  = wVal === '' ? 'lb'   : '';
    const rPh  = rVal === '' ? 'reps' : '';
    setRows += `
      <div class="set-row ${done}">
        <span class="set-num">${s+1}</span>
        <input class="set-input" type="number" inputmode="decimal" placeholder="${wPh}" data-set="${s}" data-field="weight" value="${wVal}">
        <button class="inc-btn" data-set="${s}">+5</button>
        <input class="set-input" type="number" inputmode="numeric" placeholder="${rPh}" data-set="${s}" data-field="reps" value="${rVal}">
        <button class="rpe-btn" data-set="${s}">${set.rpe ? '@' + set.rpe : 'RPE'}</button>
        <button class="check" data-set="${s}">${set.done ? '✓' : '○'}</button>
      </div>
    `;
  }

  // Pre-compute e1RM from any already-done sets (resumed session)
  const existingDone = (ex.sets || []).filter(s => s?.done && s.weight && s.reps);
  let initialE1RM = '';
  if (existingDone.length) {
    const bestE = Math.max(...existingDone.map(s => rpeE1RM(s.weight, s.reps, s.rpe)));
    if (bestE > 0) {
      const isPR = bestE > (allTimeBestE1RM[ex.name] ?? 0);
      initialE1RM = isPR
        ? `<span style="color:var(--accent)">~${bestE} lb e1RM ★ PR</span>`
        : `<span style="color:var(--fg-dim)">~${bestE} lb e1RM</span>`;
    }
  }

  const card = document.createElement('div');
  card.className = 'exercise';
  card.dataset.i = i;
  card.innerHTML = `
    <div class="exercise-header">
      <div style="flex:1">
        <div class="exercise-name">${ex.name}${ex.swapped ? ' <span class="pill" style="font-size:10px">swapped</span>' : ''}${ex.added ? ' <span class="pill accent" style="font-size:10px">added</span>' : ''}</div>
        <div class="exercise-target">${formatTarget(ex)}</div>
        ${prevRef[ex.name] ? `<div class="muted" style="font-size:11px;margin-top:2px">Last: ${formatPrevSets(prevRef[ex.name].sets)} <span style="opacity:0.6">(${prevRef[ex.name].date})</span></div>` : ''}
        <div class="e1rm-line" style="font-size:12px;margin-top:2px">${initialE1RM}</div>
        <div class="rest-timer-line" style="min-height:14px"></div>
        <div class="exercise-summary"></div>
      </div>
      <div style="display:flex;gap:6px">
        ${videoLink}
        <button class="ex-menu" style="background:var(--bg-input);border:1px solid var(--border);color:var(--fg);border-radius:8px;padding:6px 10px;font-size:14px">⋯</button>
      </div>
    </div>
    ${setRows}
    ${ex.notes ? `<div class="muted" style="margin-top:6px">${ex.notes}</div>` : ''}
  `;
  applyCompactState(card, ex);
  return card;
}

function formatTarget(ex) {
  const parts = [];
  if (ex.target_sets) parts.push(`${ex.target_sets} sets`);
  if (ex.target_reps) parts.push(`× ${ex.target_reps}`);
  if (ex.time) parts.push(ex.time);
  if (ex.rest) parts.push(`rest ${ex.rest}`);
  return parts.join(' · ');
}

function prettyGroup(g) {
  if (!g) return '';
  if (typeof g === 'string') {
    if (/^\d+\s*round/i.test(g.trim()) || /^-\s*\d+\s*round/i.test(g.trim())) return g.trim().replace(/^-\s*/, '');
    return g;
  }
  return String(g);
}

async function openRPEPicker(card, setIdx, session, i) {
  openSheet((sheet, close) => {
    sheet.innerHTML = `
      <h2>RPE</h2>
      <div class="muted" style="margin-bottom:10px">How hard was that set?</div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px">
        ${[6, 7, 7.5, 8, 8.5, 9, 9.5, 10].map(n => `<button class="btn ghost" data-rpe="${n}">@${n}</button>`).join('')}
      </div>
    `;
    sheet.querySelectorAll('button[data-rpe]').forEach(b => {
      b.onclick = async () => {
        const set = session.exercises[i].sets[setIdx] = session.exercises[i].sets[setIdx] || {};
        set.rpe = +b.dataset.rpe;
        await put('sessions', session);
        const btn = card.querySelector(`button.rpe-btn[data-set="${setIdx}"]`);
        if (btn) btn.textContent = `@${set.rpe}`;
        close();
      };
    });
  });
}

function pickDay(program, week, day, day_index) {
  if (program.weeks) {
    const w = program.weeks.find(x => x.week_num === week);
    if (!w) return null;
    return w.days.find(d => d.day_num === day) || w.days[Math.min(day - 1, w.days.length - 1)];
  }
  if (program.days) {
    if (day_index != null) return program.days[day_index] || program.days[0];
    return program.days[(day - 1) % program.days.length];
  }
  return null;
}

function renderTagDay(app, today_w) {
  const map = {
    'Rest':   { icon: '😴', txt: 'Rest day', sub: 'Recovery, stretching, walking — anything light is fine.' },
    'Cardio': { icon: '🏃', txt: 'Zone 2 cardio', sub: '30–45 min steady state. Untracked here.' },
    'Custom': { icon: '✏️', txt: 'Free-form session', sub: 'Add exercises and log as you go.' },
  };
  const m = map[today_w.tag] || { icon: '·', txt: today_w.tag, sub: '' };
  app.innerHTML = `
    <h1>${m.icon} ${m.txt}</h1>
    <div class="muted">${m.sub}</div>
    <div class="card" style="margin-top:14px">
      <div class="muted">No prescribed program for today. Use the schedule editor to assign one if you'd like to lift.</div>
      <button class="btn ghost" id="back" style="margin-top:10px">Back to today</button>
    </div>
  `;
  app.querySelector('#back').onclick = () => navigate('home');
}

function computeSessionStats(session, allSessions) {
  // All-time best e1RM per exercise from every other completed session
  const allTimeBest = {};
  for (const s of allSessions) {
    if (!s.done || s.id === session.id) continue;
    for (const ex of (s.exercises || [])) {
      for (const set of (ex.sets || [])) {
        if (!set?.weight || !set?.reps) continue;
        const e = rpeE1RM(set.weight, set.reps, set.rpe);
        if (e > (allTimeBest[ex.name] ?? 0)) allTimeBest[ex.name] = e;
      }
    }
  }

  let totalSets = 0, totalVolume = 0;
  const exerciseSummaries = [], prs = [];

  for (const ex of session.exercises) {
    const doneSets = (ex.sets || []).filter(s => s?.done && (s.weight || s.reps));
    if (!doneSets.length) continue;
    totalSets += doneSets.length;
    totalVolume += doneSets.reduce((sum, s) => sum + (s.weight || 0) * (s.reps || 0), 0);

    let bestSet = null, bestE1RM = 0;
    for (const set of doneSets) {
      const e = rpeE1RM(set.weight, set.reps, set.rpe);
      if (e > bestE1RM) { bestE1RM = e; bestSet = set; }
    }

    exerciseSummaries.push({ name: ex.name, bestSet, bestE1RM, setsCompleted: doneSets.length });

    const prev = allTimeBest[ex.name] ?? null;
    if (bestE1RM > 0 && (prev === null || bestE1RM > prev)) {
      prs.push({ name: ex.name, todayE1RM: bestE1RM, prevE1RM: prev });
    }
  }

  return { totalSets, totalVolume, exerciseSummaries, prs };
}

function renderWorkoutComplete(app, session, stats, program, week, day) {
  const programLabel = program.name || program.program_name || program.id;
  const weekDayLabel = (week && day) ? `Wk ${week}, Day ${day}` : '';
  const prNames = new Set(stats.prs.map(p => p.name));

  const prSection = stats.prs.length ? `
    <div style="margin-bottom:14px;padding:12px 14px;background:rgba(74,222,128,0.06);border:1px solid rgba(74,222,128,0.2);border-radius:12px">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--accent);font-weight:600;margin-bottom:8px">Personal records</div>
      ${stats.prs.map(pr => `
        <div style="font-size:14px;margin-top:4px;display:flex;justify-content:space-between;align-items:baseline">
          <span>${pr.name}</span>
          <span style="color:var(--accent);font-weight:600">${pr.todayE1RM} lb e1RM${pr.prevE1RM ? `<span style="color:var(--fg-dim);font-weight:400"> (was ${pr.prevE1RM})</span>` : ' <span style="color:var(--fg-dim);font-weight:400;font-size:12px">first time</span>'}</span>
        </div>
      `).join('')}
    </div>
  ` : '';

  const exRows = stats.exerciseSummaries.map(ex => {
    const isPR = prNames.has(ex.name);
    const setStr = ex.bestSet
      ? `${ex.bestSet.weight ?? '—'} × ${ex.bestSet.reps ?? '—'}`
      : `${ex.setsCompleted} sets`;
    const e1rmStr = ex.bestE1RM > 0 ? `~${ex.bestE1RM} lb` : '';
    return `
      <div style="display:flex;align-items:baseline;padding:9px 0;border-bottom:1px solid var(--border)">
        <div style="flex:1;font-size:14px;font-weight:500">
          ${ex.name}${isPR ? ' <span style="color:var(--accent);font-size:12px">★</span>' : ''}
        </div>
        <div style="font-size:14px;color:var(--fg);margin-right:12px;white-space:nowrap">${setStr}</div>
        <div style="font-size:12px;color:var(--fg-dim);white-space:nowrap;min-width:60px;text-align:right">${e1rmStr}</div>
      </div>
    `;
  }).join('');

  const statsLine = stats.totalVolume > 0
    ? `${stats.exerciseSummaries.length} exercises · ${stats.totalSets} sets · ${Math.round(stats.totalVolume).toLocaleString()} lb`
    : `${stats.exerciseSummaries.length} exercises · ${stats.totalSets} sets`;

  app.innerHTML = `
    <div style="padding-top:8px">
      <div style="font-size:32px;font-weight:700;letter-spacing:-0.5px;margin-bottom:6px">Done.</div>
      <div style="font-size:17px;font-weight:600;margin-bottom:2px">${session.focus || 'Workout'}</div>
      <div class="muted" style="margin-bottom:20px">${programLabel}${weekDayLabel ? ' · ' + weekDayLabel : ''}</div>

      ${prSection}

      <div class="card" style="padding:0 16px">
        ${exRows || '<div class="muted" style="padding:14px 0">No sets logged.</div>'}
      </div>

      <div class="muted" style="text-align:center;margin:14px 0 20px;font-size:13px">${statsLine}</div>

      <div class="btn-row">
        <button class="btn" id="done-home">Back to today</button>
        <button class="btn ghost" id="done-body">Log weight</button>
      </div>
    </div>
  `;

  app.querySelector('#done-home').onclick = () => navigate('home');
  app.querySelector('#done-body').onclick = () => navigate('body');
}

async function changeDay(delta) {
  // Manually move the program cursor (only works for "follow" mode current programs).
  const today_w = await todaysWorkout();
  if (today_w.type !== 'program') return;
  const programId = today_w.program.id;
  const program = today_w.program;
  const cur = (await pref(`cursor:${programId}`)) || { week: 1, day: 1, day_index: 0 };
  if (program.weeks) {
    let { week, day } = cur;
    week = week || today_w.week;
    day = (day || today_w.day) + delta;
    const wk = program.weeks.find(w => w.week_num === week);
    const maxDay = wk?.days?.length || 6;
    if (day > maxDay) { day = 1; week = Math.min(week + 1, program.weeks.length); }
    if (day < 1)      { week = Math.max(1, week - 1); day = program.weeks.find(w => w.week_num === week)?.days?.length || 1; }
    await pref(`cursor:${programId}`, { week, day });
  } else if (program.days) {
    const di = (((cur.day_index ?? 0) + delta) % program.days.length + program.days.length) % program.days.length;
    await pref(`cursor:${programId}`, { day_index: di });
  }
  renderWorkout(document.getElementById('app'));
}
