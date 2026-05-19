/**
 * Open Food Facts nutrient + serving parsing (US oz labels, kJ-only energy, per-100g scaling).
 */
import {
  OZ_G, ML_PER_FL_OZ, VOLUME_IN_LABEL, enrichUnits, normalizeUnit, pickDefaultUnit,
  reconcileLiquidUnits,
} from './serving_units.js';

export const OFF_USER_AGENT = 'FitTracker/1.0 (https://github.com/local/fit-tracker)';

export function offFetch(url) {
  return fetch(url, { headers: { 'User-Agent': OFF_USER_AGENT } });
}

function num(v) {
  if (v == null || v === '') return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function addUnit(units, unit, amount) {
  const u = normalizeUnit(unit);
  const n = parseFloat(amount);
  if (!u || !(n > 0)) return;
  if (u === 'ml' && (unit || '').toLowerCase().startsWith('l') && n < 50) {
    units.ml = n * 1000;
    return;
  }
  units[u] = n;
}

function parseLabelUnits(label) {
  const units = {};
  const flM = label.match(/(\d+\.?\d*)\s*(?:fl\.?\s*oz|fluid\s*ounces?)\b/i);
  if (flM) addUnit(units, 'fl_oz', flM[1]);
  // Strip matched fl oz so the weight-oz pattern does not pick up the same number
  const withoutFl = flM ? label.replace(flM[0], ' ') : label;
  const patterns = [
    [/(\d+\.?\d*)\s*(?:cup|cups)\b/i, 'cup'],
    [/(\d+\.?\d*)\s*(?:ml|mL|milliliters?)\b/i, 'ml'],
    [/(\d+\.?\d*)\s*(?:lb|lbs|pounds?)\b/i, 'lb'],
    [/(\d+\.?\d*)\s*(?:oz|ounce|ounces)\b/i, 'oz'],
    [/(\d+\.?\d*)\s*(?:tbsp|tablespoons?)\b/i, 'tbsp'],
    [/(\d+\.?\d*)\s*(?:tsp|teaspoons?)\b/i, 'tsp'],
    [/(\d+\.?\d*)\s*g\b/i, 'g'],
    [/(\d+\.?\d*)\s*(?:serving|servings|portion|portions)\b/i, 'serving'],
    [/(\d+\.?\d*)\s*(?:can|cans|bottle|bottles|slice|slices|piece|pieces|bar|bars|packet|packets)\b/i, 'serving'],
  ];
  for (const [re, unit] of patterns) {
    const m = withoutFl.match(re);
    if (m) addUnit(units, unit, m[1]);
  }
  return units;
}

/**
 * @returns {{
 *   label: string,
 *   units: Record<string, number>,
 *   defaultUnit: string,
 *   gramsPerServing: number|null,
 *   ozPerServing: number|null,
 *   preferOz: boolean,
 * }}
 */
export function parseServingInfo(servingStr, product = null) {
  let label = (servingStr || product?.serving_size || '').trim();
  if (!label && product?.serving_quantity != null && product?.serving_quantity_unit) {
    label = `${product.serving_quantity} ${product.serving_quantity_unit}`;
  }
  if (!label) label = '1 serving';

  const units = parseLabelUnits(label);

  if (product?.serving_quantity != null) {
    const q = parseFloat(product.serving_quantity);
    const rawU = product.serving_quantity_unit || '';
    if (!Number.isNaN(q) && q > 0) {
      const rawLow = rawU.toLowerCase();
      let u = normalizeUnit(rawU);
      // OFF sometimes uses "oz" for beverage bottles that are fluid ounces
      const sizeText = `${label} ${product?.serving_size || ''}`;
      if (u === 'oz' && q >= 8 && q <= 32) {
        if (/\bfl\.?\s*oz\b/i.test(sizeText)) u = 'fl_oz';
        else if (units.ml > 0 && Math.abs(units.ml / q - ML_PER_FL_OZ) < 2) u = 'fl_oz';
      }
      if (u === 'ml' && /^l/i.test(rawU.trim())) addUnit(units, 'ml', q * 1000);
      else if (u === 'ml' && /^cl/i.test(rawU.trim())) addUnit(units, 'ml', q * 10);
      else if (
        u === 'g' && units.ml > 0 && VOLUME_IN_LABEL.test(sizeText)
        && Math.abs(q - units.ml) <= 20
      ) {
        /* skip — OFF listed mass equal to mL for a drink */
      } else if (u) addUnit(units, u, q);
      else if (/fl/i.test(rawLow) && /oz/i.test(rawLow)) addUnit(units, 'fl_oz', q);
      else if (!rawU.trim() && q > 0 && q < 50) addUnit(units, 'oz', q);
    }
  }

  const sizeText = `${label} ${product?.serving_size || ''}`;
  let enriched = enrichUnits(units);
  enriched = reconcileLiquidUnits(enriched, sizeText);
  if (!Object.keys(enriched).length) {
    addUnit(enriched, 'serving', 1);
    enriched = enrichUnits(enriched);
  }

  const defaultUnit = pickDefaultUnit(enriched, label);
  const grams = enriched.g > 0 ? enriched.g : null;
  const oz = enriched.oz > 0 ? enriched.oz : (grams ? Math.round((grams / OZ_G) * 100) / 100 : null);
  const ozIdx = label.toLowerCase().search(/\b(?:oz|ounce)/);
  const gIdx = label.toLowerCase().indexOf('g');
  const preferOz = !!oz && (gIdx < 0 || (ozIdx >= 0 && ozIdx < gIdx));

  return {
    label,
    units: enriched,
    defaultUnit,
    gramsPerServing: grams,
    ozPerServing: oz,
    preferOz,
  };
}

function kcalFromNutriments(n, servingGrams) {
  const perSrv = num(n['energy-kcal_serving']);
  if (perSrv != null && perSrv > 0) return perSrv;

  const flat = num(n['energy-kcal']);
  const per100kcal = num(n['energy-kcal_100g']);
  const dataPer = (n['nutrition-data-per'] || '').toLowerCase();

  if (flat != null && flat > 0) {
    if (dataPer === 'serving' || dataPer === 'portion') return flat;
    if (per100kcal == null || Math.abs(flat - per100kcal) > 0.5) return flat;
  }

  const kjSrv = num(n['energy-kj_serving']);
  if (kjSrv != null && kjSrv > 0) return kjSrv / 4.184;

  let per100 = per100kcal;
  if (per100 == null) {
    const kj100 = num(n['energy-kj_100g']);
    if (kj100 != null) per100 = kj100 / 4.184;
  }
  if (per100 == null) {
    const e100 = num(n['energy_100g']);
    if (e100 != null) per100 = e100 / 4.184;
  }
  if (per100 != null && servingGrams > 0) {
    return per100 * (servingGrams / 100);
  }

  return flat ?? 0;
}

function pickNutrient(n, baseKey, servingGrams) {
  const perSrv = num(n[`${baseKey}_serving`]);
  if (perSrv != null) return perSrv;

  const flat = num(n[baseKey]);
  const per100 = num(n[`${baseKey}_100g`]);
  const dataPer = (n['nutrition-data-per'] || '').toLowerCase();

  if (flat != null && (dataPer === 'serving' || dataPer === 'portion')) return flat;
  if (per100 != null && servingGrams > 0) return per100 * (servingGrams / 100);
  if (flat != null && per100 != null && Math.abs(flat - per100) < 0.01) {
    return per100 * (servingGrams / 100);
  }
  return flat ?? per100 ?? 0;
}

/**
 * Build per-serving macros from an OFF product record.
 */
export function nutrientsFromProduct(product) {
  const n = product?.nutriments || {};
  let si = parseServingInfo(product?.serving_size, product);

  const hasPer100 = num(n['energy-kcal_100g']) != null
    || num(n['energy-kj_100g']) != null
    || num(n['energy_100g']) != null;

  if (!si.gramsPerServing && !si.units.ml && !si.units.cup && hasPer100) {
    si = {
      ...si,
      units: enrichUnits({ ...si.units, g: 100 }),
      defaultUnit: 'g',
      gramsPerServing: 100,
      ozPerServing: Math.round((100 / OZ_G) * 100) / 100,
      label: /\d+\s*g\b/i.test(si.label) ? si.label : '100 g',
      preferOz: false,
    };
  }

  // Use mL as mass proxy for beverages when grams unknown (water ≈ 1 g/mL)
  const scaleG = si.gramsPerServing
    || (si.units?.ml > 0 ? si.units.ml : 0)
    || (hasPer100 ? 100 : 0);
  const round1 = (v) => Math.round((v || 0) * 10) / 10;

  const calories = Math.round(kcalFromNutriments(n, scaleG) || 0);
  const protein = round1(pickNutrient(n, 'proteins', scaleG));
  const carbs = round1(pickNutrient(n, 'carbohydrates', scaleG));
  const fat = round1(pickNutrient(n, 'fat', scaleG));
  const fiber = round1(pickNutrient(n, 'fiber', scaleG));
  const saturated_fat = round1(pickNutrient(n, 'saturated-fat', scaleG));

  let note = null;
  if (calories === 0 && hasPer100) {
    note = 'Calories not on file per serving — try editing values or a different barcode listing.';
  } else if (calories === 0) {
    note = 'No nutrition data found for this product — enter values manually.';
  } else if (!product?.serving_size && hasPer100 && si.label === '100 g') {
    note = 'Using per 100 g (serving size not in database).';
  }

  return {
    serving: si.label,
    servingInfo: si,
    calories,
    protein,
    carbs,
    fat,
    fiber,
    saturated_fat,
    needsReview: calories === 0,
    note,
  };
}

/** Back-compat wrapper */
export function nutrientsFromOFF(nutriments, serving, product = null) {
  return nutrientsFromProduct({
    nutriments,
    serving_size: serving,
    ...product,
  });
}

export { OZ_G } from './serving_units.js';
