# How programs are designed

These rules come from studying the PJF Performance and BWS (Built With Science) programs in
`data/library.json`. Both the in-app generator (`src/lib/generator.js`) and Claude-built plans
follow them. The machine-readable copy is [`data/design_rules.json`](../data/design_rules.json):
change both together.

To check these rules against what the coaches actually wrote, run `python3 data/learn_patterns.py`.
It measures the PJF, BWS and Griffith programs and lists where they disagree with the rules in
[`LEARNED_PATTERNS.md`](LEARNED_PATTERNS.md).

## Session order

Warm-up / mobility → power (plyo, sprints) → main compound → secondary compound / single-leg
→ accessories (isolation) → core → conditioning → breathing / cooldown.

| Role | Sets × reps | Rest | Notes |
|---|---|---|---|
| warmup (mobility, activation) | 1-2 × 5-8, or 30 s | none | 4-6 drills, about 5 min. PJF and BWS both open this way. |
| power (plyo, sprint, med ball) | 3 × 2-6 intensive or 3 × 15-20 extensive | 60-90 s | Before any lifting, on fresh legs. 60 contacts or fewer per session. |
| main (heavy compound) | 3-4 × 6-8 (strength phase 4-6) | 2-3 min | BWS warm-up ramp: 50% × 8, 70% × 3-4, 90% × 1-2 on the first upper and first lower lift. |
| secondary (compound, single-leg) | 3 × 8-12 | 60-90 s | |
| accessory (isolation) | 3 × 10-15 (lateral raises 15-20) | 45-60 s | Superset them in pairs (A1/A2) to save time. |
| core | 2-3 × 8-15 or 20-45 s holds | 30-45 s | Holds go up 5 s per week. |
| conditioning | 10-12 rounds of 15-20 s on / 40-45 s off, or 20-35 min Zone 2 | | Intervals on strength days, Zone 2 on low days. |
| cooldown | 1 × 15-45 s holds, 3 min breathing | | |

**Warm-up and cooldown follow the workout.** Warm up what the day is about to work, and stretch
what it worked. [`data/session_prep.py`](../data/session_prep.py) does this from the exercise
tags, so a build script calls it rather than hard-coding a list:

- It scores each region (quads, hamstrings, glutes, adductors, hip flexors, calves, chest,
  shoulders, lats, upper back) by sets: 2 points for an exercise's main muscle, 1 for the others.
- *Targets* are every region a main exercise trains directly (2+ sets), plus any region scoring
  at least half the day's top region.
- **Warm-up:** keep the plan's own prep (Griffith, PJF…). `fill_warmup` adds a move from the
  plan's warm-up pool for any region that's worked hard but not reached by the prep, up to 6 moves.
- **Cooldown:** `pick_cooldown` picks 3-4 holds (PJF's length-under-load format, then 3 min of
  breathing). Every target gets reached. The day's two hardest-worked muscles need a hold that's
  *mainly* for them, so a squat-and-lunge day gets a real quad stretch, not a hip stretch that
  touches the quads. Each hold's note says which of today's exercises it's for.
- Coverage comes from tags, so a stretch's tags must say what it really stretches (check the
  provider's notes). The build prints any target nothing in the pool reaches.

**Supersets:** 0-15 s between the two exercises, 30-60 s after the pair. Pair muscles that don't
compete (push + pull, lower + upper, isolation + core).

## Weekly structure

| Days/week | Split (strength / muscle) | Athletic / court |
|---|---|---|
| 2 | Full body A/B | Full body + speed/plyo |
| 3 | Full body A/B/C | 2 full body + 1 speed/plyo/agility |
| 4 | Upper / Lower ×2 (one lower day quad-led, one glute/hinge-led) | Lower power / Upper / Lower strength / Upper + agility |
| 5 | Upper / Lower / Push / Pull / Lower | 3 strength + 2 speed/agility |
| 6 | Lower / Upper alternating + 1 recovery/mobility day | same |

**Weekly working sets per muscle** (BWS: 62-91 sets/week in total):

| Muscle | Sets/week |
|---|---|
| chest, quads, hamstrings, glutes, back (lats + upper back) | 9-15 |
| delts, biceps, triceps, calves | 6-8 |
| abs / obliques | 2-6 |

