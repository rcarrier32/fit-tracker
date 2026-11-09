---
name: add-workout-plan
description: Turn a workout plan document (pasted text, PDF, coach sheet) into a program in fit-tracker, with videos for every exercise, weight/rep logging, timers, validation, and deploy. Use whenever the user asks to build, add, import or "build in" a workout plan or program for themselves or someone else.
---

# Add a workout plan to fit-tracker

Follow [docs/ADDING_A_PROGRAM.md](../../../docs/ADDING_A_PROGRAM.md) step by step. It is the standard. The rules below are the ones that were missed before:

1. **Lift card, not rows.** Strength and home plans play on the Lift screen: weight, reps, RPE, ▶ Video, rest and set timers. Only rehab and band-only plans use the row + detail layout. No code change is needed for a new program.
2. **Every exercise has a video.** That includes warm-up items, walks and stretches. Run `enrich_program_videos.mjs` and approve the matches. Search long moves with `--max-seconds 2400`. **Provider videos first:** PJF, BWS, Griffith or the user's app links beat expert channels (E3 Rehab, Squat University, …), and those beat random channels. Check whether a provider already demos the move under another name before searching (docs/ADDING_A_PROGRAM.md §3).
3. **Carry the whole document over:** warm-ups (timed ones get timers), per-day notes, follow-along videos, week-by-week progression, equipment, goal, habits and nutrition guidance (`guide`), the safety note, and progress tracking (`progress_check` days and the Body tab check-ins). Before building, list every section of the document and map each one to a field. Say plainly if something has no home.
4. **Write a re-runnable build script** (`data/build_<program>.py`) using `data/program_builder.py`. Copy `build_athletic_programs.py` when building from existing catalog exercises, or `build_home_beginner.py` when adding new ones. Give each program a `group`; new groups appear on their own. Don't hand-edit `library.json`.
   - Prefer catalog names that already have vetted videos (library.json, plus `HIP_CATALOG_ENTRIES` in `src/lib/hip_protocol.js`). For the user's own hip, follow the hip rules in memory: Copenhagen in every hip session, advanced single-leg balance, and pain governs rehab work.
5. **Classify every new exercise** against [docs/EXERCISE_TAXONOMY.md](../../../docs/EXERCISE_TAXONOMY.md): pass `tags={...}` to `ensure_exercise`, fix any `REVIEW` guesses in `data/exercise_tags.json`, and make sure `lib.save()` ran (it merges tags and rebuilds `data/program_index.json`).
6. **Design from the knowledge layer:** follow [docs/PROGRAM_DESIGN.md](../../../docs/PROGRAM_DESIGN.md) (rules taken from PJF and BWS) and compare against similar programs in `data/program_index.json`. **Pick exercises by muscle and movement from `data/exercise_index.json`** (`by_primary_muscle`, `by_muscle`, `by_pattern`). Each entry carries its video and `video_from`, so every pick comes with its video. Prefer `pjf`/`trainheroic` (provider demos) over `catalog`. Provider exercises (data/providers/) can be used by name: `program_builder` knows them and never copies them into library.json.
6b. **Alternatives:** give each exercise row 2–4 `alternates` that fit the plan's equipment (see `data/build_lean_tone.py`).
7. **`node data/check_catalog.mjs` and `node data/check_program.mjs <id> --net` must pass** before you check it in the preview.
8. **Preview at phone size** and step through every day. Then bump the version in 3 places and push as rcarrier32. Ask before pushing unless the user already said to.
9. **Repo content:** paid provider content (PJF, TrainHeroic, BWS) is fine to commit (personal-use app); it lives in `data/providers/` and loads automatically. Still no personal names or data.

## Designing a new plan (no source document)

When the user asks for a plan by goal ("build me a 4-day athletic plan") instead of handing over a document:

1. Draft with the same engine the app uses:
   `node data/generate_plan.mjs --goal <strength|muscle|fat_loss|athletic|durability> --days N --minutes M --weeks W --equipment a,b,c [--focus Glutes,Core] [--plyo] [--level 1-3] --seed S`
   Add `--json > /tmp/draft.json` for the full program. Try a few seeds and pick the best one.
2. Review it against [docs/PROGRAM_DESIGN.md](../../../docs/PROGRAM_DESIGN.md) and similar programs in `data/program_index.json`: weekly sets per muscle, session order, phase changes, time per session, and the user's hip rules.
3. Hand-tune: swap picks, adjust doses, and add the day notes and warm-up cues the generator doesn't write. Then write `data/build_<plan>.py` using `program_builder` (copy `build_athletic_programs.py`), giving it a `group`.
4. Validate (`check_catalog`, `check_program --net`), preview at phone size, bump the version, ship.

If the user just wants a plan for themselves on their phone, point them to **Plans → Generate a plan** instead.

When the generator's choices look wrong across many plans, fix the rules (`data/design_rules.json`, and the matching doc) or the tags (`data/exercise_tags.json`), not the individual plan. Re-run `node data/generate_plan.mjs --sanity` afterwards.
