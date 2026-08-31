/**
 * US serving units — volume (mL base), mass (g base), count (serving).
 */
export const OZ_G = 28.349523125;
export const LB_G = 453.59237;

export const ML_PER_CUP = 240;
export const ML_PER_FL_OZ = 29.5735295625;
export const ML_PER_TBSP = 14.7867647813;
export const ML_PER_TSP = 4.92892159375;

/** @typedef {'g'|'oz'|'lb'|'ml'|'cup'|'fl_oz'|'tbsp'|'tsp'|'serving'} ServingUnit */

export const UNIT_LABELS = {
  g: 'grams',
  oz: 'oz',
  lb: 'lb',
  ml: 'mL',
  cup: 'cup',
  fl_oz: 'fl oz',
  tbsp: 'tbsp',
  tsp: 'tsp',
  serving: 'serving',
};

/** Default pill order — real measurements only (no “can”). */
const UNIT_ORDER = ['cup', 'fl_oz', 'ml', 'oz', 'lb', 'g', 'tbsp', 'tsp', 'serving'];

/** Label mentions volume (incl. “1 can” text — parsed as serving + mL, not a “can” unit). */
export const VOLUME_IN_LABEL = /\b(ml|mL|milliliters?|liters?|litres?|fl\.?\s*oz|fluid\s*ounce|cups?)\b/i;

/**
 * Pourable-liquid units only — deliberately excludes "cup". A cup measurement usually means
 * a solid or semi-solid (yogurt, rice, flour) whose gram weight is real, independent data;
 * only mL/L/fl-oz labels are the beverage-duplicate case `reconcileLiquidUnits` targets.
 */
const POURABLE_VOLUME_IN_LABEL = /\b(ml|mL|milliliters?|liters?|litres?|fl\.?\s*oz|fluid\s*ounce)\b/i;

/** @param {string} raw */
export function normalizeUnit(raw) {
  const u = (raw || '').toLowerCase().trim().replace(/\./g, '');
  if (!u) return null;
  if (u === 'fl_oz' || u === 'tbsp' || u === 'tsp') return u;
  if (u === 'g' || u === 'gram' || u === 'grams') return 'g';
  if (u === 'oz' || u === 'ounce' || u === 'ounces') return 'oz';
  if (u === 'lb' || u === 'lbs' || u === 'pound' || u === 'pounds') return 'lb';
  if (u === 'ml' || u === 'milliliter' || u === 'milliliters' || u === 'millilitre') return 'ml';
  if (u === 'l' || u === 'liter' || u === 'liters' || u === 'litre' || u === 'litres') return 'ml';
  if (u === 'cup' || u === 'cups') return 'cup';
  if (u === 'fl oz' || u === 'floz' || u === 'fluid ounce' || u === 'fluid ounces'
    || u === 'fluid oz' || u === 'us fl oz') return 'fl_oz';
  if (u === 'tbsp' || u === 'tablespoon' || u === 'tablespoons') return 'tbsp';
  if (u === 'tsp' || u === 'teaspoon' || u === 'teaspoons') return 'tsp';
  if (u === 'serving' || u === 'servings' || u === 'portion' || u === 'portions') return 'serving';
  if (u === 'can' || u === 'cans' || u === 'bottle' || u === 'bottles'
    || u === 'slice' || u === 'slices' || u === 'piece' || u === 'pieces'
    || u === 'bar' || u === 'bars' || u === 'packet' || u === 'packets') return 'serving';
  if (u === 'cl' || u === 'centiliter' || u === 'centiliters') return 'ml';
  return null;
}

/** @param {Record<string, number>} units */
export function enrichUnits(units) {
  const u = { ...units };
  if (u.ml > 0) {
    if (!u.cup) u.cup = Math.round((u.ml / ML_PER_CUP) * 1000) / 1000;
    if (!(u.fl_oz > 0)) u.fl_oz = Math.round((u.ml / ML_PER_FL_OZ) * 100) / 100;
    if (!u.tbsp) u.tbsp = Math.round((u.ml / ML_PER_TBSP) * 100) / 100;
    if (!u.tsp) u.tsp = Math.round((u.ml / ML_PER_TSP) * 100) / 100;
  }
  if (u.cup > 0 && !u.ml) u.ml = Math.round(u.cup * ML_PER_CUP);
  if (u.fl_oz > 0 && !u.ml) u.ml = Math.round(u.fl_oz * ML_PER_FL_OZ);
  if (u.g > 0 && !u.oz) u.oz = Math.round((u.g / OZ_G) * 100) / 100;
  if (u.oz > 0 && !u.g) u.g = Math.round(u.oz * OZ_G);
  if (u.lb > 0 && !u.g) u.g = Math.round(u.lb * LB_G);
  if (u.g > 0 && !u.lb) u.lb = Math.round((u.g / LB_G) * 100) / 100;
  return u;
}

