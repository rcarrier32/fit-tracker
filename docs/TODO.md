# To do: work a cloud session couldn't finish

Everything below was left open on 2026-11-11 (app v128) because a cloud session can't do it:
no Facebook login, no YouTube access, no API keys. Most of it needs **a Claude session on the user's
own computer**, where the browser is logged in and YouTube opens. Start there; each item says
what to run and how to check it. Ask the user before anything marked *(decide)*.

Before pushing, as always: `./scripts/bump-version.sh <n>` then `./scripts/bump-version.sh --check`.

## 1. Facebook reels → Daily Mobility

Done 2026-11-11 (v147): all 29 links read; the table in
[`research/notes-daily-mobility/facebook_reels.md`](research/notes-daily-mobility/facebook_reels.md) says what each one is
and what the app uses. Quadruped Swing Throughs plays its reel; Griffith's "Motion is lotion" moves and Jtm_fit's 5 ladder
drills were added. The reels that match Knee Circles, Standing Hip IR/ER Lifts, Knee Pull Heel Bridge and Squat to
Hamstring Stretch are screen recordings, not links: send those links to replace the stand-ins.

Undecided *(decide with the user)*: heel clicks, hip opener into knee lean back, and whether the 90/90 variants get their
own rows (no reel showed them clearly).

## 2. Stand-in videos → real demos (needs YouTube, or the reels)

These moves were added with the closest video the app already had (`video_from` in their build
script); each row's note says the demo is a stand-in. Replace each with its real demo, then delete
the stand-in sentence from the note.

