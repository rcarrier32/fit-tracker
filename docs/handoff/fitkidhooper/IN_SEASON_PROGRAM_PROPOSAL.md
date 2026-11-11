# Program proposal — In-Season Hooper (strength · speed · recovery)

An **add-on to FKH's existing program system**, not a new one: one normal `PROGRAMS` entry that reuses the
catalog's drills, videos, dosing style (Bodyweight Beast / Band Strength: same moves, dose steps up), warm-ups,
badges, pathways and `verify-programs` safety rules. Shaped like HoopStudy's *8 Week In Season Strength Training
Program* (Adam Menner): strength, speed & jumps, and recovery through a season, with HoopStudy's own
**middle-school volume** (2×8 → 3×8 → 4×8). Ships on founder approval, like every new program
(DEV_PLAN_TIER_EVALUATION §4).

## Credit and rights — decide first

The HoopStudy PDF is HoopStudy course material. FKH is public, so it must not copy that program wholesale.
- **Path A (this draft, no permission needed):** an original FKH program on the same proven structure, built
  from FKH's own drills and their existing public videos. Not branded HoopStudy; the program `desc` can say
  "in-season structure used by youth performance coaches".
- **Path B:** ask HoopStudy (the PDF lists a contact) to feature their program, credited. If they agree, add
  `trainer:"HoopStudy"` and use their wording and volumes as written.

## Why it fits FKH

- Fills a gap: FKH has strength (Bodyweight Beast I/II, Band Strength), jumps (Jump Higher I/II), rope and skill
  programs, but **no in-season block** that combines strength, speed and recovery for a player who is already
  practising and playing.
- Same principles FKH already cites (NSCA youth resistance training): technique first, volume before
  difficulty, the same moves repeated, low landing counts, full rest on speed work.
- Every main drill already exists with a video (below), so v1 needs **no new drills**.

## The program

| Field | Value | Why |
|---|---|---|
| `id` | `in-season-hooper` | |
| `duration` | 8 | HoopStudy's 8-week block. Nothing in FKH caps weeks. |
| `daysPerWeek` | 4 (2 strength + 2 speed & jumps) | `programSessionScheduleDays(4)` spaces sessions 0/2/4/6, so jump days are ≥48 h apart and there are rest days. 7 sessions would run back to back (spacing 1) with no rest. |
| Recovery | between sessions: the existing **Recovery Day** quick workout (`WORKOUT_TEMPLATES.recovery`) or rest; Sunday is already rest in `SCHEDULE` | Keeps recovery in systems FKH has, instead of 2 extra program sessions. |
| `ageRange` | `[11, 14]` | Its jump drills include 10+ drills (`squat-jumps`, `lat-stick`); 11 floor matches in-season middle school. |
| `equipment` / `equipmentFew` | `["long_band"]` / `["dumbbells"]` | A long band for `band-row`; dumbbells only for the goblet squat and RDL (swaps: `bw-squats`, `band-rdl`). `verify-programs` 2a needs this to match the drills exactly. |
| `PROGRAM_KIND` | `"strength"` | Shows first on Today's mission with any skill program. |
| `PROGRAM_WEEK_TIERS` | weeks 1–3: 1 (Foundation), 4–6: 2 (Application), 7–8: 3 (Game-Speed) | |
| Pathway | `athletic-foundation` T2 and T3 phases (`developmentPathways.js`), after Bodyweight Beast | So Coach FKH recommends it. No `requires` / `advancedOf` link: that would break the Up Next road asserts (BB → BB II → JH → JH II). |

### Sessions (same moves every week; the dose steps up)

| Session | Drills (existing ids) | Notes |
|---|---|---|
| S1 Strength A | `goblet-sq`, `pushup`, `band-row`, `reverse-lunge`, `hollow-hold` | Squat · push · pull · single-leg · core. Swap `goblet-sq` → `bw-squats` with no dumbbells. |
| S2 Speed & Jumps A | `acceleration-starts`, `high-knees`, `pogo-hops`, `broad-jump-stick`, `lat-stick` | Opens on a sprint start, not a landing (no cold landing start). Sprints are timed: "beat your best 10 yards". |
| S3 Strength B | `db-deadlift`, `split-sq`, `push-shoulder-taps`, `glute-bridge`, `side-plank` | Hinge · single-leg · push · glutes · core. Swap `db-deadlift` → `band-rdl`. Glute bridge cue: progress to single-leg in weeks 6–8. |
| S4 Speed & Jumps B | `three-step-burst`, `high-knees`, `pogo-hops`, `squat-jumps`, `snap-downs` | `squat-jumps` cue: "pause 2 s at the bottom, then jump". |

### Dose by week (HoopStudy's middle-school volume, all 8 reps)

| Weeks | Strength (every S1/S3 drill) | Sprints (`acceleration-starts`, `three-step-burst`) | Jumps (`broad-jump-stick`, `squat-jumps`, `lat-stick`) | Pogos |
|---|---|---|---|---|
| 1–2 | 2x8 (holds 2x20 s) | 4x10 yd | 3x3 | 2x10 |
| 3–4 | 3x8 (holds 3x20 s) | 6x10 yd | 4x3 | 2x10 |
| 5–6 | 3x8 (holds 3x25 s) | 8x10 yd | 4x3 | 2x10 |
| 7–8 | 4x8 (holds 3x30 s) | 10x10 yd | 5x3 | 2x8 |

**Landings per speed session** (pogos + jumps, counted the way `verify-programs` counts): weeks 1–2 about
20 + 9 + 18 = 47; weeks 7–8 16 + 15 + 30 = 61 on S2 (bounds are each side), 16 + 15 + snap-downs on S4. All
within FKH's ≤80 rule and near the ≤60 target; trim `lat-stick` to 4x3 in weeks 7–8 if `verify-programs`
counts it above 60. Sprints typed "athletic" are not landings.

