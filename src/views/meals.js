/**
 * Meals view: log meals + browse meal library + barcode scan + quick-add.
 *
 * Library entries have `kind`:
 *   - 'food'    common foods with `serving` (e.g. "4 oz chicken breast")
 *   - 'recipe'  BWS-extracted with `ingredients`, `instructions`, `variants`
 *   - 'user'    user-saved
 */
import { getAll, getByIndex, put, del } from '../db.js';
import { toast, openSheet } from '../app.js';
import { loadCatalogs } from '../lib/static_data.js';
import { parseServingInfo, nutrientsFromProduct, offFetch } from '../lib/off_nutrients.js';
import {
  UNIT_LABELS,
  calcServings,
  convertAmount,
  enrichUnits,
  perAmountForUnit,
  reconcileLiquidUnits,
  unitsForUi,
} from '../lib/serving_units.js';

const todayStr = () => new Date().toISOString().slice(0, 10);

let _activeDate = null; // null = today
let _macroRange = 'day'; // 'day' | 'week'

function attrEsc(s) {
  return String(s ?? '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function resolveServingInfo(si) {
  if (si?.units && si.defaultUnit) return si;
  return parseServingInfo(si?.label || (typeof si === 'string' ? si : '') || '');
}

/** Shared serving UI — enter amount eaten; servings auto-calculate. */
function servingFieldsHtml(prefix, servingLabel, si, { servings = 1, focusAmount = true } = {}) {
  const info = resolveServingInfo(si);
  const units = info.units || enrichUnits({ serving: 1 });
  const defaultUnit = info.defaultUnit || 'oz';
  const uiUnits = unitsForUi(units, defaultUnit, servingLabel);
  const perVal = perAmountForUnit(units, defaultUnit);
  const unitPills = uiUnits.map(u =>
    `<button type="button" class="pill${u === defaultUnit ? ' accent' : ''}" data-unit="${u}">${UNIT_LABELS[u] || u}</button>`
  ).join('');
  const unitLbl = UNIT_LABELS[defaultUnit] || defaultUnit;
  return `
    <label>Serving label</label>
    <input type="text" id="${prefix}-srvlbl" value="${attrEsc(servingLabel)}" placeholder="e.g. 1 cup, 4 oz chicken">
    <label style="margin-top:10px">Unit</label>
    <div id="${prefix}-unit-row" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">${unitPills}</div>
    <label id="${prefix}-per-lbl">Per serving (${unitLbl})</label>
    <input type="number" id="${prefix}-per" inputmode="decimal" value="${perVal}">
    <label id="${prefix}-amt-lbl" style="margin-top:10px">How much did you eat? (${unitLbl})</label>
    <input type="number" id="${prefix}-amt" inputmode="decimal" placeholder="e.g. 12"${focusAmount ? ' autofocus' : ''}>
    <div class="muted" style="font-size:12px;margin:8px 0">Servings: <strong id="${prefix}-srv-disp">${servings}</strong> <span id="${prefix}-srv-hint">(enter amount above)</span></div>
    <input type="hidden" id="${prefix}-srv" value="${servings}">
  `;
}

function wireServingFields(sheet, prefix, updatePreview) {
  const q = (id) => sheet.querySelector(`#${prefix}-${id}`);

  function getUnit() {
    return q('unit-row')?.querySelector('.pill.accent')?.dataset.unit || 'oz';
  }

  function getPerUnits() {
    const parsed = parseServingInfo(q('srvlbl')?.value || '');
    const units = { ...parsed.units };
    const unit = getUnit();
    const per = parseFloat(q('per')?.value);
    if (per > 0) units[unit] = per;
    return reconcileLiquidUnits(enrichUnits(units), q('srvlbl')?.value || '');
  }

  function setUnit(unit, { fromLabel = false } = {}) {
    const prev = getUnit();
    const perUnits = getPerUnits();
    if (!fromLabel && prev !== unit) {
      const per = q('per');
      const amt = q('amt');
      if (per?.value) per.value = convertAmount(per.value, prev, unit, perUnits);
      if (amt?.value) amt.value = convertAmount(amt.value, prev, unit, perUnits);
    }
    q('unit-row')?.querySelectorAll('[data-unit]').forEach(btn => {
      btn.classList.toggle('accent', btn.dataset.unit === unit);
    });
    const lbl = UNIT_LABELS[unit] || unit;
    if (q('per-lbl')) q('per-lbl').textContent = `Per serving (${lbl})`;
    if (q('amt-lbl')) q('amt-lbl').textContent = `How much did you eat? (${lbl})`;
  }

  function syncPerServingFromLabel() {
    const parsed = parseServingInfo(q('srvlbl')?.value || '');
    const units = parsed.units;
    if (!Object.keys(units).length) return;
    const unit = parsed.defaultUnit;
    setUnit(unit, { fromLabel: true });
    const per = q('per');
    if (per) per.value = perAmountForUnit(units, unit);
    calcServingsFromAmount();
  }

  function calcServingsFromAmount() {
    const perUnits = getPerUnits();
    const unit = getUnit();
    const amt = parseFloat(q('amt')?.value);
    const srv = q('srv');
    const disp = q('srv-disp');
    const hint = q('srv-hint');
    let s = parseFloat(srv?.value) || 1;
    if (amt > 0) {
      const calc = calcServings(amt, unit, perUnits);
      if (calc != null) {
        s = calc;
        if (srv) srv.value = String(s);
        if (disp) disp.textContent = String(s);
        if (hint) hint.textContent = '';
      }
    } else if (hint) {
      hint.textContent = '(enter amount above)';
    }
    updatePreview?.();
  }

  q('unit-row')?.querySelectorAll('[data-unit]').forEach(btn => {
    btn.onclick = () => {
      setUnit(btn.dataset.unit);
      calcServingsFromAmount();
    };
  });
  q('srvlbl')?.addEventListener('input', () => { syncPerServingFromLabel(); });
  q('per')?.addEventListener('input', calcServingsFromAmount);
  q('amt')?.addEventListener('input', calcServingsFromAmount);
  syncPerServingFromLabel();
}

async function loadZXingReader() {
  if (window.ZXingBrowser?.BrowserMultiFormatReader) return window.ZXingBrowser.BrowserMultiFormatReader;
  if (window.ZXing?.BrowserMultiFormatReader) return window.ZXing.BrowserMultiFormatReader;
  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/@zxing/browser@0.1.5/umd/index.min.js';
    s.onload = res;
    s.onerror = rej;
    document.head.appendChild(s);
  });
  return window.ZXingBrowser?.BrowserMultiFormatReader || window.ZXing?.BrowserMultiFormatReader;
}