/**
 * OFF often lists drinks as grams equal to mL (e.g. 355 g for 355 ml). Drop bogus mass units.
 */
export function reconcileLiquidUnits(units, label = '') {
  const u = { ...units };
  if (!POURABLE_VOLUME_IN_LABEL.test(label)) return u;

  const hasVolume = u.ml > 0 || u.fl_oz > 0;
  if (!hasVolume) return u;

  if (u.g > 0 && u.ml > 0 && Math.abs(u.g - u.ml) <= 15) {
    delete u.g;
    delete u.lb;
    if (u.oz > 0 && !(u.fl_oz > 0)) delete u.oz;
  } else if (u.g > 0 && u.ml > 0 && u.g / u.ml > 0.85 && u.g / u.ml < 1.15) {
    delete u.g;
    delete u.lb;
    delete u.oz;
  }

  return u;
}

/** @param {Record<string, number>} units @param {string} label */
export function pickDefaultUnit(units, label = '') {
  const lbl = label.toLowerCase();
  const has = (k) => units[k] > 0;

  if (/\b(?:ml|milliliter)/.test(lbl) && has('ml')) return 'ml';
  if (/\bcups?\b/.test(lbl) && has('cup')) return 'cup';
  if (/\bfl\.?\s*oz\b/.test(lbl) && has('fl_oz')) return 'fl_oz';
  if (has('cup') && has('ml') && units.cup === 1 && Math.abs(units.ml - ML_PER_CUP) < 8) return 'cup';
  // `\b` alone misses "170g"/"6oz" — a digit and the following letter are both \w
  // characters, so there's no word-boundary between them. `(?<=\d)` covers that case.
  if (/(?:\b|(?<=\d))(?:lb|lbs|pound)/.test(lbl) && has('lb')) return 'lb';
  if (/(?:\b|(?<=\d))(?:oz|ounce)/.test(lbl) && has('oz') && !/\bfl\.?\s*oz/.test(lbl)) return 'oz';
  if (/(?:\b|(?<=\d))(?:g|grams?)\b/.test(lbl) && has('g') && !VOLUME_IN_LABEL.test(lbl)) return 'g';
  if (/\btbsp\b/.test(lbl) && has('tbsp')) return 'tbsp';
  if (/\btsp\b/.test(lbl) && has('tsp')) return 'tsp';
  if (VOLUME_IN_LABEL.test(lbl) && has('ml')) return 'ml';
  if (/\b(?:serving|can|bottle|piece|slice|bar|packet)\b/.test(lbl) && has('serving')) return 'serving';

  for (const k of UNIT_ORDER) {
    if (has(k)) return k;
  }
  return 'oz';
}

/** @returns {string[]} */
export function unitsForUi(units, defaultUnit, label = '') {
  const vol = ['ml', 'cup', 'fl_oz'];
  const mass = ['oz', 'g', 'lb'];
  const other = ['tbsp', 'tsp', 'serving'];

  let keys;
  if (VOLUME_IN_LABEL.test(label)) {
    keys = [...vol, ...mass.filter(k => units[k] > 0), ...other.filter(k => units[k] > 0)]
      .filter(k => units[k] > 0);
  } else {
    keys = [...mass, ...vol, ...other].filter(k => units[k] > 0);
  }

  keys = [...new Set(keys)];
  if (!keys.length) return ['ml', 'cup', 'fl_oz', 'oz', 'g', 'lb', 'serving'];
  if (!keys.includes(defaultUnit) && units[defaultUnit] > 0) keys.unshift(defaultUnit);
  return keys;
}

export function calcServings(amount, unit, perServingUnits) {
  const per = perServingUnits[unit];
  if (!(amount > 0) || !(per > 0)) return null;
  return Math.round((amount / per) * 100) / 100;
}

export function convertAmount(val, from, to, perServingUnits) {
  const n = parseFloat(val);
  const perFrom = perServingUnits[from];
  const perTo = perServingUnits[to];
  if (!(n > 0) || from === to || !(perFrom > 0) || !(perTo > 0)) return val;
  // Use the raw ratio, not the 2-decimal-rounded `calcServings` display value — rounding
  // mid-conversion loses precision that compounds across repeated unit round-trips.
  const out = (n / perFrom) * perTo;
  return to === 'g' || to === 'ml' ? Math.round(out) : Math.round(out * 100) / 100;
}

export function perAmountForUnit(units, unit) {
  const v = units[unit];
  if (v > 0) {
    if (unit === 'g' || unit === 'ml') return Math.round(v);
    return v;
  }
  return '';
}
