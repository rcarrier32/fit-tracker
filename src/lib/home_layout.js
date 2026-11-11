/**
 * Home card order and visibility (the user picks it: Customize Home). Plain module so it runs in
 * node: `node data/check_home_layout.mjs`.
 */
export const HOME_CARDS = [
  { id: 'workout',  label: "Today's Workout" },
  { id: 'daily',    label: 'Daily Mobility' },
  { id: 'week',     label: 'This week', optional: true },
  { id: 'calories', label: 'Calories' },
  { id: 'feeling',  label: "How you've been feeling", optional: true },
  { id: 'lastweek', label: 'Last week (Mondays)' },
  { id: 'tips',     label: 'Tips for today' },
  { id: 'trend',    label: 'Weight trend', optional: true },
  { id: 'body',     label: 'Body weight' },
];
/** Optional cards start hidden: Today only changes when you turn one on. */
const OPTIONAL = new Set(HOME_CARDS.filter(c => c.optional).map(c => c.id));
export const DEFAULT_ORDER = HOME_CARDS.map(c => c.id);

/**
 * Saved layout → full order (unknown ids dropped, new cards appended in their default place) and
 * the hidden set.
 */
export function resolveLayout(saved) {
  const known = new Set(DEFAULT_ORDER);
  const order = (saved?.order || []).filter((id, i, a) => known.has(id) && a.indexOf(id) === i);
  for (const id of DEFAULT_ORDER) if (!order.includes(id)) {
    // A card added in an update goes after the card it follows by default.
    const prev = DEFAULT_ORDER[DEFAULT_ORDER.indexOf(id) - 1];
    const at = prev ? order.indexOf(prev) + 1 : 0;
    order.splice(at > 0 ? at : (prev ? order.length : 0), 0, id);
  }
  const shown = new Set(saved?.shown || []);
  const hidden = new Set([...(saved?.hidden || []).filter(id => known.has(id)), ...[...OPTIONAL].filter(id => !shown.has(id))]);
  return { order, hidden };
}

/** What to save: hidden regular cards, and the optional cards you turned on. */
export function layoutToSave(order, hidden) {
  return { order, hidden: [...hidden].filter(id => !OPTIONAL.has(id)), shown: [...OPTIONAL].filter(id => !hidden.has(id)) };
}

/** Move a card one place up (-1) or down (+1). */
export function moveCard(order, id, dir) {
  const out = [...order];
  const i = out.indexOf(id), j = i + dir;
  if (i < 0 || j < 0 || j >= out.length) return out;
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}
