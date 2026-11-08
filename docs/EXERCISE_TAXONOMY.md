# Exercise taxonomy

Every exercise in the catalog carries these tags. The allowed values are fixed here;
`data/check_catalog.mjs` rejects anything else. The tags live in
[`data/exercise_tags.json`](../data/exercise_tags.json), keyed by exercise id, and
`data/tag_exercises.py` merges them into `data/library.json`. Hip-tab exercises (`hiprx-…` ids)
are tagged in the same file and merged when the app loads (`src/lib/static_data.js`).

| Tag | Values | Meaning |
|---|---|---|
| `primary_muscle` | one muscle (below) | The muscle the exercise is mostly for. |
| `muscles` | list of muscles | Everything it works meaningfully, primary first. |
| `pattern` | one pattern (below) | The movement, which is how substitutions and plan slots match. |
| `role` | warmup, power, main, secondary, accessory, core, conditioning, cooldown | Where it sits in a session (see [PROGRAM_DESIGN.md](PROGRAM_DESIGN.md)). |
| `equipment` | list (below) | What you need. `bodyweight` means nothing. |
| `level` | 1, 2, 3 | 1 beginner, 2 intermediate, 3 advanced (heavy barbell, intensive plyo, complex coordination). |
| `unilateral` | true / false | One limb at a time. |
| `plane` | sagittal, frontal, transverse | Main plane of motion. |
| `hip_focus` | true / false | Builds hip strength, mobility or control (Copenhagen, airplanes, 90/90, lateral and rotational hip work). |

**Muscles:** chest, lats, upper_back, rear_delts, side_delts, front_delts, biceps, triceps,
forearms, quads, hamstrings, glutes, adductors, abductors, hip_flexors, calves, abs, obliques,
lower_back, neck, full_body.

**Patterns:**

| Group | Patterns |
|---|---|
| Lower | squat, hinge, lunge_single_leg |
| Upper | push_horizontal, push_vertical, pull_horizontal, pull_vertical, carry |
| Isolation | isolation_upper, isolation_lower (curls, raises, extensions, flies, calf raises, abduction) |
| Core | anti_extension, anti_rotation, rotation, lateral_flexion, flexion |
| Athletic | plyo_jump (two-leg jumps), plyo_bound_hop (hops, bounds, skips, pogos), speed_accel (sprints, accelerations), agility_cod (cuts, shuffles, crossover steps), deceleration_landing (landings, decels, sticks) |
| Other | balance, mobility, isometric, conditioning |

**Equipment:** bodyweight, dumbbell, kettlebell, barbell, trap_bar, band, mini_band, cable,
machine, bench, box, med_ball, sled, slider, bosu_pad, pullup_bar, landmine, smith.

## Classifying a new exercise

1. Pick `pattern` from what the body does, not the name: a "Rotational Row" is pull_horizontal if
   the pull dominates, or rotation if the turn does.
2. `role` follows how programs use it: heavy bilateral compounds are main; single-leg and
   machine compounds are secondary; curls, raises and flies are accessory; anything done as
   a drill before the main work is warmup or power.
3. `equipment` lists everything needed, including a bench or box.
4. If unsure, add the id to `data/tag-review.json` with your best guess and the question.
5. Run `node data/check_catalog.mjs`.