function parseGramsPerServing(serving) {
  return parseServingInfo(serving).gramsPerServing;
}

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

function sumMacros(meals) {
  return meals.reduce((s, m) => ({
    cal: s.cal + (m.calories || 0),
    p: s.p + (m.protein || 0),
    c: s.c + (m.carbs || 0),
    f: s.f + (m.fat || 0),
    fiber: s.fiber + (m.fiber || 0),
    sat: s.sat + (m.saturated_fat || 0),
  }), { cal: 0, p: 0, c: 0, f: 0, fiber: 0, sat: 0 });
}

function macroPctLine(p, c, f) {
  const pct = macroPercents(p, c, f);
  if (!pct) return '';
  return `<div class="muted" style="font-size:11px;margin-top:6px">Macro split: ${pct.p}% P · ${pct.c}% C · ${pct.f}% F</div>`;
}

export async function renderMeals(app, date) {
  if (date) _activeDate = date;
  const dateKey = _activeDate || todayStr();
  const isToday = dateKey === todayStr();
  const [meals, allMeals] = await Promise.all([
    getByIndex('meals', 'date', dateKey),
    _macroRange === 'week' ? getAll('meals') : Promise.resolve(null),
  ]);
  const { pref } = await import('../db.js');
  const userProfile = (await pref('profile')) || {};
  let displayMeals = meals;
  if (_macroRange === 'week') {
    const start = new Date(dateKey + 'T12:00:00');
    start.setDate(start.getDate() - 6);
    const startStr = start.toISOString().slice(0, 10);
    displayMeals = (allMeals || []).filter(m => m.date >= startStr && m.date <= dateKey);
  }
  const sums = sumMacros(displayMeals);

  let targets = null;
  if (userProfile.weight_lb) {
    const { profile } = await import('../lib/tdee.js');
    const t = profile(userProfile);
    targets = { cal: t.target_calories, p: t.macros.protein_g, c: t.macros.carb_g, f: t.macros.fat_g };
  }

  const dateLabel = isToday ? 'Today' : new Date(dateKey + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

  app.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
      <h1 style="margin:0;flex:1">Meals</h1>
      <button class="btn ghost" id="prev-day" style="width:auto;padding:6px 10px">‹</button>
      <span style="font-size:14px;font-weight:600;min-width:80px;text-align:center">${dateLabel}</span>
      <button class="btn ghost" id="next-day" style="width:auto;padding:6px 10px" ${isToday ? 'disabled' : ''}>›</button>
    </div>

    <div style="display:flex;gap:6px;margin-bottom:8px">
      <button class="pill ${_macroRange === 'day' ? 'accent' : ''}" data-range="day">Day</button>
      <button class="pill ${_macroRange === 'week' ? 'accent' : ''}" data-range="week">7 days</button>
    </div>
    ${targets ? `
    <div class="card" style="padding:10px 12px;margin-bottom:10px">
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;text-align:center">
        ${macroCell('Cal', Math.round(sums.cal), _macroRange === 'week' ? targets.cal * 7 : targets.cal)}
        ${macroCell('Protein', Math.round(sums.p), _macroRange === 'week' ? targets.p * 7 : targets.p, 'g')}
        ${macroCell('Carbs', Math.round(sums.c), _macroRange === 'week' ? targets.c * 7 : targets.c, 'g')}
        ${macroCell('Fat', Math.round(sums.f), _macroRange === 'week' ? targets.f * 7 : targets.f, 'g')}
      </div>
      ${macroPctLine(sums.p, sums.c, sums.f)}
      <div class="muted" style="font-size:11px;margin-top:8px;display:grid;grid-template-columns:1fr 1fr;gap:4px">
        <span>Fiber: ${Math.round(sums.fiber * 10) / 10}g</span>
        <span>Sat. fat: ${Math.round(sums.sat * 10) / 10}g</span>
      </div>
    </div>` : `
    <div class="muted" style="margin-bottom:10px">
      ${Math.round(sums.cal)} kcal · ${Math.round(sums.p)}p · ${Math.round(sums.c)}c · ${Math.round(sums.f)}f
      ${macroPctLine(sums.p, sums.c, sums.f)}
      <div style="margin-top:4px">Fiber ${Math.round(sums.fiber * 10) / 10}g · Sat. fat ${Math.round(sums.sat * 10) / 10}g</div>
    </div>`}

    <div style="display:flex;gap:8px;margin:0 0 8px;align-items:stretch">
      <div class="search-bar" style="flex:1;margin:0">
        <input type="text" id="meal-search" placeholder="Search foods…" autocomplete="off">
      </div>
      <button class="btn secondary" data-action="library" style="width:auto;flex-shrink:0;padding:0 14px">Library</button>
    </div>
    <div class="btn-row" style="margin:0 0 12px">
      <button class="btn" data-action="quick">+ Quick add</button>
      <button class="btn secondary" data-action="search-off">Search</button>
      <button class="btn secondary" data-action="scan">📷 Scan</button>
    </div>
    <div id="meal-list"></div>
  `;

  renderList(app.querySelector('#meal-list'), meals, dateKey);

  app.querySelectorAll('[data-range]').forEach(b => {
    b.onclick = () => {
      _macroRange = b.dataset.range;
      renderMeals(app);
    };
  });

  const $mealSearch = app.querySelector('#meal-search');
  const openLib = (q) => openLibraryPicker(dateKey, q);
  app.querySelector('[data-action="library"]').onclick = () => openLib($mealSearch.value.trim());
  $mealSearch.addEventListener('keydown', e => {
    if (e.key === 'Enter') openLib(e.target.value.trim());
  });

  app.querySelector('[data-action="quick"]').onclick = () => openQuickAdd({}, dateKey);
  app.querySelector('[data-action="search-off"]').onclick = () => openFoodSearch(dateKey, $mealSearch.value.trim());
  app.querySelector('[data-action="scan"]').onclick = () => openBarcodeScanner(dateKey);

  app.querySelector('#prev-day').onclick = () => {
    const d = new Date(dateKey + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    _activeDate = d.toISOString().slice(0, 10);
    renderMeals(app);
  };
  app.querySelector('#next-day').onclick = () => {
    if (isToday) return;
    const d = new Date(dateKey + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    _activeDate = d.toISOString().slice(0, 10);
    renderMeals(app);
  };
}

function macroCell(label, val, target, unit = '') {
  const pct = target ? Math.min(100, val / target * 100) : 0;
  const over = val > target * 1.05;
  return `
    <div>
      <div class="muted" style="font-size:10px">${label}</div>
      <div style="font-weight:700;font-size:15px;color:${over ? 'var(--warn)' : 'var(--fg)'}">${val}${unit}</div>
      <div class="muted" style="font-size:10px">/ ${target}${unit}</div>
      <div style="height:3px;background:var(--bg-input);border-radius:2px;margin-top:3px">
        <div style="height:3px;background:${over ? 'var(--warn)' : 'var(--accent)'};border-radius:2px;width:${pct}%"></div>
      </div>
    </div>
  `;
}

function toastWithUndo(msg, onUndo) {
  document.querySelectorAll('.undo-toast').forEach(t => t.remove());
  const el = document.createElement('div');
  el.className = 'undo-toast';
  el.style.cssText = [
    'position:fixed',
    'bottom:calc(var(--safe-bottom,0px) + 76px)',
    'left:50%',
    'transform:translateX(-50%)',
    'background:var(--bg-card)',
    'border:1px solid var(--border)',
    'border-radius:10px',
    'padding:12px 16px',
    'font-size:14px',
    'z-index:9999',
    'display:flex',
    'align-items:center',
    'gap:16px',
    'box-shadow:0 4px 20px rgba(0,0,0,0.45)',
    'white-space:nowrap',
  ].join(';');
  el.innerHTML = `<span>${msg}</span><button style="background:none;border:none;color:var(--accent);font-size:14px;font-weight:700;cursor:pointer;padding:0;line-height:1">Undo</button>`;
  document.body.appendChild(el);
  const timer = setTimeout(() => el.remove(), 4000);
  el.querySelector('button').onclick = () => {
    clearTimeout(timer);
    el.remove();
    onUndo();
  };
}

function renderList(el, meals, dateKey) {
  if (!meals.length) {
    el.innerHTML = `<div class="empty"><div class="icon">🍳</div><div>No meals logged yet</div></div>`;
    return;
  }
  el.innerHTML = '';
  for (const m of meals) {
    const node = document.createElement('div');
    node.className = 'list-item';
    node.style.cursor = 'pointer';
    const micro = [
      m.fiber ? `${m.fiber}g fiber` : '',
      m.saturated_fat ? `${m.saturated_fat}g sat fat` : '',
    ].filter(Boolean).join(' · ');
    node.innerHTML = `
      <div style="flex:1">
        <div class="list-item-title">${m.name}</div>
        <div class="list-item-meta">${m.calories || 0} kcal · ${m.protein || 0}p · ${m.carbs || 0}c · ${m.fat || 0}f${m.servings && m.servings !== 1 ? ' · ' + m.servings + '×' : ''}${micro ? ' · ' + micro : ''}</div>
      </div>
      <button class="btn ghost del-meal" data-id="${m.id}" style="width:auto;padding:6px 10px">✕</button>
    `;
    node.onclick = (e) => {
      if (e.target.closest('.del-meal')) return;
      openEditMeal(m, dateKey);
    };
    node.querySelector('.del-meal').onclick = async (e) => {
      e.stopPropagation();
      const item = { ...m };
      await del('meals', m.id);
      renderMeals(document.getElementById('app'));
      toastWithUndo('Removed', async () => {
        await put('meals', item);
        renderMeals(document.getElementById('app'));
      });
    };
    el.appendChild(node);
  }
}


function openEditMeal(m, dateKey) {
  const s = m.servings || 1;
  openQuickAdd({
    id: m.id,
    name: m.name,
    serving: m.serving || '1 serving',
    calories: Math.round((m.calories || 0) / s),
    protein: Math.round(((m.protein || 0) / s) * 10) / 10,
    carbs: Math.round(((m.carbs || 0) / s) * 10) / 10,
    fat: Math.round(((m.fat || 0) / s) * 10) / 10,
    fiber: Math.round(((m.fiber || 0) / s) * 10) / 10,
    saturated_fat: Math.round(((m.saturated_fat || 0) / s) * 10) / 10,
    servings: s,
    skipLibrary: true,
  }, dateKey);
}

/* ── Quick Add (with servings + barcode link) ── */

function openQuickAdd(prefill = {}, dateKey) {
  dateKey = dateKey || todayStr();
  const isEdit = !!prefill.id;
  const si0 = parseServingInfo(prefill.serving);
  openSheet((sheet, close) => {
    const base = {
      name:     prefill.name     || '',
      calories: prefill.calories || 0,
      protein:  prefill.protein  || 0,
      carbs:    prefill.carbs    || 0,
      fat:      prefill.fat      || 0,
      fiber:    prefill.fiber    || 0,
      saturated_fat: prefill.saturated_fat || 0,
      serving:  prefill.serving  || '1 serving',
    };
    sheet.innerHTML = `
      <h2>${isEdit ? 'Edit entry' : 'Quick add'}</h2>
      ${prefill.nutritionNote ? `<div class="muted" style="margin-bottom:8px;padding:8px 10px;background:var(--bg-input);border-radius:8px;color:var(--warn)">${attrEsc(prefill.nutritionNote)}</div>` : ''}
      <div class="muted" style="margin-bottom:8px">Per serving — totals multiply by servings consumed.</div>
      <label>Name</label>
      <input type="text" id="m-name" value="${attrEsc(base.name)}" autocomplete="off" placeholder="e.g. Chicken & rice">
      ${servingFieldsHtml('m', base.serving, si0, { servings: prefill.servings ?? 1, focusAmount: false })}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
        <div>
          <label>Cals (per serving)</label>
          <input type="number" id="m-cal" inputmode="decimal" value="${base.calories || ''}">
        </div>
        <div>
          <label>Protein (g)</label>
          <input type="number" id="m-p" inputmode="decimal" value="${base.protein || ''}">
        </div>
        <div>
          <label>Carbs (g)</label>
          <input type="number" id="m-c" inputmode="decimal" value="${base.carbs || ''}">
        </div>
        <div>
          <label>Fat (g)</label>
          <input type="number" id="m-f" inputmode="decimal" value="${base.fat || ''}">
        </div>
        <div>
          <label>Fiber (g)</label>
          <input type="number" id="m-fiber" inputmode="decimal" value="${base.fiber || ''}">
        </div>
        <div>
          <label>Sat. fat (g)</label>
          <input type="number" id="m-sat" inputmode="decimal" value="${base.saturated_fat || ''}">
        </div>
      </div>
      <div id="preview" class="muted" style="margin-top:6px;font-size:13px"></div>

      ${!isEdit && !prefill.skipLibrary ? `
      <label style="display:flex;align-items:center;gap:8px;margin-top:12px">
        <input type="checkbox" id="m-fav" checked style="width:auto;min-height:auto"> Save to my library
      </label>` : ''}
      <div class="btn-row" style="margin-top:14px">
        <button class="btn" id="m-save">${isEdit ? 'Save' : 'Log'}</button>
        <button class="btn ghost" id="m-cancel">Cancel</button>
      </div>
      <div style="margin-top:14px;text-align:center">
        <a href="#" id="m-scan" style="color:var(--fg-dim);font-size:13px">or scan a barcode →</a>
      </div>
    `;
    const $ = (s) => sheet.querySelector(s);
    function update() {
      const s = +$('#m-srv').value || 1;
      const c = +$('#m-cal').value || 0;
      const p = +$('#m-p').value || 0;
      const cb = +$('#m-c').value || 0;
      const f = +$('#m-f').value || 0;
      const fiber = +$('#m-fiber').value || 0;
      const sat = +$('#m-sat').value || 0;
      $('#preview').textContent = `Total: ${Math.round(c * s)} kcal · ${Math.round(p * s * 10) / 10}p · ${Math.round(cb * s * 10) / 10}c · ${Math.round(f * s * 10) / 10}f` +
        (fiber || sat ? ` · fiber ${Math.round(fiber * s * 10) / 10}g · sat ${Math.round(sat * s * 10) / 10}g` : '');
    }
    wireServingFields(sheet, 'm', update);
    sheet.addEventListener('input', e => {
      if (e.target.matches('input[type="number"]')) update();
    });
    update();
    $('#m-cancel').onclick = close;
    $('#m-scan').onclick = (e) => { e.preventDefault(); close(false); openBarcodeScanner(dateKey); };
    $('#m-save').onclick = async () => {
      const s = +$('#m-srv').value || 1;
      const meal = {
        ...(prefill.id ? { id: prefill.id } : {}),
        date: dateKey,
        name: $('#m-name').value.trim() || 'Meal',
        serving: $('#m-srvlbl').value.trim() || undefined,
        servings: s,
        calories: Math.round((+$('#m-cal').value || 0) * s),
        protein:  Math.round((+$('#m-p').value || 0) * s * 10) / 10,
        carbs:    Math.round((+$('#m-c').value || 0) * s * 10) / 10,
        fat:      Math.round((+$('#m-f').value || 0) * s * 10) / 10,
        fiber:    Math.round((+$('#m-fiber').value || 0) * s * 10) / 10,
        saturated_fat: Math.round((+$('#m-sat').value || 0) * s * 10) / 10,
        time: prefill.time || new Date().toISOString(),
      };
      await put('meals', meal);
      const $fav = $('#m-fav');
      if ($fav?.checked) {
        await put('user_meals', {
          name: meal.name,
          serving: meal.serving,
          calories: +$('#m-cal').value || 0,
          protein: +$('#m-p').value || 0,
          carbs: +$('#m-c').value || 0,
          fat: +$('#m-f').value || 0,
          fiber: +$('#m-fiber').value || 0,
          saturated_fat: +$('#m-sat').value || 0,
          ...(prefill.barcode ? { barcode: prefill.barcode } : {}),
          category: 'user',
          kind: 'user',
        });
      }
      toast(isEdit ? 'Updated' : 'Logged');
      close();
      renderMeals(document.getElementById('app'));
    };
    setTimeout(() => $('#m-name').focus(), 100);
  });
}

/* ── Library picker ── */

function buildRecentItems(logs, lib) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const counts = {};
  const latest = {};
  for (const log of logs) {
    if (!log.name || log.date < cutoffStr) continue;
    counts[log.name] = (counts[log.name] || 0) + 1;
    if (!latest[log.name] || (log.time || '') > (latest[log.name].time || '')) {
      latest[log.name] = log;
    }
  }

  return Object.keys(counts)
    .sort((a, b) => counts[b] - counts[a])
    .slice(0, 8)
    .map(name => {
      const libItem = lib.find(x => x.name === name);
      if (libItem) return libItem;
      const log = latest[name];
      const srv = log.servings || 1;
      return {
        name: log.name,
        serving: log.serving || '1 serving',
        calories: Math.round((log.calories || 0) / srv),
        protein:  Math.round(((log.protein  || 0) / srv) * 10) / 10,
        carbs:    Math.round(((log.carbs    || 0) / srv) * 10) / 10,
        fat:      Math.round(((log.fat      || 0) / srv) * 10) / 10,
        kind: 'user',
      };
    });
}

async function openLibraryPicker(dateKey, initialQuery = '') {
  dateKey = dateKey || todayStr();
  const [{ mealItems }, userMeals, recentLogs] = await Promise.all([
    loadCatalogs(),
    getAll('user_meals'),
    getAll('meals'),
  ]);
  const lib = [...userMeals.map(m => ({ ...m, kind: m.kind || 'user' })), ...mealItems];
  const recentItems = buildRecentItems(recentLogs, lib);
  openSheet((sheet, close) => {
    sheet.innerHTML = `
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
        <h2 style="margin:0;flex-shrink:0">Library</h2>
        <div class="search-bar" style="flex:1;margin:0"><input type="text" id="search" placeholder="Search…" autocomplete="off"></div>
      </div>
      <div id="recents"></div>
      <div id="cat-tabs" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;overflow-x:auto"></div>
      <div id="meals"></div>
    `;
    const allCats = ['all', 'common-protein', 'common-carb', 'common-fat', 'common-veg', 'common-snack', 'breakfast', 'lunch', 'dinner', 'snack', 'recipe', 'plan', 'user'];
    const cats = allCats.filter(c => c === 'all' || lib.some(m => m.category === c));
    const catTabs = sheet.querySelector('#cat-tabs');
    let activeCat = 'all';
    cats.forEach(c => {
      const b = document.createElement('button');
      b.className = 'pill';
      b.style.flexShrink = '0';
      b.textContent = prettyCat(c);
      b.onclick = () => {
        activeCat = c;
        catTabs.querySelectorAll('.pill').forEach(x => x.classList.toggle('accent', x === b));
        render();
      };
      if (c === 'all') b.classList.add('accent');
      catTabs.appendChild(b);
    });
    const $meals = sheet.querySelector('#meals');
    const $search = sheet.querySelector('#search');
    function render() {
      const q = $search.value.trim().toLowerCase();
      const filtered = lib.filter(m =>
        (activeCat === 'all' || m.category === activeCat) &&
        (!q || (m.name || '').toLowerCase().includes(q))
      ).sort((a, b) => {
        // common foods first, then user, then recipes
        const order = { food: 0, user: 1, recipe: 2 };
        return (order[a.kind] ?? 3) - (order[b.kind] ?? 3) || (a.name || '').localeCompare(b.name || '');
      }).slice(0, 100);
      if (!filtered.length) {
        $meals.innerHTML = `<div class="empty"><div class="icon">🥄</div><div>No matches</div></div>`;
        return;
      }
      $meals.innerHTML = filtered.map(m => `
        <div class="list-item" data-id="${m.id || ''}" data-kind="${m.kind}" data-user-id="${m.kind === 'user' && m.id ? m.id : ''}">
          <div style="flex:1">
            <div class="list-item-title">${m.name || '(unnamed)'}</div>
            <div class="list-item-meta">${m.serving ? m.serving + ' · ' : ''}${m.calories} kcal · ${m.protein}p${m.carbs ? ' · ' + m.carbs + 'c' : ''}${m.fat ? ' · ' + m.fat + 'f' : ''}</div>
          </div>
          ${m.kind === 'user' && m.id ? '<button class="btn ghost edit-user" style="width:auto;padding:6px 8px;margin-right:4px">✎</button>' : ''}
          <span class="pill ${m.kind === 'recipe' ? '' : 'accent'}">${m.kind === 'recipe' ? '→' : '+ Log'}</span>
        </div>
      `).join('');
      $meals.querySelectorAll('.list-item').forEach(item => {
        const editBtn = item.querySelector('.edit-user');
        if (editBtn) {
          editBtn.onclick = (e) => {
            e.stopPropagation();
            const um = lib.find(x => String(x.id) === item.dataset.userId);
            if (um) openEditUserMeal(um, () => { close(false); openLibraryPicker(dateKey, $search.value.trim()); });
          };
        }
        item.onclick = () => {
          let m = lib.find(x => x.id != null && String(x.id) === item.dataset.id);
          if (!m && item.dataset.kind === 'user') {
            m = lib.find(x => x.kind === 'user' && x.name === item.querySelector('.list-item-title')?.textContent);
          }
          if (!m) return;
          if (m.kind === 'recipe') openRecipeDetail(m, close, dateKey);
          else openLogServings(m, close, dateKey);
        };
      });
    }
    const $recents = sheet.querySelector('#recents');
    if (recentItems.length) {
      $recents.innerHTML = `<div class="group-label" style="margin-top:4px;margin-bottom:6px">Recent</div>` +
        recentItems.map((item, idx) => `
          <div class="list-item recent-item" style="padding:10px 12px" data-recent="${idx}">
            <div style="flex:1">
              <div class="list-item-title">${item.name}</div>
              <div class="list-item-meta">${item.serving ? item.serving + ' · ' : ''}${item.calories} kcal · ${item.protein}p</div>
            </div>
            <span class="pill accent" style="flex-shrink:0">+ Log</span>
          </div>
        `).join('');
      $recents.querySelectorAll('.recent-item').forEach(el => {
        el.onclick = () => openLogServings(recentItems[+el.dataset.recent], close, dateKey);
      });
    }

    $search.oninput = () => {
      $recents.style.display = $search.value.trim() ? 'none' : '';
      render();
    };
    if (initialQuery) {
      $search.value = initialQuery;
      $recents.style.display = 'none';
    }
    render();
    setTimeout(() => $search.focus(), 100);
  });
}

function prettyCat(c) {
  if (c === 'all') return 'All';
  if (c.startsWith('common-')) return c.replace('common-', '');
  return c;
}

/* ── Recipe detail (ingredients + instructions + variant picker) ── */

function openRecipeDetail(recipe, parentClose, dateKey) {
  dateKey = dateKey || todayStr();
  openSheet((sheet, close) => {
    const variants = recipe.variants || [];
    const initial = variants.find(v => v.calories === recipe.calories) || variants[0] || {
      calories: recipe.calories, protein_g: recipe.protein, carbs_g: recipe.carbs, fat_g: recipe.fat
    };
    let cur = { ...initial };
    sheet.innerHTML = `
      <h2>${recipe.name}</h2>
      ${recipe.category ? `<span class="pill">${recipe.category}</span>` : ''}
      <div id="variant-row" style="display:flex;gap:6px;flex-wrap:wrap;margin:10px 0"></div>
      <div id="macros" class="card-row" style="background:var(--bg-input);padding:10px;border-radius:10px;margin:8px 0">
      </div>

      ${recipe.ingredients && recipe.ingredients.length ? `
        <h3>Ingredients</h3>
        <ul style="padding-left:20px;font-size:14px;color:var(--fg-dim);line-height:1.7">
          ${recipe.ingredients.map(i => `<li>${i}</li>`).join('')}
        </ul>
      ` : ''}
      ${recipe.instructions ? `
        <h3>Instructions</h3>
        <div style="font-size:14px;color:var(--fg-dim);line-height:1.6">${recipe.instructions}</div>
      ` : ''}

      <label style="margin-top:14px">Servings</label>
      <input type="number" id="srv" value="1" step="0.25" inputmode="decimal">
      <div id="preview" class="muted" style="margin-top:6px;font-size:13px"></div>

      <div class="btn-row" style="margin-top:14px">
        <button class="btn" id="log">Log</button>
        <button class="btn ghost" id="cancel">Cancel</button>
      </div>
    `;
    const $vrow = sheet.querySelector('#variant-row');
    if (variants.length > 1) {
      variants.forEach((v, i) => {
        const b = document.createElement('button');
        b.className = 'pill' + (v.calories === cur.calories ? ' accent' : '');
        b.textContent = v.cal_band ? `${v.cal_band} cal` : `${v.calories} cal`;
        b.onclick = () => { cur = v; updateMacros(); $vrow.querySelectorAll('.pill').forEach((x, j) => x.classList.toggle('accent', j === i)); update(); };
        $vrow.appendChild(b);
      });
    }
    function updateMacros() {
      const $m = sheet.querySelector('#macros');
      $m.innerHTML = `
        <div><div class="muted" style="font-size:11px">Cal</div><div style="font-weight:700">${cur.calories}</div></div>
        <div><div class="muted" style="font-size:11px">Protein</div><div style="font-weight:700">${cur.protein_g || 0}g</div></div>
        <div><div class="muted" style="font-size:11px">Carbs</div><div style="font-weight:700">${cur.carbs_g || 0}g</div></div>
        <div><div class="muted" style="font-size:11px">Fat</div><div style="font-weight:700">${cur.fat_g || 0}g</div></div>
      `;
    }
    function update() {
      const s = +sheet.querySelector('#srv').value || 1;
      sheet.querySelector('#preview').textContent =
        `Total: ${Math.round(cur.calories * s)} kcal · ${Math.round((cur.protein_g || 0) * s * 10) / 10}p · ${Math.round((cur.carbs_g || 0) * s * 10) / 10}c · ${Math.round((cur.fat_g || 0) * s * 10) / 10}f`;
    }
    updateMacros();
    update();
    sheet.querySelector('#srv').oninput = update;
    sheet.querySelector('#cancel').onclick = close;
    sheet.querySelector('#log').onclick = async () => {
      const s = +sheet.querySelector('#srv').value || 1;
      await put('meals', {
        date: dateKey,
        name: recipe.name,
        servings: s,
        calories: Math.round(cur.calories * s),
        protein:  Math.round((cur.protein_g || 0) * s * 10) / 10,
        carbs:    Math.round((cur.carbs_g || 0) * s * 10) / 10,
        fat:      Math.round((cur.fat_g || 0) * s * 10) / 10,
        fiber:    Math.round((cur.fiber_g || 0) * s * 10) / 10,
        recipe_id: recipe.id,
        time: new Date().toISOString(),
      });
      toast(`Logged ${recipe.name}`);
      close();
      if (parentClose) parentClose();
      renderMeals(document.getElementById('app'));
    };
  });
}

/** Normalize UPC/EAN — scanners often drop the leading 0. */
function normalizeBarcode(code) {
  const digits = String(code || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 11) return '0' + digits;
  if (digits.length === 12) return digits;
  if (digits.length === 13 && digits.startsWith('0')) return digits;
  return digits;
}

/** Barcode lookup variants to try against Open Food Facts. */
function barcodeLookupCodes(code) {
  const base = normalizeBarcode(code);
  const tries = new Set([base, code.replace(/\D/g, '')]);
  if (base.length === 12) tries.add('0' + base);
  if (base.length === 13 && base.startsWith('0')) tries.add(base.slice(1));
  return [...tries].filter(Boolean);
}

/** After OFF lookup — open log sheet without dismissing the next sheet via history.back(). */
function openProductFromLookup({ name, nut, barcode }, dateKey) {
  const item = {
    name,
    serving: nut.serving,
    calories: nut.calories,
    protein: nut.protein,
    carbs: nut.carbs,
    fat: nut.fat,
    fiber: nut.fiber,
    saturated_fat: nut.saturated_fat,
    nutritionNote: nut.note,
    _servingInfo: nut.servingInfo,
    barcode,
  };
  if (nut.needsReview) toast('Nutrition may be incomplete — check values before logging');
  openLogServings(item, null, dateKey);
}

/* ── Log a food/user item with servings ── */

function openLogServings(item, parentClose, dateKey) {
  dateKey = dateKey || todayStr();
  const si = item._servingInfo || parseServingInfo(item.serving);
  openSheet((sheet, close) => {
    sheet.innerHTML = `
      <h2>${attrEsc(item.name)}</h2>
      ${item.nutritionNote ? `<div class="muted" style="margin-bottom:8px;padding:8px 10px;background:var(--bg-input);border-radius:8px;color:var(--warn)">${attrEsc(item.nutritionNote)}</div>` : ''}
      <div class="muted" style="margin-bottom:8px">Per ${item.serving || '1 serving'}: ${item.calories} kcal · ${item.protein}p · ${item.carbs || 0}c · ${item.fat || 0}f</div>
      ${servingFieldsHtml('log', item.serving || '1 serving', si, { servings: 1 })}
      <div id="preview" class="muted" style="margin-top:6px;font-size:13px"></div>
      ${!item.id || item.barcode ? `
        <label style="display:flex;align-items:center;gap:8px;margin-top:10px;font-size:14px">
          <input type="checkbox" id="save-lib" ${item.barcode ? 'checked' : ''}> Save to my library
        </label>` : ''}
      <div class="btn-row" style="margin-top:14px">
        <button class="btn" id="log">Log</button>
        <button class="btn ghost" id="cancel">Cancel</button>
      </div>
    `;
    function update() {
      const s = +sheet.querySelector('#log-srv').value || 1;
      sheet.querySelector('#preview').textContent =
        `Total: ${Math.round(item.calories * s)} kcal · ${Math.round((item.protein || 0) * s * 10) / 10}p · ${Math.round((item.carbs || 0) * s * 10) / 10}c · ${Math.round((item.fat || 0) * s * 10) / 10}f`;
    }
    wireServingFields(sheet, 'log', update);
    update();
    sheet.querySelector('#cancel').onclick = close;
    sheet.querySelector('#log').onclick = async () => {
      const s = +$srv.value || 1;
      await put('meals', {
        date: dateKey,
        name: item.name,
        servings: s,
        serving: sheet.querySelector('#log-srvlbl')?.value.trim() || item.serving,
        calories: Math.round(item.calories * s),
        protein:  Math.round((item.protein || 0) * s * 10) / 10,
        carbs:    Math.round((item.carbs || 0) * s * 10) / 10,
        fat:      Math.round((item.fat || 0) * s * 10) / 10,
        fiber:    Math.round((item.fiber || 0) * s * 10) / 10,
        saturated_fat: Math.round((item.saturated_fat || 0) * s * 10) / 10,
        time: new Date().toISOString(),
      });
      if (sheet.querySelector('#save-lib')?.checked) {
        await put('user_meals', {
          name: item.name,
          serving: item.serving || '1 serving',
          calories: item.calories,
          protein: item.protein || 0,
          carbs: item.carbs || 0,
          fat: item.fat || 0,
          fiber: item.fiber || 0,
          saturated_fat: item.saturated_fat || 0,
          barcode: item.barcode,
          category: 'user',
          kind: 'user',
        });
      }
      toast(`Logged ${item.name}`);
      close();
      if (parentClose) parentClose();
      renderMeals(document.getElementById('app'));
    };
    setTimeout(() => sheet.querySelector('#log-amt')?.focus(), 100);
  });
}

/* ── Barcode scanner ── */

function openBarcodeScanner(dateKey) {
  dateKey = dateKey || todayStr();
  openSheet((sheet, close, hooks) => {
    sheet.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <h2 style="margin:0">Scan barcode</h2>
        <button class="btn ghost" id="scan-cancel" style="width:auto;padding:6px 12px">Cancel</button>
      </div>
      <div id="scan-status" class="muted">Starting camera…</div>
      <video id="cam" autoplay playsinline muted style="width:100%;border-radius:12px;background:#000;margin-top:8px;max-height:60vh"></video>
      <div style="margin-top:12px">
        <label>Or enter barcode manually</label>
        <input type="text" id="manual-code" inputmode="numeric" placeholder="UPC/EAN">
        <button class="btn" id="manual-go" style="margin-top:8px">Look up</button>
      </div>
    `;
    const status = sheet.querySelector('#scan-status');
    const video = sheet.querySelector('#cam');
    let stream;

    async function lookupBarcode(code) {
      status.textContent = `Looking up ${code}…`;
      try {
        let product = null;
        let usedCode = code;
        for (const tryCode of barcodeLookupCodes(code)) {
          const r = await offFetch(
            `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(tryCode)}.json`
          );
          if (!r.ok) continue;
          const j = await r.json();
          if (j.status === 1 && j.product) {
            product = j.product;
            usedCode = tryCode;
            break;
          }
        }
        if (!product) {
          toast(`Not found: ${code}`);
          status.textContent = `Not found — try manual entry.`;
          return;
        }
        const nut = nutrientsFromProduct(product);
        cleanup();
        close(false);
        openProductFromLookup({
          name: product.product_name || product.brands || `Product ${usedCode}`,
          nut,
          barcode: usedCode,
        }, dateKey);
      } catch (e) {
        console.error('[scan] lookup failed', e);
        toast(`Lookup failed: ${e.message}`);
        status.textContent = `Error — check your connection or try manual entry.`;
      }
    }

    function cleanup() {
      if (stream) stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    hooks.onClose = cleanup;
    sheet.querySelector('#scan-cancel').onclick = close;

    sheet.querySelector('#manual-go').onclick = () => {
      const code = sheet.querySelector('#manual-code').value.trim();
      if (!code) { toast('Enter a barcode number first'); return; }
      const btn = sheet.querySelector('#manual-go');
      btn.disabled = true;
      btn.textContent = 'Looking up…';
      lookupBarcode(code).finally(() => {
        btn.disabled = false;
        btn.textContent = 'Look up';
      });
    };

    const isSecure = location.protocol === 'https:' || location.hostname === 'localhost';

    if (!isSecure || !('BarcodeDetector' in window)) {
      video.style.display = 'none';
      if (!isSecure) {
        status.innerHTML = `Camera requires HTTPS. <b>Enter the barcode below</b> or take a photo:`;
      } else {
        status.innerHTML = `Live scan not supported on this browser. Enter the code manually:`;
      }
      // Photo fallback — user takes a photo, we decode via ZXing loaded on demand
      const photoBtn = document.createElement('button');
      photoBtn.className = 'btn secondary';
      photoBtn.style.marginTop = '8px';
      photoBtn.textContent = '📷 Take photo of barcode';
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.capture = 'environment';
      fileInput.style.display = 'none';
      photoBtn.onclick = () => fileInput.click();
      fileInput.onchange = async () => {
        const file = fileInput.files[0];
        if (!file) return;
        status.textContent = 'Reading barcode…';
        try {
          const ReaderClass = await loadZXingReader();
          if (!ReaderClass) throw new Error('Barcode reader failed to load');
          const img = new Image();
          const objUrl = URL.createObjectURL(file);
          img.src = objUrl;
          await new Promise(r => img.onload = r);
          URL.revokeObjectURL(objUrl);
          // Phone cameras produce huge images (12MP+) that ZXing can't decode —
          // scale down to max 1200px on longest side before attempting decode
          const canvas = document.createElement('canvas');
          const MAX = 1200;
          const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
          canvas.width = Math.round(img.naturalWidth * scale);
          canvas.height = Math.round(img.naturalHeight * scale);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          const reader = new ReaderClass();
          const result = await reader.decodeFromCanvas(canvas);
          await lookupBarcode(result.getText());
        } catch (e) {
          status.textContent = `Couldn't read barcode — try manual entry below.`;
        }
      };
      status.after(photoBtn);
      photoBtn.after(fileInput);
      return;
    }

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        video.srcObject = stream;
        const detector = new BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128']
        });
        status.textContent = 'Point at a barcode...';
        let scanning = true;
        async function tick() {
          if (!scanning) return;
          try {
            const codes = await detector.detect(video);
            if (codes && codes[0]) {
              scanning = false;
              const code = codes[0].rawValue;
              status.textContent = `Found: ${code}`;
              await lookupBarcode(code);
              return;
            }
          } catch {}
          requestAnimationFrame(tick);
        }
        video.addEventListener('loadedmetadata', tick);
      } catch (e) {
        status.textContent = `Camera error: ${e.message}. Use manual entry below.`;
      }
    })();

  });
}

