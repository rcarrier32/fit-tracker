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
import { localDateStr } from '../lib/date.js';
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

const todayStr = () => localDateStr();

// This app is static, served from GitHub Pages — it can't run server code, so the one
// proxy function OFF text-search needs (api/off-search.js) is hosted separately on
// Vercel and called here by absolute URL. See fit-tracker-hosting memory / commit history
// (v40) for why this split exists; update this if the Vercel project is ever relinked.
const OFF_SEARCH_PROXY = 'https://fit-tracker-one-pi.vercel.app/api/off-search';

let _activeDate = null; // null = today
let _macroRange = 'day'; // 'day' | 'week'

function attrEsc(s) {
  return String(s ?? '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/** Reads a number input, rejecting negatives/NaN/blank rather than letting them
 * silently subtract from daily totals (a stray "-" keystroke used to pass straight
 * through `+el.value || 0`, since a negative number is truthy). */
function numInput(el, fallback = 0) {
  const n = parseFloat(el?.value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function resolveServingInfo(si) {
  if (si?.units && si.defaultUnit) return si;
  return parseServingInfo(si?.label || (typeof si === 'string' ? si : '') || '');
}

/**
 * "Save to my library" upsert — matches an existing user_meals record by barcode (if the
 * item has one) else by exact name, and updates it in place rather than always creating a
 * fresh row. Without this, checking the box on every relog of the same food (its default
 * state) silently piles up near-duplicate Library entries.
 */
async function saveToLibrary(record) {
  const existing = await getAll('user_meals');
  const match = record.id != null
    ? existing.find(m => m.id === record.id)
    : record.barcode
    ? existing.find(m => m.barcode === record.barcode)
    : existing.find(m => (m.kind || 'user') === (record.kind || 'user')
        && (m.name || '').trim().toLowerCase() === (record.name || '').trim().toLowerCase());
  await put('user_meals', match ? { ...match, ...record, id: match.id } : record);
}

function unitOptionsHtml(uiUnits, activeUnit) {
  return uiUnits.map(u =>
    `<option value="${u}"${u === activeUnit ? ' selected' : ''}>${UNIT_LABELS[u] || u}</option>`
  ).join('');
}

/**
 * Shared serving UI — enter amount eaten; servings auto-calculate. Defaults to whatever
 * unit the item's own label is phrased in (e.g. a "170g" item opens already in grams),
 * so the common case is just "type how much I ate." A compact unit <select> — not an
 * always-visible row of unit-pill buttons — covers the rare case of a different unit.
 */
function servingFieldsHtml(prefix, servingLabel, si, { servings = 1, focusAmount = true } = {}) {
  const info = resolveServingInfo(si);
  const units = info.units || enrichUnits({ serving: 1 });
  const defaultUnit = info.defaultUnit || 'oz';
  const uiUnits = unitsForUi(units, defaultUnit, servingLabel);
  const perVal = perAmountForUnit(units, defaultUnit);
  const unitPicker = uiUnits.length > 1
    ? `<select id="${prefix}-unit-select" style="width:auto;padding:4px 8px;font-size:13px;border-radius:6px">${unitOptionsHtml(uiUnits, defaultUnit)}</select>`
    : `<input type="hidden" id="${prefix}-unit-select" value="${defaultUnit}">`;
  const unitLbl = UNIT_LABELS[defaultUnit] || defaultUnit;
  return `
    <label>Serving label</label>
    <input type="text" id="${prefix}-srvlbl" value="${attrEsc(servingLabel)}" placeholder="e.g. 1 cup, 4 oz chicken">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;gap:8px">
      <label id="${prefix}-per-lbl" style="margin:0">Per serving (${unitLbl})</label>
      ${unitPicker}
    </div>
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
    return q('unit-select')?.value || 'oz';
  }

  // Tracked separately from the <select>'s own DOM value: by the time a native <select>
  // fires "change", el.value already IS the new unit, so reading "previous unit" back
  // off the DOM inside setUnit would always see prev === next and silently skip conversion.
  let activeUnit = getUnit();

  function getPerUnitsFor(forUnit) {
    const parsed = parseServingInfo(q('srvlbl')?.value || '');
    const units = { ...parsed.units };
    const per = parseFloat(q('per')?.value);
    if (per > 0) units[forUnit] = per;
    return reconcileLiquidUnits(enrichUnits(units), q('srvlbl')?.value || '');
  }
  const getPerUnits = () => getPerUnitsFor(getUnit());

  function applyUnitLabels(unit) {
    const lbl = UNIT_LABELS[unit] || unit;
    if (q('per-lbl')) q('per-lbl').textContent = `Per serving (${lbl})`;
    if (q('amt-lbl')) q('amt-lbl').textContent = `How much did you eat? (${lbl})`;
  }

  function setUnit(unit, { fromLabel = false } = {}) {
    const prev = activeUnit;
    if (!fromLabel && prev !== unit) {
      const perUnits = getPerUnitsFor(prev);
      const per = q('per');
      const amt = q('amt');
      if (per?.value) per.value = convertAmount(per.value, prev, unit, perUnits);
      if (amt?.value) amt.value = convertAmount(amt.value, prev, unit, perUnits);
    }
    const el = q('unit-select');
    if (el) el.value = unit;
    activeUnit = unit;
    applyUnitLabels(unit);
  }

  function bindUnitSelectListener() {
    q('unit-select')?.addEventListener('change', () => {
      setUnit(q('unit-select').value);
      calcServingsFromAmount();
    });
  }

  // A label edit can imply a completely different set of units (mass -> volume, a food
  // with no known unit suddenly parsing to several, etc) — rebuild the picker itself
  // rather than just re-selecting an option, including swapping a single-unit item's
  // hidden input for a real <select> (or back) if the available unit count changes.
  function rebuildUnitOptions(units, unit, label) {
    const el = q('unit-select');
    if (!el) return;
    const uiUnits = unitsForUi(units, unit, label);
    const wantSelect = uiUnits.length > 1;
    if (wantSelect === (el.tagName === 'SELECT')) {
      if (wantSelect) el.innerHTML = unitOptionsHtml(uiUnits, unit);
      else el.value = unit;
      return;
    }
    const replacement = document.createElement(wantSelect ? 'select' : 'input');
    replacement.id = el.id;
    if (wantSelect) {
      replacement.style.cssText = 'width:auto;padding:4px 8px;font-size:13px;border-radius:6px';
      replacement.innerHTML = unitOptionsHtml(uiUnits, unit);
    } else {
      replacement.type = 'hidden';
      replacement.value = unit;
    }
    el.replaceWith(replacement);
    if (wantSelect) bindUnitSelectListener();
  }

  function syncPerServingFromLabel() {
    const labelText = q('srvlbl')?.value || '';
    const parsed = parseServingInfo(labelText);
    const units = parsed.units;
    if (!Object.keys(units).length) return;
    const unit = parsed.defaultUnit;
    rebuildUnitOptions(units, unit, labelText);
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

  bindUnitSelectListener();
  // Only re-derive units from the label text in response to the user actually editing
  // it — running this once unconditionally on mount (the old behavior) would immediately
  // discard the richer, product-aware unit data a barcode scan already resolved.
  q('srvlbl')?.addEventListener('input', () => { syncPerServingFromLabel(); });
  q('per')?.addEventListener('input', calcServingsFromAmount);
  q('amt')?.addEventListener('input', calcServingsFromAmount);
  calcServingsFromAmount();
}

/**
 * Editing "Per serving" size should rescale the macro fields proportionally, since they
 * were parsed/entered against the *old* serving size — shared by openLogServings (scaling
 * a scanned item's macros) and openEditUserMeal (scaling a saved item's macros), which
 * otherwise carried this ~20-line block twice, nearly verbatim. `macroFieldIds` are the
 * `${prefix}-...` suffixes to scale (e.g. ['cal','prot','carb','fat']).
 */
function wireServingSizeRescale(sheet, prefix, si, macroFieldIds, onRescale) {
  const q = (id) => sheet.querySelector(`#${prefix}-${id}`);
  let basisG = si.gramsPerServing || (si.units?.ml > 0 ? si.units.ml : null) || null;
  function currentBasisG() {
    const unit = q('unit-select')?.value || 'oz';
    const per = parseFloat(q('per')?.value);
    if (!(per > 0)) return null;
    const enriched = enrichUnits({ [unit]: per });
    return enriched.g > 0 ? enriched.g : (enriched.ml > 0 ? enriched.ml : null);
  }
  q('per')?.addEventListener('input', () => {
    const newBasis = currentBasisG();
    if (basisG > 0 && newBasis > 0 && Math.abs(newBasis - basisG) > 0.01) {
      const ratio = newBasis / basisG;
      macroFieldIds.forEach(id => {
        const el = q(id);
        if (el) el.value = Math.round(parseFloat(el.value || 0) * ratio * 100) / 100;
      });
      // Keep the free-text label matched to the amount just typed — it's re-parsed every
      // future time this item is opened, so a stale label paired with already-rescaled
      // macros would silently mismatch on the next open/edit.
      const srvlbl = q('srvlbl');
      const perNow = q('per')?.value;
      const unitNow = q('unit-select')?.value;
      if (srvlbl && perNow && unitNow) srvlbl.value = `${perNow} ${UNIT_LABELS[unitNow] || unitNow}`;
    }
    basisG = newBasis ?? basisG;
    onRescale?.();
  });
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
    const startStr = localDateStr(start);
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

    <div style="display:flex;gap:8px;margin:0 0 12px;position:relative">
      <input type="text" id="meal-search" placeholder="Search foods…" autocomplete="off" style="flex:1;margin:0">
      <div id="meal-search-suggest" style="display:none;position:absolute;top:100%;left:0;right:56px;z-index:20;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;margin-top:4px;max-height:260px;overflow-y:auto;box-shadow:0 4px 12px rgba(0,0,0,0.35)"></div>
      <button class="btn secondary" data-action="library" style="flex:0 0 48px;width:48px;padding:0;font-size:19px" title="Browse your library" aria-label="Browse your library">📚</button>
    </div>
    <div style="display:flex;gap:8px;margin:0 0 12px">
      <button class="btn" data-action="quick" style="flex:2" title="Type in a food and its macros by hand">+ New</button>
      <button class="btn secondary" data-action="combo" style="flex:1;white-space:nowrap;padding:14px 10px" title="Save several ingredients as one item">+ Combo</button>
      <button class="btn secondary" data-action="search-off" style="flex:0 0 48px;width:48px;padding:0;font-size:19px" title="Search Open Food Facts" aria-label="Search Open Food Facts">🔍</button>
      <button class="btn secondary" data-action="scan" style="flex:0 0 48px;width:48px;padding:0;font-size:19px" title="Scan a barcode" aria-label="Scan a barcode">📷</button>
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

  // Live search — was Enter-only before, which reads as "search doesn't do anything"
  // compared to the Library sheet's own live-filtering box. Same lazy-load-once,
  // filter-in-memory pattern as the combo builder's ingredient typeahead.
  const $suggest = app.querySelector('#meal-search-suggest');
  let searchLib = null;
  async function getSearchLib() {
    if (searchLib) return searchLib;
    const [{ mealItems }, userMeals] = await Promise.all([loadCatalogs(), getAll('user_meals')]);
    searchLib = [...userMeals.map(m => ({ ...m, kind: m.kind || 'user' })), ...mealItems];
    return searchLib;
  }
  function hideMealSuggest() { $suggest.style.display = 'none'; $suggest.innerHTML = ''; }
  function openMealSuggestItem(m) {
    hideMealSuggest();
    if (m.kind === 'recipe') openRecipeDetail(m, null, dateKey);
    else if (m.kind === 'composite') openCompositeDetail(m, null, dateKey);
    else openLogServings(m, null, dateKey);
  }
  $mealSearch.addEventListener('input', async () => {
    const q = $mealSearch.value.trim().toLowerCase();
    if (q.length < 2) { hideMealSuggest(); return; }
    const lib = await getSearchLib();
    if ($mealSearch.value.trim().toLowerCase() !== q) return; // stale response, user kept typing
    const matches = lib.filter(m => (m.name || '').toLowerCase().includes(q)).slice(0, 8);
    if (!matches.length) { hideMealSuggest(); return; }
    $suggest.innerHTML = matches.map((m, i) => `
      <div class="list-item meal-suggest-item" data-i="${i}" style="padding:10px 12px">
        <div style="flex:1">
          <div class="list-item-title">${attrEsc(m.name)}</div>
          <div class="list-item-meta">${m.serving ? attrEsc(m.serving) + ' · ' : ''}${m.calories || 0} kcal · ${m.protein || 0}p</div>
        </div>
        <span class="pill ${m.kind === 'recipe' ? '' : 'accent'}">${m.kind === 'recipe' ? '→' : m.kind === 'composite' ? 'Combo →' : '+ Log'}</span>
      </div>
    `).join('');
    $suggest.style.display = 'block';
    $suggest.querySelectorAll('.meal-suggest-item').forEach(el => {
      el.onmousedown = (e) => e.preventDefault();
      el.onclick = () => openMealSuggestItem(matches[+el.dataset.i]);
    });
  });
  $mealSearch.addEventListener('blur', () => setTimeout(hideMealSuggest, 150));

  app.querySelector('[data-action="quick"]').onclick = () => openQuickAdd({}, dateKey);
  app.querySelector('[data-action="search-off"]').onclick = () => openFoodSearch(dateKey, $mealSearch.value.trim());
  app.querySelector('[data-action="scan"]').onclick = () => openBarcodeScanner(dateKey);
  app.querySelector('[data-action="combo"]').onclick = (e) => { e.preventDefault(); openComboBuilder(dateKey); };

  app.querySelector('#prev-day').onclick = () => {
    const d = new Date(dateKey + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    _activeDate = localDateStr(d);
    renderMeals(app);
  };
  app.querySelector('#next-day').onclick = () => {
    if (isToday) return;
    const d = new Date(dateKey + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    _activeDate = localDateStr(d);
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
  // Stack rather than clobber: deleting a second meal right after a first used to silently
  // remove the first toast — and its undo option — with no warning. Each pending toast now
  // gets its own vertical slot so back-to-back deletes stay independently undoable.
  const stackIndex = document.querySelectorAll('.undo-toast').length;
  const el = document.createElement('div');
  el.className = 'undo-toast';
  el.style.cssText = [
    'position:fixed',
    `bottom:calc(var(--safe-bottom,0px) + ${76 + stackIndex * 54}px)`,
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
        <div class="list-item-title">${attrEsc(m.name)}</div>
        <div class="list-item-meta">${m.calories || 0} kcal · ${m.protein || 0}p · ${m.carbs || 0}c · ${m.fat || 0}f${m.servings && m.servings !== 1 ? ' · ' + m.servings + '×' : ''}${micro ? ' · ' + micro : ''}</div>
      </div>
      <button class="btn ghost del-meal" data-id="${m.id}" style="width:auto;padding:6px 10px">✕</button>
    `;
    node.onclick = (e) => {
      if (e.target.closest('.del-meal')) return;
      if (m.ingredients?.length) openLoggedComboEdit(m, dateKey);
      else openEditMeal(m, dateKey);
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
  // Keep 2 decimal places (not the final display precision) on this divide — the save
  // handler multiplies back by `s` and rounds again, and rounding twice on a round-trip
  // is lossy (100 kcal @ 3 servings -> 33 -> 99 on a no-op edit). Two decimals keeps that
  // round-trip error well under the final rounding step, instead of compounding it.
  openQuickAdd({
    id: m.id,
    name: m.name,
    serving: m.serving || '1 serving',
    calories: Math.round(((m.calories || 0) / s) * 100) / 100,
    protein: Math.round(((m.protein || 0) / s) * 100) / 100,
    carbs: Math.round(((m.carbs || 0) / s) * 100) / 100,
    fat: Math.round(((m.fat || 0) / s) * 100) / 100,
    fiber: Math.round(((m.fiber || 0) / s) * 100) / 100,
    saturated_fat: Math.round(((m.saturated_fat || 0) / s) * 100) / 100,
    servings: s,
    time: m.time,
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
      <h2>${isEdit ? 'Edit entry' : 'New food'}</h2>
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

      ${!prefill.skipLibrary ? `
      <label style="display:flex;align-items:center;gap:8px;margin-top:12px">
        <input type="checkbox" id="m-fav" ${isEdit ? '' : 'checked'} style="width:auto;min-height:auto"> ${isEdit ? 'Update my saved copy in Library' : 'Save to my library'}
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
      const s = numInput($('#m-srv'), 1);
      const c = numInput($('#m-cal'));
      const p = numInput($('#m-p'));
      const cb = numInput($('#m-c'));
      const f = numInput($('#m-f'));
      const fiber = numInput($('#m-fiber'));
      const sat = numInput($('#m-sat'));
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
      const s = numInput($('#m-srv'), 1);
      const meal = {
        ...(prefill.id ? { id: prefill.id } : {}),
        date: dateKey,
        name: $('#m-name').value.trim() || 'Meal',
        serving: $('#m-srvlbl').value.trim() || undefined,
        servings: s,
        calories: Math.round((numInput($('#m-cal'))) * s),
        protein:  Math.round((numInput($('#m-p'))) * s * 10) / 10,
        carbs:    Math.round((numInput($('#m-c'))) * s * 10) / 10,
        fat:      Math.round((numInput($('#m-f'))) * s * 10) / 10,
        fiber:    Math.round((numInput($('#m-fiber'))) * s * 10) / 10,
        saturated_fat: Math.round((numInput($('#m-sat'))) * s * 10) / 10,
        time: prefill.time || new Date().toISOString(),
      };
      await put('meals', meal);
      const $fav = $('#m-fav');
      if ($fav?.checked) {
        await saveToLibrary({
          name: meal.name,
          serving: meal.serving,
          calories: numInput($('#m-cal')),
          protein: numInput($('#m-p')),
          carbs: numInput($('#m-c')),
          fat: numInput($('#m-f')),
          fiber: numInput($('#m-fiber')),
          saturated_fat: numInput($('#m-sat')),
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
  const cutoffStr = localDateStr(cutoff);

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
        fiber:    Math.round(((log.fiber    || 0) / srv) * 10) / 10,
        saturated_fat: Math.round(((log.saturated_fat || 0) / srv) * 10) / 10,
        kind: 'user',
      };
    });
}

async function openLibraryPicker(dateKey, initialQuery = '', onPick) {
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
        (!q || (m.name || '').toLowerCase().includes(q)) &&
        // Picking an ingredient for a combo row needs a flat per-serving item — a recipe
        // (ingredients/instructions/variants) or another combo doesn't fit that shape, and
        // clicking one used to fall through to logging the whole thing to today instead of
        // filling the row, with no indication anything went wrong. Just don't offer them.
        (!onPick || (m.kind !== 'recipe' && m.kind !== 'composite'))
      ).sort((a, b) => {
        // common foods first, then user/combo, then recipes
        const order = { food: 0, user: 1, composite: 1, recipe: 2 };
        return (order[a.kind] ?? 3) - (order[b.kind] ?? 3) || (a.name || '').localeCompare(b.name || '');
      }).slice(0, 100);
      if (!filtered.length) {
        $meals.innerHTML = `<div class="empty"><div class="icon">🥄</div><div>No matches</div></div>`;
        return;
      }
      $meals.innerHTML = filtered.map((m, i) => `
        <div class="list-item" data-idx="${i}">
          <div style="flex:1">
            <div class="list-item-title">${attrEsc(m.name) || '(unnamed)'}</div>
            <div class="list-item-meta">${m.serving ? attrEsc(m.serving) + ' · ' : ''}${m.calories} kcal · ${m.protein}p${m.carbs ? ' · ' + m.carbs + 'c' : ''}${m.fat ? ' · ' + m.fat + 'f' : ''}</div>
          </div>
          <button class="btn ghost edit-user" style="width:auto;padding:6px 8px;margin-right:4px" title="Edit">✎</button>
          ${(m.kind === 'user' || m.kind === 'composite') && m.id != null
            ? '<button class="btn ghost del-user" style="width:auto;padding:6px 8px;margin-right:4px" title="Delete">🗑️</button>'
            : ''}
          <span class="pill ${m.kind === 'recipe' ? '' : 'accent'}">${m.kind === 'recipe' ? '→' : m.kind === 'composite' ? 'Combo →' : '+ Log'}</span>
        </div>
      `).join('');
      $meals.querySelectorAll('.list-item').forEach(itemEl => {
        const m = filtered[+itemEl.dataset.idx];
        itemEl.querySelector('.edit-user').onclick = (e) => {
          e.stopPropagation();
          if (m.kind === 'composite') {
            openComboBuilder(dateKey, m, () => { close(false); openLibraryPicker(dateKey, $search.value.trim()); });
            return;
          }
          // A catalog food/recipe (static JSON, not yours to mutate) opens as an unsaved
          // draft — Saving it there creates your own personal copy via autoIncrement
          // instead of colliding with the catalog's synthetic string id (`id` must be
          // entirely absent, not just undefined, or IndexedDB throws a DataError). Only
          // the flat food-shaped fields are carried over — a recipe's `ingredients` (a
          // string array, a completely different shape than a combo's ingredient objects),
          // `instructions`, and `variants` don't fit this editor and shouldn't ride along
          // as stray dead data on the new record.
          const draft = (m.kind === 'user' && m.id != null) ? m : {
            name: m.name, serving: m.serving,
            calories: m.calories, protein: m.protein, carbs: m.carbs, fat: m.fat,
            fiber: m.fiber, saturated_fat: m.saturated_fat, barcode: m.barcode,
            kind: 'user', category: 'user',
          };
          openEditUserMeal(draft, () => { close(false); openLibraryPicker(dateKey, $search.value.trim()); });
        };
        itemEl.querySelector('.del-user')?.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!confirm(`Delete "${m.name}" from your library?`)) return;
          await del('user_meals', m.id);
          toast('Deleted');
          close(false);
          openLibraryPicker(dateKey, $search.value.trim());
        });
        itemEl.onclick = () => {
          if (onPick && m.kind !== 'recipe' && m.kind !== 'composite') openLogServings(m, close, dateKey, onPick);
          else if (m.kind === 'recipe') openRecipeDetail(m, close, dateKey);
          else if (m.kind === 'composite') openCompositeDetail(m, close, dateKey);
          else openLogServings(m, close, dateKey);
        };
      });
    }
    const $recents = sheet.querySelector('#recents');
    // Same "no recipe/combo as a flat ingredient" rule as the main list (see above).
    const recentForList = onPick ? recentItems.filter(m => m.kind !== 'recipe' && m.kind !== 'composite') : recentItems;
    if (recentForList.length) {
      $recents.innerHTML = `<div class="group-label" style="margin-top:4px;margin-bottom:6px">Recent</div>` +
        recentForList.map((item, idx) => `
          <div class="list-item recent-item" style="padding:10px 12px" data-recent="${idx}">
            <div style="flex:1">
              <div class="list-item-title">${attrEsc(item.name)}</div>
              <div class="list-item-meta">${item.serving ? attrEsc(item.serving) + ' · ' : ''}${item.calories} kcal · ${item.protein}p</div>
            </div>
            <span class="pill ${item.kind === 'recipe' ? '' : 'accent'}" style="flex-shrink:0">${item.kind === 'recipe' ? '→' : item.kind === 'composite' ? 'Combo →' : '+ Log'}</span>
          </div>
        `).join('');
      $recents.querySelectorAll('.recent-item').forEach(el => {
        el.onclick = () => {
          const m = recentForList[+el.dataset.recent];
          if (onPick && m.kind !== 'recipe' && m.kind !== 'composite') openLogServings(m, close, dateKey, onPick);
          else if (m.kind === 'recipe') openRecipeDetail(m, close, dateKey);
          else if (m.kind === 'composite') openCompositeDetail(m, close, dateKey);
          else openLogServings(m, close, dateKey);
        };
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

/* ── Combo meals: save several ingredients (shake, bowl…) as one item ── */

const CB_FIELD_LABEL = 'display:block;font-size:11px;color:var(--fg-dim);margin-bottom:3px';

function comboRowHtml(ing = {}) {
  return `
    <div class="cb-row" data-fiber="${ing.fiber || 0}" data-sat="${ing.saturated_fat || 0}" style="border:1px solid var(--border);border-radius:10px;padding:10px;margin-bottom:8px">
      <div style="display:flex;gap:8px;margin-bottom:8px">
        <div style="flex:1;position:relative">
          <input type="text" class="cb-i-name" placeholder="Ingredient (e.g. Avocado)" value="${attrEsc(ing.name || '')}" autocomplete="off">
          <div class="cb-i-suggest" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:20;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;margin-top:4px;max-height:180px;overflow-y:auto;box-shadow:0 4px 12px rgba(0,0,0,0.35)"></div>
        </div>
        <button type="button" class="btn secondary cb-i-find" style="width:auto;padding:6px 10px;flex-shrink:0;font-size:16px" title="Scan, search, or pick from Library">🔍</button>
        <button type="button" class="btn ghost cb-i-remove" style="width:auto;padding:6px 10px;flex-shrink:0">✕</button>
      </div>
      <div style="display:flex;gap:6px;margin-bottom:8px">
        <div style="flex:1"><label style="${CB_FIELD_LABEL}">Amount</label><input type="number" class="cb-i-amount" inputmode="decimal" placeholder="Amount" value="${ing.amount ?? ''}"></div>
        <div style="flex:1"><label style="${CB_FIELD_LABEL}">Unit</label><input type="text" class="cb-i-unit" placeholder="g, tbsp, banana…" value="${attrEsc(ing.unit || '')}"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <div><label style="${CB_FIELD_LABEL}">Calories</label><input type="number" class="cb-i-cal" inputmode="decimal" placeholder="Cal" value="${ing.calories ?? ''}"></div>
        <div><label style="${CB_FIELD_LABEL}">Protein (g)</label><input type="number" class="cb-i-p" inputmode="decimal" placeholder="Protein" value="${ing.protein ?? ''}"></div>
        <div><label style="${CB_FIELD_LABEL}">Carbs (g)</label><input type="number" class="cb-i-c" inputmode="decimal" placeholder="Carbs" value="${ing.carbs ?? ''}"></div>
        <div><label style="${CB_FIELD_LABEL}">Fat (g)</label><input type="number" class="cb-i-f" inputmode="decimal" placeholder="Fat" value="${ing.fat ?? ''}"></div>
      </div>
    </div>
  `;
}

/** Small chooser for filling one combo ingredient row — scan a barcode, search Open Food
 * Facts, or pick from the Library — each in "pick" mode: instead of logging the item, the
 * resolved amount/unit/macros are handed to `onPick` for that one row. */
function openIngredientPicker(dateKey, onPick) {
  openSheet((sheet, close) => {
    sheet.innerHTML = `
      <h2>Find an ingredient</h2>
      <div class="muted" style="margin-bottom:10px;font-size:13px">Scanned or searched items are saved to your Library too, so they're ready to use again.</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <button class="btn secondary" id="ip-scan">📷 Scan barcode</button>
        <button class="btn secondary" id="ip-search">🔍 Search Open Food Facts</button>
        <button class="btn secondary" id="ip-library">📚 My Library</button>
      </div>
      <button class="btn ghost" id="ip-cancel" style="margin-top:14px">Cancel</button>
    `;
    sheet.querySelector('#ip-cancel').onclick = close;
    sheet.querySelector('#ip-scan').onclick = () => { close(false); openBarcodeScanner(dateKey, onPick); };
    sheet.querySelector('#ip-search').onclick = () => { close(false); openFoodSearch(dateKey, '', onPick); };
    sheet.querySelector('#ip-library').onclick = () => { close(false); openLibraryPicker(dateKey, '', onPick); };
  });
}

/** Best-guess amount/unit/macros for a Library item, used to fill a combo row directly —
 * same derivation as the pick-mode flow, but applied instantly instead of opening a
 * confirm sheet, since typeahead is meant to be the fast path for "I already have this
 * in my Library." */
function libItemToRowFill(m) {
  const si = parseServingInfo(m.serving || '');
  // ozPerServing is only ever derived FROM grams (enrichUnits sets it only if .g is set —
  // see serving_units.js), so it's never the sole signal for a purely volume-labeled item
  // ("8 fl oz", "1 cup"). Without the ml fallback, amount silently defaulted to 1 while
  // unit correctly resolved to fl_oz/ml/cup — a mismatched pair that corrupts every later
  // rescale (ratio = newAmount / 1 instead of newAmount / trueServingSize).
  const mlPerServing = si.units?.ml > 0 ? si.units.ml : null;
  const amount = si.gramsPerServing || si.ozPerServing || mlPerServing || 1;
  const unit = si.gramsPerServing ? 'g' : si.ozPerServing ? 'oz' : mlPerServing ? 'ml' : (si.defaultUnit || 'serving');
  return {
    name: m.name, amount, unit,
    calories: m.calories || 0, protein: m.protein || 0, carbs: m.carbs || 0, fat: m.fat || 0,
    fiber: m.fiber || 0, saturated_fat: m.saturated_fat || 0,
  };
}

async function openComboBuilder(dateKey, existing = null, onSaved = null) {
  dateKey = dateKey || todayStr();
  // Loaded once up front so each row's ingredient-name field can live-filter it, the same
  // way the Library picker's own search box does — typing "avoc" should surface your
  // saved "Avocado" immediately instead of requiring the separate 🔍 picker sheet.
  const [{ mealItems }, userMeals] = await Promise.all([loadCatalogs(), getAll('user_meals')]);
  const lib = [...userMeals, ...mealItems].filter(m => m.name && m.kind !== 'recipe' && m.kind !== 'composite');
  openSheet((sheet, close, hooks) => {
    sheet.innerHTML = `
      <h2>${existing ? 'Edit combo' : 'Build a combo meal'}</h2>
      <div class="muted" style="margin-bottom:8px;font-size:13px">Save several measured ingredients as one item — log it in one tap next time, still able to adjust amounts.</div>
      <label>Name</label>
      <input type="text" id="cb-name" placeholder="e.g. Avocado Shake" value="${attrEsc(existing?.name || '')}" autocomplete="off">
      <div id="cb-rows" style="margin-top:10px"></div>
      <button type="button" class="btn secondary" id="cb-add-row">+ Add ingredient</button>
      <div id="cb-total" class="muted" style="margin:12px 0;font-size:14px"></div>
      <div class="btn-row" style="margin-top:6px">
        <button class="btn" id="cb-save">Save combo</button>
        <button class="btn ghost" id="cb-cancel">Cancel</button>
      </div>
    `;
    const $rows = sheet.querySelector('#cb-rows');

    function updateTotal() {
      let cal = 0, p = 0, c = 0, f = 0, fiber = 0, sat = 0;
      $rows.querySelectorAll('.cb-row').forEach(row => {
        cal += numInput(row.querySelector('.cb-i-cal'));
        p   += numInput(row.querySelector('.cb-i-p'));
        c   += numInput(row.querySelector('.cb-i-c'));
        f   += numInput(row.querySelector('.cb-i-f'));
        fiber += parseFloat(row.dataset.fiber) || 0;
        sat   += parseFloat(row.dataset.sat) || 0;
      });
      sheet.querySelector('#cb-total').textContent =
        `Total: ${Math.round(cal)} kcal · ${Math.round(p * 10) / 10}p · ${Math.round(c * 10) / 10}c · ${Math.round(f * 10) / 10}f` +
        (fiber || sat ? ` · fiber ${Math.round(fiber * 10) / 10}g · sat ${Math.round(sat * 10) / 10}g` : '');
    }

    // The row's own "amount ↔ macros" relationship — a picked ingredient's macros are only
    // ever correct for the amount they were picked at, so editing amount has to rescale
    // them the same way wireIngredientRows/scaleIngredient does for a saved combo. Snapshot
    // the current amount+macros as the reference point whenever it's genuinely known (a
    // fresh pick, or the user typing macros in by hand) so the NEXT amount edit has
    // something real to scale from.
    function rebase(row) {
      row.dataset.baseAmount = numInput(row.querySelector('.cb-i-amount'));
      row.dataset.baseCal = numInput(row.querySelector('.cb-i-cal'));
      row.dataset.baseP = numInput(row.querySelector('.cb-i-p'));
      row.dataset.baseC = numInput(row.querySelector('.cb-i-c'));
      row.dataset.baseF = numInput(row.querySelector('.cb-i-f'));
      row.dataset.baseFiber = parseFloat(row.dataset.fiber) || 0;
      row.dataset.baseSat = parseFloat(row.dataset.sat) || 0;
    }

    function rescaleFromBase(row) {
      const base = parseFloat(row.dataset.baseAmount) || 0;
      if (base <= 0) return;  // nothing known to scale from (blank row, no pick yet)
      const newAmount = numInput(row.querySelector('.cb-i-amount'));
      const ratio = newAmount / base;
      row.querySelector('.cb-i-cal').value = Math.round((parseFloat(row.dataset.baseCal) || 0) * ratio);
      row.querySelector('.cb-i-p').value = Math.round((parseFloat(row.dataset.baseP) || 0) * ratio * 10) / 10;
      row.querySelector('.cb-i-c').value = Math.round((parseFloat(row.dataset.baseC) || 0) * ratio * 10) / 10;
      row.querySelector('.cb-i-f').value = Math.round((parseFloat(row.dataset.baseF) || 0) * ratio * 10) / 10;
      row.dataset.fiber = Math.round((parseFloat(row.dataset.baseFiber) || 0) * ratio * 10) / 10;
      row.dataset.sat = Math.round((parseFloat(row.dataset.baseSat) || 0) * ratio * 10) / 10;
    }

    function fillRow(row, picked) {
      row.querySelector('.cb-i-name').value = picked.name;
      row.querySelector('.cb-i-amount').value = picked.amount;
      row.querySelector('.cb-i-unit').value = picked.unit;
      row.querySelector('.cb-i-cal').value = picked.calories;
      row.querySelector('.cb-i-p').value = picked.protein;
      row.querySelector('.cb-i-c').value = picked.carbs;
      row.querySelector('.cb-i-f').value = picked.fat;
      // Fiber/sat fat aren't editable inline (same as openLogServings) but shouldn't be
      // silently dropped when the source actually has them — every combo used to report
      // 0 for both, permanently undercounting daily totals for anyone using combos.
      row.dataset.fiber = picked.fiber || 0;
      row.dataset.sat = picked.saturated_fat || 0;
      rebase(row);
      updateTotal();
    }

    function addRow(ing) {
      const el = document.createElement('div');
      el.innerHTML = comboRowHtml(ing);
      const row = el.firstElementChild;
      $rows.appendChild(row);
      if (ing.amount != null) rebase(row);  // pre-filled row (editing an existing combo)
      row.querySelector('.cb-i-amount').addEventListener('input', () => { rescaleFromBase(row); updateTotal(); });
      ['.cb-i-cal', '.cb-i-p', '.cb-i-c', '.cb-i-f'].forEach(sel =>
        row.querySelector(sel).addEventListener('input', () => { rebase(row); updateTotal(); }));
      row.querySelector('.cb-i-name').addEventListener('input', updateTotal);
      row.querySelector('.cb-i-unit').addEventListener('input', updateTotal);
      row.querySelector('.cb-i-remove').onclick = () => { row.remove(); updateTotal(); };
      row.querySelector('.cb-i-find').onclick = () => {
        openIngredientPicker(dateKey, (picked) => {
          fillRow(row, picked);
          // The picker's scan/search/library chain closes each of its own hops with
          // syncHistory=false (so it doesn't fight the next sheet's pushState) and never
          // resyncs on its own — left alone, this combo builder's *own* eventual close()
          // would never fire its history.back(), permanently leaking those entries.
          hooks.resyncHistory();
        });
      };

      // Typeahead — live-filters the same Library data the picker's "My Library" option
      // browses, so the common case (already-saved ingredient) doesn't need the extra
      // sheet at all: type a few letters, tap the match, done.
      const $name = row.querySelector('.cb-i-name');
      const $suggest = row.querySelector('.cb-i-suggest');
      function hideSuggest() { $suggest.style.display = 'none'; $suggest.innerHTML = ''; }
      $name.addEventListener('input', () => {
        const q = $name.value.trim().toLowerCase();
        if (q.length < 2) { hideSuggest(); return; }
        const matches = lib.filter(m => m.name.toLowerCase().includes(q)).slice(0, 6);
        if (!matches.length) { hideSuggest(); return; }
        $suggest.innerHTML = matches.map((m, i) => `
          <div class="cb-suggest-item" data-i="${i}" style="padding:8px 10px;cursor:pointer;border-bottom:1px solid var(--border)">
            <div style="font-size:14px">${attrEsc(m.name)}</div>
            <div class="muted" style="font-size:12px">${m.serving ? attrEsc(m.serving) + ' · ' : ''}${m.calories || 0} kcal</div>
          </div>
        `).join('');
        $suggest.style.display = 'block';
        $suggest.querySelectorAll('.cb-suggest-item').forEach(el => {
          el.onmousedown = (e) => e.preventDefault();  // fire before the input's blur hides the list
          el.onclick = () => { fillRow(row, libItemToRowFill(matches[+el.dataset.i])); hideSuggest(); };
        });
      });
      $name.addEventListener('blur', () => setTimeout(hideSuggest, 150));
    }

    (existing?.ingredients?.length ? existing.ingredients : [{}, {}]).forEach(addRow);
    updateTotal();

    sheet.querySelector('#cb-add-row').onclick = () => addRow({});
    sheet.querySelector('#cb-cancel').onclick = close;
    sheet.querySelector('#cb-save').onclick = async () => {
      const name = sheet.querySelector('#cb-name').value.trim();
      if (!name) { toast('Enter a name for this combo'); return; }
      const ingredients = [...$rows.querySelectorAll('.cb-row')].map(row => ({
        name: row.querySelector('.cb-i-name').value.trim(),
        amount: numInput(row.querySelector('.cb-i-amount'), 1),
        unit: row.querySelector('.cb-i-unit').value.trim(),
        calories: numInput(row.querySelector('.cb-i-cal')),
        protein: numInput(row.querySelector('.cb-i-p')),
        carbs: numInput(row.querySelector('.cb-i-c')),
        fat: numInput(row.querySelector('.cb-i-f')),
        fiber: parseFloat(row.dataset.fiber) || 0,
        saturated_fat: parseFloat(row.dataset.sat) || 0,
      })).filter(ing => ing.name);
      if (!ingredients.length) { toast('Add at least one ingredient'); return; }
      const totals = ingredients.reduce((t, i) => ({
        cal: t.cal + i.calories, p: t.p + i.protein, c: t.c + i.carbs, f: t.f + i.fat,
        fiber: t.fiber + i.fiber, sat: t.sat + i.saturated_fat,
      }), { cal: 0, p: 0, c: 0, f: 0, fiber: 0, sat: 0 });
      await saveToLibrary({
        ...(existing?.id ? { id: existing.id } : {}),
        name,
        serving: `${ingredients.length} ingredient${ingredients.length > 1 ? 's' : ''}`,
        calories: Math.round(totals.cal),
        protein: Math.round(totals.p * 10) / 10,
        carbs: Math.round(totals.c * 10) / 10,
        fat: Math.round(totals.f * 10) / 10,
        fiber: Math.round(totals.fiber * 10) / 10,
        saturated_fat: Math.round(totals.sat * 10) / 10,
        ingredients,
        category: 'user',
        kind: 'composite',
      });
      toast(`Saved "${name}"`);
      close();
      onSaved?.();
    };
  });
}

/** Scale one ingredient's macros by amount ÷ its saved default amount. */
function scaleIngredient(ing, newAmount) {
  const ratio = ing.amount > 0 ? newAmount / ing.amount : 0;
  return {
    calories: Math.round((ing.calories || 0) * ratio),
    protein: Math.round((ing.protein || 0) * ratio * 10) / 10,
    carbs: Math.round((ing.carbs || 0) * ratio * 10) / 10,
    fat: Math.round((ing.fat || 0) * ratio * 10) / 10,
    fiber: Math.round((ing.fiber || 0) * ratio * 10) / 10,
    saturated_fat: Math.round((ing.saturated_fat || 0) * ratio * 10) / 10,
  };
}

function renderIngredientRows(ingredients) {
  return ingredients.map((ing, i) => `
    <div class="cd-row" data-idx="${i}" style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <div style="flex:1;min-width:0">
        <div style="font-size:14px">${attrEsc(ing.name)}</div>
        <div class="muted cd-row-macros" style="font-size:12px"></div>
      </div>
      <input type="number" class="cd-i-amount" inputmode="decimal" value="${ing.amount ?? 0}" style="width:70px;flex-shrink:0">
      <span class="muted" style="font-size:12px;flex-shrink:0">${attrEsc(ing.unit || '')}</span>
    </div>
  `).join('');
}

/**
 * Wires live per-line + running-total recalculation for ingredient rows already in the
 * sheet (from `renderIngredientRows`). Each line rescales against its OWN saved `amount`
 * (never the last-typed value), so edits don't compound the way the old per-serving-grams
 * rescale bug did. Returns a function that reads the currently-resolved ingredients+totals
 * on demand, shared between the "log a saved combo" and "edit an already-logged combo" sheets.
 */
function wireIngredientRows(sheet, ingredients, onUpdate) {
  const $rows = sheet.querySelector('#cd-rows');
  function resolve() {
    return ingredients.map((ing, i) => {
      const row = $rows.querySelector(`.cd-row[data-idx="${i}"]`);
      const amt = numInput(row.querySelector('.cd-i-amount'), ing.amount);
      return { ...ing, amount: amt, ...scaleIngredient(ing, amt) };
    });
  }
  function totalsOf(resolved) {
    return resolved.reduce((t, i) => ({
      cal: t.cal + i.calories, p: t.p + i.protein, c: t.c + i.carbs, f: t.f + i.fat,
      fiber: t.fiber + (i.fiber || 0), sat: t.sat + (i.saturated_fat || 0),
    }), { cal: 0, p: 0, c: 0, f: 0, fiber: 0, sat: 0 });
  }
  function update() {
    const resolved = resolve();
    resolved.forEach((s, i) => {
      $rows.querySelector(`.cd-row[data-idx="${i}"] .cd-row-macros`).textContent =
        `${s.calories} kcal · ${s.protein}p · ${s.carbs}c · ${s.fat}f`;
    });
    const t = totalsOf(resolved);
    sheet.querySelector('#cd-total').textContent =
      `Total: ${Math.round(t.cal)} kcal · ${Math.round(t.p * 10) / 10}p · ${Math.round(t.c * 10) / 10}c · ${Math.round(t.f * 10) / 10}f` +
      (t.fiber || t.sat ? ` · fiber ${Math.round(t.fiber * 10) / 10}g · sat ${Math.round(t.sat * 10) / 10}g` : '');
    onUpdate?.();
  }
  $rows.querySelectorAll('.cd-i-amount').forEach(inp => inp.addEventListener('input', update));
  update();
  return () => {
    const resolved = resolve();
    return { resolved, totals: totalsOf(resolved) };
  };
}

/** Log a saved combo — each ingredient's amount defaults from the save but is editable,
 * and rescales that line (and the running total) independently of the others. */
function openCompositeDetail(item, parentClose, dateKey) {
  dateKey = dateKey || todayStr();
  const ingredients = item.ingredients || [];
  openSheet((sheet, close) => {
    sheet.innerHTML = `
      <h2>${attrEsc(item.name)}</h2>
      <div class="muted" style="margin-bottom:10px;font-size:13px">Adjust any ingredient's amount — the total updates as you go.</div>
      <div id="cd-rows">${renderIngredientRows(ingredients)}</div>
      <div id="cd-total" class="muted" style="margin:10px 0;font-size:14px"></div>
      <label style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:14px">
        <input type="checkbox" id="cd-update-defaults" style="width:auto;min-height:auto"> Update saved amounts with these changes
      </label>
      <div class="btn-row" style="margin-top:8px">
        <button class="btn" id="cd-log">Log</button>
        <button class="btn ghost" id="cd-cancel">Cancel</button>
      </div>
    `;
    const getResolved = wireIngredientRows(sheet, ingredients);
    sheet.querySelector('#cd-cancel').onclick = close;
    sheet.querySelector('#cd-log').onclick = async () => {
      const { resolved, totals } = getResolved();
      await put('meals', {
        date: dateKey,
        name: item.name,
        servings: 1,
        serving: `${resolved.length} ingredients`,
        calories: Math.round(totals.cal),
        protein: Math.round(totals.p * 10) / 10,
        carbs: Math.round(totals.c * 10) / 10,
        fat: Math.round(totals.f * 10) / 10,
        fiber: Math.round(totals.fiber * 10) / 10,
        saturated_fat: Math.round(totals.sat * 10) / 10,
        ingredients: resolved,
        comboId: item.id ?? null,
        time: new Date().toISOString(),
      });
      if (sheet.querySelector('#cd-update-defaults')?.checked) {
        await saveToLibrary({
          id: item.id,
          name: item.name,
          serving: `${resolved.length} ingredients`,
          calories: Math.round(totals.cal),
          protein: Math.round(totals.p * 10) / 10,
          carbs: Math.round(totals.c * 10) / 10,
          fat: Math.round(totals.f * 10) / 10,
          fiber: Math.round(totals.fiber * 10) / 10,
          saturated_fat: Math.round(totals.sat * 10) / 10,
          ingredients: resolved,
          category: 'user',
          kind: 'composite',
        });
      }
      toast(`Logged ${item.name}`);
      close();
      if (parentClose) parentClose();
      renderMeals(document.getElementById('app'));
    };
  });
}

/** Edit an already-logged combo entry — same per-ingredient override UI as logging one,
 * but updates the existing `meals` record in place instead of creating a new entry. */
function openLoggedComboEdit(m, dateKey) {
  const ingredients = m.ingredients || [];
  openSheet((sheet, close) => {
    sheet.innerHTML = `
      <h2>${attrEsc(m.name)}</h2>
      <div class="muted" style="margin-bottom:10px;font-size:13px">Adjust any ingredient's amount — the total updates as you go.</div>
      <div id="cd-rows">${renderIngredientRows(ingredients)}</div>
      <div id="cd-total" class="muted" style="margin:10px 0;font-size:14px"></div>
      ${m.comboId != null ? `
      <label style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:14px">
        <input type="checkbox" id="cd-update-defaults" style="width:auto;min-height:auto"> Update the saved combo's default amounts too
      </label>` : ''}
      <div class="btn-row" style="margin-top:8px">
        <button class="btn" id="cd-save">Save</button>
        <button class="btn ghost" id="cd-cancel">Cancel</button>
      </div>
    `;
    const getResolved = wireIngredientRows(sheet, ingredients);
    sheet.querySelector('#cd-cancel').onclick = close;
    sheet.querySelector('#cd-save').onclick = async () => {
      const { resolved, totals } = getResolved();
      await put('meals', {
        ...m,
        serving: `${resolved.length} ingredients`,
        calories: Math.round(totals.cal),
        protein: Math.round(totals.p * 10) / 10,
        carbs: Math.round(totals.c * 10) / 10,
        fat: Math.round(totals.f * 10) / 10,
        fiber: Math.round(totals.fiber * 10) / 10,
        saturated_fat: Math.round(totals.sat * 10) / 10,
        ingredients: resolved,
      });
      if (m.comboId != null && sheet.querySelector('#cd-update-defaults')?.checked) {
        await saveToLibrary({
          id: m.comboId,
          name: m.name,
          serving: `${resolved.length} ingredients`,
          calories: Math.round(totals.cal),
          protein: Math.round(totals.p * 10) / 10,
          carbs: Math.round(totals.c * 10) / 10,
          fat: Math.round(totals.f * 10) / 10,
          fiber: Math.round(totals.fiber * 10) / 10,
          saturated_fat: Math.round(totals.sat * 10) / 10,
          ingredients: resolved,
          category: 'user',
          kind: 'composite',
        });
      }
      toast('Updated');
      close();
      renderMeals(document.getElementById('app'));
    };
  });
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
      const s = numInput(sheet.querySelector('#srv'), 1);
      sheet.querySelector('#preview').textContent =
        `Total: ${Math.round(cur.calories * s)} kcal · ${Math.round((cur.protein_g || 0) * s * 10) / 10}p · ${Math.round((cur.carbs_g || 0) * s * 10) / 10}c · ${Math.round((cur.fat_g || 0) * s * 10) / 10}f`;
    }
    updateMacros();
    update();
    sheet.querySelector('#srv').oninput = update;
    sheet.querySelector('#cancel').onclick = close;
    sheet.querySelector('#log').onclick = async () => {
      const s = numInput(sheet.querySelector('#srv'), 1);
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
function openProductFromLookup({ name, nut, barcode }, dateKey, onPick) {
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
  openLogServings(item, null, dateKey, onPick);
}

/* ── Log a food/user item with servings ── */

function openLogServings(item, parentClose, dateKey, onPick) {
  dateKey = dateKey || todayStr();
  const si = item._servingInfo || parseServingInfo(item.serving);
  openSheet((sheet, close) => {
    sheet.innerHTML = `
      <h2>${attrEsc(item.name)}</h2>
      ${item.nutritionNote ? `<div class="muted" style="margin-bottom:8px;padding:8px 10px;background:var(--bg-input);border-radius:8px;color:var(--warn)">${attrEsc(item.nutritionNote)}</div>` : ''}
      <div class="muted" style="margin-bottom:4px;font-size:12px">Nutrition per serving (edit if scanned values look wrong)</div>
      <div style="display:flex;gap:6px;margin-bottom:8px">
        <div style="flex:1"><label style="font-size:11px">Cal</label><input type="number" id="log-cal" inputmode="decimal" value="${item.calories || 0}"></div>
        <div style="flex:1"><label style="font-size:11px">Protein</label><input type="number" id="log-prot" inputmode="decimal" value="${item.protein || 0}"></div>
        <div style="flex:1"><label style="font-size:11px">Carbs</label><input type="number" id="log-carb" inputmode="decimal" value="${item.carbs || 0}"></div>
        <div style="flex:1"><label style="font-size:11px">Fat</label><input type="number" id="log-fat" inputmode="decimal" value="${item.fat || 0}"></div>
      </div>
      ${servingFieldsHtml('log', item.serving || '1 serving', si, { servings: 1 })}
      <div id="preview" class="muted" style="margin-top:6px;font-size:13px"></div>
      ${!item.id || item.barcode ? `
        <label style="display:flex;align-items:center;gap:8px;margin-top:10px;font-size:14px">
          <input type="checkbox" id="save-lib" ${item.barcode ? 'checked' : ''}> Save to my library
        </label>` : ''}
      <div class="btn-row" style="margin-top:14px">
        <button class="btn" id="log">${onPick ? 'Add to combo' : 'Log'}</button>
        <button class="btn ghost" id="cancel">Cancel</button>
      </div>
    `;
    function getMacros() {
      return {
        cal: numInput(sheet.querySelector('#log-cal')),
        prot: numInput(sheet.querySelector('#log-prot')),
        carb: numInput(sheet.querySelector('#log-carb')),
        fat: numInput(sheet.querySelector('#log-fat')),
      };
    }
    function update() {
      const s = numInput(sheet.querySelector('#log-srv'), 1);
      const m = getMacros();
      sheet.querySelector('#preview').textContent =
        `Total: ${Math.round(m.cal * s)} kcal · ${Math.round(m.prot * s * 10) / 10}p · ${Math.round(m.carb * s * 10) / 10}c · ${Math.round(m.fat * s * 10) / 10}f`;
    }
    wireServingFields(sheet, 'log', update);
    wireServingSizeRescale(sheet, 'log', si, ['cal', 'prot', 'carb', 'fat'], update);
    ['#log-cal', '#log-prot', '#log-carb', '#log-fat'].forEach(id => {
      sheet.querySelector(id)?.addEventListener('input', update);
    });

    update();
    sheet.querySelector('#cancel').onclick = close;
    async function maybeSaveToLibrary(m, servingLabel) {
      if (!sheet.querySelector('#save-lib')?.checked) return;
      await saveToLibrary({
        name: item.name,
        serving: servingLabel || '1 serving',
        calories: m.cal,
        protein: m.prot,
        carbs: m.carb,
        fat: m.fat,
        fiber: item.fiber || 0,
        saturated_fat: item.saturated_fat || 0,
        barcode: item.barcode,
        category: 'user',
        kind: 'user',
      });
    }
    sheet.querySelector('#log').onclick = async () => {
      const s = numInput(sheet.querySelector('#log-srv'), 1);
      const m = getMacros();
      const servingLabel = sheet.querySelector('#log-srvlbl')?.value.trim() || item.serving;
      if (onPick) {
        // Picking this item as an ingredient for a combo — don't log it to today, hand
        // its resolved amount/macros back to the row that asked for it. Still offer to
        // save it to the library (checked by default for a scan) so a newly-scanned
        // ingredient is reusable on its own too, not just trapped inside this combo.
        await maybeSaveToLibrary(m, servingLabel);
        const unit = sheet.querySelector('#log-unit-select')?.value || 'oz';
        const amtField = sheet.querySelector('#log-amt');
        const amount = numInput(amtField) > 0 ? numInput(amtField) : numInput(sheet.querySelector('#log-per'), 1);
        onPick({
          name: item.name,
          amount,
          unit,
          calories: Math.round(m.cal * s),
          protein: Math.round(m.prot * s * 10) / 10,
          carbs: Math.round(m.carb * s * 10) / 10,
          fat: Math.round(m.fat * s * 10) / 10,
          fiber: Math.round((item.fiber || 0) * s * 10) / 10,
          saturated_fat: Math.round((item.saturated_fat || 0) * s * 10) / 10,
        });
        // syncHistory=false on both: this is unwinding 2+ nested picker sheets back down
        // to the combo builder underneath, not a user back-navigation. `close()`'s default
        // (true) calls history.back(), and firing that from two sheets in the same tick
        // fires stray popstate events that the *outer* combo-builder sheet's own listener
        // also reacts to — closing a sheet nobody asked to close. false avoids that entirely.
        close(false);
        if (parentClose) parentClose(false);
        return;
      }
      await put('meals', {
        date: dateKey,
        name: item.name,
        servings: s,
        serving: servingLabel,
        calories: Math.round(m.cal * s),
        protein:  Math.round(m.prot * s * 10) / 10,
        carbs:    Math.round(m.carb * s * 10) / 10,
        fat:      Math.round(m.fat * s * 10) / 10,
        fiber:    Math.round((item.fiber || 0) * s * 10) / 10,
        saturated_fat: Math.round((item.saturated_fat || 0) * s * 10) / 10,
        time: new Date().toISOString(),
      });
      await maybeSaveToLibrary(m, servingLabel);
      toast(`Logged ${item.name}`);
      close();
      if (parentClose) parentClose();
      renderMeals(document.getElementById('app'));
    };
    setTimeout(() => sheet.querySelector('#log-amt')?.focus(), 100);
  });
}

/* ── Barcode scanner ── */

function openBarcodeScanner(dateKey, onPick) {
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
    let scanning = false;

    async function lookupBarcode(code) {
      status.textContent = `Looking up ${code}…`;
      try {
        // A previously-scanned-and-corrected item takes priority over the network — a bad
        // Open Food Facts parse fixed once and saved shouldn't repeat itself every rescan.
        const codes = barcodeLookupCodes(code);
        const saved = (await getAll('user_meals')).find(m => m.barcode && codes.includes(m.barcode));
        if (saved) {
          cleanup();
          close(false);
          openLogServings({
            id: saved.id,
            name: saved.name,
            serving: saved.serving,
            calories: saved.calories,
            protein: saved.protein,
            carbs: saved.carbs,
            fat: saved.fat,
            fiber: saved.fiber,
            saturated_fat: saved.saturated_fat,
            barcode: saved.barcode,
          }, null, dateKey, onPick);
          return;
        }
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
        }, dateKey, onPick);
      } catch (e) {
        console.error('[scan] lookup failed', e);
        toast(`Lookup failed: ${e.message}`);
        status.textContent = `Error — check your connection or try manual entry.`;
      }
    }

    function cleanup() {
      scanning = false; // stop the tick() detection loop — otherwise it reschedules itself
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
        scanning = true;
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

function openFoodSearch(dateKey, initialQuery = '', onPick) {
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
        // Cross-origin, not same-origin: this app is static, served from GitHub Pages
        // (rcarrier32.github.io/fit-tracker), which can't run server code — so the one
        // proxy function this needs (api/off-search.js) lives on Vercel instead, called
        // here by absolute URL. It forwards to Open Food Facts server-side; a direct
        // browser fetch to OFF's own search API is blocked by CORS (it sends no
        // Access-Control-Allow-Origin header) regardless of which origin calls it.
        const r = await fetch(`${OFF_SEARCH_PROXY}?q=${encodeURIComponent(q)}`);
        if (!r.ok) throw new Error(`Server error ${r.status}`);
        const j = await r.json();
        const products = j.hits || [];
        if (!products.length) {
          $res.innerHTML = '<div class="empty"><div>No results</div></div>';
          return;
        }
        $res.innerHTML = products.map(p => {
          const n = p.nutriments || {};
          const cal = n['energy-kcal_100g'] || n['energy-kcal_serving'];
          const name = (p.product_name || p.generic_name || 'Unknown').replace(/</g, '&lt;');
          const brands = (Array.isArray(p.brands) ? p.brands.join(', ') : (p.brands || '')).replace(/</g, '&lt;');
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
              }, dateKey, onPick);
            } catch (err) {
              toast(`Lookup failed: ${err.message}`);
            }
          };
        });
      } catch (e) {
        $res.innerHTML = `<div class="muted">Search failed: ${e.message}. Try <b>Library</b> for saved foods, or <b>Scan</b> a barcode instead.</div>`;
      }
    }
    sheet.querySelector('#off-go').onclick = run;
    $q.addEventListener('keydown', e => { if (e.key === 'Enter') run(); });
    if (initialQuery) run();
    else setTimeout(() => $q.focus(), 100);
  });
}

