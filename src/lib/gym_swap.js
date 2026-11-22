/**
 * "🏋 Gym today": swap the exercises a plan only uses because home has no gym equipment for a better
 * gym version of the same movement. Plain module (no app imports) so it runs in node:
 * `node data/check_gym_swap.mjs`.
 *
 * A row is a home stand-in when it's a working lift (main, secondary or accessory) done with only band,
 * mini band, slider or bodyweight, in a loadable movement (not a hold, balance, mobility, core or jump
 * drill). Its replacement must be the same movement pattern and main muscle, use real gym equipment
 * (dumbbells first: the user prefers them; then cable, machine, barbell, Smith, trap bar, landmine, pull-up
 * bar) the gym has, have a video, and be at most one level harder. Then: exercises the coach programs use
 * (data/learned_patterns.json), your ♥ favourites, BWS's gym lifts, same one-side/two-side.
 *
 * Never swapped: ♥ favourites, required moves (Copenhagen), anything with a set logged today, and rows
 * whose plan picked dumbbells or kettlebells (those are a choice, not a stand-in).
 */
const STAND_IN_KIT = new Set(['band', 'mini_band', 'slider', 'bodyweight']);
const GYM_KIT = new Set(['cable', 'machine', 'barbell', 'smith', 'trap_bar', 'landmine', 'pullup_bar']);
const WORKING = new Set(['main', 'secondary', 'accessory']);
const LOADABLE = new Set(['squat', 'hinge', 'lunge_single_leg', 'push_horizontal', 'push_vertical', 'pull_horizontal', 'pull_vertical',
  'isolation_upper', 'isolation_lower', 'carry']);
const REQUIRED = /copenhagen|nordic/i;
const COMBO = /\bto\b|\+|combo|complex|\bx\b/i;
const STOP = new Set(['band', 'banded', 'mini', 'slider', 'resisted', 'bodyweight', 'with', 'and', 'the', 'single', 'arm', 'leg', 'cable', 'machine', 'barbell',
  'dumbbell', 'smith', 'seated', 'standing', 'lying', 'kneeling', 'half']);
const words = (n) => new Set(String(n).toLowerCase().replace(/\(.*?\)/g, '').split(/[^a-z]+/).filter(w => w.length > 2 && !STOP.has(w)).map(w => w.replace(/s$/, '')));
/** Share of the stand-in's meaningful words the candidate repeats (Pull-Aparts ↔ ?, Pullover ↔ Pullover). */
const shared = (a, b) => { const A = words(a), B = words(b); if (!A.size) return 0; let n = 0; for (const w of A) if (B.has(w)) n++; return n / A.size; };
/** Accessories stay accessories; main and secondary lifts can trade places. */
const sameJob = (a, b) => a === 'accessory' ? b === 'accessory' : (b === 'main' || b === 'secondary');

export const GYM_DEFAULT = ['dumbbell', 'barbell', 'trap_bar', 'bench', 'box', 'cable', 'machine', 'pullup_bar', 'band', 'mini_band',
  'landmine', 'kettlebell', 'med_ball', 'smith'];

/** Is this catalog entry a home stand-in that the gym could do better? */
export function isStandIn(e) {
  return !!e && WORKING.has(e.role) && LOADABLE.has(e.pattern) && (e.equipment || ['bodyweight']).every(q => STAND_IN_KIT.has(q));
}

/** Coach usage share for a name, across every goal's coach programs. */
function coachShare(learned, name) {
  let best = 0;
  for (const g of Object.values(learned?.goals || {})) {
    const n = g.exercises?.[name];
    if (n) best = Math.max(best, n / Math.max(1, g.programs?.length || 1));
  }
  return best;
}