Each muscle is trained at least twice a week. Indirect work counts as half a set (a step-up still
trains quads), the way the research counts it.

**By goal** (`goals.<goal>.volume_targets`, from the coach programs in
[LEARNED_PATTERNS.md](LEARNED_PATTERNS.md); scaled by days/5 under 5 days a week):

| Goal | Abs | Obliques | Glutes | Adductors |
|---|---|---|---|---|
| strength, muscle | 2-6 | 2-6 | 9-15 | 0-6 |
| fat_loss (PJF Fat Don't Fly) | 8-12 | 6-10 | 12-20 | 0-6 |
| durability (Durability Code, Griffith) | 8-12 | 10-16 | 15-22 | 4-8 |
| athletic | 4-8 | 4-8 | 12-18 | 0-6 |

## Rules that change by goal

From comparing the coach programs with these rules (`python3 data/learn_patterns.py`) and the
research in [research/Workout plan builder methods.md](research/Workout%20plan%20builder%20methods.md):

- **Rest** (`rest`): fat loss rests 90 s on main lifts and 60 s on the rest (PJF writes about 60 s;
  research finds a small cost below 60 s and no gain past about 90 s). Strength keeps 2-3 min.
- **Core sets** (`core_sets`): fat loss and durability give core 3 sets, as PJF and Griffith do.
- **Core early** (`core_early`): fat loss, durability and athletic do the day's core move right after
  power work and before the main lift, as PJF does: anti-extension, anti-rotation, side-bend or hold
  patterns only, smooth reps, well short of failure. Strength and muscle keep core at the end.
- **Fat-loss structure** (`splits`, `superset_all`, `days.cond_glutes`): 4-6 days are three full-body
  days plus a Conditioning + Glutes day (25 min of Zone 2, then a no-rest glute and hip circuit),
  as Lean & Tone and PJF write them. Every lift is paired with one that doesn't compete (lower with
  upper, push with pull): 0-15 s between the two, rest after the pair. Lifting days end with an
  interval finisher (sprint/jog/walk rounds, Zone 4/5); the long day is Zone 2.
- **Cooldown** (`cooldown`: fat loss, durability, athletic): 2-4 holds for what the day worked, the
  two hardest-worked muscles each getting a hold mainly for them, then 3 min of 7/11 breathing. The
  generator does in JS what `data/session_prep.py` does for hand-built plans; each hold's note says
  which of today's exercises it's for. Strength and muscle plans (BWS style) have none.
- **Home kit** (`load_limited`): with no barbell, cable, machine, Smith or sled, weights can't keep
  going up, so main and secondary reps climb each phase (8-10 → 10-12 → 12-15) instead of dropping,
  rest after a pair shortens by 15 s in the last phase, and non-main picks move up a level per
  phase (harder versions: single-leg, B-stance, 1¼ reps).
- **Required moves** (`required`): durability plans always include the Copenhagen adductor drill,
  3 times a week in the first phase and twice a week after (athletic plans: twice a week throughout); the study's 1x/week in season is a minimum, not a target (the Harøy 2019 programme: 41% fewer groin
  problems), moving from the knee version up; and a Nordic hamstring lower once a week, 2-3 × 3-5 slow
  lowers, on the hamstring slot (or a new accessory slot on the hinge day when the split has none).
  These may be one level above the person's level, and trimming for time never removes them.
- **Jump contacts** (`max_contacts`): jumps, bounds and landings stay at 100 or fewer a session
  (each side counted). `--sanity` checks it.
- **Warm-up rounds** (`session_minutes.<min>.warmup_rounds`, `warmup_rounds`): 1 round for 30 min,
  2 for 45 and 60, 3 for fat loss at 60 min (PJF writes 2-3).

**Session size:** 6-8 exercises fit 60 min. For 45 min, use 5-6. For 30 min, use 5 exercises,
mostly supersets, and cut isolation first (BWS express versions drop about 25% of sets).

## Progression (PJF style)