function openEditUserMeal(item, onUpdated) {
  const si = parseServingInfo(item.serving);
  openSheet((sheet, close) => {
    sheet.innerHTML = `
      <h2>${item.id != null ? 'Edit saved food' : 'Save a copy to my library'}</h2>
      <label>Name</label>
      <input type="text" id="u-name" value="${attrEsc(item.name)}" autocomplete="off">
      ${servingFieldsHtml('u', item.serving || '1 serving', si, { servings: 1, focusAmount: false })}
      <div class="muted" style="font-size:12px;margin:-4px 0 10px">Changing "Per serving" rescales the macros below to match.</div>
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
        ${item.id != null ? '<button class="btn ghost" id="u-del">Delete</button>' : ''}
        <button class="btn ghost" id="u-cancel">Cancel</button>
      </div>
    `;
    // "How much did you eat"/Servings don't apply to editing a library default — hide
    // them, but still run wireServingFields for its unit-switch/conversion wiring.
    sheet.querySelector('#u-amt-lbl')?.style.setProperty('display', 'none');
    sheet.querySelector('#u-amt')?.style.setProperty('display', 'none');
    sheet.querySelector('#u-srv-disp')?.closest('div')?.style.setProperty('display', 'none');
    wireServingFields(sheet, 'u', () => {});
    wireServingSizeRescale(sheet, 'u', si, ['cal', 'p', 'c', 'f', 'fiber', 'sat']);

    sheet.querySelector('#u-cancel').onclick = close;
    sheet.querySelector('#u-save').onclick = async () => {
      await put('user_meals', {
        ...item,
        name: sheet.querySelector('#u-name').value.trim() || 'Food',
        serving: sheet.querySelector('#u-srvlbl').value.trim() || '1 serving',
        calories: numInput(sheet.querySelector('#u-cal')),
        protein: numInput(sheet.querySelector('#u-p')),
        carbs: numInput(sheet.querySelector('#u-c')),
        fat: numInput(sheet.querySelector('#u-f')),
        fiber: numInput(sheet.querySelector('#u-fiber')),
        saturated_fat: numInput(sheet.querySelector('#u-sat')),
        category: 'user',
        kind: 'user',
      });
      toast('Saved');
      close();
      onUpdated?.();
    };
    sheet.querySelector('#u-del')?.addEventListener('click', async () => {
      if (!confirm(`Delete "${item.name}" from your library?`)) return;
      await del('user_meals', item.id);
      toast('Deleted');
      close();
      onUpdated?.();
    });
  });
}
