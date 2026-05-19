/**
 * US serving units — volume (ml base), mass (g base), count (servings).
 */
export const OZ_G = 28.349523125;

export const ML_PER_CUP = 240;
export const ML_PER_FL_OZ = 29.5735295625;
export const ML_PER_TBSP = 14.7867647813;
export const ML_PER_TSP = 4.92892159375;

/** @typedef {'g'|'oz'|'ml'|'cup'|'fl_oz'|'tbsp'|'tsp'|'serving'} ServingUnit */

export const UNIT_LABELS = {
  g: 'grams',
  oz: 'oz',
  ml: 'mL',
  cup: 'cup',
  fl_oz: 'fl oz',
  tbsp: 'tbsp',
  tsp: 'tsp',
  serving: 'serving',
};

const UNIT_ORDER = ['cup', 'fl_oz', 'oz', 'ml', 'tbsp', 'tsp', 'g', 'serving'];

/** @param {string} raw */
export function normalizeUnit(raw) {
  const u = (raw || '').toLowerCase().trim().replace(/\./g, '');
  if (!u) return null;
  if (u === 'g' || u === 'gram' || u === 'grams') return 'g';
  if (u === 'oz' || u === 'ounce' || u === 'ounces') return 'oz';
  if (u === 'ml' || u === 'milliliter' || u === 'milliliters' || u === 'millilitre') return 'ml';
  if (u === 'l' || u === 'liter' || u === 'liters' || u === 'litre' || u === 'litres') return 'ml';
  if (u === 'cup' || u === 'cups') return 'cup';
  if (u === 'fl oz' || u === 'floz' || u === 'fluid ounce' || u === 'fluid ounces') return 'fl_oz';
  if (u === 'tbsp' || u === 'tablespoon' || u === 'tablespoons') return 'tbsp';
  if (u === 'tsp' || u === 'teaspoon' || u === 'teaspoons') return 'tsp';
  if (u === 'serving' || u === 'servings' || u === 'portion' || u === 'portions') return 'serving';
  return null;
}

/** @param {Record<string, number>} units */
export function enrichUnits(units) {
  const u = { ...units };
  if (u.ml > 0) {
    if (!u.cup) u.cup = Math.round((u.ml / ML_PER_CUP) * 1000) / 1000;
    if (!u.fl_oz) u.fl_oz = Math.round((u.ml / ML_PER_FL_OZ) * 100) / 100;
    if (!u.tbsp) u.tbsp = Math.round((u.ml / ML_PER_TBSP) * 100) / 100;
    if (!u.tsp) u.tsp = Math.round((u.ml / ML_PER_TSP) * 100) / 100;
  }
  if (u.cup > 0 && !u.ml) u.ml = Math.round(u.cup * ML_PER_CUP);
  if (u.fl_oz > 0 && !u.ml) u.ml = Math.round(u.fl_oz * ML_PER_FL_OZ);
  if (u.g > 0 && !u.oz) u.oz = Math.round((u.g / OZ_G) * 100) / 100;
  if (u.oz > 0 && !u.g) u.g = Math.round(u.oz * OZ_G);
  return u;
}

/** @param {Record<string, number>} units @param {string} label */
export function pickDefaultUnit(units, label = '') {
  const lbl = label.toLowerCase();
  const has = (k) => units[k] > 0;
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
  if (/\b(?:g|gram)\b/.test(lbl) && has('g')) return 'g';
  for (const k of UNIT_ORDER) {
    if (has(k)) return k;
  }
  return 'oz';
}

/** @returns {string[]} */
export function unitsForUi(units, defaultUnit) {
  const keys = UNIT_ORDER.filter(k => units[k] > 0);
  if (!keys.length) return ['oz', 'g'];
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
  return '';
}
