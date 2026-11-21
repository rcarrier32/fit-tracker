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

## Sources to read in a local session (blocked from cloud sessions)

The cloud proxy can't reach these hosts. Open them on the user's computer, pull out anything useful
(dosing, progressions, education), and note it here.

- Locala NHS, *Lateral Hip Pain — Info for Patients* (PDF): https://www.locala.org.uk/fileadmin/Services/MSK/Hip/Lateral_Hip_Pain_-_Info_for_Patients.pdf
  (ChatGPT cited it for supported single-leg balance; likely also has GTPS education: load, positions, sleep.)
- University of Washington, *Lower Body Exercises While Standing* (PDF): https://healthonline.washington.edu/sites/default/files/record_pdfs/Lower-Body-Exercises-While-Standing-RU.pdf
  (cited for sit-to-stand; the "-RU" suffix suggests it may be the Russian-language version, so look for the English one.)
- NHS Northamptonshire MSK physiotherapy page (cited for step-ups; it's a clinic venue page, probably not a demo):
  https://nhft-nhs-web.verseonecloud.com/physiotherapy/venue/msk-physiotherapy-isebrook-hospital-wellingborough-233/
- The Prehab Guys library, *Isometric Bridge Hip Abduction Band* (likely paywalled):
  https://library.theprehabguys.com/vimeo-video/isometric-bridge-hip-abduction-band/

## Video candidates from ChatGPT (UNVERIFIED — do not apply without checking)

ChatGPT often invents YouTube ids. Check each one plays, is a short single-exercise demo, and matches the move.

| Move | ChatGPT's id | Claimed title / channel |
|---|---|---|
| Supine Banded Hip Abduction Isometric | `JkvdQonRI-k` | "Seated/Supine Hip Abduction Isometrics" (a PT) |
| Glute bridge (already has videos) | `CPb8yRUxWBQ` | "Glute Bridge 101", Knob Noster PT |
| Standing hip abduction (not added) | `jA1CCqp5e9g` | Physical Therapy First |
| Standing Wall Hip-Abduction Isometric | `acBVAPPRYIw` | Knob Noster PT |
| Band walks (already has videos) | `ZvXFnpUnX-c` | Knob Noster PT |

## Still without a video (show "🔍 Find" / a YouTube search)

Standing Wall Hip-Abduction Isometric, Supine Banded Hip Abduction Isometric, Split-Stance Weight Shift,
Elevated Sit-to-Stand, Step and Stick, Lateral Step and Stick. The plan builder for the Lift program skips
ladder steps without a video, so Step and Stick / Lateral Step and Stick only show in the Hip tab until they get one.
See docs/TODO.md §9 for the steps.
