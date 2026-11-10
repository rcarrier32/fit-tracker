/**
 * Favourite exercises (♡ on the exercise screen and in the Lift ⋯ menu), kept in pref('fav_exercises').
 * The plan builders prefer them (src/lib/generator.js, src/lib/plan_builder.js) and Swap lists them first.
 * Loaded once at boot so screens can ask isFav() without waiting.
 */
import { pref } from '../db.js';

let _favs = new Set();
const listeners = new Set();

export async function loadFavorites() {
  _favs = new Set((await pref('fav_exercises')) || []);
  return _favs;
}
export const isFav = (name) => _favs.has(name);
export const favorites = () => [..._favs];
export function onFavChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export async function toggleFav(name) {
  if (_favs.has(name)) _favs.delete(name); else _favs.add(name);
  await pref('fav_exercises', [..._favs]);
  listeners.forEach(fn => { try { fn(name, _favs.has(name)); } catch { /* a closed screen */ } });
  return _favs.has(name);
}