/** Ranked gym replacements for a stand-in (best first). */
export function gymReplacements(e, catalog, { gym = GYM_DEFAULT, learned = null, favorites = [], avoid = [], level = 3, used = new Set() } = {}) {
  const have = new Set(['bodyweight', ...gym]);
  const favs = new Set(favorites), no = new Set(avoid);
  return catalog
    .filter(c => c.name !== e.name && !used.has(c.name) && !no.has(c.name) && (c.video_url || c.video) && !c.video_standin
      && c.pattern === e.pattern && c.primary_muscle === e.primary_muscle && sameJob(e.role, c.role)
      && (c.equipment || []).some(q => GYM_KIT.has(q) || q === 'dumbbell') && (c.equipment || []).every(q => have.has(q))
      && (c.level || 2) <= Math.max(level, (e.level || 2) + 1) && !/last resort|optional/i.test(c.name))
    .map(c => [coachShare(learned, c.name) * 3 + (favs.has(c.name) ? 2 : 0) + (c.sources?.includes('bws') ? 1 : 0)
      + (!!c.unilateral === !!e.unilateral ? 0.5 : 0) + (c.role === e.role ? 0.3 : 0)
      + ((c.equipment || []).includes('dumbbell') ? 2.5 : 0)    // the user prefers dumbbells (2026-11-11)
      + 1.5 * shared(e.name, c.name)                         // "Band Pullover" → "Cable Pullover"
      - (COMBO.test(c.name) ? 2 : 0), c])                    // a plain lift beats a combo move
    .sort((a, b) => b[0] - a[0] || a[1].name.localeCompare(b[1].name))
    .map(([, c]) => c);
}

/**
 * Apply or undo the gym swaps on today's session rows.
 * @param rows   session rows ({ name, orig_name, sets: [...], swapped, gym_swap, notes })
 * @param on     true = going to the gym today, false = back to the plan
 * @returns { rows, swaps: [{from, to}] }
 */
export function applyGymDay(rows, on, lookup, catalog, opts = {}) {
  const favs = new Set(opts.favorites || []);
  const logged = (x) => (x.sets || []).some(s => s?.done);
  const out = rows.map(x => ({ ...x }));
  const swaps = [];
  if (!on) {
    for (const x of out) if (x.gym_swap && !logged(x)) {
      swaps.push({ from: x.name, to: x.gym_swap.from });
      x.name = x.gym_swap.from;
      x.notes = x.gym_swap.notes ?? null;
      x.swapped = x.gym_swap.wasSwapped || undefined;
      delete x.gym_swap;
    }
    return { rows: out, swaps };
  }
  const used = new Set(out.map(x => x.name));
  for (const x of out) {
    if (x.gym_swap || logged(x) || favs.has(x.name) || REQUIRED.test(x.name)) continue;
    const e = lookup(x.name);
    if (!isStandIn(e)) continue;
    // Lunges and step-ups: the gym upgrade is holding dumbbells, not a machine (a leg press changes the movement).
    if (e.pattern === 'lunge_single_leg') {
      if ((opts.gym || GYM_DEFAULT).includes('dumbbell') && (e.equipment || ['bodyweight']).every(q => q === 'bodyweight')) {
        x.gym_swap = { from: x.name, notes: x.notes ?? null, wasSwapped: !!x.swapped };
        x.notes = 'At the gym: hold dumbbells (or a kettlebell) for this one.' + (x.notes ? ` ${x.notes}` : '');
        swaps.push({ from: x.name, to: x.name, note: 'hold dumbbells' });
      }
      continue;
    }
    const best = gymReplacements(e, catalog, { ...opts, used })[0];
    if (!best) continue;
    x.gym_swap = { from: x.name, notes: x.notes ?? null, wasSwapped: !!x.swapped };
    swaps.push({ from: x.name, to: best.name });
    used.add(best.name);
    x.name = best.name;
    x.swapped = true;
    x.notes = `Gym swap: ${x.gym_swap.from} → ${best.name} (same movement, loaded with gym equipment). Same sets and reps.` + (x.gym_swap.notes ? ` ${x.gym_swap.notes}` : '');
  }
  return { rows: out, swaps };
}

