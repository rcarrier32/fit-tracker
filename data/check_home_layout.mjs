/** Checks src/lib/home_layout.js. `node data/check_home_layout.mjs` */
import { resolveLayout, moveCard, DEFAULT_ORDER } from '../src/lib/home_layout.js';
let fail = 0;
const ok = (n, c, x = '') => { if (!c) { fail++; console.log(`✗ ${n} ${x}`); } else console.log(`✓ ${n}`); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
ok('nothing saved → default', eq(resolveLayout(null).order, DEFAULT_ORDER) && resolveLayout(null).hidden.size === 0);
ok('workout first by default', DEFAULT_ORDER[0] === 'workout' && DEFAULT_ORDER[1] === 'daily' && DEFAULT_ORDER[2] === 'calories');
const custom = ['calories', 'workout', 'body', 'daily', 'tips', 'lastweek'];
ok('saved order kept', eq(resolveLayout({ order: custom }).order, custom));
ok('unknown and duplicate ids dropped', eq(resolveLayout({ order: ['x', 'calories', 'calories', ...custom] }).order, custom));
const r = resolveLayout({ order: ['calories', 'workout', 'body'] });
ok('missing cards added, saved ones keep their order', r.order.length === DEFAULT_ORDER.length && r.order.indexOf('calories') < r.order.indexOf('workout') && r.order.indexOf('workout') < r.order.indexOf('body'), r.order.join());
ok('a new card lands after the one it follows', r.order.indexOf('daily') === r.order.indexOf('workout') + 1, r.order.join());
ok('hidden kept, unknown ignored', eq([...resolveLayout({ hidden: ['tips', 'nope'] }).hidden], ['tips']));
ok('move up', eq(moveCard(['a', 'b', 'c'], 'b', -1), ['b', 'a', 'c']));
ok('move down at the end is a no-op', eq(moveCard(['a', 'b', 'c'], 'c', 1), ['a', 'b', 'c']));
console.log(fail ? `${fail} failed` : 'all passed');
process.exit(fail ? 1 : 0);