function openFoodSearch(dateKey, initialQuery = '') {
  dateKey = dateKey || todayStr();
  openSheet((sheet, close) => {
    sheet.innerHTML = `
      <h2>Search foods</h2>
      <div class="muted" style="margin-bottom:8px">Open Food Facts database</div>
      <div class="search-bar"><input type="text" id="off-q" placeholder="e.g. greek yogurt" autocomplete="off"></div>
      <button class="btn" id="off-go" style="margin-top:8px">Search</button>
      <div id="off-results" style="margin-top:12px"></div>
    `;
    const $q = sheet.querySelector('#off-q');
    const $res = sheet.querySelector('#off-results');
    if (initialQuery) $q.value = initialQuery;
    async function run() {
      const q = $q.value.trim();
      if (!q) { toast('Enter a search term'); return; }
      $res.innerHTML = '<div class="muted">Searching…</div>';
      try {
        const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=20`;
        const r = await offFetch(url);
        if (!r.ok) throw new Error(`Server error ${r.status}`);
        const j = await r.json();
        const products = j.products || [];
        if (!products.length) {
          $res.innerHTML = '<div class="empty"><div>No results</div></div>';
          return;
        }
        $res.innerHTML = products.map(p => {
          const n = p.nutriments || {};
          const cal = n['energy-kcal_100g'] || n['energy-kcal_serving'];
          const name = (p.product_name || p.generic_name || 'Unknown').replace(/</g, '&lt;');
          const brands = (p.brands || '').replace(/</g, '&lt;');
          return `
            <div class="list-item off-item" data-code="${p.code}">
              <div style="flex:1">
                <div class="list-item-title">${name}</div>
                <div class="list-item-meta">${brands}${cal ? ' · ~' + Math.round(cal) + ' kcal' : ''}</div>
              </div>
              <span class="pill accent">+</span>
            </div>`;
        }).join('');
        $res.querySelectorAll('.off-item').forEach(el => {
          el.onclick = async () => {
            const code = el.dataset.code;
            close(false);
            try {
              const r2 = await offFetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`);
              const j2 = await r2.json();
              if (j2.status !== 1) { toast('Product not found'); return; }
              const prod = j2.product;
              const nut = nutrientsFromProduct(prod);
              openProductFromLookup({
                name: prod.product_name || prod.brands || `Product ${code}`,
                nut,
                barcode: code,
              }, dateKey);
            } catch (err) {
              toast(`Lookup failed: ${err.message}`);
            }
          };
        });
      } catch (e) {
        $res.innerHTML = `<div class="muted">Search failed: ${e.message}</div>`;
      }
    }
    sheet.querySelector('#off-go').onclick = run;
    $q.addEventListener('keydown', e => { if (e.key === 'Enter') run(); });
    if (initialQuery) run();
    else setTimeout(() => $q.focus(), 100);
  });
}

