# Exercise reels to match (Facebook) — to do in a local session

**For a Claude session on the user's own computer**, where the browser is logged into Facebook
(cloud sessions can't use that login, so every link there comes back as a login page).

Saved 2026-11-11 for the **Daily Mobility** program (`data/build_daily_mobility.py`, program id
`daily_mobility`). Most of the hip moves are **Vernon Griffith**'s (the TrainHeroic coach whose
101 demos are already in `data/providers/trainheroic.json`); others are from Proformance and
other coaches.

## What to do

1. Open each link below in the logged-in browser and fill in the **Move** and **Creator** columns
   (and any reps/sets/cues the reel gives).
2. Match each reel to the user's notes (below). Several hip-list moves have no exercise in the
   app yet and are stood in for by a general move in Daily C:
   heel clicks, hip opener into knee lean back, standing 45° extension IR/ER, knee pull + lift +
   tie heel bridge, ½ frog into cobra, frog leg cobra lean, squats to hamstring stretch,
   90/90 45 push, 90/90 backside opener, 90/90 30% rotations, 90/90 swing-through single leg,
   90/90 lift back / lean to side, swing-throughs.
3. For each one: add it with `lib.ensure_exercise(name, 'daily', tags={...})` in
   `data/build_daily_mobility.py`, give its row the reel as `video_url` (Facebook links open in the
   browser), put it in Daily C (or A/B where it fits), re-run
   `python3 data/build_daily_mobility.py`, then `node data/check_catalog.mjs` and
   `node data/check_program.mjs daily_mobility`.
4. If Griffith's TrainHeroic demo exists for the same move under another name, use that name
   instead (provider demo first, see docs/ADDING_A_PROGRAM.md §3).

## The user's notes the reels come from

**Hip Mobility:** 1 Rotating Pigeon · 2 Knee circle · 3 Sit back ankle tuck/untuck · 4 Standing 45
extension internal/external · 5 Frog Leg Cobra Lean · 6 ½ Frog into cobra · 7 Hip opener into knee
lean back · 8 Knee Pull Band Resistance diff angles · 9 Knee Pull, Lift Tie Heel Bridge · 10 Squats
to Hamstring stretch · 11 Heel Clicks · 12 90/90 45 push · 13 90/90 Windshield Wipers · 14 90/90
Backside Opener · 15 90/90 30% Rotations · 16 90/90 swing through single leg · 17 90/90 lift Back,
lean to side if need · 18 Lunge to Hamstring (tuck/push glute) · 19 Swing Throughs · 20 Band Pigeon

**Low Back Body:** Cat Camel 7x · Lunge with overhead reach 6x · Hip Airplanes (Split Lunge
Rotation) 3x3 · Stand stretch with breath

## Already read from screen recordings (cloud session)

- Proformance, "Forget about tight hips with these 4 moves": bench-supported pigeon with
  rotation · lateral lunge with one foot on the bench · deep hip-flexor lunge, back leg long ·
  kneeling at the bench, leg circles/extensions. (Used in Daily C as stand-ins.)
- PJF Online: Optional Pigeon Length Under Load → Hip Flexor Length Under Load; plate step-downs,
  half-kneeling front-foot-on-plate knee rocks, single-leg stance.
- 11 more Facebook screen recordings, read 2026-11-11 (frame by frame). Only one is Griffith's,
  and its "...more" caption wasn't expanded, so **his full hip session is still in a reel link**:

