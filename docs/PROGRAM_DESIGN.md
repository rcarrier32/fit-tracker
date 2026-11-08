# How programs are designed

These rules come from studying the PJF Performance and BWS (Built With Science) programs in
`data/library.json`. Both the in-app generator (`src/lib/generator.js`) and Claude-built plans
follow them. The machine-readable copy is [`data/design_rules.json`](../data/design_rules.json):
change both together.

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

Each muscle is trained at least twice a week.

**Session size:** 6-8 exercises fit 60 min. For 45 min, use 5-6. For 30 min, use 5 exercises,
mostly supersets, and cut isolation first (BWS express versions drop about 25% of sets).

## Progression (PJF style)

- **2-week microcycles.** Week 2 repeats week 1 with +1-2 reps, +5 s on holds, or +2 rounds/+5 min of cardio.
- **A new phase every 2 weeks:** swap most accessories, keep the main lifts, drop strength reps by about 2 (8 → 6), and raise effort (8/10 → 9/10).
- **Sprints and plyos:** intensity goes 50 → 70 → 90 → 100% across the weeks, with more sets and longer rest as it climbs.
- **Deload:** neither source writes one. Our plans make the last week of a 6- or 8-week block a deload (sets halved, same weights).
- **Moving up a level:** when a movement stops reaching an 8/10 effort and is pain-free, move to the next variation.

## Exercise choice

- Pick by `pattern` and `role` first, then `primary_muscle`, then the equipment available
  ([EXERCISE_TAXONOMY.md](EXERCISE_TAXONOMY.md)).
- Substitutions stay in the same pattern and the same primary muscle. BWS alternates match the primary muscle 90% of the time.
- **Athletic and durability goals** add hip-building work every session: Copenhagen, single-leg balance, rotation, lateral lunge, landing and deceleration (`hip_focus`). This builds the hip up; nothing is excluded for it.
- No exercise repeats within a day. Main lifts stay the same within a phase, and accessories rotate between phases.