const KIT_WORD = { cable: 'a cable', machine: 'a machine', barbell: 'a barbell', smith: 'a Smith machine', trap_bar: 'a trap bar',
  landmine: 'a landmine', pullup_bar: 'a pull-up bar', sled: 'a sled', suspension: 'TRX straps', pool: 'a pool', bike: 'a bike',
  agility_ladder: 'an agility ladder', kettlebell: 'a kettlebell', box: 'a box', bench: 'a bench', med_ball: 'a med ball',
  bosu_pad: 'a BOSU or pad', slider: 'sliders', foam_roller: 'a foam roller', dumbbell: 'dumbbells', band: 'a band', mini_band: 'a mini band' };
/** Does this catalog entry fit the kit? */
export const fitsKit = (e, kit) => !!e && (e.equipment || ['bodyweight']).every(q => q === 'bodyweight' || kit.has(q));

/**
 * v220, the other way round from the gym swap: at home, a plan row your equipment can't do becomes the first
 * alternate you can: the plan's own alternatives, then BWS's, then PJF's, then the same movement and main muscle
 * (dumbbells first, at most one level harder, a video). Never swapped: rows with a set logged, ♥ favourites,
 * required moves. Undo: { on: false } puts the plan's moves back (for a gym day).
 * @param opts { kit: Set, on: true|false, providerAlts: (name) => names[], favorites, learned }
 */
export function applyHomeKit(rows, lookup, catalog, opts = {}) {
  const kit = opts.kit || new Set(['bodyweight']);
  const logged = (x) => (x.sets || []).some(s => s?.done);
  const out = rows.map(x => ({ ...x }));
  const swaps = [];
  if (opts.on === false) {
    for (const x of out) if (x.home_swap && !logged(x)) {
      swaps.push({ from: x.name, to: x.home_swap.from });
      x.name = x.home_swap.from; x.notes = x.home_swap.notes ?? null; x.swapped = x.home_swap.wasSwapped || undefined;
      delete x.home_swap;
    }
    return { rows: out, swaps };
  }
  const favs = new Set(opts.favorites || []);
  const used = new Set(out.map(x => x.name));
  for (const x of out) {
    if (x.home_swap || x.gym_swap || logged(x) || favs.has(x.name) || REQUIRED.test(x.name)) continue;
    const e = lookup(x.name);
    if (!e || fitsKit(e, kit) || /cooldown/i.test(x.round_group || '')) continue;
    const named = [...(x.alternates || []), ...(e.bws_alternates || []), ...((opts.providerAlts && opts.providerAlts(x.name)) || [])];
    let best = named.map(n => lookup(n)).find(c => c && c.name !== x.name && !used.has(c.name) && fitsKit(c, kit) && (c.video_url || c.video));
    if (!best) {
      best = catalog.filter(c => c.name !== e.name && !used.has(c.name) && (c.video_url || c.video) && !c.video_standin
          && c.pattern === e.pattern && c.primary_muscle === e.primary_muscle && fitsKit(c, kit)
          && (c.level || 2) <= (e.level || 2) + 1 && !/last resort/i.test(c.name))
        .map(c => [coachShare(opts.learned, c.name) * 3 + (favs.has(c.name) ? 2 : 0) + ((c.equipment || []).includes('dumbbell') ? 2 : 0)
          + (!!c.unilateral === !!e.unilateral ? 0.5 : 0) + (c.role === e.role ? 0.5 : 0) + 1.5 * shared(e.name, c.name) - (COMBO.test(c.name) ? 2 : 0), c])
        .sort((a, b) => b[0] - a[0] || a[1].name.localeCompare(b[1].name))[0]?.[1];
    }
    if (!best) continue;
    const need = (e.equipment || []).filter(q => q !== 'bodyweight' && !kit.has(q)).map(q => KIT_WORD[q] || q.replace(/_/g, ' '));
    x.home_swap = { from: x.name, notes: x.notes ?? null, wasSwapped: !!x.swapped };
    swaps.push({ from: x.name, to: best.name });
    used.add(best.name);
    x.name = best.name;
    x.swapped = true;
    x.notes = `Home swap: ${x.home_swap.from} needs ${need.join(' and ') || 'gym equipment'} → ${best.name}, same sets and reps. "Going to the gym today?" puts it back.`
      + (x.home_swap.notes ? ` ${x.home_swap.notes}` : '');
  }
  return { rows: out, swaps };
}

