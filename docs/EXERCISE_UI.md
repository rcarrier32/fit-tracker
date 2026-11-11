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
keeps running on the next exercise's sheet. Timed moves done one side at a time (`sidesOf()`:
"each side/leg", "Right side, then left", PJF's "Perform each side", or a one-sided name such
as Copenhagen, side plank, single-leg, B-stance) time each side: right, then a beep and
"Switch legs — Left leg" with a 10 s switch countdown, then left on a fresh timer. The set
logs after both sides. Write "Each side." in a plan's notes to turn this on. ▶ Video on a list card opens that exercise in
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
- `actions`: plan-specific buttons such as Remove (for your own added exercises).

Rehab and band-only plans use this exercise shape and render through these three functions.
Strength programs, including home dumbbell plans, stay on the Lift card so people can log
weight and reps. See [ADDING_A_PROGRAM.md](ADDING_A_PROGRAM.md).

## Clipping a demo that shows other moves too

Some provider demos show more than one exercise (PJF's *KB Swing + Box Jump Contrast*). A clip
plays only one exercise's part, looping, for PJF/HLS/MP4 videos and YouTube (`start`/`end`).

- **On the phone:** exercise sheet → **⋯** → ✂ Clip video (also in the Lift card's ⋯ menu). Play
  the demo, tap Start and End, Save. A small "✂ 0:12–0:27 · full video" line shows under a clipped
  demo. It's a one-off per exercise, so the tools stay behind ⋯.
- **Stored:** this phone's clips in `pref('clips')` (part of Export data); clips for every device in
  [`data/clips.json`](../data/clips.json). Copy a phone's clip there to ship it.
- Each clip is tied to one video (`src`: `mux:<id>`, `yt:<id>` or the file URL), so if an
  exercise's video changes the old clip is ignored. Code: `clipFor` / `saveClip` in
  `src/lib/local_videos.js`, the player and tools in `src/lib/exercise_ui.js`.


## During and after a workout (v117)

- **Rest timer** keeps running when you leave the Lift tab: a pill above the tab bar shows it (tap
  the time to go back). −15 / +15 / Skip on the card, in the sheet and on the pill.
- **Undo**: logging a set shows "Set N logged · Undo" for 5 s.
- **Session clock** in the header from the first logged set; the finish screen shows the minutes.
- **⋯ menu**: 📝 note (shows next time as "Last note: …"), 🤕 this hurts, 🏋 plates & warm-up sets
  (plates a side for barbell/Smith/trap bar, and a warm-up ramp to the working weight).
- **Finish screen**: how it felt (easy / about right / too much, energy), anything that hurt, a
  workout note, and Share (the phone's share sheet, or copy). Hurt twice and an exercise leaves new
  plans; two of the last three feeling like too much suggests a lighter week (src/lib/learn.js).
- **📅 Add to calendar** (Today → Body weight card): weekly events for the training days with an
  alert before each, as an .ics file the phone's Calendar imports (src/lib/calendar.js,
  `node data/check_calendar.mjs`). A home-screen web app can't schedule its own reminders reliably,
  so the calendar does it. Days come from the weekly schedule, else the days the logs show you
  train; length from how long workouts really take.
- **Not done: saving demo videos offline.** TrainHeroic demos are YouTube (can't be cached) and PJF
  demos are Mux HLS streams, which iPhone Safari plays outside the service worker, so caching them
  wouldn't make them play offline.
- **♡ Favourites** (src/lib/favorites.js, pref `fav_exercises`): tap ♡ on any exercise screen (Lift,
  Hip, plans) or ⋯ → ♡ Favourite on a Lift card. A ♥ shows on the card and in Swap, where favourites
  of the same movement come first. Generate (+2.5, more than anything learned) and the Manual builder
  pick them first; the preview lists the ones used and each says "♥ your favourite".
- **🏋 Going to the gym today?** (Lift screen, shown when today has something the gym could do better;
  src/lib/gym_swap.js, `node data/check_gym_swap.mjs`): swaps home stand-ins (working lifts done only with a
  band, mini band, slider or bodyweight, in a loadable movement) for the gym version of the same movement and
  main muscle, dumbbells first (the user prefers them), then the gym's cable, machines, barbell (⚙), best first by what the coach
  programs use, ♥ favourites, BWS gym lifts and a name match; accessories stay accessories, combo moves rank
  last. Bodyweight lunges get "hold dumbbells" instead of a machine. Never swapped: ♥ favourites,
  Copenhagen/Nordics, dumbbell and kettlebell work (a choice, not a stand-in), holds, mobility, core, jumps,
  anything logged today. Sets and reps stay; tap again to put the plan back.
