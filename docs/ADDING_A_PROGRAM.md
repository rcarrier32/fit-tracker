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
| Anything with weights: dumbbells, barbells, machines, bodyweight strength (BWS, PJF, home plans) | **Lift card** (default) | Weight + reps + RPE per set, last-time prefill, ▶ Video embed, rest countdown, ▶ Start timer on timed moves. **Start workout** runs it one exercise at a time in the shared exercise sheet (video on top, Next →) |
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
(shown as the target, e.g. `"45-60s"`. The rest timer counts down from it after each set, low end of a range, and counts up when there is none), `round_group` (e.g. `"Circuit · 2 rounds"`), `notes`.
A running row written as one set is N sets: `reps="8 rounds"`, PJF's bare `"14"` on a sprint/zone row, or `"3 × 10 yd"`. When its notes (or name) spell out the
phases, like `"10 s fast, 20 s jog, 40 s walk"`, each round gets an interval timer that calls
out each phase and starts the next round by itself.
Optional per exercise: `alternates` (a list of catalog names, shown first under **Plan
alternatives** in the Lift card's Swap menu, like BWS alternates; give every strength slot 2–4
that fit the plan's equipment) and `video_url` (the row's own video, `&t=` for a start time).
Progression across weeks (more rounds, more reps) goes in the script's per-week loop.

**Two programs at once** (e.g. strength Mon/Wed/Fri plus agility Tue/Thu): say so in the
description, and give the program a `suggested_week` (`days`: 7 entries Sun..Sat, each `'train'`,
`'rest'` or another program id; `labels`: names for those ids). The Start sheet then offers
"Set up my week" and writes the Mixed Week schedule in one tap. The person sets it up with Today → Set up Mixed Week, and each program keeps
its own progress.

**Build from the exercise index.** `data/exercise_index.json` (rebuilt by `lib.save()` / `tag_exercises.py`
via `data/catalog.mjs`) lists every exercise the phone has, from library, the Hip tab and provider files, with its muscles,
pattern, role, equipment, level, its video and `video_from` (`pjf`, `trainheroic` = the provider's own demo;
`catalog` = library.json's YouTube link). Fill each slot by muscle and pattern (`by_primary_muscle`, `by_muscle`,
`by_pattern`) and the video comes with the exercise. The validators and `generate_plan.mjs` load the same catalog.

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

**Provider videos first, always.** Use this order, and when a better tier turns up later, swap it in:
1. Our providers' own demos: PJF (The PJF System, PJF Performance, and on-device member videos), BWS
   ("BWS Programs" / Jeremy Ethier), Griffith (TrainHeroic), and links the user sends from those apps.
   Before searching, check whether any provider already has the same move under another name.
2. A trusted expert channel (E3 Rehab, Squat University, Rehab Hero, Cressey, NASM, …; the
   allowlists in `enrich_program_videos.mjs` and `enrich_hip_videos.mjs`).
3. Anything else only as a stand-in, and a document's own follow-along videos stay as given.

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

## Provider content and the public repo

This is a personal-use app, and the user chose (2026-11-09) to keep paid provider content in the
repo: PJF member videos and notes (`data/providers/pjf.json`) and the TrainHeroic plan
(`data/providers/trainheroic.json`, written by `~/Documents/fit-tracker-private/build_th_import.py`).
The app loads every file in `BUNDLED_SOURCES` (`src/lib/local_videos.js`) at boot, so no phone
needs an import. Add a new provider the same way: a file in `data/providers/` plus its name in that list.

Still keep out: people's names and personal data. Plans for another person get a generic name,
and their data stays on their phone.