function openEditUserMeal(item, onUpdated) {
  openSheet((sheet, close) => {
    const esc = (s) => (s || '').replace(/"/g, '&quot;');
    sheet.innerHTML = `
      <h2>Edit saved food</h2>
      <label>Name</label>
      <input type="text" id="u-name" value="${esc(item.name)}" autocomplete="off">
      <label>Serving label</label>
      <input type="text" id="u-srv" value="${esc(item.serving || '1 serving')}">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div><label>Cals</label><input type="number" id="u-cal" value="${item.calories || ''}"></div>
        <div><label>Protein (g)</label><input type="number" id="u-p" value="${item.protein || ''}"></div>
        <div><label>Carbs (g)</label><input type="number" id="u-c" value="${item.carbs || ''}"></div>
        <div><label>Fat (g)</label><input type="number" id="u-f" value="${item.fat || ''}"></div>
        <div><label>Fiber (g)</label><input type="number" id="u-fiber" value="${item.fiber || ''}"></div>
        <div><label>Sat. fat (g)</label><input type="number" id="u-sat" value="${item.saturated_fat || ''}"></div>
      </div>
      <div class="btn-row" style="margin-top:14px">
        <button class="btn" id="u-save">Save</button>
        <button class="btn ghost" id="u-del">Delete</button>
        <button class="btn ghost" id="u-cancel">Cancel</button>
      </div>
    `;
    sheet.querySelector('#u-cancel').onclick = close;
    sheet.querySelector('#u-save').onclick = async () => {
      await put('user_meals', {
        ...item,
        name: sheet.querySelector('#u-name').value.trim() || 'Food',
        serving: sheet.querySelector('#u-srv').value.trim() || '1 serving',
        calories: +sheet.querySelector('#u-cal').value || 0,
        protein: +sheet.querySelector('#u-p').value || 0,
        carbs: +sheet.querySelector('#u-c').value || 0,
        fat: +sheet.querySelector('#u-f').value || 0,
        fiber: +sheet.querySelector('#u-fiber').value || 0,
        saturated_fat: +sheet.querySelector('#u-sat').value || 0,
        category: 'user',
        kind: 'user',
      });
      toast('Saved');
      close();
      onUpdated?.();
    };
    sheet.querySelector('#u-del').onclick = async () => {
      if (!confirm(`Delete "${item.name}" from your library?`)) return;
      await del('user_meals', item.id);
      toast('Deleted');
      close();
      onUpdated?.();
    };
  });
}
