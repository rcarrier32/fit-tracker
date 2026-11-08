# Adding a workout program

How a plan document (a PDF, a pasted doc, a coach's sheet) becomes a program in the app.
Worked examples: `data/build_athletic_programs.py` (three 6-week programs, built from
existing catalog exercises) and `data/build_home_beginner.py` (one plan, new exercises).
Both use the helpers in `data/program_builder.py`. `data/build_hip_program.mjs` builds the user's
hip plan straight from the Hip tab's data (`src/lib/hip_protocol.js`): re-run it after changing the
Hip tab's sessions, then `python3 data/tag_exercises.py`.

## 1. Pick the screen it plays on

| Kind of plan | Screen | What the person gets |
|---|---|---|
| Anything with weights: dumbbells, barbells, machines, bodyweight strength (BWS, PJF, home plans) | **Lift card** (default) | Weight + reps + RPE per set, last-time prefill, ▶ Video embed, rest timer, ▶ Start timer on timed moves |
| Rehab and band-only work (Hip, TOS, PJF band days) | Row + detail ([EXERCISE_UI.md](EXERCISE_UI.md)) | Thumbnail rows, tap for the video with set checkboxes, no weight entry |

A new program in `library.json` gets the Lift card without any code change. Don't switch
a strength plan to rows. People need to log their weights.

## 2. Write a build script: `data/build_<program>.py`

Import `Library, ex, w, expand_weeks` from `program_builder.py`. Save the programs under a
new key with `lib.set_programs('<key>', [...])`. Any key other than `pjf`/`bws` shows up on
the Programs screen and in the Mixed Week picker, listed under each program's `group`.
No app code change is needed.

The script owns the program and its new catalog entries. It's safe to re-run, so edit the
script and re-run it instead of hand-editing `library.json`.

**Program fields** (shown on the Programs card and the Start sheet):
`id`, `program_name`, `group` (the heading it lists under), `source`, `description`,
`sessions_per_week`, `session_length_min`, `level`, plus optional `equipment[]`, `goal`,
`guide[]` (`{title, items[]}`: habits, nutrition, reminders) and `safety`.

**Weeks → days → exercises.** Each day has `day_num` and `focus` (the title, e.g.
"Mon · Glutes & Legs"). Optional per day:
- `warmup[]`: `{name, reps | time, notes}`. Timed items get a timer button.
- `notes[]`: coaching cues for that day (week goal, tempo, rest).
- `video`: `{title, url, note?}`. A follow-along video. YouTube plays in the app; other sites open in the browser.
- `progress_check`: button label that opens the weekly check-in (start of the plan, and before each rest day).

Each exercise: `name`, `sets`, `reps` **or** `time` (`"30:00"`, `"15s"`), `rest`
(shown as the target, e.g. `"45-60s"`. The rest timer counts up from 0 after each set), `round_group` (e.g. `"Circuit · 2 rounds"`), `notes`.
Optional per exercise: `alternates` (a list of catalog names, shown first under **Plan
alternatives** in the Lift card's Swap menu, like BWS alternates; give every strength slot 2–4
that fit the plan's equipment) and `video_url` (the row's own video, `&t=` for a start time).
Progression across weeks (more rounds, more reps) goes in the script's per-week loop.

**Two programs at once** (e.g. strength Mon/Wed/Fri plus agility Tue/Thu): say so in the
description. The person sets it up with Today → Set up Mixed Week, and each program keeps
its own progress.

**Names.** Reuse an existing catalog name when the movement already exists, so its vetted
video comes with it (check `library.json` and the hip tab's `HIP_CATALOG_ENTRIES`).
Otherwise add it with `lib.ensure_exercise(name, '<source tag>', tags={...})`.

**Classify every new exercise** ([EXERCISE_TAXONOMY.md](EXERCISE_TAXONOMY.md)): pass
`primary_muscle, muscles, pattern, role, equipment, level, unilateral, plane, hip_focus` in
`tags`. Anything you leave out is guessed by `data/suggest_tags.py` and printed as `REVIEW`, so
check those lines and fix the guesses in `data/exercise_tags.json`. `lib.save()` merges the tags
into `library.json` and rebuilds `data/program_index.json` (the summary of every program
that plan design reads). To edit tags by hand, change `exercise_tags.json` and run
`python3 data/tag_exercises.py`.

## 3. Videos: every exercise gets one

```bash
node data/enrich_program_videos.mjs --source <tag>
```

Then set `"approved"` in `data/<tag>-video-review.json` and apply:

```bash
node data/enrich_program_videos.mjs --source <tag> --apply
```

- Strength and fitness clips: Claude may judge the candidates itself. Rehab clips stay human-reviewed.
- Long moves (walks, stretches): re-run with `--only "<name>" --redo --max-seconds 2400` to find follow-along length videos.
- Check every link from the source document still works (the validator's `--net` flag does this).

## 4. Validate. It must pass before shipping.

```bash
node data/check_catalog.mjs
```

Every catalog exercise must be tagged with taxonomy values.


```bash
node data/check_program.mjs <program_id> --net
```

For PJF programs, add `--local ~/Documents/fit-tracker-private/pjf-local-videos.json`
to count the on-device PJF videos, the same way the phone does.

It fails on names that don't resolve, exercises with no video (they'd show "🔍 Find"), timed
moves without a parseable time, missing sets/reps, and dead follow-along links.

## 5. Check it in the preview, bump the version, ship

1. Preview at phone size (`.claude/launch.json` → `fit-tracker`): start the plan from Programs and step through every day with **Day →**.
2. Bump the version in all three places: `version.json`, `sw.js` `CACHE`, and `index.html` (`?v=` ×2 and `__FIT_V`).
3. Commit and push `main` as **rcarrier32**. The active `gh` account may be legendsyba. Pushing is the deploy (GitHub Pages).
4. Confirm `https://rcarrier32.github.io/fit-tracker/version.json` shows the new number.

## Keep out of the public repo

The repo and site are public. Never commit PJF member stream ids or notes, people's names, or
personal data. Plans for another person get a generic name. Their data stays on their phone.
