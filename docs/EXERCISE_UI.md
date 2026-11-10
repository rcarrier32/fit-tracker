# Exercise UI system

Every plan shows exercises the same way, through [`src/lib/exercise_ui.js`](../src/lib/exercise_ui.js).
This is the FKH pattern: a short list you can scan, and a detail screen you tap into.

| Piece | What it does |
|---|---|
| `exerciseRowHTML(ex, opts)` | Short list row: 16:9 video thumb, name, prescription, set dashes, check circle |
| `wireExerciseRows(root, { open, check })` | Tap a row to open the detail. Tap the circle to check it off. |
| `openExerciseDetail(ex, opts)` | Detail sheet: embedded YouTube on top, then sets/log, extra block, how-to, warnings, actions, and **Next →** |

Used by: Hip Recovery, TOS Rehab, Daily Mobility, PJF band days and Lift. It follows
FitKidHooper's `ExerciseDetailSheet`: **✓ Mark exercise done** beside **Next →** in a sticky
footer, and with `autoNext` the last set moves on to the next exercise by itself. Rest timing
and timer cues (beep, vibrate, voice) are FKH's, ported in
[`src/lib/exercise_session.js`](../src/lib/exercise_session.js).

**Lift (Start workout).** Lift runs through this same sheet. `mountSets` puts the Lift card's
own weight/reps/RPE rows inside it (the same card and handlers the list uses), so last-time
prefill, +5, RPE, set timers and e1RM work the same in both. The flow is warm-up moves, then
the exercises. Next → goes to the next unfinished exercise, except at the end of a superset
or circuit done a set at a time, where it goes back round to the group's first unfinished
one. The rest timer counts down from the exercise's `rest` (counts up when it has none) and
keeps running on the next exercise's sheet. ▶ Video on a list card opens that exercise in
the flow. Today's **Start workout** opens it straight away.

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
- `autoNext`: move on by itself once the exercise is done (FKH).
- `mountSets(el, changed)`: draw your own set logging instead of the checkboxes (Lift).
- `finish`: a button on the 🎉 card, such as Finish workout.
- `actions`: plan-specific buttons such as Pause and Remove.

Rehab and band-only plans use this exercise shape and render through these three functions.
Strength programs, including home dumbbell plans, stay on the Lift card so people can log
weight and reps. See [ADDING_A_PROGRAM.md](ADDING_A_PROGRAM.md).
