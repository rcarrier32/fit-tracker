# App inventory: mobility, recovery and joint-health exercises already in fit-tracker

> **Out of date (2026-11-11, v121):** the hip flare mode, exercise pauses, flare caution badges and
> "hip-friendly swaps" described below have been removed from the app, and so has the old daily card
> (`src/views/daily_mobility.js`). The user has no hip restrictions: nothing here should gate or avoid
> hip moves (90/90, shin box, lunges, hip-flexor stretches are all fine).

Scope: local codebase study of /home/user/fit-tracker only (no web research). "Source" links below are repo file paths; line numbers where useful. Video source codes come from `data/exercise_index.json` field `video_from`: **pjf** = PJF Performance's own demo (mux stream), **trainheroic** = Vernon Griffith's own TrainHeroic demo (YouTube), **catalog** = a curated YouTube link stored in library.json / hip_protocol.js, **none** = no video. Index totals: 715 exercises, 687 with video (catalog 379, pjf 208, trainheroic 100, none 28) — [data/exercise_index.json](data/exercise_index.json) `counts`.

## 1. What src/views/daily_mobility.js does

### Takeaway
The app's "Daily mobility" card is a fixed 5-exercise, ~5-minute BWS routine (Cat Cow, World's Greatest Stretch, Asian Squat, Half Kneeling Thoracic Rotations, Wall Slides) read from `library.json → warmups.bws_daily_mobility`; it does not pick or rotate moves, it just shows the list as a checklist with catalog videos, and lets the user add custom extras per day.

### Cited Findings
- Header comment: "Daily mobility / durability routine — BWS catalog + custom exercises per day." — [src/views/daily_mobility.js:1-3](src/views/daily_mobility.js)
- Move selection: `defaultRoutine()` returns `warmups.bws_daily_mobility`, else the first warm-up whose `day_types` includes `'any'`; no rotation, no day-type or readiness logic — [src/views/daily_mobility.js:20-24](src/views/daily_mobility.js)
- Routine content (`bws_daily_mobility`, source BWS, `day_types: ["any"]`, note "Do daily — morning, break, or before bed. ~5 minutes.") — [data/library.json:61035](data/library.json):
  - Cat Cow — 60s — "As many quality reps as you can within 60 seconds." (muscles: spine)
  - World's Greatest Stretch — 30s per side — "5 quality reps per side." (hips, ankles, mid_back)
  - Asian Squat — 30s hold + 30s side-to-side — "Heels on rolled towel if needed." (hips, ankles)
  - Half Kneeling Thoracic Rotations — 30s — "Rotate upper body only, avoid rotating at hips." (mid/upper back, chest, shoulders)
  - Wall Slides — 60s — "Back flat, arms and hands in contact with wall." (lower/mid traps)
