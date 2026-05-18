/**
 * Static catalogs (exercises, programs, recipes, common foods) loaded from JSON
 * and cached in memory. NOT stored in IndexedDB — they're large and read-only.
 */

let _cache = null;
let _loading = null;

export async function loadCatalogs() {
  if (_cache) return _cache;
  if (_loading) return _loading;
  _loading = (async () => {
    const [lib, meals, foods] = await Promise.all([
      fetch('data/library.json').then(r => r.json()),
      fetch('data/meal_library.json').then(r => r.json()).catch(() => ({ recipes: [] })),
      fetch('data/common_foods.json').then(r => r.json()).catch(() => ({ foods: [] })),
    ]);
    const programs = [
      ...lib.programs.pjf.map(p => ({ ...p, source: 'PJF' })),
      ...lib.programs.bws.map(p => ({ ...p, source: 'BWS' })),
    ];
    const exerciseById = new Map(lib.exercises.map(e => [e.id, e]));
    const exerciseByName = new Map(lib.exercises.map(e => [e.name.toLowerCase(), e]));
    // Also index by aliases so variant name formats resolve to the same entry
    lib.exercises.forEach(e => (e.aliases || []).forEach(a => {
      if (!exerciseByName.has(a.toLowerCase())) exerciseByName.set(a.toLowerCase(), e);
    }));
    const programById = new Map(programs.map(p => [p.id, p]));

    // Build unified meal/food catalog
    const mealItems = [];
    (meals.recipes || []).forEach((r, i) => mealItems.push({
      id: `recipe-${i}`,
      name: r.name,
      calories: r.default_calories,
      protein: r.default_protein_g || 0,
      fat: r.default_fat_g || 0,
      carbs: r.default_carbs_g || 0,
      fiber: r.default_fiber_g || (r.variants?.[0]?.fiber_g) || 0,
      category: r.category,
      ingredients: r.ingredients,
      instructions: r.instructions,
      variants: r.variants,
      sources: r.sources,
      kind: 'recipe',
    }));
    (foods.foods || []).forEach((f, i) => mealItems.push({
      id: `food-${i}`,
      name: f.name,
      serving: f.serving,
      calories: f.calories,
      protein: f.protein,
      fat: f.fat,
      carbs: f.carbs,
      category: f.category,
      kind: 'food',
    }));

    _cache = {
      exercises: lib.exercises,
      exerciseById,
      exerciseByName,
      programs,
      programById,
      mealItems,
      warmups: lib.warmups || {},
      warmupSetsProtocol: lib.warmup_sets_protocol || null,
    };
    return _cache;
  })();
  return _loading;
}

export function getCachedSync() {
  return _cache;  // returns null if not loaded yet
}

// Returns all programs including user-saved custom plans from prefs
export async function getAllPrograms() {
  const { programs } = await loadCatalogs();
  const { pref } = await import('../db.js');
  const custom = (await pref('custom_programs')) || [];
  return [...programs, ...custom.map(p => ({ ...p, source: 'custom' }))];
}
