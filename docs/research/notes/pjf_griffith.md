# PJF Performance (Paul Fabritz) and Vernon Griffith: Training Methodology for a Plan Generator

> **Method caveat (read first):** In this session every page fetch failed at DNS (outside the allowed network list): pjfperformance.com, online.pjfperformance.net, marketplace.trainheroic.com, performanceexplored.com, 9to5strength.com and basketballstrongpodcast.com. Everything below therefore comes from **search-engine snippets and summaries** of those pages, not full-page reads. Both coaches sell paid programs, and the detailed prescriptions (sets, reps, holds, contacts) sit behind paywalls or inside member areas. Much of what the brief asks for is **not publicly documented**, and the Gaps sections say so plainly. To fill them, a later session needs those hosts allowed, or the user needs to supply program PDFs or screenshots.

## 1. Session structure and order (mobility/prep, core activation, plyos, strength, conditioning, cooldown)

### Takeaway
I found no public source stating PJF's within-session order, including whether core or isometric activation comes first. Reviews of Vert Code Elite describe activation work, and some days dedicated to mobility and core, separate from jumping days. Griffith's sales pages describe full-body sessions, each with one focus of the day (posterior vs anterior, groin, hip mobility, pelvis-spine). Neither page publishes an intra-session order.

### Cited Findings
- **PJF Vert Code Elite** includes "activation exercises to help develop the mind-muscle connection." In the layout one reviewer describes, days 2 and 4 are mobility and core days and day 3 is a technical jumping day, so core and jumping sit on separate days, not in a fixed core-then-plyo order within one session. — [9to5strength review (via search summary)](https://9to5strength.com/vert-code-elite-full-review/)
- A 2023 user review reports that Vert Code Elite moves from 5 to 6 days a week, with the sessions on days 1-3 repeated on days 4-6. — [basketballworkouttips Vert Code Elite review](https://www.basketballworkouttips.com/vert-code-elite-review/); see also [A1Athlete Vert Code Elite review](https://a1athlete.com/vert-code-elite-review/)
- Vert Code Elite is described as having "up to 6 training sessions per week." — [verticaljumpworld review](https://verticaljumpworld.com/vert-code-elite-review-pjf-performance/)
- A newer PJF variant (Vert Code 2.0 / 16-week) is described as having "5-6 days per week of weight room, jump and speed work." — [PJF: Vert Code vs Vert Code Elite](https://www.pjfperformance.com/the-vert-code-vs-the-vert-code-elite/)
- PJF Podcast topics include "Do Athletes Need Direct Core Training" and "Do We Really Need Plyometrics or Just Approach Jumping?" (Episode 061). The content of these episodes was not retrievable. — [PJF Podcast (libsyn)](https://pjfperformance.libsyn.com/); [ListenNotes](https://www.listennotes.com/podcasts/the-pjf-podcast-elite-sports-performance-GA9LlOs-bS8/)
- On Mind Pump episode 900, Fabritz covers "plyometrics being done the RIGHT WAY vs. the wrong way." — [Mind Pump 900](https://mindpumppodcast.com/900-nba-superstar-sports-performance-coach-paul-fabritz/); [Internet Archive copy](https://archive.org/details/fckydxq6eripxfhyodube1dcuzuepq8c9j64rf7u)
- **Griffith, Runners Mobility & Strength:** "full-body" sessions meant to pair with a running schedule. Each day has its own focus (posterior vs anterior, groin, hip mobility, pelvis-spine relationship). — [TrainHeroic: Runners Mobility and Strength](https://marketplace.trainheroic.com/workout-plan/program/griffith-program-1755617891)
- **Griffith, Dynamic Strength:** six weeks, four sessions a week (three power + strength + mobility sessions, plus one mobility/movement session). It "attacks each training session of the week from a full body standpoint, varying loading strategies and movement patterns over six weeks." — [TrainHeroic: Dynamic Strength Program](https://marketplace.trainheroic.com/workout-plan/program/griffith-program-1705431456)

### Inferences
- The common strength-and-conditioning default (prep, then power/plyo, then strength, then accessories/core, then conditioning) is consistent with the PJF review descriptions, but **no source confirms it for PJF or Griffith**. If the generator uses it, label it a general convention, not PJF doctrine.
- PJF appears to split the week by day type (jump/technical day vs mobility/core day vs weight-room day) as well as by intra-session order. A rule like "day_type ∈ {jump_strength, mobility_core}" is better supported than any claim about core placement within a session.
- Griffith's model looks like "one mobility/strength focus per day, delivered full-body", which maps naturally to a day `focus` tag.

### Gaps
- **Core activation before plyos or lifting, and why:** not documented in any retrievable source. The brief's premise ("does PJF put core/isometric activation early?") could be neither confirmed nor refuted. The direct-core-training podcast episode is the likeliest source; its content was not accessible.
- Cooldown content and length for either coach: not found.
- Where conditioning sits for PJF: not found.

## 2. Isometrics (types, durations, progression)

### Takeaway
Both coaches use isometrics: PJF in the early phases of Vert Code bodyweight and in Durability Code's connective-tissue focus, Griffith in Advanced Mobility Explored and the Bodyweight Exploring Program. **No hold durations, yielding/overcoming split or week-by-week progression is publicly documented** for either.

### Cited Findings
- **PJF Vert Code (Bodyweight):** "starts out quite slowly by easing you into things with some fairly easy plyometrics and isometrics." — [A1Athlete Vert Code Bodyweight review](https://a1athlete.com/vert-code-bodyweight-review/)
- **PJF Durability Code Elite:** a 16-week system in two 8-week stages, Restore (foundation) then Prime (advanced). It develops "full-body strength, connective tissue resilience, and plyometric capacity." — [PJF online: The Durability Code Elite](https://online.pjfperformance.net/groups/the-durability-code-elite/)
- **Griffith Advanced Mobility Explored:** the "SECOND installment of Exploring Mobility". It explores "more external loads, isometric exercises and dynamic movements" over six weeks, five days a week. — [TrainHeroic: Advanced Mobility Explored](https://marketplace.trainheroic.com/workout-plan/program/griffith-program-1610928375)
- **Griffith Bodyweight Exploring Program:** the Week 1, Day 2 sample lists an "FFE ISO" (likely a rear-foot/front-foot-elevated split-squat isometric; the abbreviation is not expanded on the page). — [TrainHeroic: Bodyweight Exploring Program](https://marketplace.trainheroic.com/workout-plan/program/griffith-program-1609558009)

### Inferences
- PJF's sequence appears to be isometrics and low-level plyos early, building toward more reactive and elastic work, which fits a "tendon prep first" logic. A generator rule could put isometrics at higher weight in phase 1 and lower weight later. The exact durations would have to come from general evidence, not PJF.
- Griffith's mobility line appears to progress unloaded mobility (Exploring Mobility, then New Mobility Explored), then added external load plus isometrics (Advanced / Loaded Mobility). The isometric is a *progression tool* for mobility, not just a warm-up.

### Gaps
- Yielding vs overcoming usage, long-length holds, hold times (for example 30-45 s) and how holds progress: **not documented for either coach.**
- How "FFE ISO" is prescribed (time, sets): not visible in snippets.

## 3. Plyometric dosing (contacts, extensive vs intensive, progression)

### Takeaway
PJF's public phase names describe an extensive-to-intensive, absorb-to-elastic progression. **No contact counts per session are published.** Griffith's power work (Dynamic Strength, Golf Mobility and Power) is undocumented at the dosing level.

### Cited Findings
- **Vert Code (Bodyweight), 12 weeks** = four phases of 2, 2, 4 and 4 weeks: **Build The Base, then Absorb & Redirect, then Explode, then Spring.** — [A1Athlete Vert Code Bodyweight review](https://a1athlete.com/vert-code-bodyweight-review/); [PJF: The Vert Code](https://www.pjfperformance.com/the-vert-code/); [PJF online group](https://online.pjfperformance.net/groups/the-vert-code-bodyweight/)
- **Vert Code Elite** = 12 phases of 4 weeks each (12 months). Later phases move toward power, then speed-strength, then reactive and elastic qualities. — [A1Athlete Vert Code Elite review](https://a1athlete.com/vert-code-elite-review/); [verticaljumpworld](https://verticaljumpworld.com/vert-code-elite-review-pjf-performance/)
- Outcome caveat: one 2021 review reports a participant who finished 8 Elite phases and gained only about 3 inches. — [verticaljumpworld](https://verticaljumpworld.com/vert-code-elite-review-pjf-performance/)
- Griffith's Dynamic Strength includes "power" in three of its four weekly sessions, with no dosing given. — [TrainHeroic: Dynamic Strength](https://marketplace.trainheroic.com/workout-plan/program/griffith-program-1705431456)

### Inferences
- A machine rule faithful to PJF's *structure*: `phase_1 = base (low-amplitude extensive plyos + isometrics)`, `phase_2 = landing/absorption + redirection`, `phase_3 = concentric explosive/intensive`, `phase_4 = elastic/reactive (short ground contact)`. The phase lengths in the 12-week bodyweight version are 2/2/4/4.
- Contact numbers must come from general literature (other researchers' notes), not PJF.

### Gaps
- Contacts per session or week, intensive vs extensive split, and box/depth heights: **not found for either coach.**

## 4. Warm-up / prep length and rounds

### Takeaway
Not documented publicly for either coach.

### Cited Findings
- The only related statement: Griffith's mobility programs are "daily programmed movements progressed appropriately by a certified coach." — [Performance Explored: Mobility (via search summary)](https://www.performanceexplored.com/mobility)

### Inferences
- None that would be safe to encode as coach-specific.

### Gaps
- Warm-up minutes and rounds for PJF and Griffith: not found.

## 5. Rest periods and density for fat-loss work (PJF "Fat Don't Fly")

### Takeaway
**No public information about a PJF program called "Fat Don't Fly" turned up** in two searches. Its existence, structure, rest periods and density are unverified.

### Cited Findings
- A search for `PJF Performance "Fat Don't Fly"` returned only unrelated results. — (no source; negative search result)
- Griffith offers a "Functional Strength and Conditioning Program" on TrainHeroic; its rest and density details are not in snippets. — [TrainHeroic: Functional Strength and Conditioning](https://marketplace.trainheroic.com/workout-plan/program/griffith-program-1663892754?attrib=536865-lt)

### Inferences
- If the app needs a `fat_loss` goal attributed to PJF, it currently has **no citable source**. Use general density and circuit rules from other research, labeled as non-PJF, or ask the user for the Fat Don't Fly program material.

### Gaps
- Everything about "Fat Don't Fly": name verification, weeks, days, rest intervals, circuits/EMOMs, and how conditioning is progressed.

## 6. Progression over weeks (volume vs exercise change vs levels; deloads)

### Takeaway
PJF progresses by **phases of 2-8 weeks that change the training quality and exercise selection** (base, then absorb, then explode, then spring; Restore, then Prime). Griffith progresses by **six- or eight-week blocks that "vary loading strategies and movement patterns"** and by moving athletes up a product ladder (bodyweight mobility, then loaded/advanced mobility). Neither publicly describes deloads, or a rule like "change exercises every 2 weeks."

### Cited Findings
- PJF phase blocks: 2/2/4/4 weeks (Vert Code bodyweight) — [A1Athlete](https://a1athlete.com/vert-code-bodyweight-review/); 4-week phases x 12 (Elite) — [A1Athlete Elite](https://a1athlete.com/vert-code-elite-review/); 8 + 8 weeks, Restore then Prime (Durability Code Elite) — [PJF online](https://online.pjfperformance.net/groups/the-durability-code-elite/)
- One user report of Elite (2023) says days 1-3 repeat on days 4-6 within the week. — [basketballworkouttips](https://www.basketballworkouttips.com/vert-code-elite-review/)
- Neither the bodyweight Vert Code reviews nor the Elite reviews mention deload weeks. — [A1Athlete](https://a1athlete.com/vert-code-bodyweight-review/) (stated absence in review summary)
- Griffith Dynamic Strength: "varying loading strategies and movement patterns over six weeks." — [TrainHeroic](https://marketplace.trainheroic.com/workout-plan/program/griffith-program-1705431456)
- Griffith's mobility ladder: Exploring Mobility / New Mobility Explored, then Advanced Mobility Explored ("second installment... more external loads, isometric exercises and dynamic movements"), with Loaded Mobility (6 wk x 3 days; hips, spine, shoulders, ankles) alongside. — [Advanced Mobility Explored](https://marketplace.trainheroic.com/workout-plan/program/griffith-program-1610928375); [New Mobility Explored](https://marketplace.trainheroic.com/workout-plan/program/griffith-program-1674618700); [Loaded Mobility](https://marketplace.trainheroic.com/workout-plan/program/griffith-program-1728002150)

### Inferences
- Encodable rule (PJF-consistent): progression = `phase transition` (new exercise set and new quality emphasis) every 2-4 weeks early, 4-8 weeks later. Within a phase, presumably repeat the template; that is unverified.
- Encodable rule (Griffith-consistent): progression = `add external load / isometric / dynamic variant` to the same mobility pattern, rather than adding reps.
- Deloads: **absent from all public descriptions.** Do not attribute deload logic to either coach.

### Gaps
- Within-phase loading (sets, reps, %), any rule for swapping exercises every 2 weeks, deload weeks and their rationale: not found.

## 7. Durability principles (tendon loading, tibialis/calf/hip, single-leg, frontal/transverse, knees-over-toes)

### Takeaway
PJF's public durability content stresses connective-tissue resilience. In one summarized podcast episode, he **downplays tibialis raises relative to soleus and calf work** and endorses full range of motion and tibial rotation for knee health, which is a partial, explicit departure from "knees over toes" emphasis. Griffith's durability programming centers on hip mobility, single-leg hinge/row/bridge work and rotation.

### Cited Findings
- **PJF Podcast 058 "Knee Health Myths, Truth About Tib Raises, Stretching and More":** summary says tib raises are "overrated", that the tibialis handles a small fraction of body weight in jumping compared with the soleus, that claims about knee blood flow and "slowing triple flexion" have been "debunked", and that tib raises are "not the most important exercise". Full range of motion is endorsed as supporting joint health and "promoting tibial rotation, which is crucial for knee health." *(Secondary AI-summary site; not verified against audio.)* — [Recapio summary of PJF Podcast 058](https://recapio.com/digest/058-knee-health-myths-truth-about-tib-raises-stretching-and-more-pjf-podcast-by-pjfperformance)
- Durability Code Elite targets "connective tissue resilience" and "plyometric capacity" across Restore (8 wk) then Prime (8 wk). — [PJF online](https://online.pjfperformance.net/groups/the-durability-code-elite/)
- Fabritz is described as using early assessments to "attack specific deficiencies" rather than a non-individualized plan, and as consulting with NBA clients' skill trainers. — [SLAM](https://www.slamonline.com/?p=481764)
- **Griffith Runners program**, Week 1 sample: single-leg hinge to hip-flexor drive, contralateral single-leg row, single-leg hinge-to-row combo, bench-supported single-leg glute bridge. Goal: "hip mobility and lower body resiliency" for "durability across running mileage." — [TrainHeroic: Runners Mobility and Strength](https://marketplace.trainheroic.com/workout-plan/program/griffith-program-1755617891)
- **Griffith Bulletproof Your Hips**: six weeks, "focusing on the hips", with hip rotation, tension and range of motion. The listing contradicts itself on frequency (3 vs 5 days a week). — [TrainHeroic: Bulletproof your Hips](https://marketplace.trainheroic.com/workout-plan/program/griffith-program-1654618029)
- Griffith Golf Mobility and Power (6 weeks) shows rotational power and mobility work. — [TrainHeroic: Golf Mobility and Power](https://marketplace.trainheroic.com/workout-plan/program/griffith-program-1656270483?attrib=536865-web)

### Inferences
- For a PJF-flavored generator: prioritize soleus/calf loading over tibialis volume (keep tib raises as a minor accessory), use full-ROM knee work, and add a connective-tissue "restore" phase before "prime" plyos.
- For Griffith-flavored durability: a single-leg hinge pattern plus a contralateral row or hip-flexor drive, single-leg bridging, groin/adductor focus days and hip rotation (transverse plane) work.

### Gaps
- PJF's explicit use of frontal/transverse-plane work, specific tendon-loading protocols and any ATG/KOT exercises he endorses: not found.

## 8. Griffith specifics: progression logic, lettered supersets, levels

### Takeaway
Griffith (credentialed CSCS*D, TSAC-F; sometimes listed as "Vernon Griffith II") publishes many TrainHeroic programs. Each is 6 or 8 weeks at 3-5 days a week. His programs progress from bodyweight to loaded mobility and vary loading and patterns. **Lettered superset groups (A1/A2) and per-level regressions are not visible** in any retrievable snippet.

### Cited Findings
- Program catalog (all TrainHeroic): Runners Mobility & Strength (8 wk x 3 d, ~$65); Loaded Mobility (6 wk x 3 d, $50); Advanced Mobility Explored (6 wk x 5 d, $50); Dynamic Strength (6 wk x 4 d, $50); Bulletproof Your Hips (6 wk, 3 or 5 d, $50); Bodyweight Exploring; Exploring Barbell Training; Jacked Athlete; Functional Strength & Conditioning; Golf Mobility & Power; Performance Explored; Exploring Strength and Mobility Team (subscription); GBRS Performance team. — [Runners](https://marketplace.trainheroic.com/workout-plan/program/griffith-program-1755617891); [Loaded Mobility](https://marketplace.trainheroic.com/workout-plan/program/griffith-program-1728002150); [Advanced Mobility](https://marketplace.trainheroic.com/workout-plan/program/griffith-program-1610928375); [Dynamic Strength](https://marketplace.trainheroic.com/workout-plan/program/griffith-program-1705431456); [Bulletproof Hips](https://marketplace.trainheroic.com/workout-plan/program/griffith-program-1654618029); [Bodyweight Exploring](https://marketplace.trainheroic.com/workout-plan/program/griffith-program-1609558009); [Exploring Barbell](https://marketplace.trainheroic.com/workout-plan/program/griffith-program-1596857196?attrib=536865-web); [Jacked Athlete](https://marketplace.trainheroic.com/workout-plan/program/griffith-program-1654647975); [Performance Explored](https://marketplace.trainheroic.com/workout-plan/program/griffith-program-1595718311); [Explorers team](https://marketplace.trainheroic.com/workout-plan/team/explorers); [GBRS team](https://marketplace.trainheroic.com/workout-plan/team/gbrs-performance-team); [GBRS announcement](https://soldiersystems.net/2021/09/12/introducing-gbrs-performance/); [Linktree](https://linktr.ee/vernongriffith)
- Sample-week previews on the Dynamic Strength and Bulletproof Hips pages show Day 1/3/5 entries with welcome or notes text, but no exercises in the snippet. — [Dynamic Strength](https://marketplace.trainheroic.com/workout-plan/program/griffith-program-1705431456); [Bulletproof Hips](https://marketplace.trainheroic.com/workout-plan/program/griffith-program-1654618029)
- Runners program note: suitable "even if not following a running plan." — [Runners](https://marketplace.trainheroic.com/workout-plan/program/griffith-program-1755617891)

### Inferences
- Encodable Griffith rules: block length of 6 weeks (8 for runners); 3 days a week for mobility/strength add-ons to sport training, 4-5 for standalone; one focus per day; progression by adding load, isometrics or dynamic variants to the same pattern.

### Gaps
- Superset lettering, rep/hold schemes, and how single-leg work regresses or progresses by level: **not retrievable** without full TrainHeroic page access (marketplace.trainheroic.com was blocked).
- Whether the "Jacked Athlete" program links to the Jacked Athlete podcast/brand: unverified.

## 9. TrainHeroic platform (how coaches program; auto-progress)

### Takeaway
TrainHeroic supports percentage-of-working-max prescriptions, a **Linear Weight Progression** feature that sets the weight from the athlete's last logged set, linked supersets saved to a library, and mobile editing. A1/A2 lettering was not confirmed.

### Cited Findings
- Coaches can prescribe "Weight %" of an athlete's working max. Percentages refresh to a recommended weight when the athlete updates their max. **Linear Weight Progression** bases the weight on the athlete's last logged set. — [TrainHeroic support: Programming section](https://support.trainheroic.com/hc/en-us/sections/18156499826701-Programming); [TrainHeroic support article](https://support.trainheroic.com/hc/en-us/articles/18156690075917); [TrainHeroic blog: Training with Percentages](https://www.trainheroic.com/blog/training-with-percentages-programming-for-optimal-results/)
- Supersets are made by linking already-programmed blocks; they can carry instructions and be saved to the library. — [TrainHeroic support: Programming](https://support.trainheroic.com/hc/en-us/sections/18156499826701-Programming)
- TrainHeroic offers pre-built marketplace programming and coach tools. — [TrainHeroic Pre-Built Programming](https://support.trainheroic.com/hc/en-us/sections/18156483383309-TrainHeroic-Pre-Built-Programming); [TH Create](https://www.trainheroic.com/create); [Athlete app](https://trainheroic.com/athlete/)

### Inferences
- A generator mirroring TrainHeroic could support `load_mode ∈ {percent_of_working_max, last_logged_set_linear}` and `superset_group` IDs.

### Gaps
- Whether TrainHeroic displays A/B/C letter groupings automatically, and the increment rules for Linear Weight Progression: not confirmed.
