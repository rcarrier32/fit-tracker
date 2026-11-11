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
- 11 more Facebook screen recordings (mostly Griffith) were being read on 2026-11-11; results
  are added below when available.

## Links

| # | Link | Creator | Move |
|---|---|---|---|
| 1 | https://www.facebook.com/share/r/1KCCCnZDYk/ | | |
| 2 | https://www.facebook.com/share/r/1DwCaigXgo/ | | |
| 3 | https://www.facebook.com/share/r/14nrxPggGDK/ | | |
| 4 | https://www.facebook.com/share/r/1G3XhuNqxJ/ | | |
| 5 | https://www.facebook.com/share/r/1SsUvsbpfz/ | | |
| 6 | https://www.facebook.com/share/r/154jd4L95QS/ | | |
| 7 | https://www.facebook.com/share/r/1DNdSPh8KL/ | | |
| 8 | https://www.facebook.com/share/r/1FSvxNHagh/ | | |
| 9 | https://www.facebook.com/share/v/1Dt3KzHMuZ/ | | |
| 10 | https://www.facebook.com/share/r/1e7DvdzGeL/ | | |
| 11 | https://www.facebook.com/share/r/1dtKD1N3NR/ | | |
| 12 | https://www.facebook.com/share/r/1Eg9h6emjN/ | | |
| 13 | https://www.facebook.com/share/r/1B5nvH41kd/ | | |
| 14 | https://www.facebook.com/share/r/19u9Jf4T7z/ | | |
| 15 | https://www.facebook.com/share/v/14uXCEoJ2gx/ | | |
| 16 | https://www.facebook.com/share/r/1KLibtqVwQ/ | | |
| 17 | https://www.facebook.com/share/r/14yaY7cdBJ3/ | | |
| 18 | https://www.facebook.com/share/r/1MUgcCmXWz/ | | |
| 19 | https://www.facebook.com/share/r/1DytG6Xr62/ | | |
| 20 | https://www.facebook.com/share/r/19J5jeRbxL/ | | |
| 21 | https://www.facebook.com/share/r/1KfsHSGupc/ | | |
| 22 | https://www.facebook.com/share/r/1HyPkxUbsv/ | | |
| 23 | https://www.facebook.com/share/r/19qvFrjBEq/ | | |
| 24 | https://www.facebook.com/share/v/1FLcHuHnk8/ | | |
| 25 | https://www.facebook.com/share/r/1E16iko8Wi/ | | |
| 26 | https://www.facebook.com/share/r/1Kt7PxPyMr/ | | |
| 27 | https://www.facebook.com/share/r/1CW6bp2xMh/ | | |
| 28 | https://www.facebook.com/share/r/198mCiGMg6/ | | |
| 29 | https://www.facebook.com/share/r/1HxtPvKyML/ | | |