**Daily Mobility** (`data/build_daily_mobility.py`, `NEW`; the user's own reels should cover them, see §1):
Knee Pull Heel Bridge is still a stand-in. Knee Circles, Standing Hip Internal/External Lifts and Squat to
Hamstring Stretch play YouTube demos since 2026-11-12 (v151) until their reel links come in; Quadruped Swing
Throughs plays its reel.

**HoopStudy 8-Week** (`data/build_hoopstudy.py`, `NEW`; HoopStudy's PDF has no pictures or videos):
done 2026-11-11 (v146) for A-March · A-Skip · Power Skip · OH March · Falling Sprints · Paused Squat Jumps ·
Single Leg Wall Stride; v151 (2026-11-12) for Hollow Hold Sit Up and Hook Plank. Still stand-ins (search found
nothing usable): Prone Pull Through · 90/90 Sprints · 90/90 Single Power Jumps. HoopStudy's course videos
(courses.hoopstudy.com, the user's login) are the best source for those. Also confirm what "90/90 Sprints",
"90/90 Single Power Jumps", "Single Leg ISO Hold" and "Hook Plank" are: the PDF names them without describing them, and the notes say what
was assumed.

**Look in FitKidHooper first** (`legendsyba/FitKidHooper`, `src/data/trainingCatalog.js`): it already links
vetted HoopStudy and other demos, including Hollow Body Hold (→ Hollow Hold Sit Up) and Squat Jumps
(→ Paused Squat Jumps), and its HoopStudy candidate list (`docs/HOOPSTUDY_CANDIDATES.md`) may have the rest.

How: `node data/enrich_program_videos.mjs --source hoopstudy` (or `--source daily`) writes
candidates to `data/<source>-video-review.json`. It needs `YOUTUBE_API_KEY` in the environment or a
gitignored `.env.local`. Approve the right ones, run it again with `--apply`, delete `video_from` for
those names in the build script, re-run the build, then:
- `node data/check_catalog.mjs`
- `node data/check_program.mjs hoopstudy_8wk_in_season --net`
- `node data/check_program.mjs daily_mobility --net`

Provider demos (PJF, BWS, Griffith) beat expert channels, which beat random ones
([ADDING_A_PROGRAM.md](ADDING_A_PROGRAM.md) §3).

## 3. Catalog exercises with no video

Done 2026-11-12 (v150): every catalog exercise has a video except Basketball (it's a game, not a move).

The 25 BWS-tagged extras that got YouTube demos (Ab Wheel Rollout, Hack Squat, Zottman Curl and the rest;
picks in `data/bws-video-review.json`) are in no BWS workbook and no BWS program: they've been catalog-only
swap options since the first commit. The BWS workbook links (124 exercises, `data/bws_exercise_db.json`) are
all applied already, so there's no BWS link to wait for.

Same-move links to provider demos are `alias_of` entries in `data/providers/*.json`: Walk or Easy Bike →
PJF Nasal Breathing Cardio Warm Up, Bridge March → TrainHeroic Marching Glute Bridge With Hips Up.

## 4. Agility ladder drills

Done 2026-11-11 (v147): Ladder Twist Hops, Ladder In & Out Hops, Ladder Lateral In & Outs, Ickey Shuffle and Ali Shuffle
(Jtm_fit's reel, the user's save), in `data/build_daily_mobility.py` `REEL_NEW`. They're in the plan builder's pool when
the agility ladder is ticked. One reel shows all five: replace with one demo each (YouTube) when the quota allows.

## 5. Weekly AI check-in with a Claude API key *(decide)*

Deferred by the user. The app learns on the phone with no AI (`src/lib/learn.js`, `src/lib/adapt.js`).
An optional weekly check-in would send a summary of the week's logs to the Claude API for coaching
notes. It needs an API key the user provides, and must not send names or the email address. Talk it
through with the user before building anything: what they'd want from it and where the key lives.

## 6. Branch tidy-up (GitHub refused deletes from cloud sessions)

- `claude/charming-noether-gbkjh9`: merged (pull requests #5, #6, #7). Delete it unless new work is on it:
  `git push origin --delete claude/charming-noether-gbkjh9`.
- Other sessions' branches, **not** in `main`, so don't delete them without asking the user
  (CLAUDE.md rules): `claude/admiring-planck-pxx2wg` (3 commits), `claude/icon-update-not-applying-yc1asv`
  (58), `ccr-645a6c8f-v74bik` (77), `ccr-6b46d8ff-z08nyx` (9), `ccr-df5d237c-aov2jp` (66). Check each
  with the user: merge, or delete if `main` already has the same change.

## 7. Plan builder: still to do *(decide with the user)*

- **Other sports.** Sports days are basketball only (`sport: { name, days }` in the generator is ready for more:
  each needs its impact profile and a label on game days).

## 8. FitKidHooper: commit the In-Season Hooper program (needs push access to `legendsyba/FitKidHooper`)

A cloud session couldn't get write access to FKH, so the work is parked here:
- [`handoff/fitkidhooper/IN_SEASON_PROGRAM_PROPOSAL.md`](handoff/fitkidhooper/IN_SEASON_PROGRAM_PROPOSAL.md): the
  proposal (FKH format), built into FKH's existing program system: one 8-week `PROGRAMS` entry, 4 sessions a
  week (2 strength, 2 speed & jumps), FKH's own drills and videos, HoopStudy's middle-school volume.
- [`handoff/fitkidhooper/in-season-hooper.patch`](handoff/fitkidhooper/in-season-hooper.patch): the change
  (program + `PROGRAM_WEEK_TIERS`, badge, `PROGRAM_KIND`). It passed FKH's `verify-programs` (21 programs OK),
  `verify:path-gates` and `verify:exercise-skills` on 2026-11-11.

In a session on FitKidHooper:
1. `git apply <path>/in-season-hooper.patch` at the FKH repo root (re-check if `trainingCatalog.js` moved on).
2. Add `in-season-hooper` to the `athletic-foundation` T2/T3 phases in `src/lib/developmentPathways.js`, and bump
   `RELEASE_ID` / `WHATS_NEW` in `src/lib/changelog.js`.
3. `npm install`, then `npm run build` (runs every verify step) and the Playwright suite.
4. *(decide with the user)* Ship as an original FKH program (default), or ask HoopStudy first to feature theirs
   by name. New programs ship on founder approval.

## Known limits (no action needed)

- Generated plans on a bodyweight-only kit leave upper-body days short (about 3% of test days): with no
  band, bar or dumbbells there's little to pull with. The user trains with dumbbells.
