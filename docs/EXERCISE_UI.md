# Exercise UI system

Every plan shows exercises the same way, through [`src/lib/exercise_ui.js`](../src/lib/exercise_ui.js).
This is the FKH pattern: a short list you can scan, and a detail screen you tap into.

| Piece | What it does |
|---|---|
| `exerciseRowHTML(ex, opts)` | Short list row: 16:9 video thumb, name, prescription, set dashes, check circle |
| `wireExerciseRows(root, { open, check })` | Tap a row to open the detail. Tap the circle to check it off. |
| `openExerciseDetail(ex, opts)` | Detail sheet: embedded YouTube on top, then sets/log, extra block, how-to, warnings, actions, and **Next →** |

Used by: Hip Recovery, TOS Rehab, Daily Mobility, and Lift. Lift only uses the view-only
detail (for warm-up moves and the Full list view), because weight and rep entry stay on its card.

## Lift step-by-step mode

Lift's equivalent of the detail sheet's **Next →** flow lives in `setupGuided()` in
`src/views/workout.js`. It shows the list view's own Lift cards one at a time, with
`videoBlockHTML()` from this file on top, a progress bar (tap to jump), a rest line that
stays on screen after Next, and Back / Next. Next goes down the list, except at the end of a
superset or circuit done a set at a time, where it goes back to the group's first unfinished
exercise. The mode (`lift_view` pref: `guided` or `list`) and the current step (`guided_step`)
are saved, so a reload or a swap keeps your place.

## Exercise shape (author new plans in this shape)

```js
{
  id: 'pt-sl-balance-pad',          // stable — logs are keyed by it, never rename
  name: 'Single-Leg Balance on BOSU / Pad + Weight Pass-Arounds',
  subtitle: 'One line on what it is for',
  sets: '3 × 5 passes each direction per leg',   // "N × …" → N set rows; anything else → 1
  freq: '3× / week',
  cues: ['Short how-to lines, one idea each'],
  warning: 'Optional stop/regress rule',
  askPt: 'Optional question for the PT',
  videoId: '…' | video_url: '…',    // rehab videos only via the gated review file
  search: 'youtube fallback query',
  optional: true,                   // shows an OPTIONAL badge
}
```

## Plan responsibilities

A plan only stores state and hands callbacks to `openExerciseDetail`:

- `isDone` / `setDone(v)`: the per-day check-off. Finishing every set calls `setDone(true)`.
- `sets: { get, save }`: per-set booleans for today (`hip_sets`, `tos_sets`).
- `next()`: the next unchecked exercise in the same list, so a session runs top to bottom.
- `completeLabel`: shown when nothing is left. The list also shows a 🎉 complete card.
- `actions`: plan-specific buttons such as Pause and Remove.

Rehab and band-only plans use this exercise shape and render through these three functions.
Strength programs, including home dumbbell plans, stay on the Lift card so people can log
weight and reps. See [ADDING_A_PROGRAM.md](ADDING_A_PROGRAM.md).
