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

const todayStr = () => new Date().toISOString().slice(0, 10);

let _activeDate = null; // null = today

export async function renderMeals(app, date) {
  if (date) _activeDate = date;
  const dateKey = _activeDate || todayStr();
  const isToday = dateKey === todayStr();
  const meals = await getByIndex('meals', 'date', dateKey);
  const { pref } = await import('../db.js');
  const userProfile = (await pref('profile')) || {};
  const sums = meals.reduce((s, m) => ({
    cal: s.cal + (m.calories || 0),
    p:   s.p   + (m.protein  || 0),
    c:   s.c   + (m.carbs    || 0),
    f:   s.f   + (m.fat      || 0),
  }), { cal: 0, p: 0, c: 0, f: 0 });

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

    ${targets ? `
    <div class="card" style="padding:10px 12px;margin-bottom:10px">
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;text-align:center">
        ${macroCell('Cal', Math.round(sums.cal), targets.cal)}
        ${macroCell('Protein', Math.round(sums.p), targets.p, 'g')}
        ${macroCell('Carbs', Math.round(sums.c), targets.c, 'g')}
        ${macroCell('Fat', Math.round(sums.f), targets.f, 'g')}
      </div>
    </div>` : `<div class="muted" style="margin-bottom:10px">${Math.round(sums.cal)} kcal · ${Math.round(sums.p)}p · ${Math.round(sums.c)}c · ${Math.round(sums.f)}f</div>`}

    <div class="btn-row" style="margin:0 0 12px">
      <button class="btn" data-action="quick">+ Quick add</button>
      <button class="btn secondary" data-action="library">Library</button>
      <button class="btn secondary" data-action="scan">📷 Scan</button>
    </div>
    <div id="meal-list"></div>
  `;

  renderList(app.querySelector('#meal-list'), meals, dateKey);

  app.querySelector('[data-action="quick"]').onclick = () => openQuickAdd({}, dateKey);
  app.querySelector('[data-action="library"]').onclick = () => openLibraryPicker(dateKey);
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
    node.innerHTML = `
      <div style="flex:1">
        <div class="list-item-title">${m.name}</div>
        <div class="list-item-meta">${m.calories || 0} kcal · ${m.protein || 0}p · ${m.carbs || 0}c · ${m.fat || 0}f${m.servings && m.servings !== 1 ? ` · ${m.servings}×` : ''}</div>
      </div>
      <button class="btn ghost" data-id="${m.id}" style="width:auto;padding:6px 10px">✕</button>
    `;
    node.querySelector('button').onclick = async (e) => {
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

/* ── Quick Add (with servings + barcode link) ── */

function openQuickAdd(prefill = {}, dateKey) {
  dateKey = dateKey || todayStr();
  openSheet((sheet, close) => {
    const base = {
      name:     prefill.name     || '',
      calories: prefill.calories || 0,
      protein:  prefill.protein  || 0,
      carbs:    prefill.carbs    || 0,
      fat:      prefill.fat      || 0,
      serving:  prefill.serving  || '1 serving',
    };
    sheet.innerHTML = `
      <h2>Quick add</h2>
      <div class="muted" style="margin-bottom:8px">Enter values per serving — log multiplies by servings consumed.</div>
      <label>Name</label>
      <input type="text" id="m-name" value="${base.name}" autocomplete="off" placeholder="e.g. Chicken & rice">
      <label>Serving size (label, optional)</label>
      <input type="text" id="m-srvlbl" value="${base.serving}" placeholder="e.g. 4 oz, 1 cup">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
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
      </div>
      <label>Servings consumed</label>
      <input type="number" id="m-srv" value="1" step="0.25" inputmode="decimal">
      <div id="preview" class="muted" style="margin-top:6px;font-size:13px"></div>

      <label style="display:flex;align-items:center;gap:8px;margin-top:12px">
        <input type="checkbox" id="m-fav" style="width:auto;min-height:auto"> Save to my library
      </label>
      <div class="btn-row" style="margin-top:14px">
        <button class="btn" id="m-save">Log</button>
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
      $('#preview').textContent = `Total: ${Math.round(c * s)} kcal · ${Math.round(p * s * 10) / 10}p · ${Math.round(cb * s * 10) / 10}c · ${Math.round(f * s * 10) / 10}f`;
    }
    sheet.addEventListener('input', e => {
      if (e.target.matches('input[type="number"]')) update();
    });
    update();
    $('#m-cancel').onclick = close;
    $('#m-scan').onclick = (e) => { e.preventDefault(); close(); openBarcodeScanner(); };
    $('#m-save').onclick = async () => {
      const s = +$('#m-srv').value || 1;
      const meal = {
        date: dateKey,
        name: $('#m-name').value.trim() || 'Meal',
        serving: $('#m-srvlbl').value.trim() || undefined,
        servings: s,
        calories: Math.round((+$('#m-cal').value || 0) * s),
        protein:  Math.round((+$('#m-p').value || 0) * s * 10) / 10,
        carbs:    Math.round((+$('#m-c').value || 0) * s * 10) / 10,
        fat:      Math.round((+$('#m-f').value || 0) * s * 10) / 10,
        time: new Date().toISOString(),
      };
      await put('meals', meal);
      if ($('#m-fav').checked) {
        await put('user_meals', {
          name: meal.name,
          serving: meal.serving,
          calories: +$('#m-cal').value || 0,
          protein: +$('#m-p').value || 0,
          carbs: +$('#m-c').value || 0,
          fat: +$('#m-f').value || 0,
          category: 'user',
          kind: 'user',
        });
      }
      toast('Logged');
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

async function openLibraryPicker(dateKey) {
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
      <h2>Library</h2>
      <div id="recents"></div>
      <div class="search-bar"><input type="text" id="search" placeholder="Search meals or foods..." autocomplete="off"></div>
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
        <div class="list-item" data-id="${m.id}">
          <div style="flex:1">
            <div class="list-item-title">${m.name || '(unnamed)'}</div>
            <div class="list-item-meta">${m.serving ? m.serving + ' · ' : ''}${m.calories} kcal · ${m.protein}p${m.carbs ? ' · ' + m.carbs + 'c' : ''}${m.fat ? ' · ' + m.fat + 'f' : ''}</div>
          </div>
          <span class="pill ${m.kind === 'recipe' ? '' : 'accent'}">${m.kind === 'recipe' ? '→' : '+ Log'}</span>
        </div>
      `).join('');
      $meals.querySelectorAll('.list-item').forEach(item => {
        item.onclick = () => {
          const m = lib.find(x => String(x.id) === item.dataset.id);
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
    render();
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

/* ── Log a food/user item with servings ── */

function openLogServings(item, parentClose, dateKey) {
  dateKey = dateKey || todayStr();
  // Parse serving grams from strings like "100g", "28g", "1 oz (28g)"
  const gramMatch = (item.serving || '').match(/(\d+\.?\d*)\s*g\b/i);
  const gramsPerServing = gramMatch ? parseFloat(gramMatch[1]) : null;

  openSheet((sheet, close) => {
    sheet.innerHTML = `
      <h2>${item.name}</h2>
      <div class="muted" style="margin-bottom:8px">Per ${item.serving || '1 serving'}: ${item.calories} kcal · ${item.protein}p · ${item.carbs || 0}c · ${item.fat || 0}f</div>
      ${gramsPerServing ? `
        <label>Amount (grams)</label>
        <input type="number" id="grams" inputmode="decimal" placeholder="e.g. 150">
        <div class="muted" style="font-size:12px;margin-bottom:8px">${gramsPerServing}g per serving — enter grams to auto-calculate servings</div>
      ` : ''}
      <label>Servings</label>
      <input type="number" id="srv" value="1" step="0.25" inputmode="decimal">
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
      const s = +sheet.querySelector('#srv').value || 1;
      sheet.querySelector('#preview').textContent =
        `Total: ${Math.round(item.calories * s)} kcal · ${Math.round((item.protein || 0) * s * 10) / 10}p · ${Math.round((item.carbs || 0) * s * 10) / 10}c · ${Math.round((item.fat || 0) * s * 10) / 10}f`;
    }
    const $srv = sheet.querySelector('#srv');
    const $grams = sheet.querySelector('#grams');
    if ($grams) {
      $grams.oninput = () => {
        const g = parseFloat($grams.value);
        if (g && gramsPerServing) {
          $srv.value = Math.round((g / gramsPerServing) * 100) / 100;
          update();
        }
      };
    }
    $srv.oninput = update;
    update();
    sheet.querySelector('#cancel').onclick = close;
    sheet.querySelector('#log').onclick = async () => {
      const s = +$srv.value || 1;
      await put('meals', {
        date: dateKey,
        name: item.name,
        servings: s,
        serving: item.serving,
        calories: Math.round(item.calories * s),
        protein:  Math.round((item.protein || 0) * s * 10) / 10,
        carbs:    Math.round((item.carbs || 0) * s * 10) / 10,
        fat:      Math.round((item.fat || 0) * s * 10) / 10,
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
    setTimeout(() => ($grams || $srv).focus(), 100);
  });
}

/* ── Barcode scanner ── */

function openBarcodeScanner(dateKey) {
  dateKey = dateKey || todayStr();
  openSheet((sheet, close) => {
    sheet.innerHTML = `
      <h2>Scan barcode</h2>
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
        const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`);
        if (!r.ok) throw new Error(`Server error ${r.status}`);
        const j = await r.json();
        if (j.status !== 1) {
          toast(`Not found: ${code}`);
          status.textContent = `Not found — try manual entry.`;
          return;
        }
        const p = j.product;
        const n = p.nutriments || {};
        const serving = p.serving_size || '100g';
        const cal = n['energy-kcal_serving'] ?? n['energy-kcal_100g'];
        const prot = n['proteins_serving'] ?? n['proteins_100g'];
        const carb = n['carbohydrates_serving'] ?? n['carbohydrates_100g'];
        const fat = n['fat_serving'] ?? n['fat_100g'];
        cleanup();
        close();
        openLogServings({
          name: p.product_name || p.brands || `Product ${code}`,
          serving: serving,
          calories: cal ? Math.round(cal) : 0,
          protein: prot ? Math.round(prot * 10) / 10 : 0,
          carbs: carb ? Math.round(carb * 10) / 10 : 0,
          fat: fat ? Math.round(fat * 10) / 10 : 0,
          barcode: code,
        }, null, dateKey);
      } catch (e) {
        toast(`Lookup failed: ${e.message}`);
        status.textContent = `Error — check your connection or try manual entry.`;
      }
    }

    function cleanup() {
      if (stream) stream.getTracks().forEach(t => t.stop());
    }

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
          if (!window.ZXing) {
            await new Promise((res, rej) => {
              const s = document.createElement('script');
              s.src = 'https://unpkg.com/@zxing/browser@0.1.5/umd/index.min.js';
              s.onload = res; s.onerror = rej;
              document.head.appendChild(s);
            });
          }
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
          const reader = new ZXing.BrowserMultiFormatReader();
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

    sheet.parentElement.addEventListener('click', e => {
      if (e.target === sheet.parentElement) cleanup();
    });
  });
}