- **2-week microcycles.** Week 2 repeats week 1 with +5 s on holds, or +2 rounds/+5 min of cardio.
  Reps don't go up on a schedule: the coaches raise reps in only 0-26% of repeats. Lifts use double
  progression: once every set reaches the top of the rep range, add the smallest weight step.
- **A new phase every 2 weeks:** swap most accessories, drop strength reps by about 2 (8 → 6), and raise effort (8/10 → 9/10).
- **Main lifts** stay for the whole plan up to 6 weeks, and change every 4 weeks in longer plans (Nippard keeps exercises 4 weeks).
- **Add sets, not reps** (`set_ramp`): by the last phase the secondaries get one more set (1.1: strength,
  fat loss, durability), and the accessories too (1.2: muscle, athletic). The coach programs end about
  10% above their first week (1.6× in PJF's band program).
- **Sprints and plyos:** intensity goes 50 → 70 → 90 → 100% across the weeks, with more sets and longer rest as it climbs.
- **Deload:** none of the 15 coach programs writes one, and the research finds a planned week off
  doesn't help muscle and can cost a little strength. Only strength and muscle plans of 8+ weeks end
  with a deload week (sets halved, same weights). Otherwise deload when the logs show a drop.
- **Moving up a level:** when a movement stops reaching an 8/10 effort and is pain-free, move to the next variation.

## Adjusting from the logs

A written plan says what to do; [`src/lib/adapt.js`](../src/lib/adapt.js) says what weight to use
today, from the last 3 times the lift was logged (in any plan). The workout card shows it as
"Today: 105 lb × 8 · ↑ 5 lb: every set hit 10 last time" and prefills the sets with it.

- **Double progression:** every set at the working weight reached the top of the rep range → add
  the smallest step (5 lb; 2.5 lb on dumbbells under 15 lb) and aim for the bottom of the range.
  If the step is over 10% of the load, aim for 2 more reps first.
- **Under the range two sessions running** at that weight → about 8% lighter, then build back.
- **14+ days since last time** → about 90% of the last weight.
- **Otherwise** same weight, beat last time's reps. The heaviest weight logged is the baseline, so a
  weight changed by hand carries forward.
- **Bodyweight** at the top of the range on every set → move to a harder version.
- **Deload when the logs say so:** 3+ lifts in today's session dropping → a banner suggests a deload
  week (half the sets, same weights). No plan schedules one except 8+ week strength/muscle plans.

`node data/check_adapt.mjs` checks these rules.

## Exercises the coaches pick

`python3 data/learn_patterns.py` also records which exercises each goal's coach programs use
(`goals.<goal>.exercises` in data/learned_patterns.json: name → how many of its programs use it).
The generator prefers them, scaled by that share: a BWS staple used in 8 of 9 muscle programs
(bench, low-incline DB press, DB RDL, face pulls, chest-supported row) clearly beats a one-off,
while one PJF program's pick only nudges, so volume balancing still decides. Strength borrows the
BWS list. Names marked "last resort" in the catalog are pushed down, and a slot's first muscle wins a
tie ("chest, triceps" → a chest move). Upper A/B and Full Body A carry a chest accessory (BWS: 9-15
chest sets a week; plans were at 6).

## In the plan preview

- **Why each pick:** every exercise says why it's there ("Main lift, kept from the last phase",
  "Core early, to switch it on", "Groin injury prevention", "one you swap to or add", "level 2 for
  phase 3", "Stretch for today's quads").
- **Compared with the coaches** ([`src/lib/compare.js`](../src/lib/compare.js)): weekly sets per
  muscle against the min–max of the coach programs for the goal (data/learned_patterns.json), their
  ranges scaled to the plan's days a week, and plain sets a session against theirs. Strength has no
  coach program to compare with.
- **Go easy on** (`easy_on`): hip, knees, lower back or shoulders leaves out moves that commonly load
  the area (lunges and deep hip positions; jumps and landings; heavy barbell hinges and rows; overhead
  pressing and dips), in lifts, warm-ups and cooldowns. Required moves stay, in a version that avoids
  the area where one exists. Only ever chosen by the user; nothing turns it on automatically. Not medical advice.

## +1 set when a lift keeps climbing

When a lift has gone up two sessions running and every set hit the top of the range again, the
card offers **+1 set** for today (up to 5, not while the check-ins say you're beat): volume goes
where it's working, the research report's volume rule.

## Daily Mobility card

Daily Mobility runs next to whatever program is active, from its own card on Today (mockup:
[`docs/mockups/daily_mobility_card.png`](mockups/daily_mobility_card.png); state and streak in
[`src/lib/daily_card.js`](../src/lib/daily_card.js), `node data/check_daily_card.mjs`). It opens at
`#/daily`, the Lift screen with Daily Mobility's own A → B → C position, so the training program's
day never moves. It replaced the old daily mobility checklist on the Move tab and rest days.
- **Not started:** today's day, about how long, the streak, what changed for yesterday's training,
  **Start** (opens the first move) and **Skip today**.
- **Started:** moves done, a progress bar, the next move, **Resume**.
- **Done or skipped:** one line. Skipping keeps today's day for tomorrow and ends the streak.
- **Streak:** days in a row finished. Today not done yet doesn't break it; a skipped or missed day does.
- If Daily Mobility is itself the active program, the card is hidden (Today's Workout already shows it).

## One move, once a day

Daily Mobility, the hip plan's warm-up / Pelvic Reset and workouts like Recovery & Mobility share
moves (Cat Cow / Cat Camel, posterior pelvic tilt breathing, the half-kneeling hip flexor stretch).
Once a move is done in one of them today, the others show it as done there
([`src/lib/same_move.js`](../src/lib/same_move.js) matches names, `node data/check_same_move.mjs`;
[`src/lib/moves_today.js`](../src/lib/moves_today.js) gathers today's sessions and hip check-offs):
- **Hip tab:** the move shows checked, "✓ Done today in Daily Mobility", and counts toward the hip
  warm-up on Today. Nothing extra is written to the hip log.
- **Workouts:** the row says "✓ Done today in …" with **Mark done**, which fills its sets as done and
  marked as counted from there ("✓ Counted from …"). Warm-up moves done elsewhere show as done, and
  the Start flow skips them.
- A counted set never counts as a source for another place, and skipped sessions don't count.


When today's Daily Mobility session starts ([`src/lib/daily_adjust.js`](../src/lib/daily_adjust.js),
`node data/check_daily_adjust.mjs`), it reads yesterday's logged training (not yesterday's mobility,
not skipped sessions):
- **Jumps, sprints, landings or a heavy leg day** (9+ leg sets): pogos become a single-leg balance
  hold. Tendon and elastic loading is spaced across the week, not daily.
- **Each area trained directly (4+ working sets)** gets one more set (max 3) of today's holds and
  mobility moves for it: stretch what was worked, like generated cooldowns.
- A note at the top says what changed and why. A rest day changes nothing.

## Learning from your logs

[`src/lib/learn.js`](../src/lib/learn.js) works out a personal profile from the last 12 weeks of
logged workouts, on the phone, with no AI service: plain counts and trends. It needs 6 logged
workouts before anything changes; the Plans tab shows it under "What the app has learned".

| Learns | From | Changes |
|---|---|---|
| Exercises you avoid | Swapped away from 2+ times (more than done), or left undone most times | Generated plans leave them out |
| ♥ Favourites (you mark them, no logs needed) | ♡ on the exercise screen or ⋯ menu | Both builders pick them first, ahead of everything learned |
| What you swap to, and add | Swaps and added exercises | Generated plans prefer them |
| What's progressing or stalled | Weekly trend of each lift's estimated max (3+ sessions) | Progressing picks preferred; stalled accessories rotated |
| Trend per muscle | Average of its lifts' trends | Shown; for the volume rule next |
| How fast you outgrow ranges | Share of exercises where every set beat the top by 2+ | At 30%+, weight targets jump twice as far when you do it again |
| Real session length | First to last logged set (each set now stores its time) | Generate starts at the closest session length |
| When you train | Weekdays trained and skipped, sessions a week | Generate starts at your usual days a week |

`node data/check_learn.mjs` checks it.

## Warm-ups cover the day

Every body region the day works with 2+ exercises (push, pull, legs & hips, core) gets at least one warm-up move.
Hip-focused prep alone isn't enough on a full-body day: add a push (push-up to pike, push-up to shoulder airplane) and a
pull/shoulder move (band pull-aparts, rolling shoulder armbar, light banded lat pulldown). `check_program.mjs` warns on
gaps, the generator builds warm-ups from the day's exercises, and `generate_plan.mjs --sanity` checks it.

The user's collected moves (his hip and low-back lists and saved reels, catalog source `daily`,
added by `data/build_daily_mobility.py`) are ordinary warm-up options: eligible like any other
warm-up move, with no preference.

## Progression by level (Griffith style)

Griffith's 8-week TrainHeroic plan never explains its progressions, but they are consistent:

1. **2-week blocks.** Each exercise runs twice; week 2 adds a little (10 s → 15 s holds, 8 → 12 reps, pogos 20 → 30, carries 40 → 50 → 60 ft).
2. **Each new block moves the movement one step up:** isometric/supported → loaded → elevated or single-leg → dynamic or plyometric.
   Split squat: landmine iso → Bulgarian → FFE dumbbell → FFE floating heel / KB drops. Adductors: side-bridge scissor → 90/90
   Copenhagen → straight-leg Copenhagen → dynamic Copenhagen. Push: push-up to shoulder airplane → plyo push-up to pike →
   plyo push-up to shoulder airplane.
3. **Warm-ups progress too:** band-assisted (distractions, floss) → active control (Figure 4, wall hip circles) → loaded and
   dynamic (loaded hip airplane, two-leg drop into split squat). Every day opens with 2–3 prep moves; later weeks add a mobility block.

In the catalog this is the `level` tag (1 beginner, 2 intermediate, 3 advanced; Griffith's moves are levelled by the week
they first appear: weeks 1–2, 3–6, 7–8) plus `progresses_by`. BWS-style lifts progress by load; variation moves progress by level.
The generator moves variation slots up a level per phase so the last phase lands on the person's level, and the Swap menu
offers the same movement one level harder or easier. A person can be at different levels on different movements: swap up
wherever you're already there.

## Exercise choice

- Pick by `pattern` and `role` first, then `primary_muscle`, then the equipment available
  ([EXERCISE_TAXONOMY.md](EXERCISE_TAXONOMY.md)).
- Substitutions stay in the same pattern and the same primary muscle. BWS alternates match the primary muscle 90% of the time.
- **Athletic and durability goals** add hip-building work every session: Copenhagen, single-leg balance, rotation, lateral lunge, landing and deceleration (`hip_focus`). This builds the hip up; nothing is excluded for it.
- No exercise repeats within a day. Main lifts stay the same within a phase, and accessories rotate between phases.

## Generator

**Extensive test:** `node data/test_generator.mjs` (add `--report` to write
[GENERATOR_TEST_REPORT.md](GENERATOR_TEST_REPORT.md)) runs 2,700 plans: every goal × 2-6 days × 30/45/60
min × 4 kits (bodyweight, home dumbbells, home plus, gym) × level 1-3 × 4/6/8 weeks, with random focus, jumps,
"go easy on", a learned "avoid" and favourites on a third of them. Hard rules (must pass): no repeats in a day,
3+ working exercises, video, equipment, level (one level up only for required moves or when nothing at the
level fits, and then the why line says so), "go easy on", no "last resort" picks, sets and reps/time, supersets
of 2+, pair rest, the time box, jump contacts, warm-up coverage, cooldown by goal, deload only where the rules
say (and it halves the sets), required moves per week, a learned "avoid" stays out unless it's the only fit,
the last phase keeps its lifting sets (within 8%; athletic exempt), same seed → same plan. Quality is reported:
coach range and coach-exercise share by goal, session length vs asked, muscles trained twice a week,
push:pull, variety.

`src/lib/generator.js` turns these rules into plans, both in the app (Plans → Generate a plan)
and in node (`node data/generate_plan.mjs`). `--sanity` runs every goal × days × minutes ×
equipment combination and checks for:
- repeated exercises within a day
- exercises without a video
- equipment you don't have
- sessions over the time box
- big muscles under half their weekly target
