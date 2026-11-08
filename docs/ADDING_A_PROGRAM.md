# Adding a workout program

How a plan document (a PDF, a pasted doc, a coach's sheet) becomes a program in the app.
`data/build_home_beginner.py` is the worked example. Copy it.

## 1. Pick the screen it plays on

| Kind of plan | Screen | What the person gets |
|---|---|---|
| Anything with weights: dumbbells, barbells, machines, bodyweight strength (BWS, PJF, home plans) | **Lift card** (default) | Weight + reps + RPE per set, last-time prefill, ▶ Video embed, rest timer, ▶ Start timer on timed moves |
| Rehab and band-only work (Hip, TOS, PJF band days) | Row + detail ([EXERCISE_UI.md](EXERCISE_UI.md)) | Thumbnail rows, tap for the video with set checkboxes, no weight entry |

A new program in `library.json` gets the Lift card without any code change. Don't switch
a strength plan to rows. People need to log their weights.

## 2. Write a build script: `data/build_<program>.py`

The script owns the program and its new catalog entries. It's safe to re-run, so edit the
script and re-run it instead of hand-editing `library.json`.

**Program fields** (shown on the Programs card and the Start sheet):
`id`, `program_name`, `source` (the group it lists under), `description`,
`sessions_per_week`, `session_length_min`, `level`, plus optional `equipment[]`, `goal`,
`guide[]` (`{title, items[]}`: habits, nutrition, reminders) and `safety`.

**Weeks → days → exercises.** Each day has `day_num` and `focus` (the title, e.g.
"Mon · Glutes & Legs"). Optional per day:
- `warmup[]`: `{name, reps | time, notes}`. Timed items get a timer button.
- `notes[]`: coaching cues for that day (week goal, tempo, rest).
- `video`: `{title, url, note?}`. A follow-along video. YouTube plays in the app; other sites open in the browser.
- `progress_check`: button label that opens the weekly check-in (start of the plan, and before each rest day).

Each exercise: `name`, `sets`, `reps` **or** `time` (`"30:00"`, `"15s"`), `rest`
(`"45-60s"` starts a 45 s rest timer), `round_group` (e.g. `"Circuit · 2 rounds"`), `notes`.
Progression across weeks (more rounds, more reps) goes in the script's per-week loop.

**Names.** Reuse an existing catalog name when the movement already exists, so its vetted
video comes with it (check `library.json` and the hip tab's `HIP_CATALOG_ENTRIES`).
Otherwise add a catalog entry with `sources: ['<tag>']` so the video pipeline finds it.

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
node data/check_program.mjs <program_id> --net
```

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