| Recording | Creator | Moves (dose / cues) | Note items it shows |
|---|---|---|---|
| 2025-09-12 | **Vernon Griffith**: "FULL HIP MOBILITY SESSION while out at Ohio State…" | Hands and knees → kick one leg back → sink into a low pigeon/long lunge, chest down, reach forward → back; both sides. No dose shown. | likely #1 Rotating Pigeon (or #19/#20) |
| 2025-09-15 | Dr. Devon Hoffman, "fix anterior pelvic tilt" | On back: pull one knee to chest, lift the other foot's toes, drive the heel and lift the hip, low back pressed down; hold 5 breaths (exhale back down, inhale hip up); both sides. | **#9 Knee Pull, Lift Toe/Heel Bridge** (strong) |
| 2025-11-04 | dr.leethechiro | On back, long band low-anchored around the top of the thigh, pulling toward the anchor; knee to chest and across at different angles. | likely **#8 Knee Pull Band Resistance** |
| 2025-09-21 | RISE Training, "pinch in your hip" | Seated leaning back, band foot-to-other-knee, hold the knee against it: 2 × 40 s at 40% daily for a week, then more effort/less time. (2nd move cut off.) | possibly #8 |
| 2025-10-21 | Project Physical Therapy, "What them hips do?" | Back to a wall, standing leg slightly bent; other leg turn in + lift, then turn out + lift, alternating; 8-10 cycles × 2-3 sets; wall/chair for balance. | likely **#4 Standing 45 ext IR/ER** |
| 2025-10-19 | raybeau_moves, "Hip Mobility Beginner Friendly" | All ×5 each side: block squat + trunk rotation reach · seated knee windshield wipers · seated good mornings · side-bend QL stretch · squat → fold → lunge back · 90-90 hold/hinge, straighten back leg. | likely **#13** (wipers), **#10** (squat→hamstring), weak #12/#14/#17 |
| 2026-02-26 | Yoga With Katharine, "Hip Mobility routine that will change your life" | Malasana folds · knee drops in squat · **quadruped knee circles** · low lunge tucks · mermaid openers · kneeling side lunges; 3×/day for 21 days. | **#2 Knee circle** (strong), likely #18 (tuck), possibly #1 |
| 2025-09-20 | Physical Therapy Session, "30 times daily" | Hands and knees: swing one knee under the body, then kick the leg back and up. | possibly **#19 Swing Throughs** |
| 2025-10-19 | Zac Cupples, "Still stretching your hip flexors?" | On back, ball between knees, lower one leg without arching, 3 × 8/side · reverse lunge holding a weight, heel heavy, no back arch/hip hike, 3 × 8/side; 2-4 weeks. | not on the list (hip extension control) |
| 2026-02-26 | Yoga with Asury, "undoes hours of sitting" | Shins up a wall, knees on a blanket: hands-and-knees → cobra/upward dog and back, repeated. | not on the list (near #5/#6) |
| 2026-02-26 | Anytime Mobility, "3 moves each day" | On back with a small ball: knee rotations · legs straight up · frog-leg lift. | not on the list |

Still **not found in any recording**: #3 sit back ankle tuck/untuck, #5 frog leg cobra lean,
#6 ½ frog into cobra, #7 hip opener into knee lean back, #11 heel clicks, #15 90/90 30% rotations,
#16 90/90 swing-through single leg, #20 band pigeon (and a clear #12/#14/#17). These are most
likely in Griffith's full hip-session reel and the links below.

## Stand-ins in Daily C (added 2026-11-11, check these)

**These moves are options, not a checklist** (the user, 2026-11-11). Daily C uses a core of 7;
the rest are in its Swap lists ("Plan alternatives"), and all of them are ordinary warm-up options
the plan generator can pick for training-day warm-ups (no preference over other moves). When linking reels, add new moves the same way:
catalog entries with `role: warmup`, source `daily`, and only put them in Daily C if they earn a slot.

Every move from the user's Hip Mobility list in Daily C is either a **new exercise named after the
list item, borrowing the closest existing demo** (`video_from` in `data/build_daily_mobility.py`), or an
**existing app exercise used for the list item**. Each row's notes in the app say "Demo is a
stand-in" or name the list item. Replace a stand-in when its real reel is linked, and change the
mapping if it's the wrong move.

| List item | In Daily C as | Demo shown now | How sure | Source of the move |
|---|---|---|---|---|
| #1 Rotating Pigeon | Optional Pigeon Length Under Load (existing, PJF) | PJF's own | likely | Griffith reel (2025-09-12) or PJF; Griffith's full session not seen |
| #2 Knee circle | **Knee Circles** (new) | stand-in: Fire Hydrants | strong match, stand-in demo | Yoga With Katharine reel |
| #4 Standing 45 ext IR/ER | **Standing Hip Internal/External Lifts** (new) | stand-in: Facing Wall Hip Circle Rotations (Griffith) | likely match ("extension" part not obvious) | Project Physical Therapy reel |
| #8 Knee Pull Band Resistance | Banded Hip Distraction Pulling Into Hip Flexion (existing, Griffith) | Griffith's own | likely | dr.leethechiro reel (RISE Training possible) |
| #9 Knee Pull, Lift Tie Heel Bridge | **Knee Pull Heel Bridge** (new) | stand-in: On Bench Single Leg Glute Bridge (Griffith) | strong match, stand-in demo | Dr. Devon Hoffman reel |
| #10 Squats to Hamstring stretch | **Squat to Hamstring Stretch** (new) | stand-in: Hamstring Stretch | likely | raybeau_moves reel |
| #13 90/90 Windshield Wipers | 90/90 Knee Roll (existing, PJF) | PJF's own | likely | raybeau_moves reel |
| #18 Lunge to Hamstring | Hamstring Floss (existing, PJF) | PJF's own | likely (tuck part seen) | Yoga With Katharine reel |
| #19 Swing Throughs | **Quadruped Swing Throughs** (new) | stand-in: Donkey Kicks | possible | Physical Therapy Session reel (or Griffith) |
| #20 Band Pigeon | Banded Incline Pigeon Rotation (existing, Griffith) | Griffith's own | guess (not seen in any recording) | — |
| #3 Sit back ankle tuck/untuck | Hip Flexor Rock Back (existing, Griffith) | Griffith's own | guess | — |
| #5/#6 Frog leg cobra lean, ½ frog into cobra | Optional Downward Frog (existing, PJF) | PJF's own | guess | — |
| #12, #14, #15, #16, #17 (90/90 45 push, backside opener, 30% rotations, swing-through single leg, lift back/lean) | folded into 90/90 Hip Opener (existing, PJF), 1:30 | PJF's own | placeholder | likely Griffith's full hip session |
| #7 Hip opener into knee lean back, #11 Heel clicks | not in Daily C yet | — | not found | — |

## Links (all 29 read 2026-11-11, logged-in local session)

Read by expanding each caption and sampling frames. **Used** = what the app does with it now.

| # | Link | Creator | Moves | Used |
|---|---|---|---|---|
| 1 | https://www.facebook.com/share/r/1KCCCnZDYk/ | OJ.Fit | "Fix tight hip flexors with these 4 moves": 90-90 dynamic stretch 30 s, (supine) leg raises 12/side, half-kneeling hip flexor lift 12/side | — (the app has these) |
| 2 | https://www.facebook.com/share/r/1DwCaigXgo/ | FitPhysio Dr.K (PT) | Hip internal rotation for the deep squat: supine on a bench, band around the ankles, IR test/drill | — |
| 3 | https://www.facebook.com/share/r/14nrxPggGDK/ | Igor system | 3 moves: pigeon → 90/90 rotation, seated 90/90 swing-through, quadruped knee swing-through | **Quadruped Swing Throughs** video (#19); also shows #1, #16 |
| 4 | https://www.facebook.com/share/r/1G3XhuNqxJ/ | John Pierson | "I'm 37": general mobility (hanging lat stretch, lateral flexion, squat, pull-ups, dips) | — |
| 5 | https://www.facebook.com/share/r/1SsUvsbpfz/ | Portia Mitchell | Half-kneeling hip work with a kettlebell, kneeling lunge, single-leg balance on a pad | — |
| 6 | https://www.facebook.com/share/r/154jd4L95QS/ | dmitrymobility | 4-move hip rotation flow: straddle rotations, lunge/pigeon rotation, 90/90 | — |
| 7 | https://www.facebook.com/share/r/1DNdSPh8KL/ | Mat Frankel | "If you sit a lot": seated 90/90, half-kneeling hip flexor, seated knee lifts | — |
| 8 | https://www.facebook.com/share/r/1FSvxNHagh/ | Nooch_13 | Side-lying-on-bench hip abduction with thoracic rotation (glute med) | — |
| 9 | https://www.facebook.com/share/v/1Dt3KzHMuZ/ | Dr. Bryan Geier (Doctor Fascia) | Standing hip internal/external rotation, 2:39 | candidate for #4 (Standing Hip IR/ER Lifts), not linked |
| 10 | https://www.facebook.com/share/r/1e7DvdzGeL/ | MauraExplorer.Yoga | Supine tabletop, block between thighs, hip IR (feet out), adductors + deep core | — |
| 11 | https://www.facebook.com/share/r/1dtKD1N3NR/ | liftwithkartiki | "If you sit a lot": lunge rotation, prone frog-leg, seated rotation; 2-3 × 6-10 | possible #5 frog leg, not linked |
| 12 | https://www.facebook.com/share/r/1Eg9h6emjN/ | FitwithCarla | Foam-roller toe taps (lower abs) | — |
| 13 | https://www.facebook.com/share/r/1B5nvH41kd/ | Primal Mobility | Seated 90/90 internal-rotation lift and hold | candidate for #15/#17 |
| 14 | https://www.facebook.com/share/r/19u9Jf4T7z/ | **Vernon Griffith** (post) | Hip & low back: Incline Bench Pigeon Rotations, QL Hip Drop, Half Kneeling Lateral Tilts, Suitcase Carries | his TrainHeroic demos already cover the pigeon, QL drop and carry |
| 15 | https://www.facebook.com/share/v/14uXCEoJ2gx/ | **Vernon Griffith** (post) | Adductors/groin: rack adductor work, Rack ISO Leg Whip, "add movement, load, length and velocity" | — |
| 16 | https://www.facebook.com/share/r/1KLibtqVwQ/ | Yoga with Asury | Shins-up-the-wall cobra | — |
| 17 | https://www.facebook.com/share/r/14yaY7cdBJ3/ | Proformance | Hip IR: banded 90/90 IR, med-ball/bench work, supine band | — |
| 18 | https://www.facebook.com/share/r/1MUgcCmXWz/ | jasonandlaurenpak | Lengthen/isolate/strengthen: split-stance adductor mob, side-lying adductor lifts, cossack squat, side plank clamshell hip raise, landmine curtsy lunge | — |
| 19 | https://www.facebook.com/share/r/1DytG6Xr62/ | Jtm_fit | 5 ladder drills: Twist Hops, In & Out Hops, Lateral In & Outs, Ickey Shuffle, Ali Shuffle | **all 5 added** (equipment agility_ladder) |
| 20 | https://www.facebook.com/share/r/19J5jeRbxL/ | Proformance | "Forget about tight hips with these 4 moves" (already read) | Daily C stand-ins |
| 21 | https://www.facebook.com/share/r/1KfsHSGupc/ | PostureKing | Raised Foot Spinal Sweep (hamstring / sciatic floss) | — |
| 22 | https://www.facebook.com/share/r/1HyPkxUbsv/ | Yoga With Katharine | Hip routine: squat → hamstring, mermaid, low lunge (likely the knee-circles one) | candidate for #2 / #10 |
| 23 | https://www.facebook.com/share/r/19qvFrjBEq/ | Yoga With Katharine | Relevés, wide-stance folds, malasana knee drops | — |
| 24 | https://www.facebook.com/share/v/1FLcHuHnk8/ | **Vernon Griffith** (post) | "Motion is lotion" (under 10 min, 1-2 rounds): Hip Pry to Lateral Stretch 5/side, Dynamic Groin Drift 6 angles, Figure Four Contours 8/side, Side Lying Hip Openers 8/side, Adductor Rock Backs 8/side | **3 added**: Hip Pry to Lateral Stretch, Side Lying Hip Opener, Adductor Rock Back (groin drift + figure 4 use his TrainHeroic demos) |
| 25 | https://www.facebook.com/share/r/1E16iko8Wi/ | Skyler Munro | Shoulders: lower trap, serratus, rotator cuff drills | — |
| 26 | https://www.facebook.com/share/r/1Kt7PxPyMr/ | Violet Balance | Side-lying ball squeeze + band reach (functional asymmetry) | — |
| 27 | https://www.facebook.com/share/r/1CW6bp2xMh/ | Garcia_effect_official | 10 foam-roller mobility moves | — |
| 28 | https://www.facebook.com/share/r/198mCiGMg6/ | MauraExplorer.Yoga | Prone shoulder opener over a ball (rounded shoulders) | — |
| 29 | https://www.facebook.com/share/r/1HxtPvKyML/ | Yoga with Asury | 3 shoulder openers on yoga blocks, 1-3 min holds | — |

**Not in any link:** Griffith's full hip session (2025-09-12 recording), Dr. Devon Hoffman (#9), dr.leethechiro (#8),
Project Physical Therapy (#4), raybeau_moves (#10, #13). Those stay screen recordings only, so Knee Circles,
Standing Hip IR/ER Lifts, Knee Pull Heel Bridge and Squat to Hamstring Stretch keep their stand-ins. Still not
seen anywhere: #3, #6, #7, #11, #12, #14, #16 (#16 only partly, Igor reel).