- Presentation: collapsible card "Daily mobility" with done count `x/N`, the routine note, rows rendered by the shared `exerciseRowHTML`, an "+ Add exercise" button and "All done" — [src/views/daily_mobility.js:47-66](src/views/daily_mobility.js)
- Video: each row's video comes from the catalog entry looked up by name (`exerciseByName`); the routine itself supplies only dose and notes — [src/views/daily_mobility.js:81-85](src/views/daily_mobility.js). The detail sheet supports done/next navigation, "Daily mobility complete" label — [src/views/daily_mobility.js:96-118](src/views/daily_mobility.js)
- Logging: per-date `pref('mobility_logs')[dateKey] = {completed:[names], extra:[...]}` (local, per device) — [src/views/daily_mobility.js:9-18](src/views/daily_mobility.js)
- Add sheet: free-text name / duration / notes; library picker = first 40 exercises whose name matches `/mobility|durability|stretch|warm/` or id matches `/mobility|durability/` (crude name filter, not tag-based); placeholder example "Hip CARs" — [src/views/daily_mobility.js:131-173](src/views/daily_mobility.js)
- Where it renders: Cardio/Move tab (full) — [src/views/cardio.js:94](src/views/cardio.js); rest/easy-day screen in the workout view (compact) — [src/views/workout.js:1826-1827](src/views/workout.js)
- Catalog video sources for the 5 moves: Cat Cow = pjf (shares PJF's Cat Camel demo); World's Greatest Stretch, Asian Squat, Half Kneeling Thoracic Rotations, Wall Slides = catalog (YouTube) — [data/exercise_index.json](data/exercise_index.json)
- Hip flare mode "deliberately does not touch the lifting programs or daily mobility" — [src/lib/hip_protocol.js:1750-1758](src/lib/hip_protocol.js) (FLARE doc comment)

### Inferences
- Swapping in a new routine is a data change: add/replace a `warmups` entry (e.g. a new id with `day_types:["any"]`) or change `bws_daily_mobility`; the view needs no change unless rotation (A/B days) or per-day selection is wanted, which it currently cannot do.
- Exercise names in a new routine must match catalog names exactly (case-insensitive) or aliases, otherwise the row has no video (lookup is by name, line 83).
- Nothing in the current routine trains ankles/calves/knees under load, single-leg balance or tendons; it is pure range-of-motion + scap work.

### Gaps
- No tag-based or readiness-based selection exists; whether the user wants rotation must come from the user.

## 2. Program contents: Recovery & Mobility, Hip plan, Hip tab, Griffith TrainHeroic, PJF Durability Code

### Takeaway
The app already holds a rich, video-backed mobility/prehab library: PJF's Durability Code (daily-style correctives, ankle/foot work, knee isos, length-under-load holds, Nordics, soleus), Griffith's runners program (hip distractions, hamstring floss, shin box, pogos, calf isos, Copenhagen variants, T-spine), BWS warm-ups/prehab (band pull-aparts, ERs, dead hangs), and the Hip tab (PT + Motion RC + pelvic-reset breathing, with flare rules).

### Cited Findings
**Recovery & Mobility (`move30_recovery_mobility`)** — built by [data/build_recovery.py](data/build_recovery.py), stored at [data/library.json:60695](data/library.json); 2 off-day sessions, 30-45 min, "use on off days, alternate A and B" (build_recovery.py:53-65).
- Recovery A (from PJF Durability Code recovery day; build_recovery.py:24-36): Optional Foam Roll Circuit 5:00 (pjf); Supine Cross Connect 2×5/side (pjf); Rolling Arm Bar w/ Screwdriver Rotation 2×5/side (pjf); Walking Sprinters Mobility 2×8/side (pjf); Extensive Locomotion Cariocas 2×1:00 (pjf); Back Leg Lunge (Peterson Lunge) 2×5/leg (pjf); Wide Stance Length Under Load 45s (pjf); Brisk Walk 25:00 (alts bike/jog/Zone 2).
- Recovery B (BWS daily mobility + BWS prehab + Hip tab Pelvic Reset; build_recovery.py:37-51): Cat Cow 1:00; World's Greatest Stretch 2×30s/side; Asian Squat 1:00; Wall Side T Spine Opener 2×30s/side (pjf; alts Half Kneeling Thoracic Rotations, T-Spine Wall Contour); Wall Slides 12; (Weighted) Prone Arm Circles 2×12; Banded Hip Abductions 2×15; Posterior Pelvic Tilt Breathing 3×5 breaths (alts 7/11 Breathing, Sidelying Grounding); Easy Bike 30:00.

**BWS warm-ups / prehab (`library.json → warmups`)** — [data/library.json:60965-61070](data/library.json)
- `bws_prehab` ("Add after workouts or on rest days"): (Weighted) Prone Arm Circles 10-15; Wall Slides 10-15; Banded Hip Abductions 10-15; Dead Hangs 10-60s (overhand, relax; video pjf).
- `bws_upper_warmup`: Arm Circles 5/dir; Band Over-and-Backs 5; Band Pull-Aparts 10 (catalog); Band External Rotations 10/side (catalog); Weighted External Rotations 10/side (catalog).
- `bws_lower_warmup`: Forward Leg Swings 5/side; Side Leg Swings 5/side; Deep Squat 30s hold rocking side to side (catalog); Dead Bug 5/side.

**PJF The Durability Code Prime (`pjf_durability_code_prime`, 8 weeks × 6 days)** — [data/library.json:28958](data/library.json) (source text: data/pjf_durability_code_prime.txt). Weekly shape: D1/D4/D6 Lower Body, D2/D5 Core/Upper Body, D3 Recovery + Correctives/Iso's. Mobility/prehab content (week 1 unless noted; all videos = pjf):
- Lower-day prep (every lower day): Nasal Breathing Cardio Warm Up 5:00; Split Stance Loaded Hip Rotations 1×8; Hip Hinge Ankle Rocker 2×8; Cross Connect Glute Bridge 2×5; Half Kneeling Hip Flexor Stretch 8 (2 rounds); Hip Flexor w/ Rotation/Breathing 8/side; Half Kneeling Lift Off 2×5; Loaded Lateral Line Stretch 2×8; Hip Mobility ER/IR Skips 2 rounds.
- Lower-day ankle/foot accessories (D1/D4 wk1): Lateral Ankle Slant Board Cooker 3×10; Anti Ankle Collapse Progressions 3×8. D6: Ankle Mobility Lift Off 3×8; **Soleus Raise 3×12**; Copenhagen Side Plank 3×25s/side; RFE Iso/Oscillating Progressions 3×8; FFE Rotational Split Squat 3×8. Weeks 5+: 3D Ankle Blaster 3×15s; Ankle Mobility 1 Leg Squat 2×12; Single Leg Hip IR/ER 2×4-8; Single Leg Motor Control Squat/Calf Raise 2×4; Achilles Negative Steps 3×20s; Knee Step Overs 3×6; **Eccentric Nordic Hamstring Curl 3×4** (from wk4); Overcoming Glute Isometric (wk3); 90 Degree Knee ISOs 4×4 (wk7).
- Lower-day cooldown ("length under load", 45s holds): Hip Flexor Length Under Load; Lateral Lunge Length Under Load; Optional Adductor Stretch Progressions; Optional Pigeon Length Under Load; Wide Stance Length Under Load; Rotational RDL Length Under Load; Optional Post Chain Stretch; Hip Flexor/Quad Bridge (PJF's couch stretch); Front Chain Stretch w/ Reach and Tu.
- Core/Upper-day opener: Hanging w/ Breathing Emphasis 1:30 (dead hang); Shoulder Mobility Pullovers 2×8; QB1 Spiral Line 3×8. Weeks 5+ add 90/90 Knee Roll 45s + 3×4, All Four Prone Hip Shift Drill 3×4, Proprioception Progressions, Eyes Closed Diagonal Steps, Optional Downward Frog 3×8.
- Core/Upper-day "Workout 2" correctives block (~15 min, every D2/D5, all 8 weeks): Rock Back Breathing 10; Toe Motor Control 45s; Wall Side Posture Reach 2×20s; **Cat Camel 2×8**; Hip Mobility Band Freestyle 45s; Griffith Wall Rotations 2×4; Knee Pumps 2×1:00; **Slant Board Isometric Progressions 2×45s**; **60 Degree Knee ISOs 2×45s** (video review approved a PJF-style clip; "Spanish Squats" clips were candidates — data/pjf-video-review.json:7433-7442); **2 Leg Hamstring Iso 2×45s**; **Resisted Ankle Circles 2×30s**; Hip Flexor/Quad Bridge 45s; Front Chain Stretch w/ Reach and Tu.
- D3 recovery: as Recovery A above, plus Backwards/Forward Extensive Locomotive Skips 2×2:30 and Zone 2 25:00.

**Other PJF programs with mobility moves** (data/library.json programs.pjf): Fat Don't Fly phases use **7/11 Breathing 3:00** to close strength days (P1-P3); P2 movement-quality days: 90/90 Hip Opener 3×4, Dead Bug Rocker Series 3×6; P2 calf: Bent Knee Calf Raise 3×15, Double Leg Functional Calf Raise 3×20; P3 core days: **Hamstring Floss 3×10**, Wall Side T Spine Band Rotations 3×7. All pjf video.

**Griffith "Runners Mobility & Strength" (`th_runners_mobility_strength_8wk`)** — [data/providers/trainheroic.json:2551](data/providers/trainheroic.json); 8 weeks, 3 days/wk, 50 min, lettered groups, "Every exercise plays Griffith's own demo". All below are video = trainheroic unless noted (first-seen week/day, dose):
- Hips: Banded Hip Distraction Pulling Into Hip Extension (w1d1, 3 reps × 3s hold); …Into Hip Flexion (3 × 3s); Shin Box Rotation (w1d3 2×8); Single Leg Hinge To Hip Flexor Drive (w1d2 2×6); Standing Hip Flexion Supported With ISO Hold (2×10s); Kettlebell Loaded Hip Flexor Lift (w3 2×8); Hip Flexor Fall-In (w3 2×8); Facing Wall Hip Airplane (w3 2×6); QL Hip Drop From A Bench (w3 2×6); Figure 4 Flow (w5 2×8); Dynamic Hip Flexor Rock Back (w5 2×6); Shin Box Reach And Row (w5 2×8); Star Toe Tap (w5 2×6, balance); Loaded Hip Airplane (w5 2×6); Facing Wall Hip Circle Rotations (w7 2×6, L3); Hip Flexor Rock Back (w7 2×6, L3); Banded Incline Pigeon Rotation (w7 2×8, L3); Band Pulling Hip Hurdle (w7 3×5).
- Groin: Side Bridge Adductor Scissor (w1 3×1 × 10s hold); Supported Lateral Squat (w1d3 2×8); 90/90 Copenhagen (w3 3×10s); Dynamic Groin Drift (w3 2×8); Adductor Grab Banded Pendulum Swing (w4 2×6); Copenhagen Straight Leg (w5); Dynamic Copenhagen (w7 2×6, L3); Lateral Step To Adductor Pull-In.
- Hamstrings: Hamstring Floss With Knee Flexion (w1d2 2×8); Banded Hamstring Floss (w1d2 2×10).
- Knees: Poliquin Step Down (w1 1×8); Poliquin Step Down With TKE (w3 2×10); Step Up With TKE (w5 2×8); Landmine Split Squat Isometric (w1 2×10s); Barbell FFE Zercher ISO Hold (w3 2×10s); Lunge Matrix (w3 2×6).
- Lower leg: **Pogos (w1d3 2×20)**; **Loaded Calf ISO (w1d1 2×8s)**; Loaded Single Leg Calf Raise (w3 2×8); **Soleus Raise (w5d3 3×10; video pjf)**; Lateral Hops.
- Spine/shoulder: T-Spine Wall Contour (w7 2×6, L3); Side Lying T-Spine Dumbbell Press (w7 3×8); Rotating Pike Twist To Cobra Flow (w7 2×4); Rolling Shoulder Armbar (w5 3×6); Serratus Slides (w3 3×8).

**Hip plan (`hip_plan_pt_motion_rc`) and Hip tab (src/lib/hip_protocol.js)** — library program at [data/library.json:50823](data/library.json): "Session A and B alternate 3 days a week… every 2 weeks each exercise moves up its progression", 6 weeks, 45 min. Hip-tab exercises carry their own YouTube `videoId` (counted as **catalog** in the index).
- Warm-Up "Daily · 10-15 min" ("Never stretch cold") — [hip_protocol.js:24-140](src/lib/hip_protocol.js): Walk or Easy Bike 5-10 min; Cat-Cow 10 reps; Pelvic Tilts 15; Half-Kneeling Hip Flexor Stretch 3×30s/side (line 78-91; "highest-value stretch"); Thomas Hip Flexor Stretch 2×30s/side; Piriformis Stretch 3×30s/side (askPt note: figure-4 adduction may compress gluteal tendons, line 120); Hamstring Stretch 3×30s/side (strap).
- Pelvic Reset "Daily · Flare-friendly" (no end-range stretching) — [hip_protocol.js:146-215](src/lib/hip_protocol.js): Bench Hip Lift with Roller Squeeze 3×5 breaths; Sidelying Grounding 3×5 breaths; Posterior Pelvic Tilt Breathing 3×5 breaths; Supine Ball Squeeze Series 8 each.
- PT (line 221+): Single Leg Stance 3×30s/side; Single-Leg Balance on BOSU/Pad + Weight Pass-Arounds 3×5 each direction; Bridge with Ball Squeeze 3×12; Bird Dog 3×8/side 3s hold; Posterior Lunge 3×10; Band Walks 3×10; Single-Leg RDL 3×10; Standing Fire Hydrant 3×12; Side-Lying Hip Abduction 3×15; Modified Side Plank 3×20-30s; Straight Leg Raise 3×12; Prone Hip Extension (straight / knee bent) 3×12; Step Up with Leg Raise 3×10; Side Step-Ups 3×10.
- Motion RC (line 482+): Banded Distraction for Hip IR 2×10; …for Hip ER 2×10; Mini Band Monster Walk 2×15; Quadruped Hip Hikes 2×8; Standing Hip Hikes 2×10 @10 lb; SL Hip Airplane w/ Foam Roller 2×8-10; Banded Side Plank Clamshell 3×10; Banded Hip Flexor March 2×25s; TFL / Hip IR Stretch 3×10s; Seated Banded Hip IR 2×10-12; Adductor Slider Lunge 3×10 @20 lb; Elevated Hamstring Bridge 3×10; Copenhagen Side Plank (Knee) 3×30s.
- Sessions: A and B both start with the 4 mobility-prep moves (distraction IR/ER, seated banded IR, TFL/IR stretch), quadruped hip hikes, pad balance and Copenhagen — [hip_protocol.js:1495-1555](src/lib/hip_protocol.js). Schedule: Mon/Wed/Fri strength alternating A/B, all other days "Easy walk or bike + Pelvic Reset"; warm-up + pelvic reset every day — [hip_protocol.js:1701-1727](src/lib/hip_protocol.js).
- Progression ladders (e.g. Copenhagen knee → long lever → bottom-leg raises; pad balance → clock reaches → ball catches; airplane → unsupported → weighted), unlock suggested after 4 pain-free sessions, never automatic — [hip_protocol.js:1892-1913](src/lib/hip_protocol.js).
- Recovery tips: seat height hips ≥ knees, walk every 30-45 min of sitting, "short and frequent beats long and occasional" for hip-flexor stretching, ice after flares / heat before exercise — [hip_protocol.js:1053-1096](src/lib/hip_protocol.js).
- Reference protocol (MGB hip arthroscopy for FAI, rev 07/2024) phases I-V shown as a yardstick vs. surgery date, "not a prescription" — [hip_protocol.js:1570-1659](src/lib/hip_protocol.js); PROTOCOL_GAPS lists moves to ask a PT about (stool IR/ER, clamshells, single-leg balance with clock taps, Pallof press) — [hip_protocol.js:1661-1671](src/lib/hip_protocol.js).

**Athletic programs relevant to court work** (data/build_athletic_programs.py → library.json programs.athletic): Court Ready 6wk uses Achilles Negative Steps 2×6/leg (pjf), decel/landing drills ("Quiet feet, hips back, knees over toes. Stick every landing." — data/library.json:49626), Linear Line Hops 3×10/leg, Lateral Bounds; Hip Function 6wk reuses hip-tab moves plus Single Leg Hip IR/ER 2×6 each way.

### Inferences
- PJF's D2/D5 "Workout 2" correctives block is the closest existing thing to a ~15-minute daily joint-care routine, already covering toes, ankles, knees (isos), hamstrings, hips and T-spine with PJF's own demos.
- Griffith's prep groups (A/B "Prep") are short, low-level (L1-L2) and video-backed: good raw material for hip/groin/lower-leg days.

### Gaps
- Week-by-week PJF doses beyond weeks 1 and 5 were not fully enumerated (structure repeats; full text in data/pjf_durability_code_prime.txt).
- PJF D2/D5 correctives have time doses but no per-exercise coaching notes in library.json (notes null).

## 3. Candidate table by joint/region

### Takeaway
Every requested category except tibialis raises, Spanish squat (as a named move), wall sit, ATG/knees-over-toes split squat, couch stretch (as a named move) and CARs has at least one in-app exercise with a demo video.

### Cited Findings
All rows: tags from [data/exercise_index.json](data/exercise_index.json) (pattern / role / level), appearances and doses from the program files cited in section 2. "PJF-DC" = Durability Code Prime; "TH" = Griffith TrainHeroic; "Hip" = Hip tab / hip plan; "Rec" = Recovery & Mobility; "BWS-DM" = current daily mobility.

**Feet / ankles / calves / Achilles**
| Exercise | Where | Dose used | Tags | Video |
|---|---|---|---|---|
| Toe Motor Control | PJF-DC D2/D5 correctives | 45s | mobility/warmup/L1 | pjf |
| Resisted Ankle Circles | PJF-DC D2/D5 | 2×30s | mobility/warmup/L1 | pjf |
| Band Around the Back Ankle Circles | PJF band DB | — | mobility/warmup/L1 | catalog |
| Floating Toes Dorsiflexion w/ Band Distraction | PJF band DB | — | mobility/warmup/L1 | catalog |
| Band Around the Back Plantar Flexion | PJF band DB | — | mobility/warmup/L1 | catalog |
| Hip Hinge Ankle Rocker | PJF-DC lower prep | 2×8 | mobility/warmup/L1 | pjf |
| Ankle Mobility Lift Off | PJF-DC D6 | 3×8 | mobility/warmup/L1 | pjf |
| Ankle Mobility 1 Leg Squat | PJF-DC wk5+ | 2×12 | mobility/warmup/L1 | pjf |
| Anti Ankle Collapse Progressions | PJF-DC D1/D4 | 3×8 | isolation_lower/accessory/L1 | pjf |
| Lateral Ankle Slant Board Cooker | PJF-DC D1/D4 | 3×10 | isolation_lower/accessory/L2 | pjf |
| 3D Ankle Blaster | PJF-DC wk5+ | 3×15s | isolation_lower/accessory/L1 | pjf |
| Soleus Raise | PJF-DC D6; TH w5d3 | 3×12; 3×10 | isolation_lower/accessory/L1 | pjf |
| Loaded Calf ISO | TH w1d1 | 2×8s | isometric/accessory/L1 | trainheroic |
| Loaded Single Leg Calf Raise | TH w3 | 2×8 | isolation_lower/accessory/L2 | trainheroic |
| Bent Knee Calf Raise (Optional) | PJF FDF P2 | 3×15 | isolation_lower/accessory/L1 | pjf |
| Double Leg Functional Calf Raise | PJF FDF P2 | 3×20 | isolation_lower/accessory/L1 | pjf |
| Single Leg Motor Control Squat/Calf Raise | PJF-DC wk5 | 2×4 | balance/accessory/L2 | pjf |
| Seated / Standing / Single Leg Weighted Calf Raise | BWS | — | isolation_lower/accessory/L1-2 | catalog |
| Achilles Negative Steps | PJF-DC wk5 D6; Court Ready D1 | 3×20s; 2×6/leg | deceleration_landing/power/L2 | pjf |
| Pogos | TH w1d3 prep | 2×20 | plyo_bound_hop/warmup/L1 | trainheroic |
| Resisted Pogos (+ split stance / RFESS / rotational) | PJF band DB | — | plyo_bound_hop/power/L2 | catalog |
| Linear Line Hops | Court Ready | 3×10/leg | plyo_bound_hop/power/L2 | catalog |

**Knees (tendon isometrics, step-downs, TKE)**
| Exercise | Where | Dose | Tags | Video |
|---|---|---|---|---|
| 60 Degree Knee ISOs (Spanish-squat-like) | PJF-DC D2/D5; wk5 D4 | 2×45s; 4×5 | isometric/accessory/L2 | pjf |
| 90 Degree Knee ISOs | PJF-DC wk7 | 4×4 | isometric/accessory/L2 | pjf |
| Slant Board Isometric Progressions | PJF-DC D2/D5 | 2×45s | isometric/accessory/L2 | pjf |
| Supine Quad Extension Iso | PJF band DB | — | isometric/accessory/L2 | catalog |
| Landmine Split Squat Isometric | TH w1 | 2×10s | isometric/secondary/L1 | trainheroic |
| FFE Goblet Split Squat Isometric | Lean & Tone | — | isometric/secondary/L2 | catalog |
| Forward Lunge Isometric | PJF band DB | — | isometric/accessory/L2 | catalog |
| Poliquin Step Down (+ With TKE) | TH w1 / w3 | 1×8; 2×10 | lunge_single_leg/warmup/L1-2 | trainheroic |
| Lateral Step-Down | Hip ladder; Hip Function | 3×10/leg | lunge_single_leg/secondary/L2 | catalog |
| 2 Leg TKE / 1 Leg Supported TKE | PJF band DB | — | isolation_lower/accessory/L1-2 | catalog |
| Knee Step Overs | PJF-DC wk5 D6 | 3×6 | isolation_lower/accessory/L1 | pjf |
| Knee Pumps | PJF-DC D2/D5 | 2×1:00 | speed_accel/warmup/L1 | pjf |

**Single-leg balance / proprioception**
| Exercise | Where | Dose | Tags | Video |
|---|---|---|---|---|
| Single Leg Stance | Hip PT | 3×30s/side | balance/accessory/L1 | catalog |
| Single-Leg Balance on BOSU/Pad + Pass-Arounds | Hip A & B | 3×5 each dir | balance/accessory/L2 | catalog |
| Single-Leg Pad Balance + Clock Reaches / Ball Catches | Hip ladder | 3×5 reaches; 3×10 catches | balance/accessory/L2 | catalog |
| Star Toe Tap | TH w5 | 2×6 | balance/warmup/L2 | trainheroic |
| Proprioception Progressions; Eyes Closed Diagonal Steps | PJF-DC wk5 D2/D5 | 2 rounds; 2×30s | balance | pjf |
| SL Hip Airplane w/ Foam Roller → No Support → Weighted | Hip B / ladder | 2×8-10 → 2×6 | balance/accessory/L2-3 | catalog |

**Hips (flexors, rotation, IR/ER, distraction)**
| Exercise | Where | Dose | Tags | Video |
|---|---|---|---|---|
| World's Greatest Stretch | BWS-DM; Rec B | 30s/side | mobility/cooldown/L1 | catalog |
| Asian Squat / Deep Squat | BWS-DM; BWS lower WU | 30s+30s; 30s | mobility/warmup/L1 | catalog |
| Banded Distraction for Hip IR / ER | Hip A & B | 2×10 | mobility/warmup/L1 | catalog |
| Banded Hip Distraction Into Hip Extension / Flexion | TH w1d1 | 3 × 3s hold | mobility/warmup/L1 | trainheroic |
| Seated Banded Hip IR | Hip A & B | 2×10-12 | isolation_lower/accessory/L2 | catalog |
| TFL / Hip IR Stretch | Hip A & B | 3×10s | mobility/cooldown/L1 | catalog |
| Single Leg Hip IR/ER | PJF-DC wk5; Hip Function | 2×4-8 | isolation_lower/accessory/L1 | pjf |
| Hip Mobility ER/IR Skips | PJF-DC lower prep | 2 rounds | mobility/warmup/L1 | pjf |
| Split Stance Loaded Hip Rotations | PJF-DC lower prep | 1×8 | mobility/warmup/L2 | pjf |
| Shin Box Rotation / Reach And Row | TH w1 / w5 | 2×8 | mobility/warmup/L1-2 | trainheroic |
| Figure 4 Flow | TH w5 | 2×8 | mobility/warmup/L2 | trainheroic |
| Rock Back Breathing | PJF-DC D2/D5 | 10 | mobility/warmup/L1 | pjf |
| Hip Flexor Rock Back / Dynamic Hip Flexor Rock Back | TH w5/w7 | 2×6 | mobility/warmup/L2-3 | trainheroic |
| Half Kneeling Hip Flexor Stretch | Hip WU; PJF-DC lower prep | 3×30s/side; 8 | mobility/cooldown/L1 | catalog (hip) / pjf |
| Thomas Hip Flexor Stretch | Hip WU | 2×30s/side | mobility | catalog |
| Hip Flexor Length Under Load | PJF-DC cooldown | 45s | mobility/cooldown/L1 | pjf |
| Hip Flexor/Quad Bridge (PJF couch stretch) | PJF-DC; Lean & Tone | 45s/side | hinge/cooldown/L2 | pjf |
| Half Kneeling Lift Off | PJF-DC lower prep | 2×5 | mobility/warmup/L1 | pjf |
| Standing Hip Flexion Supported With ISO Hold | TH w1 | 2×10s | isometric/accessory/L1 | trainheroic |
| Banded Hip Flexor March → Standing Banded March | Hip A / ladder | 2×25s → 2×8 | accessory/L1-2 | catalog |
| 90/90 Hip Opener | PJF FDF P2 | 3×4 | mobility/warmup/L1 | pjf |
| 90/90 Knee Roll | PJF-DC wk5 D2/D5 | 45s; 3×4 | mobility/warmup/L1 | pjf |
| Optional Pigeon Length Under Load | PJF-DC cooldown | 45s | mobility/cooldown/L1 | pjf |
| Piriformis Stretch | Hip WU | 3×30s/side | mobility | catalog |
| Quadruped Hip Hikes | Hip A & B | 2×8 | — | catalog |
| Walking Sprinters Mobility | Rec A; PJF-DC D3 | 2×8/side | mobility/warmup/L1 | pjf |

**Groin / adductors**
| Exercise | Where | Dose | Tags | Video |
|---|---|---|---|---|
| Copenhagen Side Plank (Knee) → Long Lever → Bottom-Leg Raises | Hip A & B / ladder; Hip Function | 3×30s → 3×20s → 2×8 | isometric/core/L1-3 | catalog (raises: none) |
| Copenhagen Side Plank | PJF-DC D6 | 3×25s/side | isometric/core/L2 | pjf |
| Side Bridge Adductor Scissor | TH w1 | 3 × 10s hold | isometric/core/L1 | trainheroic |
| 90/90 Copenhagen | TH w3 | 3×10s | isometric/core/L2 | trainheroic |
| Copenhagen Straight Leg / Dynamic Copenhagen | TH w5 / w7 | 3×1; 2×6 | L2-3 | trainheroic |
| Wide Stance Length Under Load | Rec A; PJF-DC | 45s; 2×30s | mobility/cooldown/L1 | pjf |
| Lateral Lunge Length Under Load | PJF-DC cooldown | 45s | mobility/cooldown/L1 | pjf |
| Optional Adductor Stretch Progressions; Crossover Step Adductor Stretch | PJF-DC | 1-2 rounds; 2×30s | mobility/cooldown/L1 | pjf |
| Optional Downward Frog | PJF-DC wk5 D2/D5 | 3×8 | mobility/cooldown/L1 | pjf |
| Dynamic Groin Drift; Supported Lateral Squat | TH w3; w1 | 2×8 | warmup/L1-2 | trainheroic |
| Extensive Locomotion Cariocas | Rec A; PJF-DC D3 | 2×1:00 | agility_cod/warmup/L2 | pjf |

**Hamstrings / posterior chain**
| Exercise | Where | Dose | Tags | Video |
|---|---|---|---|---|
| Hamstring Floss | PJF FDF P3 | 3×10 | mobility/warmup/L1 | pjf |
| Banded Hamstring Floss; Hamstring Floss With Knee Flexion | TH w1d2 | 2×10; 2×8 | mobility/warmup/L1 | trainheroic |
| Hamstring Stretch (strap) | Hip WU | 3×30s/side | mobility | catalog |
| 2 Leg Hamstring Iso | PJF-DC D2/D5 | 2×45s | isometric/accessory/L2 | pjf |
| Eccentric Nordic Hamstring Curl | PJF-DC wk4+ | 3×4 | isolation_lower/accessory/L3 | pjf |
| Nordic Hamstring Curl / Reverse Nordic Curl | BWS | — | L2-3 | none |
| Rotational RDL Length Under Load; Optional Post Chain Stretch | PJF-DC cooldown | 45s | mobility/cooldown/L1 | pjf |
| Elevated Hamstring Bridge → SL → Slider Curls | Hip A / ladder | 3×10 → 3×8 | L2 | catalog |

**Spine / T-spine / trunk**
| Exercise | Where | Dose | Tags | Video |
|---|---|---|---|---|
| Cat Cow / Cat Camel / Cat-Cow | BWS-DM 60s; PJF-DC 2×8; Hip WU 10 | — | mobility/warmup/L1 | pjf (one shared demo) |
| Half Kneeling Thoracic Rotations | BWS-DM | 30s | mobility/warmup/L1 | catalog |
| Wall Side T Spine Opener | Rec B | 2×30s/side | mobility/warmup/L1 | pjf |
| Wall Side T Spine Band Rotations | PJF FDF P3 | 3×7 | mobility/warmup/L1 | pjf |
| Griffith Wall Rotations; Wall Side Posture Reach | PJF-DC D2/D5 | 2×4; 2×20s | mobility/warmup/L1 | pjf |
| T-Spine Wall Contour | TH w7 | 2×6 | mobility/warmup/L3 | trainheroic |
| Rolling Arm Bar w/ Screwdriver Rotation | Rec A; PJF-DC D3 | 2×5/side | mobility/warmup/L2 | pjf |
| QB1 Spiral Line | PJF-DC D2/D5 | 3×8 | mobility/warmup/L2 | pjf |
| Supine Cross Connect | Rec A | 2×5/side | anti_extension/core/L1 | pjf |
| Dead Bug; Dead Bug Rocker Series; Bird Dog | BWS lower WU 5/side; FDF P2 3×6; Hip PT 3×8 | — | core/L1 | catalog / pjf / catalog |

**Shoulders / scapula**
| Exercise | Where | Dose | Tags | Video |
|---|---|---|---|---|
| Wall Slides | BWS-DM; BWS prehab; Rec B | 60s; 10-15 | mobility/warmup/L1 | catalog |
| (Weighted) Prone Arm Circles | BWS prehab; Rec B | 10-15; 2×12 | mobility/warmup/L1 | catalog |
| Band Pull-Aparts | BWS upper WU | 10 | pull_horizontal/accessory/L2 | catalog ("Band Pull-Apart" duplicate: none) |
| Band External Rotations; Weighted External Rotations | BWS upper WU | 10/side | isolation_upper/accessory/L1-2 | catalog (Cable External Rotation: none) |
| Standing Face Pulls; Bent Over DB Face Pulls | BWS | — | pull_horizontal/accessory/L2 | catalog |
| Dead Hangs | BWS prehab | 10-60s | isometric/accessory/L1 | pjf |
| Hanging w/ Breathing Emphasis | PJF-DC D2/D5 | 1:30 | mobility/cooldown/L1 | pjf |
| Shoulder Mobility Pullovers | PJF-DC D2/D5 | 2×8 | mobility/warmup/L1 | pjf |
| Serratus Slides; Rolling Shoulder Armbar | TH w3 / w5 | 3×8; 3×6 | L2 | trainheroic |

**Breathing / down-regulation**
| Exercise | Where | Dose | Tags | Video |
|---|---|---|---|---|
| 7/11 Breathing | PJF Fat Don't Fly P1-P3; Lean & Tone; Rec B alt | 3:00 | mobility/cooldown/L1 | pjf |
| Posterior Pelvic Tilt Breathing | Hip Pelvic Reset; Rec B | 3×5 breaths | mobility/cooldown/L1 | catalog |
| Sidelying Grounding; Bench Hip Lift with Roller Squeeze; Supine Ball Squeeze Series | Hip Pelvic Reset | 3×5 breaths; 8 each | — | catalog |
| Nasal Breathing Cardio Warm Up | PJF-DC every lower day | 5:00 | conditioning/warmup/L1 | pjf |

**Not in the app (searched exercise_index.json names)**
- Tibialis raise: no exercise. Only mention is research notes: PJF podcast 058 calls tib raises "overrated" vs soleus/calf work — [docs/research/notes/pjf_griffith.md:116-130](docs/research/notes/pjf_griffith.md).
- Spanish squat: no named exercise; "Spanish Squats" YouTube clips were only video-review candidates for 60 Degree Knee ISOs — [data/pjf-video-review.json:7433](data/pjf-video-review.json).
- Wall sit: no exercise (only a timer regex in [src/lib/generator.js:36](src/lib/generator.js)).
- ATG split squat / knees-over-toes named moves: none; "knees over toes" appears only as a landing cue in Court Ready (data/library.json:49626). The research notes say PJF's stance on ATG/KOT exercises was "not found" (pjf_griffith.md:134).
- Couch stretch: no exercise by that name; Lean & Tone notes call "Hip Flexor/Quad Bridge" "PJF's couch stretch… Knee pain: use Hip Flexor Length Under Load instead" — [data/library.json:54373](data/library.json).
- CARs: none in the index (only "Band Assisted Half Kneeling Scapular CARs" as a video-review clip title, data/pjf-video-review.json:8033; and the "Hip CARs" placeholder in daily_mobility.js:136).
- Videos missing (`video_from: none`) among relevant moves: Nordic Hamstring Curl, Reverse Nordic Curl, Cable External Rotation, Band Pull-Apart (duplicate of Band Pull-Aparts), Donkey Calf Raise, Bridge March, Copenhagen with Bottom-Leg Raises — [data/exercise_index.json](data/exercise_index.json).

### Inferences
- A basketball-oriented daily routine can be fully video-backed using PJF + Griffith + catalog moves: e.g. ankles (Resisted Ankle Circles, Hip Hinge Ankle Rocker), calves/soleus (Soleus Raise, Loaded Calf ISO), knee iso (60 Degree Knee ISOs or Slant Board Iso as the "Spanish squat" stand-in), balance (Single Leg Stance / Star Toe Tap), groin (Copenhagen Knee, Side Bridge Adductor Scissor), hamstrings (Banded Hamstring Floss, 2 Leg Hamstring Iso), T-spine (Wall Side T Spine Opener), shoulders (Band Pull-Aparts, Band ERs, Dead Hangs), breathing (7/11 or PPT breathing), with Pogos as a low-dose tendon primer.
- Adding tibialis raises, Spanish squats, wall sits, ATG split squats or CARs would need new catalog entries plus videos (the add-workout-plan flow); otherwise rows would render without video.

### Gaps
- PJF band DB moves (ankle circles, dorsiflexion, TKE etc.) have catalog videos, but their prescribed doses were not checked in data/pjf_band_database.json.

## 4. Hip constraints a daily routine must respect

### Takeaway
The user has a hip being rehabbed through PT and Motion RC, with an October 2026 flare (burning/pinching at the side/back of the hip) that began after a pull in a 90/90 stretch; the app flags 90/90 / mermaid moves, forward-driving hip-flexor stretches (half-kneeling, couch / hip-flexor-quad bridge) and lunges/split squats, and asks that side-hip volume be counted.

### Cited Findings
- Flare summary: "Burning/pinching on the side and back of the hip, glute and outer-thigh tightness. Started after a pull in a 90/90 stretch; lunges, sitting, and the forward-driving hip flexor stretch make it worse. Lying down eases it. Cause not established yet" — [src/lib/hip_protocol.js:1759-1760](src/lib/hip_protocol.js)
- Default pauses when flare mode turns on: Half-Kneeling Hip Flexor Stretch ("known aggravator"), Posterior Lunge, Adductor Slider Lunge — [hip_protocol.js:1761-1765](src/lib/hip_protocol.js)
- Flare calm rules: "Gentle range only… Nothing forced to end range, no deep hip rotation, no seated 90/90 positions. The Pelvic Reset tab is the go-to here"; short easy walks only if mild; keep the pelvis level, end a single-leg set if the opposite hip drops or hikes; sit with knees no higher than hips, get up every 30-45 min; don't sleep on the sore side — [hip_protocol.js:1767-1776](src/lib/hip_protocol.js)
- Return rule: back after 2-3 settled days at about half volume; stop-if: sharp pinch, building burning, tingling/numbness, weakness or limp — [hip_protocol.js:1777-1779](src/lib/hip_protocol.js)
- Caution tags by name (regex): `deep-rotation` = /90\s*\/\s*90|mermaid/; `hip-forward-stretch` = /hip flexor \/ quad bridge|couch stretch|hip flexor stretch|kneeling hip flexor|thomas/; `lunge` = /lunge|split squat/; also tags side-lying-load (side plank, clamshell, Copenhagen), hinge, bridge, squat, step — [hip_protocol.js:1819-1828](src/lib/hip_protocol.js). The Thomas stretch is explicitly NOT flagged — [hip_protocol.js:1853-1855](src/lib/hip_protocol.js)
- Suggested swaps: for 90/90-type → Bench Hip Lift with Roller Squeeze, Supine Ball Squeeze Series, Sidelying Grounding, Cat Cow, Dead Bug; for hip-forward stretch → Posterior Pelvic Tilt Breathing, Bench Hip Lift, Pelvic Tilts, Hamstring Stretch, Dead Bug; for lunges → step-ups, box squat, goblet squat, hip thrust, DB RDL, bridge with ball squeeze — [hip_protocol.js:1839-1852](src/lib/hip_protocol.js)
- Side-hip load counted weekly (side-lying abduction, side plank, band walks, fire hydrant, monster walk, hip hikes, side-plank clamshell, Copenhagen knee, pool abduction); "trimming the total side-hip volume is the first lever" — [hip_protocol.js:1786-1817](src/lib/hip_protocol.js), [hip_protocol.js:487](src/lib/hip_protocol.js)
- Piriformis (figure-4) carries an ask-your-PT note: forced ER and adduction may compress gluteal tendons if the lateral pain is tendinopathy — [hip_protocol.js:120](src/lib/hip_protocol.js)
- The hip plan already prescribes warm-up + Pelvic Reset daily and strength Mon/Wed/Fri — [hip_protocol.js:1703-1727](src/lib/hip_protocol.js)
- Caution badges apply across the catalog while flare mode is on, "never to pause or remove anything outside the Hip tab" — [hip_protocol.js:1834-1838](src/lib/hip_protocol.js); the generator's "go easy on hip" option is described in [docs/PROGRAM_DESIGN.md:174](docs/PROGRAM_DESIGN.md) ("Hip-flare mode turns on 'hip'. Not medical advice.")

### Inferences
- A new daily routine should avoid (or gate behind "hip settled") 90/90 Hip Opener, 90/90 Knee Roll, 90/90 Copenhagen, Shin Box moves (seated deep rotation, not regex-flagged but the same position family), Pigeon, Half Kneeling Hip Flexor Stretch, Hip Flexor/Quad Bridge, World's Greatest Stretch (a lunge-position hip-flexor stretch, not regex-flagged by name) and any lunge/split-squat isometric. Note the current daily mobility card includes World's Greatest Stretch and Asian Squat (deep flexion), which flare mode does not touch.
- Copenhagen variants and side planks add to the side-hip weekly count; on days that are hip strength days (Mon/Wed/Fri, Copenhagen already in A and B) a daily routine should not duplicate them.
- Hip-safe options that also serve basketball: Pelvic Reset breathing, Thomas stretch (unflagged), Hamstring Stretch / Banded Hamstring Floss, Cat Cow, Dead Bug, ankle/foot/calf work, knee isos done without a split stance (60 Degree Knee ISOs / Slant Board Iso), T-spine wall work, shoulder band work.

### Gaps
- The user's age (~40), basketball coaching/playing and whether the flare is currently active are not stored in the repo files read; the flare is dated "Oct 2026" in a code comment (hip_protocol.js:1751). Surgery date (if any) is a runtime pref (`hip_surgery_date`), not in the repo.
- The cause of the flare is explicitly "not established" in the code; no diagnosis is recorded.
