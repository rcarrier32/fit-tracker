# ChatGPT "Left Hip Rehabilitation Plan" — what we took, what's left to verify

Saved 2026-11-21 from a cloud session. The user pasted a ChatGPT plan (post-arthroscopy, lateral hip strength)
plus their symptom history and asked to evaluate it for our hip plan (`src/lib/hip_protocol.js`).

## The user's context (from the paste)

- Left hip arthroscopy, labral repair + FAI correction, April 9 2026. Good early progress, then recurring symptoms.
- Left: deep discomfort on the outside of the hip, slightly below and behind the greater trochanter. Pulling/tightening
  when the left foot lands and takes weight. Worse after long sitting and when first standing up; eases once walking.
  Side-sleeping on the left aggravates it. Not much tenderness to direct pressure. No consistent pinch in hip flexion.
- Right: constant gripping in the upper glute near the pelvis, even sitting; movement helps. Feels the pelvis sits
  rotated when seated (left sit bone forward) and shifts weight to the left.
- Working theories, not diagnoses: glute med/min involvement, GTPS, post-op mechanics, bilateral compensation,
  posterior-lateral hip structures. Goal: the left hip accepts and shares load better; return to lifting and basketball.

**User's call:** ignore ChatGPT's "avoid these movements" list (deep lunges, 90/90, hip flexor stretching, leg drive on
bench, etc.). "I like our programs and think we need to fix things, not avoid exercises." Nothing was removed.

## Evaluation

Most of ChatGPT's Phase 1–3 was already in Sessions A/B at a harder level (band walks → Monster Walk; low step-ups →
Step-ups / Side Step-Ups; supported balance → pad balance with weight passes; standing abduction → side-lying abduction
and standing hip hikes; double-leg bridge → ball-squeeze and hamstring bridges with ladders).

Added in v201 (the gaps it pointed at):

| Added | Where | Why |
|---|---|---|
| Supine Banded Hip Abduction Isometric 5 × 30 s | Pelvic Reset (daily) | steady side-hip load, both sides evenly |
| Standing Wall Hip-Abduction Isometric 5 × 30 s/side | Sessions A & B, first | glute med/min holds; standing leg keeps the pelvis level |
| Split-Stance Weight Shift → Step and Stick → Lateral Step and Stick | Sessions A & B (ladder) | the main symptom: the left foot taking weight |
| Banded Glute Bridge with Abduction | Session A (ladder → march → single leg) | push-out partner to B's ball-squeeze bridge |
| Elevated Sit-to-Stand → Box Squat | Session B (ladder) | standing up after sitting, even on both feet |
| Sit evenly on both sit bones | Driving & Recovery | the left weight shift when seated |
| Hip Check (L vs R every 2 weeks: single-leg stance, side plank, single-leg bridge, step-downs) | Back to Court tab, `pref('hip_checks')`, in the PT summary | measurable both-sides progress; gates the court steps (80% / 90%) |
| Back to Court: pogos → switch & stick → linear decel → lateral landing → lateral decels → lateral bounds | new Hip tab | return-to-basketball ladder, then Court Ready / HoopStudy. All six use PJF demos already in the catalog |

## Sources (read 2026-11-21 in a local session)

- **Locala NHS, *Lateral Hip Pain — Info for Patients*** ([PDF](https://www.locala.org.uk/fileadmin/Services/MSK/Hip/Lateral_Hip_Pain_-_Info_for_Patients.pdf)).
  The useful one. GTPS = the gluteal tendons, not the bursa; irritated by overload **and by compression** in daily
  positions; strengthening is the fix (injections only buy time). Exercises: side-lying leg-lift *hold* (top leg at hip
  height, pelvis stacked, no hitch) 1 min × 2–3; single-leg balance 30 s with the pelvis level (hand on the wall
  allowed); step-ups leading with the weaker leg, slow lower; "advanced": side-lying hips-up hold with the top leg
  lifted, 30 s/side. Compressive positions: hanging on one hip, crossed legs/knees, side-lying with the top knee
  dropped across. Sleep: sore side up with a pillow between the knees, or on the back.
  **Used:** new Driving & Recovery tip `rc-tendon-positions` (sleep/stand/sit positions; the user side-sleeps on the
  left and it aggravates). Exercises already covered at a harder level (supine/standing abduction isos, pad balance,
  step-ups, side plank / Copenhagen). Nothing removed: it is about resting positions, not training.
- **University of Washington, *Lower Body Exercises While Standing***: the English version is
  [here](https://healthonline.washington.edu/sites/default/files/record_pdfs/Lower-Body-Exercises-While-Standing.pdf)
  (the cited "-RU" link is the Russian copy). Basic standing set, 1 × 10 → 2 × 15, 3×/day. Sit-to-stand cue ("hips
  to the front of the seat, equal weight over each foot, sit down slowly") matches ours. Nothing new.
- **NHS Northamptonshire MSK page**: a clinic venue page, no exercise content. Nothing to use.
- **The Prehab Guys, *Isometric Bridge – Hip Abduction, Band***: video is paywalled (53 s); the text is free:
  bridge, tuck the tailbone, push the knees out hard, keep the hips up throughout; don't arch; **don't let the feet
  roll out**. **Used:** that feet cue added to Banded Glute Bridge with Abduction.

## Video candidates from ChatGPT (checked 2026-11-21)

All five ids are real and match their titles (ChatGPT didn't invent them this time), but four are 2½–3½ min talking
videos from Knob Noster PT, so short demos were used instead.

| Move | ChatGPT's id | Checked |
|---|---|---|
| Supine Banded Hip Abduction Isometric | `JkvdQonRI-k` | real, Knob Noster PT, 3:20 |
| Glute bridge (already has videos) | `CPb8yRUxWBQ` | real, Knob Noster PT, 2:38 |
| Standing hip abduction (not added) | `jA1CCqp5e9g` | real, Physical Therapy First, 0:29 |
| Standing Wall Hip-Abduction Isometric | `acBVAPPRYIw` | real, Knob Noster PT, 2:54 |
| Band walks (already has videos) | `ZvXFnpUnX-c` | real, Knob Noster PT, 3:35 |

## Videos applied (v202)

| Move | Video | Channel |
|---|---|---|
| Supine Banded Hip Abduction Isometric | `jybaCNbYOOs` (15 s) | Your Rehab Physio |
| Standing Wall Hip-Abduction Isometric | `NIycWL3cZEE` (12 s) | Evolutio Sports Physio (knee-to-wall shown; MedBridge's clip had no wall in frame and a subscribe overlay) |
| Split-Stance Weight Shift | `-xCit32uabY` (27 s) | Total Performance Physical Therapy |
| Elevated Sit-to-Stand | `VT8zoJ-gXQY` (38 s) | PT Solutions Physical Therapy |
| Step and Stick | `F1K8Q1XmSwQ` (9 s) | Kevin Sheehan's Running Exercises and Drills |
| Lateral Step and Stick | `kzjp2dQLhfk` (24 s) | Keep It Moving Physical Therapy (manual search; the script's query returned hops and step-downs) |

Picks checked by API (exists, embeddable, title) and by sampled frames. No PJF/BWS/TrainHeroic demo exists for any.
