/** Checks src/lib/weight_chart.js. `node data/check_weight_chart.mjs` */
import { weightSeries, gridLines, weightChartSVG, weightSummary } from '../src/lib/weight_chart.js';
let fail = 0;
const ok = (n, c, x = '') => { if (!c) { fail++; console.log(`✗ ${n} ${x}`); } else console.log(`✓ ${n}`); };
const day = (k) => { const d = new Date('2026-11-11T12:00:00'); d.setDate(d.getDate() - k); return d.toISOString().slice(0, 10); };
const T = '2026-11-11';
// 120 days, losing ~0.15 lb/day with noise, every other day
const body = []; for (let k = 120; k >= 0; k -= 2) body.push({ date: day(k), weight_lb: Math.round((200 - (120 - k) * 0.15 + (k % 4 ? 0.6 : -0.6)) * 10) / 10 });
body.push({ date: '2026-12-01', weight_lb: 150 });   // future: ignored
const m1 = weightSeries(body, { days: 30, today: T }), all = weightSeries(body, { days: null, today: T });
ok('1M only has the last 30 days', m1.points.every(p => p.date >= day(29)) && m1.points.length === 15, String(m1.points.length));
ok('All goes back to the first weigh-in, future ignored', all.points[0].date === day(120) && all.points.at(-1).date === T);
ok('7-day average smooths the noise', Math.max(...m1.points.map(p => Math.abs(p.avg - p.w))) <= 1.2);
ok('change and pace from the averages', all.change < -15 && all.perWeek > -1.2 && all.perWeek < -0.9, JSON.stringify([all.change, all.perWeek]));
ok('one weigh-in → null', weightSeries([{ date: T, weight_lb: 180 }], { today: T }) === null);
ok('two the same day count once', weightSeries([{ date: T, weight_lb: 180 }, { date: T, weight_lb: 181 }], { today: T }) === null);
const g = gridLines(183.2, 191.7);
ok('3–4 round grid lines', g.length >= 3 && g.length <= 5 && g.every(v => v % 1 === 0 || v % 0.5 === 0), g.join());
const svg = weightChartSVG(m1, { goalPerWeek: -1 });
ok('svg: average line, a dot per weigh-in, goal pace', /<path d="M/.test(svg) && (svg.match(/class="wc-hit"/g) || []).length === m1.points.length && /stroke-dasharray/.test(svg));
ok('svg: no NaN', !/NaN|Infinity/.test(svg));
ok('summary', /lb · -?\d/.test(weightSummary(all)), weightSummary(all));
console.log(fail ? `${fail} failed` : 'all passed');
process.exit(fail ? 1 : 0);