`high-knees` is 2x10 yd every week (sprint posture warm-in, not counted as landings if typed athletic; check).

### Draft entry

```js
{ id:"in-season-hooper", name:"In-Season Hooper", emoji:"🏀", color:"#f97316",
  badgeId:"pgm-in-season", duration:8, daysPerWeek:4, ageRange:[11,14],
  equipment:["long_band"], equipmentFew:["dumbbells"],
  desc:"Stay strong, fast and fresh through your season. Two strength days and two speed & jump days a week, " +
       "8 weeks. Same moves every week — the sets go up as you get stronger. On the days between, do the " +
       "Recovery Day workout or rest. Lift with a grown-up nearby, technique first: light weights, perfect reps.",
  weeks:[
    { week:1, goal:"Learn every move. Light weights, perfect reps, full rest between sprints.",
      sessions:[
        { day:"Session 1", focus:"Strength A", exercises:["goblet-sq","pushup","band-row","reverse-lunge","hollow-hold"],
          dose:{ "goblet-sq":"2x8", "pushup":"2x8", "band-row":"2x8", "reverse-lunge":"2x8 each leg", "hollow-hold":"2x20 s" } },
        { day:"Session 2", focus:"Speed & Jumps A", exercises:["acceleration-starts","high-knees","pogo-hops","broad-jump-stick","lat-stick"],
          dose:{ "acceleration-starts":"4x10 yards", "high-knees":"2x10 yards", "pogo-hops":"2x10", "broad-jump-stick":"3x3", "lat-stick":"3x3 each side" } },
        { day:"Session 3", focus:"Strength B", exercises:["db-deadlift","split-sq","push-shoulder-taps","glute-bridge","side-plank"],
          dose:{ "db-deadlift":"2x8", "split-sq":"2x8 each leg", "push-shoulder-taps":"2x8", "glute-bridge":"2x8", "side-plank":"2x20 s each side" } },
        { day:"Session 4", focus:"Speed & Jumps B", exercises:["three-step-burst","high-knees","pogo-hops","squat-jumps","snap-downs"],
          dose:{ "three-step-burst":"4x10 yards", "high-knees":"2x10 yards", "pogo-hops":"2x10", "squat-jumps":"3x3", "snap-downs":"2x5" } },
      ] },
    // weeks 2–8: same sessions, doses from the table above (week 2 = week 1).
  ] }
```

Plus, per FKH's checklist:
1. `src/lib/badges.js` → `{ id:"pgm-in-season", cat:"program", name:"In-Season Hooper", emoji:"🏀", desc:"Finished the 8-week in-season program", color:"#f97316" }`.
2. `src/lib/programKind.js` → `"in-season-hooper": "strength"`.
3. `trainingCatalog.js` → `PROGRAM_WEEK_TIERS["in-season-hooper"] = [1,1,1,2,2,2,3,3]`.
4. `developmentPathways.js` → `athletic-foundation` T2 + T3 `programIds` (and the Wing/Post phases if wanted).
5. `changelog.js` → bump `RELEASE_ID`, add a `WHATS_NEW` line.
6. Run `npm run verify:programs`, `npm run verify:exercise-skills`, and the Playwright suite.

## Checked against FKH's own build checks

Added locally to a copy of FKH (`trainingCatalog.js` program + `PROGRAM_WEEK_TIERS`, `badges.js`, `programKind.js`)
and run, 2026-11-11:
- `npm run verify:programs` → **21 programs OK** (landings per session, ≥48 h between jump days, age floors,
  every drill dosed and parsing, gear matching exactly, no cold landing start).
- `verify:path-gates` OK, `verify:exercise-skills` OK.
- Not run: `verify:imports` and `vite build` (need `npm install`), the Playwright suite. Pathway wiring
  (`developmentPathways.js`) and the `changelog.js` bump are not in the patch yet.
The full 8-week entry is in `in-season-hooper.patch` (applies with `git apply` at the repo root).

## v2 (optional): drills FKH doesn't have yet

HoopStudy's sessions also use moves FKH has no drill for. Each needs a new id, `EXERCISE_META`, and a public
clip that is **watched, clipped and cue-checked** before it ships (VIDEO_REVIEW_CHECKLIST). Preferred channels:
Simple Speed Coach, PJFPerformance, NASM, Children's Hospital Colorado.
- Sprint drills: **A-skip / A-march / power skip**, **falling start** (would replace `high-knees` / start the sprints).
- Strength: **Cossack / lateral lunge**, **single-leg glute bridge**.
- Recovery (in `balance` with `movementType:"mobility"`, `workoutRole:["recovery"]`, so no new category):
  **90/90 hip switch**, **hip-flexor (couch) stretch**, **diaphragmatic breathing**, **foam roll**
  (needs a `foam_roller` gear key in `programGear.js` or `equipmentFew`).
With those, a "Recovery" session could become part of the program instead of pointing at the quick workout.

## Gaps to name (not in this proposal)

- **Game and practice days.** FKH can't shift the plan around a game (CALENDAR_ROADMAP Tier 3). The rules worth
  bringing over later, proven in a sister app: mark a game ✓ / ✕; the day after a game drops jumps and hard
  sprints; no leg-heavy session the day before a game; recovery after two hard days in a row.
- **Coach → team assignment** doesn't exist; a coach can send the `?program=in-season-hooper` share link
  (`programShare.js`).
- **Supervision copy** for strength work exists only in this program's `desc`; FKH may want a standard line on
  every dumbbell drill.
