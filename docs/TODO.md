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

**Uncle Shen reel (saved 2026-11-20, read 2026-11-21):** one move, the same as Half Kneeling Thoracic Rotations.
Done (v203): it's in Daily Mobility and, at the user's call, the Basketball Warm-up.

Undecided *(decide with the user)*: heel clicks, hip opener into knee lean back, and whether the 90/90 variants get their
own rows (no reel showed them clearly).

## 2. Stand-in videos → real demos (needs YouTube, or the reels)

These moves were added with the closest video the app already had (`video_from` in their build
script); each row's note says the demo is a stand-in. Replace each with its real demo, then delete
the stand-in sentence from the note.

**Daily Mobility** (`data/build_daily_mobility.py`, `NEW`; the user's own reels should cover them, see §1):
No stand-ins left. Knee Circles, Standing Hip Internal/External Lifts and Squat to Hamstring Stretch play
YouTube demos since 2026-11-12 (v151) until their reel links come in; Knee Pull Heel Bridge plays the user's
YouTube pick (v153); Quadruped Swing Throughs plays its reel.

**HoopStudy 8-Week**: done 2026-11-12 (v152). The 13 moves only this program uses play HoopStudy's own
course demos from `data/providers/hoopstudy.json` (Wistia HLS links read from courses.hoopstudy.com with
the user's login; the user OK'd committing them). Moves shared with other plans (e.g. Reverse Step Back
Lunge) keep their current video. v153: the recovery day uses HoopStudy's own names and videos for 90/90 Hip
Lift with Internal Rotation, Single Leg ISO Hold (split-stance hold, both knees at 90°) and Single Leg ISO
Heel Bridge Hold (the course lesson "Day 6 & Day 7 | Recovery" shows them).

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
the agility ladder is ticked. v154 (2026-11-12): each plays its own YouTube demo (picks in `data/build_daily_mobility.py`).

## 5. Weekly AI check-in with a Claude API key *(decide)*

Deferred by the user. The app learns on the phone with no AI (`src/lib/learn.js`, `src/lib/adapt.js`).
An optional weekly check-in would send a summary of the week's logs to the Claude API for coaching
notes. It needs an API key the user provides, and must not send names or the email address. Talk it
through with the user before building anything: what they'd want from it and where the key lives.

## 6. Branch tidy-up

Done 2026-11-12: every branch except `main` is deleted (the user OK'd the two unmerged ones).

## 7. Plan builder: still to do *(decide with the user)*

- **Other sports.** Sports days are basketball only (`sport: { name, days }` in the generator is ready for more:
  each needs its impact profile and a label on game days).

## 8. FitKidHooper: In-Season Hooper program

Done 2026-11-12: FKH pull request #4 merged into `legendsyba/FitKidHooper` and deployed (app.legendsyba.com).
It ships as an original FKH program using HoopStudy's middle-school volume, not under HoopStudy's name.

## 9. Hip plan: lateral-hip moves

Done 2026-11-21 (v202): the six v201 moves play short PT demos, the four sources are read, and what they changed
(a resting-positions tip, a bridge cue) is in [`research/notes-hip/chatgpt-lateral-hip-plan.md`](research/notes-hip/chatgpt-lateral-hip-plan.md).
Note: `node data/enrich_hip_videos.mjs --apply` re-applies every "approved" id in the review file and blanks the
title of a pick that isn't among its candidates; check `git diff src/lib/hip_protocol.js` after running it.

## 10. Proformance (Dr. Alyssa Lu, PT): more moves *(decide with the user)*

v204 (2026-11-21) added her hip internal-rotation moves (see the reels table, #17 and #20) and moved the figure-4
Piriformis Stretch out of the hip warm-up (90/90 Hip Opener + Adductor Rock Back instead). Her YouTube channel
@proformancesportstherapy (~400 shorts) plays inside the app, unlike her Facebook reels. The survey of her other
reels and shorts is in [`research/proformance.md`](research/proformance.md); its best moves went in at v205 (the user's
"all"). What's left there is optional: the ~25 relevant shorts listed but not frame-checked, and her 720+ Facebook reels
(247 ids captured).
Bench Pigeon Rotation still plays the Facebook reel; swap in her YouTube short if the survey finds one.

## 11. Hip Plan length *(check with the PT)*

v206 (2026-11-21) restructured Hip Plan A/B to the new rehab rule (docs/PROGRAM_DESIGN.md "Rehab and mobility
sessions"): 3 prep drills + 9-10 working moves, one per slot (~50-55 min with the hip warm-up), the other versions
under Swap (`HIP_SWAPS`) or as later ladder steps. The PT's own program had 15 exercises a session: worth confirming
the slot picks with the PT. The hip warm-up (8 moves, the PT's daily warm-up) still runs before every workout.

## Known limits (no action needed)

- Generated plans on a bodyweight-only kit leave upper-body days short (about 3% of test days): with no
  band, bar or dumbbells there's little to pull with. The user trains with dumbbells.
