/**
 * US serving units — volume (ml base), mass (g base), count (servings).
 */
export const OZ_G = 28.349523125;

export const ML_PER_CUP = 240;
export const ML_PER_FL_OZ = 29.5735295625;
export const ML_PER_TBSP = 14.7867647813;
export const ML_PER_TSP = 4.92892159375;

/** @typedef {'g'|'oz'|'ml'|'cup'|'fl_oz'|'tbsp'|'tsp'|'can'|'serving'} ServingUnit */

export const UNIT_LABELS = {
  g: 'grams',
  oz: 'oz',
  ml: 'mL',
  cup: 'cup',
  fl_oz: 'fl oz',
  tbsp: 'tbsp',
  tsp: 'tsp',
  can: 'can',
  serving: 'serving',
};

const UNIT_ORDER = ['can', 'cup', 'fl_oz', 'ml', 'oz', 'tbsp', 'tsp', 'g', 'serving'];

export const VOLUME_IN_LABEL = /\b(ml|mL|milliliters?|liters?|litres?|fl\.?\s*oz|fluid\s*ounce|cups?|cans?|bottles?)\b/i;

/** @param {string} raw */
export function normalizeUnit(raw) {
  const u = (raw || '').toLowerCase().trim().replace(/\./g, '');
  if (!u) return null;
  // Already-normalized keys from parseLabelUnits
  if (u === 'fl_oz' || u === 'tbsp' || u === 'tsp' || u === 'can') return u;
  if (u === 'g' || u === 'gram' || u === 'grams') return 'g';
  if (u === 'oz' || u === 'ounce' || u === 'ounces') return 'oz';
  if (u === 'ml' || u === 'milliliter' || u === 'milliliters' || u === 'millilitre') return 'ml';
  if (u === 'l' || u === 'liter' || u === 'liters' || u === 'litre' || u === 'litres') return 'ml';
  if (u === 'cup' || u === 'cups') return 'cup';
  if (u === 'fl oz' || u === 'floz' || u === 'fluid ounce' || u === 'fluid ounces'
    || u === 'fluid oz' || u === 'us fl oz') return 'fl_oz';
  if (u === 'tbsp' || u === 'tablespoon' || u === 'tablespoons') return 'tbsp';
  if (u === 'tsp' || u === 'teaspoon' || u === 'teaspoons') return 'tsp';
  if (u === 'serving' || u === 'servings' || u === 'portion' || u === 'portions') return 'serving';
  if (u === 'can' || u === 'cans') return 'can';
  if (u === 'bottle' || u === 'bottles') return 'can';
  if (u === 'cl' || u === 'centiliter' || u === 'centiliters') return 'ml';
  return null;
}

/** @param {Record<string, number>} units */
export function enrichUnits(units) {
  const u = { ...units };
  if (u.ml > 0) {
    if (!u.cup) u.cup = Math.round((u.ml / ML_PER_CUP) * 1000) / 1000;
    // Only derive fl oz from mL when not already set from label (avoid 17.99 vs 18)
    if (!(u.fl_oz > 0)) u.fl_oz = Math.round((u.ml / ML_PER_FL_OZ) * 100) / 100;
    if (!u.tbsp) u.tbsp = Math.round((u.ml / ML_PER_TBSP) * 100) / 100;
    if (!u.tsp) u.tsp = Math.round((u.ml / ML_PER_TSP) * 100) / 100;
  }
  if (u.cup > 0 && !u.ml) u.ml = Math.round(u.cup * ML_PER_CUP);
  if (u.fl_oz > 0 && !u.ml) u.ml = Math.round(u.fl_oz * ML_PER_FL_OZ);
  if (u.g > 0 && !u.oz) u.oz = Math.round((u.g / OZ_G) * 100) / 100;
  if (u.oz > 0 && !u.g) u.g = Math.round(u.oz * OZ_G);
  if (u.can > 0 && u.ml > 0 && !u.serving) u.serving = u.can;
  return u;
}

/**
 * OFF often lists drinks as grams equal to mL (e.g. 355 g for 355 ml). Drop bogus mass units.
 * @param {Record<string, number>} units
 * @param {string} label
 */
