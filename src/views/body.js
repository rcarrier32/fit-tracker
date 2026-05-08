/**
 * Body view: log weight + body comp daily, view trend chart.
 */
import { put, get, getAll, pref } from '../db.js';
import { profile, actualTdeeForWeek, bfPctNavy } from '../lib/tdee.js';
import { toast } from '../app.js';

const todayStr = () => new Date().toISOString().slice(0, 10);
const ymd = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d); };
let _bodyDate = null;

export async function renderBody(app, date) {
  if (date) _bodyDate = date;
  const dateKey = _bodyDate || todayStr();
  const isToday = dateKey === todayStr();
  const all = (await getAll('body')).sort((a, b) => a.date.localeCompare(b.date));
  const todayLog = await get('body', dateKey);
  const userProfile = (await pref('profile')) || {};

  const rolling7 = rollingAverage(all, 7);
  const rolling7display = rolling7 ? rolling7.toFixed(1) : null;

  const dateLabel = isToday ? 'Today' : new Date(dateKey + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

  app.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
      <h1 style="margin:0;flex:1">Body</h1>
      <button class="btn ghost" id="prev-day" style="width:auto;padding:6px 10px">‹</button>
      <span style="font-size:14px;font-weight:600;min-width:80px;text-align:center">${dateLabel}</span>
      <button class="btn ghost" id="next-day" style="width:auto;padding:6px 10px" ${isToday ? 'disabled' : ''}>›</button>
    </div>
    <div class="muted" style="margin-bottom:12px">Morning weigh-in — after bathroom, before food</div>

    <div class="card">
      <label>Weight (lb)</label>
      <input type="number" id="w" inputmode="decimal" step="0.1" value="${todayLog?.weight_lb ?? ''}" placeholder="${userProfile.weight_lb || ''}">
      <label>Notes (optional)</label>
      <input type="text" id="n" value="${todayLog?.notes ?? ''}" placeholder="e.g. salty meal yesterday">
      <button class="btn" id="save" style="margin-top:14px">${todayLog ? 'Update' : 'Log'} ${isToday ? 'today' : dateLabel}</button>
    </div>

    ${rolling7display ? `
    <div class="card">
      <div class="card-row">
        <h2 style="margin:0">7-Day Average</h2>
        <span class="pill accent">${rolling7display} lb</span>
      </div>
      <div class="muted">Smooths out daily fluctuations — this is your real trend number.</div>
    </div>` : ''}

    ${all.length >= 2 ? renderTrendCard(all, userProfile) : ''}
    ${all.length >= 7 ? await renderWeeklyCard(all) : ''}

    <h2 style="margin-top:16px">Body Fat Estimate</h2>
    <div class="card">
      <div class="muted" style="margin-bottom:10px">Navy circumference method. Measure in inches, relaxed, morning.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div>
          <label>Waist (in)</label>
          <input type="number" id="bf-waist" inputmode="decimal" step="0.25" placeholder="${userProfile.waist_in || ''}">
        </div>
        <div>
          <label>Neck (in)</label>
          <input type="number" id="bf-neck" inputmode="decimal" step="0.25" placeholder="${userProfile.neck_in || ''}">
        </div>
        <div>
          <label>Height (in)</label>
          <input type="number" id="bf-height" inputmode="decimal" step="0.25" placeholder="${userProfile.height_in || ''}">
        </div>
        <div style="display:flex;align-items:flex-end">
          <button class="btn secondary" id="calc-bf">Calculate</button>
        </div>
      </div>
      <div id="bf-result" class="muted" style="margin-top:10px;font-size:14px"></div>
    </div>

    <h2>History</h2>
    <div id="history">${renderHistory(all)}</div>
  `;

  app.querySelector('#save').onclick = async () => {
    const w = parseFloat(app.querySelector('#w').value);
    if (!w) { toast('Enter a weight'); return; }
    const n = app.querySelector('#n').value.trim();
    await put('body', { date: dateKey, weight_lb: w, notes: n || undefined });
    if (isToday && userProfile) await pref('profile', { ...userProfile, weight_lb: w });
    toast('Saved');
    renderBody(app);
  };

  app.querySelector('#prev-day').onclick = () => {
    const d = new Date(dateKey + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    _bodyDate = d.toISOString().slice(0, 10);
    renderBody(app);
  };
  app.querySelector('#next-day').onclick = () => {
    if (isToday) return;
    const d = new Date(dateKey + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    _bodyDate = d.toISOString().slice(0, 10);
    renderBody(app);
  };

  app.querySelector('#calc-bf')?.addEventListener('click', async () => {
    const waist  = parseFloat(app.querySelector('#bf-waist').value)  || userProfile.waist_in;
    const neck   = parseFloat(app.querySelector('#bf-neck').value)   || userProfile.neck_in;
    const height = parseFloat(app.querySelector('#bf-height').value) || userProfile.height_in;
    const $res = app.querySelector('#bf-result');
    if (!waist || !neck || !height) { $res.textContent = 'Enter waist, neck, and height.'; return; }
    const bf = bfPctNavy({ height_in: height, waist_in: waist, neck_in: neck });
    if (bf === null) { $res.textContent = 'Could not calculate.'; return; }
    $res.innerHTML = `Estimated body fat: <strong style="color:var(--fg)">${bf}%</strong>`;
    // Save measurements to profile for next time
    const updatedProfile = { ...userProfile, waist_in: waist, neck_in: neck, height_in: height, bf_pct: bf };
    await pref('profile', updatedProfile);
    toast(`BF% updated to ${bf}%`);
  });
}

function rollingAverage(all, days) {
  if (all.length < 2) return null;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutStr = cutoff.toISOString().slice(0, 10);
  const recent = all.filter(e => e.date >= cutStr);
  if (!recent.length) return null;
  return recent.reduce((s, e) => s + e.weight_lb, 0) / recent.length;
}

function renderTrendCard(all, prof) {
  const last = all[all.length - 1];
  const oldestRecent = all.find(e => e.date >= daysAgo(14)) || all[0];
  const change = last.weight_lb - oldestRecent.weight_lb;
  const days = (new Date(last.date) - new Date(oldestRecent.date)) / (1000 * 60 * 60 * 24);
  const wkRate = days >= 1 ? (change / days * 7).toFixed(2) : '—';
  const target = prof.weekly_change_lb || -1;
  const onTrack = Math.abs(parseFloat(wkRate) - target) < 0.5;
  return `
    <div class="card">
      <h2>Trend</h2>
      <div class="card-row">
        <div>
          <div class="muted" style="font-size:11px">Latest</div>
          <div style="font-size:22px;font-weight:700">${last.weight_lb} lb</div>
        </div>
        <div>
          <div class="muted" style="font-size:11px">14-day change</div>
          <div style="font-size:22px;font-weight:700;color:${change < 0 ? 'var(--accent)' : 'var(--warn)'}">${change >= 0 ? '+' : ''}${change.toFixed(1)} lb</div>
        </div>
        <div>
          <div class="muted" style="font-size:11px">Rate/wk</div>
          <div style="font-size:22px;font-weight:700;color:${onTrack ? 'var(--accent)' : 'var(--warn)'}">${wkRate}</div>
        </div>
      </div>
      ${sparkline(all.slice(-30))}
    </div>
  `;
}

async function renderWeeklyCard(all) {
  // Use last 7 days of actual weight + actual calories to calc real TDEE
  const { getByIndex } = await import('../db.js');
  const days = [];
  for (let i = 0; i <= 6; i++) days.push(daysAgo(i));
  const meals = [];
  for (const d of days) {
    const m = await getByIndex('meals', 'date', d);
    meals.push({ date: d, total: m.reduce((s, x) => s + (x.calories || 0), 0) });
  }
  const dailyCalAvg = meals.reduce((s, m) => s + m.total, 0) / 7;
  const start = all.find(e => e.date >= daysAgo(7));
  const end = all[all.length - 1];
  if (!start || !end || start.date === end.date) return '';
  const weightChange = end.weight_lb - start.weight_lb;
  const tdee = actualTdeeForWeek(dailyCalAvg, weightChange);
  return `
    <div class="card">
      <h2>Actual TDEE (last 7 days)</h2>
      <div class="muted">Avg intake ${Math.round(dailyCalAvg)} kcal · Δweight ${weightChange.toFixed(1)} lb</div>
      <div style="font-size:28px;font-weight:700;margin-top:6px">${tdee} kcal/day</div>
      <div class="muted" style="font-size:11px">Calculated from your real intake + scale change. Use this to retune your target.</div>
    </div>
  `;
}

function renderHistory(all) {
  if (!all.length) return `<div class="empty">No weigh-ins yet</div>`;
  return all.slice(-30).reverse().map(e => `
    <div class="list-item">
      <div>
        <div class="list-item-title">${e.weight_lb} lb</div>
        <div class="list-item-meta">${e.date}${e.notes ? ` · ${e.notes}` : ''}</div>
      </div>
    </div>
  `).join('');
}

function sparkline(points) {
  if (points.length < 2) return '';
  const w = 320, h = 60, pad = 4;
  const ws = points.map(p => p.weight_lb);
  const min = Math.min(...ws), max = Math.max(...ws);
  const range = max - min || 1;
  const xs = (i) => pad + (i / (points.length - 1)) * (w - pad * 2);
  const ys = (v) => h - pad - ((v - min) / range) * (h - pad * 2);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xs(i).toFixed(1)} ${ys(p.weight_lb).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;margin-top:10px">
    <path d="${path}" fill="none" stroke="#4ade80" stroke-width="2"/>
  </svg>`;
}
