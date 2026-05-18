/**
 * Open Food Facts nutrient + serving parsing (US oz labels, kJ-only energy, per-100g scaling).
 */
const OZ_G = 28.349523125;

export const OFF_USER_AGENT = 'FitTracker/1.0 (https://github.com/local/fit-tracker)';

export function offFetch(url) {
  return fetch(url, { headers: { 'User-Agent': OFF_USER_AGENT } });
}

function num(v) {
  if (v == null || v === '') return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

/** @returns {{ label: string, gramsPerServing: number|null, ozPerServing: number|null, preferOz: boolean }} */
export function parseServingInfo(servingStr, product = null) {
  let label = (servingStr || product?.serving_size || '').trim();
  if (!label && product?.serving_quantity != null && product?.serving_quantity_unit) {
    label = `${product.serving_quantity} ${product.serving_quantity_unit}`;
  }
  if (!label) label = '1 serving';

  const ozM = label.match(/(\d+\.?\d*)\s*(?:oz|ounce|ounces)\b/i);
  const gM = label.match(/(\d+\.?\d*)\s*g\b/i);

  let grams = null;
  if (product?.serving_quantity != null) {
    const q = parseFloat(product.serving_quantity);
    const u = (product.serving_quantity_unit || '').toLowerCase();
    if (!Number.isNaN(q)) {
      if (u === 'g' || u === 'gram' || u === 'grams') grams = q;
      else if (u === 'oz' || u === 'ounce' || u === 'ounces') grams = q * OZ_G;
      else if (!u && q > 0 && q < 50) grams = q * OZ_G; // bare number + oz in label
    }
  }
  if (grams == null && gM) grams = parseFloat(gM[1]);
  if (grams == null && ozM) grams = parseFloat(ozM[1]) * OZ_G;

  const oz = ozM ? parseFloat(ozM[1]) : (grams ? Math.round((grams / OZ_G) * 100) / 100 : null);
  const ozIdx = label.toLowerCase().search(/\b(?:oz|ounce)/);
  const gIdx = label.toLowerCase().indexOf('g');
  const preferOz = !!ozM && (gIdx < 0 || (ozIdx >= 0 && ozIdx < gIdx));

  return { label, gramsPerServing: grams, ozPerServing: oz, preferOz };
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

  if (!si.gramsPerServing && hasPer100) {
    si = {
      ...si,
      gramsPerServing: 100,
      ozPerServing: Math.round((100 / OZ_G) * 100) / 100,
      label: /\d+\s*g\b/i.test(si.label) ? si.label : '100 g',
      preferOz: false,
    };
  }

  const scaleG = si.gramsPerServing || (hasPer100 ? 100 : 0);
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

export { OZ_G };