export function reconcileLiquidUnits(units, label = '') {
  const u = { ...units };
  if (!VOLUME_IN_LABEL.test(label)) return u;

  const hasVolume = u.ml > 0 || u.fl_oz > 0 || u.cup > 0 || u.can > 0;
  if (!hasVolume) return u;

  // Database said "355 g" but label says "355 ml" / "1 can"
  if (u.g > 0 && u.ml > 0 && Math.abs(u.g - u.ml) <= 15) {
    delete u.g;
    if (u.oz > 0 && u.fl_oz > 0 && Math.abs(u.oz * OZ_G - u.ml) > 20) delete u.oz;
  } else if (u.g > 0 && u.ml > 0 && u.g / u.ml > 0.85 && u.g / u.ml < 1.15) {
    delete u.g;
    delete u.oz;
  }

  return u;
}

/** @param {Record<string, number>} units @param {string} label */
export function pickDefaultUnit(units, label = '') {
  const lbl = label.toLowerCase();
  const has = (k) => units[k] > 0;
  if (/\b(?:can|cans|bottle|bottles)\b/.test(lbl) && has('can')) return 'can';
  // One US cup of liquid (e.g. milk 240 ml) — prefer cup even if label only says "240 ml"
  if (has('cup') && has('ml') && units.cup > 0
    && Math.abs(units.ml - units.cup * ML_PER_CUP) < 5) {
    if (/\bcups?\b/.test(lbl) || (units.cup === 1 && Math.abs(units.ml - ML_PER_CUP) < 5)) return 'cup';
  }
  if (/\bcups?\b/.test(lbl) && has('cup')) return 'cup';
  if (/\bfl\.?\s*oz\b/.test(lbl) && has('fl_oz')) return 'fl_oz';
  if (/\b(?:oz|ounce)/.test(lbl) && has('oz')) return 'oz';
  if (/\b(?:ml|milliliter)/.test(lbl) && has('ml')) return 'ml';
  if (/\btbsp\b/.test(lbl) && has('tbsp')) return 'tbsp';
  if (/\btsp\b/.test(lbl) && has('tsp')) return 'tsp';
  // Prefer volume over grams for drinks when both slipped through
  if (VOLUME_IN_LABEL.test(lbl) && has('ml')) return 'ml';
  if (/\b(?:g|gram)\b/.test(lbl) && has('g') && !VOLUME_IN_LABEL.test(lbl)) return 'g';
  for (const k of UNIT_ORDER) {
    if (has(k)) return k;
  }
  return 'oz';
}

/** @returns {string[]} */
export function unitsForUi(units, defaultUnit, label = '') {
  const liquidKeys = ['can', 'cup', 'fl_oz', 'ml', 'oz', 'serving', 'g'];
  let keys = VOLUME_IN_LABEL.test(label)
    ? liquidKeys.filter(k => units[k] > 0)
    : UNIT_ORDER.filter(k => units[k] > 0);
  if (!keys.length) return ['ml', 'fl_oz', 'can', 'cup', 'oz', 'g'];
  if (!keys.includes(defaultUnit) && units[defaultUnit] > 0) keys.unshift(defaultUnit);
  return keys;
}

/**
 * @param {number} amount
 * @param {ServingUnit} unit
 * @param {Record<string, number>} perServingUnits
 */
export function calcServings(amount, unit, perServingUnits) {
  const per = perServingUnits[unit];
  if (!(amount > 0) || !(per > 0)) return null;
  return Math.round((amount / per) * 100) / 100;
}

/**
 * @param {number} val
 * @param {ServingUnit} from
 * @param {ServingUnit} to
 * @param {Record<string, number>} perServingUnits
 */
export function convertAmount(val, from, to, perServingUnits) {
  const n = parseFloat(val);
  if (!(n > 0) || from === to) return val;
  const servings = calcServings(n, from, perServingUnits);
  if (servings == null) return val;
  const perTo = perServingUnits[to];
  if (!(perTo > 0)) return val;
  const out = servings * perTo;
  return to === 'g' || to === 'ml' ? Math.round(out) : Math.round(out * 100) / 100;
}

export function perAmountForUnit(units, unit) {
  const v = units[unit];
  if (v > 0) return unit === 'g' || unit === 'ml' ? Math.round(v) : v;
  if (unit === 'can') return 1;
  return '';
}
