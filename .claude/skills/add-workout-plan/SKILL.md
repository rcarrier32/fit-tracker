---
name: add-workout-plan
description: Turn a workout plan document (pasted text, PDF, coach sheet) into a program in fit-tracker, with videos for every exercise, weight/rep logging, timers, validation, and deploy. Use whenever the user asks to build, add, import or "build in" a workout plan or program for themselves or someone else.
---

# Add a workout plan to fit-tracker

Follow [docs/ADDING_A_PROGRAM.md](../../../docs/ADDING_A_PROGRAM.md) step by step. It is the standard. The rules below are the ones that were missed before:

1. **Lift card, not rows.** Strength and home plans play on the Lift screen: weight, reps, RPE, ▶ Video, rest and set timers. Only rehab and band-only plans use the row + detail layout. No code change is needed for a new program.
2. **Every exercise has a video.** That includes warm-up items, walks and stretches. Run `enrich_program_videos.mjs` and approve the matches. Search long moves with `--max-seconds 2400`.
3. **Carry the whole document over:** warm-ups (timed ones get timers), per-day notes, follow-along videos, week-by-week progression, equipment, goal, habits and nutrition guidance (`guide`), the safety note, and progress tracking (`progress_check` days and the Body tab check-ins). Before building, list every section of the document and map each one to a field. Say plainly if something has no home.
4. **Write a re-runnable build script** (`data/build_<program>.py`, copied from `build_home_beginner.py`). Don't hand-edit `library.json`.
5. **`node data/check_program.mjs <id> --net` must pass** before you check it in the preview.
6. **Preview at phone size** and step through every day. Then bump the version in 3 places and push as rcarrier32. Ask before pushing unless the user already said to.
7. **Public repo:** generic program names, no personal names or data.
