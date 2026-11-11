/**
 * Home card order and visibility (the user picks it: Customize Home). Plain module so it runs in
 * node: `node data/check_home_layout.mjs`.
 */
export const HOME_CARDS = [
  { id: 'workout',  label: "Today's Workout" },
  { id: 'daily',    label: 'Daily Mobility' },
  { id: 'calories', label: 'Calories' },
  { id: 'lastweek', label: 'Last week (Mondays)' },
  { id: 'tips',     label: 'Tips for today' },
  { id: 'body',     label: 'Body weight' },
];
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
  const hidden = new Set((saved?.hidden || []).filter(id => known.has(id)));
  return { order, hidden };
}

/** Move a card one place up (-1) or down (+1). */
export function moveCard(order, id, dir) {
  const out = [...order];
  const i = out.indexOf(id), j = i + dir;
  if (i < 0 || j < 0 || j >= out.length) return out;
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}
