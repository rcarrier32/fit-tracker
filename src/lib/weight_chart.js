/**
 * Weight chart for Today's Weight trend card and the Body tab: pick a range (1M · 3M · 6M · 1Y · All),
 * the 7-day average as the main line, each weigh-in as a faint dot, light grid lines with labels,
 * your goal pace dashed, and tap a dot for its date and weight.
 * The maths and the SVG are plain functions (node: `node data/check_weight_chart.mjs`);
 * mountWeightChart() wires the buttons in the browser.
 */
const DAY = 864e5;
const t = (ymd) => new Date(ymd + 'T12:00:00').getTime();
const ymd = (ms) => { const x = new Date(ms); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const r1 = (x) => Math.round(x * 10) / 10;

export const RANGES = [['1M', 30], ['3M', 91], ['6M', 182], ['1Y', 365], ['All', null]];

/**
 * Weigh-ins in the range, each with its trailing 7-day average.
 * @returns null with fewer than 2 weigh-ins in range, else
 *   { points: [{date, w, avg}], from, to, change, perWeek, lo, hi }
 */
export function weightSeries(body = [], { days = 30, today } = {}) {
  const all = body.filter(b => +b.weight_lb > 0 && (!today || b.date <= today))
    .map(b => ({ date: b.date, w: +b.weight_lb })).sort((a, b) => a.date.localeCompare(b.date));
  // one per day (the last entry wins)
  const byDay = new Map(all.map(p => [p.date, p])); const uniq = [...byDay.values()];
  const end = today || uniq[uniq.length - 1]?.date;
  if (!end) return null;
  const start = days ? ymd(t(end) - (days - 1) * DAY) : uniq[0].date;
  const points = uniq.filter(p => p.date >= start).map(p => {
    const win = uniq.filter(q => q.date <= p.date && t(q.date) > t(p.date) - 7 * DAY);
    return { ...p, avg: r1(win.reduce((s, q) => s + q.w, 0) / win.length) };
  });
  if (points.length < 2) return null;
  const a = points[0], z = points[points.length - 1];
  const weeks = (t(z.date) - t(a.date)) / (7 * DAY);
  const vals = points.flatMap(p => [p.w, p.avg]);
  return { points, from: start, to: end, change: r1(z.avg - a.avg), perWeek: weeks >= 1 ? r1((z.avg - a.avg) / weeks) : null,
    lo: Math.min(...vals), hi: Math.max(...vals) };
}

/** Round grid steps: 3–5 lines across the range. */
export function gridLines(lo, hi) {
  const span = Math.max(1, hi - lo);
  const step = [0.5, 1, 2, 5, 10, 20, 50].find(s => span / s <= 4.5) || 100;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(r1(v));
  return out;
}

const fmtDay = (d) => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/** The chart as an SVG string. `goalPerWeek` (lb/week, e.g. -1) draws the goal pace from the first average. */
export function weightChartSVG(s, { height = 150, goalPerWeek = null, id = 'wc' } = {}) {
  if (!s) return '';
  const W = 320, H = height, L = 30, R = 6, T = 8, B = 18;
  const t0 = t(s.points[0].date), t1 = Math.max(t(s.points[s.points.length - 1].date), t0 + DAY);
  let lo = s.lo, hi = s.hi;
  const goalEnd = goalPerWeek ? s.points[0].avg + goalPerWeek * (t1 - t0) / (7 * DAY) : null;
  if (goalEnd != null) { lo = Math.min(lo, goalEnd); hi = Math.max(hi, goalEnd); }
  const pad = Math.max(0.3, (hi - lo) * 0.08); lo -= pad; hi += pad;
  const X = (d) => L + (t(d) - t0) / (t1 - t0) * (W - L - R);
  const Y = (v) => T + (hi - v) / (hi - lo) * (H - T - B);
  const grid = gridLines(lo, hi).map(v => `
    <line x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="var(--border)" stroke-width="1"/>
    <text x="${L - 4}" y="${(Y(v) + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="var(--fg-dim)">${v}</text>`).join('');
  const avgPath = s.points.map((p, i) => `${i ? 'L' : 'M'}${X(p.date).toFixed(1)},${Y(p.avg).toFixed(1)}`).join(' ');
  const goal = goalEnd != null ? `<line x1="${X(s.points[0].date).toFixed(1)}" y1="${Y(s.points[0].avg).toFixed(1)}" x2="${(W - R).toFixed(1)}" y2="${Y(goalEnd).toFixed(1)}"
    stroke="var(--fg-dim)" stroke-width="1" stroke-dasharray="4 4"/>` : '';
  const mid = ymd((t0 + t1) / 2);
  const dates = [[s.points[0].date, 'start'], [mid, 'middle'], [s.points[s.points.length - 1].date, 'end']].map(([d, a]) =>
    `<text x="${X(d).toFixed(1)}" y="${H - 4}" text-anchor="${a}" font-size="9" fill="var(--fg-dim)">${fmtDay(d)}</text>`).join('');
  const dots = s.points.map((p, i) => `<circle cx="${X(p.date).toFixed(1)}" cy="${Y(p.w).toFixed(1)}" r="2.2" fill="var(--accent)" opacity="0.35"/>
    <circle class="wc-hit" data-i="${i}" cx="${X(p.date).toFixed(1)}" cy="${Y(p.w).toFixed(1)}" r="9" fill="transparent" style="cursor:pointer"/>`).join('');
  return `<svg id="${id}" viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" role="img"
    aria-label="Weight, ${fmtDay(s.points[0].date)} to ${fmtDay(s.points[s.points.length - 1].date)}: 7-day average from ${s.points[0].avg} to ${s.points[s.points.length - 1].avg} lb">
    ${grid}${goal}
    <path d="${avgPath}" fill="none" stroke="var(--accent)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}${dates}
    <circle class="wc-sel" r="4" fill="var(--accent)" stroke="var(--bg)" stroke-width="2" style="display:none"/>
  </svg>`;
}

/** Summary line under the chart for a series. */
export function weightSummary(s) {
  if (!s) return '';
  const sign = (v) => (v > 0 ? '+' : '') + v;
  return `${sign(s.change)} lb${s.perWeek != null ? ` · ${sign(s.perWeek)} lb/week` : ''}`;
}

/**
 * Browser: draw the chart into `el` with range buttons and tap-for-value.
 * @param body weigh-ins ({date, weight_lb}); opts: { today, range = '3M', goalPerWeek, height, onRange }
 */
export function mountWeightChart(el, body, opts = {}) {
  let range = opts.range || '3M';
  const draw = () => {
    const days = (RANGES.find(([k]) => k === range) || RANGES[1])[1];
    const s = weightSeries(body, { days, today: opts.today });
    const id = 'wc' + Math.random().toString(36).slice(2, 7);
    el.innerHTML = `
      <div style="display:flex;gap:4px;margin:8px 0 6px">${RANGES.map(([k]) => `
        <button type="button" class="pill ${k === range ? 'accent' : ''}" data-range="${k}" style="cursor:pointer;font-size:11px;padding:3px 9px">${k}</button>`).join('')}</div>
      ${s ? weightChartSVG(s, { height: opts.height || 150, goalPerWeek: opts.goalPerWeek, id })
        : '<div class="muted" style="font-size:12px;padding:16px 0">Not enough weigh-ins in this range yet.</div>'}
      <div class="wc-cap muted" style="font-size:12px;margin-top:4px;min-height:16px">${s ? `${weightSummary(s)}${opts.goalPerWeek ? ` <span style="opacity:0.7">· dashed: goal pace</span>` : ''}` : ''}</div>`;
    el.querySelectorAll('[data-range]').forEach(b => b.onclick = (e) => { e.stopPropagation(); range = b.dataset.range; opts.onRange?.(range); draw(); });
    if (!s) return;
    const sel = el.querySelector('.wc-sel'), cap = el.querySelector('.wc-cap');
    el.querySelectorAll('.wc-hit').forEach(h => h.onclick = (e) => {
      e.stopPropagation();
      const p = s.points[+h.dataset.i];
      sel.setAttribute('cx', h.getAttribute('cx')); sel.setAttribute('cy', h.getAttribute('cy')); sel.style.display = '';
      cap.innerHTML = `<b style="color:var(--fg)">${fmtDay(p.date)}: ${p.w} lb</b> · 7-day average ${p.avg}`;
    });
  };
  draw();
}
