# App-based and "AI" workout plan builders: how they generate and adapt programs

Research date: 2026-11-10. Method note: the session's network blocked direct fetches of fitbod.me, help.rpstrength.com and dr-muscle.com (DNS refused), so these findings come from web-search result summaries of those pages, not from full-page reads. Vendor help centers are treated as "documented behavior"; vendor blogs as "vendor marketing"; review sites, app-store reviews and Reddit relays as "user-reported." No vendor publishes an exact formula. Apps with no usable sources found: Caliber's algorithm specifics, JEFIT internals, Strong internals, and any patents.

## Plan generation: inputs, split selection, exercise selection

### Takeaway
Every app asks roughly the same onboarding inputs: goal, days/frequency, equipment, experience. Fitbod is the only one with a documented per-muscle recovery model (0-100% per muscle group, full recovery assumed at about 6-7 days), and it uses that model to pick each day's exercises on the fly instead of following a fixed split. RP, Juggernaut, Alpha Progression and Hevy Trainer generate a fixed multi-week template and adapt the numbers inside it.

### Cited Findings
- **Hevy Trainer** onboarding asks experience level, current goal, available equipment and workout frequency. It then generates a complete program with workouts, exercises, rep ranges, rest periods, starting-weight recommendations and tips. Documented — [Hevy help center](https://help.hevyapp.com/hc/en-us/articles/38385724273047-Hevy-Trainer-Explained-How-It-Builds-Your-Workout-Program); [Hevy plan generator page](https://www.hevyapp.com/features/workout-plan-generator/)
- Sources conflict on Hevy Trainer's price tier: the help center says Pro-only, the launch post says it is included in the standard subscription — [Hevy help center](https://help.hevyapp.com/hc/en-us/articles/38385724273047-Hevy-Trainer-Explained-How-It-Builds-Your-Workout-Program) vs [Announcing Hevy Trainer](https://www.hevyapp.com/announcing-hevy-trainer/)
- **Fitbod exercise selection** ("Smart Exercise Selection") weighs the user's goals against balanced muscle engagement. It learns preferences from skips, replacements, deletions and manual additions, plus explicit "Recommend More / Recommend Less / Never Again" flags. Documented — [Fitbod help: How Fitbod Creates Your Workout](https://help.fitbod.me/hc/en-us/articles/360004429814-How-Fitbod-Creates-Your-Workout)
- **Fitbod recovery model**: it estimates how much each muscle was worked from the logged sets, reps and load, sums all exercises that hit a muscle group, and assigns that group a 0-100% fatigue/recovery score. Each exercise type has its own recovery profile based on the muscles it uses — [Fitbod help: Muscle Recovery](https://help.fitbod.me/hc/en-us/articles/360006269014-Muscle-Recovery); [Fitbod blog: algorithm](https://fitbod.me/blog/fitbod-algorithm)
- Sources conflict on the Fitbod recovery horizon. The help center says muscles count as fully recovered after 6 days unless other factors apply; one blog post says 100% after 7 days of rest; another says "up to 7 days" depending on recent training — [Fitbod help: Muscle Recovery](https://help.fitbod.me/hc/en-us/articles/360006269014-Muscle-Recovery); [Fitbod blog: muscle recovery](https://fitbod.me/blog/muscle-recovery/)
- A Fitbod blog post says a recovery score below 50% gets labeled "mostly fatigued," and that training within the last 12 days also counts as a sign more recovery is needed. Vendor blog — [Fitbod blog: when to lift heavier / recover](https://fitbod.me/blog/how-fitbods-ai-knows-exactly-when-you-should-lift-heavier-and-when-to-recover/)
- Fitbod scores each candidate exercise by how recovered its required muscles are. Vendor blog — [Fitbod blog: personalization algorithms](https://fitbod.me/blog/how-fitbod-personalizes-your-workout-plan-using-smart-training-algorithms/)
- Fitbod recovery scores can be adjusted by outside activity imported from Apple Health, Health Connect, Fitbit or Strava. Users can also edit the percentages by hand in the Recovery tab — [Fitbod help: Muscle Recovery](https://help.fitbod.me/hc/en-us/articles/360006269014-Muscle-Recovery)
- **RP Hypertrophy** is built on Mike Israetel's volume landmarks (MV/MEV/MAV/MRV) and arranged in mesocycles that ramp up volume and end with a deload week. Third-party summary, consistent with the RP help center — [SensAI comparison 2026](https://www.sensai.fit/blog/juggernaut-ai-vs-rp-hypertrophy-vs-alpha-progression-2026); [RP help: deload placement](https://help.rpstrength.com/hc/en-us/articles/33510413024279-Does-the-app-automatically-place-deloads)
- **Caliber**: the free app includes coach-designed plans; the paid tier adds a human coach who uses workout, nutrition, habit and progress data — [SensAI Future review 2026](https://www.sensai.fit/blog/future-app-review-2026)

### Inferences
- Fitbod's model looks like a per-muscle fatigue accumulator: each logged set adds fatigue to its muscles, weighted by the exercise's muscle profile and the volume/load, and fatigue then decays to zero over about 6-7 days. That design maps well onto a tagged exercise catalog where each exercise carries primary and secondary muscle tags with weights. The decay curve, the weighting of volume against intensity, and the secondary-muscle factors are not public; any implementation has to choose its own.
- The "<50% = mostly fatigued" threshold is a usable starting point for an exercise filter, but it comes from a marketing blog, not the help center.
- Fitbod's preference learning is a simple pattern to copy: per-exercise affinity weights driven by explicit flags (more / less / never) and implicit signals (skip, swap, delete, add).

### Gaps
- No public split-selection logic for any app (for example, how a given number of days maps to upper/lower vs full-body). Fitbod appears to have no fixed split, which is inferred from its recovery-driven daily selection, not stated.
- No source on how Fitbod or Hevy use session time limits in selection. Fitbod is commonly described as having a workout-duration setting, but no source on it was retrieved.
- JEFIT and Caliber exercise-selection logic: no sources found.
- No patents found. None were searched specifically, because of the tool-call budget.

## Load progression from logged sets

### Takeaway
There are three documented families:
1. **e1RM-driven prescription**: Fitbod estimates a "Theoretical 1RM" and varies load and reps around it across heavy and light days.
2. **Double progression with per-set RIR targets**: Alpha Progression and Hevy Trainer. Hevy only raises load once the top of the rep range is hit on all prescribed sets.
3. **RPE-based autoregulation**: JuggernautAI adjusts weight and volume set to set from entered RPE, and adjusts the next week from performance plus a readiness check-in.

Dr. Muscle says it computes the next session's weights from every logged set but publishes no formula.

### Cited Findings
- **Fitbod** calculates an "Estimated Strength" ("Theoretical 1RM") from logged workouts and bases sets, reps and weight on workout history. If an exercise is consistently completed with ease, it gradually raises the weight or reps. Documented — [Fitbod help: How Fitbod Creates Your Workout](https://help.fitbod.me/hc/en-us/articles/360004429814-How-Fitbod-Creates-Your-Workout)
- Fitbod blog example: 220 lb x 8 reps gives an estimated 1RM of about 271 lb. The 1RM is recalculated as you get stronger. A search summary attributes the estimate to a Brzycki-based formula, but this was not independently verified. Vendor blog — [Fitbod blog: progressive overload](https://fitbod.me/blog/what-is-progressive-overload-and-how-fitbod-builds-it-into-every-workout-automatically/)
- Fitbod uses "dynamic adaptation": sets, reps and weights deliberately vary between sessions, with high reps at lower weight for hypertrophy and low reps at heavier weight for strength, cycling heavy and light days. Its blog says "This isn't random, it's responsive." — [Fitbod help article](https://help.fitbod.me/hc/en-us/articles/16254175592215); [Fitbod blog: personalization](https://fitbod.me/blog/how-fitbod-personalizes-your-workout-plan-using-smart-training-algorithms/)
- **Alpha Progression** gives a specific weight, rep count and RIR target for every working set, computed from the user's actual previous performance. Its recommendations follow double progression: once you reach the top of the rep range, the next session moves to the next higher weight. Vendor glossary and blog — [Alpha Progression home](https://alphaprogression.com/en); [AP glossary: double progression](https://alphaprogression.com/en/glossary/double-progression); [AP glossary: progression](https://alphaprogression.com/en/glossary/progression)
- Alpha Progression can change weight and reps together. Its example is a lifter who improved enough to progress but could not hold the same reps after the gym's next available weight jump; the app then raises the load and lowers the rep target. It also sets different targets for early and later sets to account for fatigue within a session — [AP blog: weight progression](https://alphaprogression.com/en/blog/weight-progression-muscle-and-strength-gain); [AP blog: reps in reserve](https://alphaprogression.com/en/blog/reps-in-reserve)
- **MacroFactor's "Smart Progression"** (a comparable app with documented behavior) sometimes suggests a lighter weight with more reps when a full weight jump would push the next set outside the programmed rep range — [MacroFactor help: Smart Progressions](https://help.macrofactorapp.com/en/articles/305-understanding-and-using-smart-progressions)
- **Hevy Trainer** tells you when to increase weight and by how much, based on performance. You must hit the upper end of the rep range at a given weight on all prescribed sets before it raises the load — [Hevy help center](https://help.hevyapp.com/hc/en-us/articles/38385724273047-Hevy-Trainer-Explained-How-It-Builds-Your-Workout-Program); [Hevy plan generator page](https://www.hevyapp.com/features/workout-plan-generator/)
- Plain logging in Hevy and Strong is reported not to raise weights automatically; in Strong the user defines the progression rule. User-reported, undated — [boards.ie thread](https://www.boards.ie/discussion/comment/123546630); [TechBloat comparison](https://www.techbloat.com/10-lifting-apps-compared-for-easier-progressive-overload.html)
- **JEFIT** has a "Load Progression" feature that calculates progression automatically; no mechanism is described. Vendor blog — [JEFIT blog: progressive overload](https://www.jefit.com/blog/progressive-overload-training-simple-guide)
- **JuggernautAI**: on main lifts, entered RPEs change weights and volume from set to set and affect future weeks' targets. Users are told to under-rate effort rather than over-rate it so the program adjusts gradually. RPE plus readiness ratings feed changes to volume, intensity and frequency. Documented — [JuggernautAI help: All about RPE and RIR](https://help.jtsstrength.com/en/articles/2-all-about-rpe-and-rir)
- JuggernautAI adapts at the end of each week, using performance and check-in data to fine-tune the following week — [JuggernautAI help: How it is individualized](https://help.jtsstrength.com/en/articles/3-how-juggernautai-is-individualized-to-you)
- JuggernautAI's readiness rating comes from a proprietary algorithm combining sleep, motivation, soreness and performance, and it adjusts programming at several levels. A third party reports a 0-100 readiness score since app v3.0, not confirmed by Juggernaut — [JuggernautAI help: Readiness rating](https://help.jtsstrength.com/en/articles/15-readines-rating); [SensAI comparison](https://www.sensai.fit/blog/juggernaut-ai-vs-rp-hypertrophy-vs-alpha-progression-2026)
- **Dr. Muscle** tracks every set and calculates the ideal weights for next time. It uses rest-pause sets and Daily Undulating Periodization. After eligible rest-pause sessions on the first exercise, a post-workout "Too easy / Too hard" answer adjusts the next session's set count. Vendor-reported — [Dr. Muscle App Store listing](https://apps.apple.com/us/app/id1073943857); [Dr. Muscle: progressive overload app](https://dr-muscle.com/progressive-overload-app-gain-muscle-strength/)
- Dr. Muscle's claim that it builds muscle "59% faster" has no independent study behind it — [Dr. Muscle App Store listing](https://apps.apple.com/us/app/-/id1073943857)
- **RP Hypertrophy** also decides when to add weight and reps (help article title: "How does the app determine when to add weight, reps and sets"), but it works mainly on volume. Its inputs are feedback ratings, not per-set RPE — [RP help article](https://help.rpstrength.com/hc/en-us/articles/32600173777815-How-does-the-app-determine-when-to-add-weight-reps-and-sets); [SensAI comparison](https://www.sensai.fit/blog/juggernaut-ai-vs-rp-hypertrophy-vs-alpha-progression-2026)

### Inferences
- For an app that already logs weight and reps per set, the cheapest well-proven layer is double progression with a rep range per exercise. The rule: once all sets hit the top of the range, raise the load by the smallest available increment and reset to the bottom of the range. Add Alpha Progression's and MacroFactor's tweak: when the increment is too large relative to the load (dumbbells, cables), adjust load and rep target together, keeping estimated effort constant via an e1RM formula, rather than forcing the full jump.
- An e1RM (Epley/Brzycki) calculated from the best logged set gives a common currency. It lets the app prescribe new rep targets, compare sessions with different rep counts, and seed starting weights for swapped exercises.
- Optional per-set RIR/RPE input enables Juggernaut-style set-to-set adjustment. Juggernaut's advice to under-rate RPE suggests the update should be damped (small steps), not a full correction.

### Gaps
- No vendor publishes increment sizes, rep-range defaults or e1RM formulas. The Brzycki attribution for Fitbod is unverified.
- How JuggernautAI turns AMRAP or rep-out sets into next-week training maxes: no source found in this session. Juggernaut Method's classic AMRAP-based adjustment exists, but no sourced description of the AI app's version was retrieved.
- Dr. Muscle's actual formula: not documented beyond marketing.

## Volume progression (RP-style feedback, MEV to MRV)

### Takeaway
RP Hypertrophy is the reference design. After each session it asks for pump, soreness/recovery and workload ("how beat up") ratings per muscle and uses them to add, hold or remove sets for that muscle the next time. Low pump, low soreness and an easy workload add sets. Great pump, normal healing and a challenging workload hold. Excessive soreness that delays recovery or too much workload removes sets. Exact thresholds are not public. Dr. Muscle uses a simpler "too easy / too hard" answer on some sessions.

### Cited Findings
- RP collects feedback on how pumped, sore and "beat up from volume" you feel after each session, and that feedback shapes every later session's volume — [RP help article](https://help.rpstrength.com/hc/en-us/articles/32600173777815-How-does-the-app-determine-when-to-add-weight-reps-and-sets); [hypertrophy.zendesk.com article](https://hypertrophy.zendesk.com/hc/en-us/articles/14605661323671)
- Strong pumps, normal healing and a workload that feels like it is pushing your limits are unlikely to change volume. Unimpressive pumps, barely any soreness and an "pretty easy" workload usually lead to more sets. A third-party quote gives the reverse case: amazing pumps, so sore you can't heal on time, and too much volume means fewer sets — [RP help article](https://help.rpstrength.com/hc/en-us/articles/32600173777815-How-does-the-app-determine-when-to-add-weight-reps-and-sets); [Alpha Progression blog: best muscle-building apps](https://alphaprogression.com/en/blog/best-muscle-building-apps)
- RP's help center calls the logic "a bit complex" but says it acts in "fairly predictable ways in most cases." Users can add or delete sets by hand if they disagree — [RP help article](https://help.rpstrength.com/hc/en-us/articles/32600173777815-How-does-the-app-determine-when-to-add-weight-reps-and-sets)
- The app is designed to keep ramping up volume within each training cycle, and the last week of each mesocycle is a deload — [RP help: Does the app automatically place deloads](https://help.rpstrength.com/hc/en-us/articles/33510413024279-Does-the-app-automatically-place-deloads)
- RP's volume landmarks: MV (maintenance), MEV (minimum effective), MAV (maximum adaptive), MRV (maximum recoverable). The app autoregulates between them from feedback — [SensAI comparison](https://www.sensai.fit/blog/juggernaut-ai-vs-rp-hypertrophy-vs-alpha-progression-2026); background in [RP podcast Hypertrophy 102](https://rppodcast.libsyn.com/hypertrophy-102-how-to-train-for-most-muscle-growth)
- Dr. Muscle adjusts set count from a post-workout "Too easy / Too hard" answer after eligible rest-pause sessions — [Dr. Muscle App Store listing](https://apps.apple.com/us/app/id1073943857)
- Fitbod tracks volume, intensity and recovery, but no set-adding rule is documented — [Fitbod blog: tracking volume, intensity and recovery](https://fitbod.me/blog/tracking-volume-intensity-and-recovery-with-fitbod/)

### Inferences
- A workable RP-like rule for a personal app is a per-muscle 3-question survey, each answered on a 0-3 scale: pump, soreness at the next session of that muscle, and workload. Combine the answers into a decision of +1 or +2 sets, hold, or -1 set, capped weekly so the muscle starts the mesocycle near MEV and ends near MRV by the final loading week. Note that RP's soreness question is answered when the muscle is next trained ("did you heal in time?"), so the set change applies to the next session of that muscle. This timing is inferred from the "so sore that you can't heal on time" wording.
- Because the decision is per muscle, the catalog's muscle tags drive it. Only exercises tagged with that muscle get the added or removed sets.

### Gaps
- RP's exact scoring scales, rating thresholds and maximum sets added per week are not public.
- The RIR progression across RP's mesocycle (commonly described elsewhere as starting around 3 RIR and moving toward 0-1) was not confirmed from an RP source in this session.

## Deload triggers and contents

### Takeaway
There are two models:
- **Scheduled**: RP always makes the final week of the mesocycle a deload.
- **Performance-triggered**: Dr. Muscle suggests a deload when estimated strength (1RM) drops, cutting sets by about 50%. Users can trigger or cancel it.

Juggernaut's readiness score adjusts week-to-week stress, but no explicit deload trigger was found. Fitbod's recovery model replaces a formal deload by steering exercise selection away from fatigued muscles.

### Cited Findings
- RP: the last week of each mesocycle is a deload. For example, a 6-week block deloads in week 6 — [RP help: deload placement](https://help.rpstrength.com/hc/en-us/articles/33510413024279-Does-the-app-automatically-place-deloads)
- RP has a help article explaining why training suddenly gets much easier in the deload week — [RP help: Why did my training get so much easier](https://help.rpstrength.com/hc/en-us/articles/31639551676439-Why-did-my-training-get-so-much-easier-deload)
- Dr. Muscle: when fatigue builds and the estimated 1RM falls, the app schedules a deload that cuts sets by about 50%. Users can also deload manually or cancel a suggested one. Vendor-reported — [Dr. Muscle: Deload](https://dr-muscle.com/deload/); [Dr. Muscle: Manual deloads](https://dr-muscle.com/manual-deloads/)
- JuggernautAI: readiness (sleep, motivation, soreness, performance) and RPE adjust volume, intensity and frequency — [JuggernautAI help: Readiness rating](https://help.jtsstrength.com/en/articles/15-readines-rating)
- Alpha Progression's algorithm also handles mesocycles and deloads. Details not retrieved — [Alpha Progression home](https://alphaprogression.com/en)

### Inferences
- A hybrid is easy to build from logged data. Schedule a deload every N weeks (end of mesocycle). Also pull it forward when e1RM on key lifts drops across, for example, two consecutive sessions, or when per-muscle feedback hits the "can't recover" level two sessions in a row. A deload of about half the sets at similar or slightly lower load matches Dr. Muscle's description. The two-session drop threshold is a design choice, not sourced.

### Gaps
- What RP's deload does to load and RIR, as opposed to sets: not retrieved.
- The size of the e1RM drop that triggers Dr. Muscle's deload: not documented.
- Whether Fitbod has any explicit deload feature: not found.

## Missed sessions, stalls/plateaus, exercise swaps

### Takeaway
Documented handling is basic. RP lets you either end the missed day or rename it and do it at the next opportunity, so the program shifts rather than skipping. Fitbod handles swaps through its preference learning, with explicit "never again" flags. Plateau handling is mostly implicit: Fitbod varies load and rep schemes, Dr. Muscle triggers deloads on strength drops, and Alpha Progression combines weight and rep changes. Users complain most about recommendations that are wrong after a swap or a manual override.

### Cited Findings
- RP missed sessions: on a rigid schedule, end the workout from the three-dot menu. Otherwise, rename the missed day and complete it at the next available opportunity, then carry on with the program — [RP help: sick or missed a day](https://help.rpstrength.com/hc/en-us/articles/30804240761751-What-should-I-do-if-I-am-sick-or-miss-a-day)
- One unofficial alternatives blog claims RP recommendations "can become nonsensical" after a missed workout. Opinion — [RP alternatives 2026 blog](https://docs-nine-silk.vercel.app/blog/rp-hypertrophy-alternatives-2026)
- Fitbod learns from skips, replacements, deletions and manual additions, and supports "Never Again" flags — [Fitbod help: How Fitbod Creates Your Workout](https://help.fitbod.me/hc/en-us/articles/360004429814-How-Fitbod-Creates-Your-Workout)
- Dr. Muscle frames deloads as the way to break plateaus, triggered by strength dropping — [Dr. Muscle: Deload](https://dr-muscle.com/deload/)

### Inferences
- When a user swaps exercises, seed the new exercise's load from an e1RM ratio between the two exercises (for example, a same-muscle, same-movement-pattern catalog tag with a strength ratio), or start conservatively and progress quickly. Fitbod's main documented complaints are wild first suggestions on unfamiliar exercises.
- For missed sessions, shift the remaining sessions forward (RP's approach) rather than deleting them. If the gap is long (for example, more than 10-14 days), reduce load before resuming. The threshold is a design suggestion, not sourced.
- Stall detection: no e1RM improvement on a lift over about 3 exposures. Response: first micro-adjust reps or load; if it repeats, swap the variation or deload. This is a design suggestion, not sourced.

### Gaps
- No vendor documentation on explicit plateau detection rules was found.
- Whether Juggernaut reshuffles the week after missed sessions: not found.

## What human coaching apps (Future, Caliber) do differently

### Takeaway
Future and Caliber replace the algorithm with a human coach. Future: an intake call, a custom program, weekly revisions based on logged data, messaging, and wearables. Caliber: a free app with coach-designed plans plus paid one-to-one coaching that also uses nutrition and habit data. They mainly add context (injuries, schedule, motivation, life stress), communication and accountability rather than better load math. Both cost far more than algorithmic apps.

### Cited Findings
- Future: a certified coach does an initial call, builds a custom program and adjusts it every week. Price is about $199/month or $149/month prepaid yearly, with a $50 first month (pricing as of about September 2026) — [SensAI Future review 2026](https://www.sensai.fit/blog/future-app-review-2026)
- Caliber: a free training app with coach-designed plans. The paid coach uses workout, nutrition, habit and progress data, with human video and text coaching — [SensAI Future review 2026](https://www.sensai.fit/blog/future-app-review-2026)
- One reviewer sees Future as more of a generic fitness coaching app and Caliber as more strength-focused. The same reviewer says Future has more coaches and more specialty diversity. Another describes Future's frequent one-to-one communication as similar to Caliber's premium tier — [Garage Gym Reviews](https://www.garagegymreviews.com/?p=141316); [Fitnessdrum Caliber review](https://fitnessdrum.com/caliber-app-review/)
- Industry commentary frames human coaching as possibly becoming a luxury product as AI improves — [Athletech News](https://athletechnews.com/age-of-ai-human-personal-trainers-might-become-a-luxury-future-caliber/)
- Caveat: SensAI sells a competing product, so its review is vendor-adjacent — [SensAI](https://www.sensai.fit/blog/future-app-review-2026)

### Inferences
- What a personal app can borrow: a weekly review step that summarizes the week (adherence, e1RM trends, feedback flags) and proposes changes for the user to accept. This copies the coach's weekly check-in without needing a coach.

### Gaps
- No documented details of how Future or Caliber coaches structure progression. It is presumably coach-specific.
- Caliber's "Strength Score" or its other in-app metrics: not retrieved.

## Published details, weaknesses and user complaints

### Takeaway
No app publishes formulas or patents (none found). The documented behavior sits in help centers: Fitbod, RP, JuggernautAI and Hevy. The most common complaint about Fitbod is erratic weight recommendations, both too heavy and too light, that don't learn from manual overrides, plus workouts that feel "random." For RP, the complaints are opacity and odd behavior after missed sessions. Dr. Muscle's main criticism is UI quality and unverified marketing claims.

### Cited Findings
- Fitbod, "random" workouts: one App Store reviewer said generating them is like throwing darts at a chart of exercises. A two-year user, relayed by a competitor, concluded "the algorithm is broken." The relay is competitor-sourced and biased — [Appshunter Fitbod reviews](https://appshunter.io/ios/app/1041517543/reviews/9); [Dr. Muscle Fitbod review](https://dr-muscle.com/fitbod-app-review-alternative/)
- Fitbod loads too heavy: 50 kg suggested for rows normally done at 20 kg x 8; 35 lb lateral raises suggested when 15 lb was the reviewer's max — [Appshunter Fitbod reviews](https://appshunter.io/ios/app/1041517543/reviews/2); [Garage Gym Reviews Fitbod review](https://www.garagegymreviews.com/fitbod-review)
- Fitbod loads too low and not adapting: one user was constantly raising weights the app kept recommending too low. Another said new-exercise suggestions start too low and "stay with its own original recommendations" after overrides — [Appshunter Fitbod reviews](https://appshunter.io/ios/app/1041517543/reviews/4); [Justuseapp Fitbod reviews](https://justuseapp.com/en/app/1041517543/fitbod-gym-fitness-planner/reviews)
- Fitbod review sentiment is about 66% positive and 34% negative on Justuseapp. Trustpilot complaints center on billing and support. Several reviewers say recommendations improve after enough logging and corrections — [Justuseapp](https://justuseapp.com/en/app/1041517543/fitbod-gym-fitness-planner/reviews); [Trustpilot](https://www.trustpilot.com/review/fitbod.me)
- RP: the logic is "a bit complex," and recommendations can reportedly go odd after missed sessions. The latter is unofficial — [RP help article](https://help.rpstrength.com/hc/en-us/articles/32600173777815-How-does-the-app-determine-when-to-add-weight-reps-and-sets); [RP alternatives blog](https://docs-nine-silk.vercel.app/blog/rp-hypertrophy-alternatives-2026)
- RP Hypertrophy costs about $299.99/year per a 2026 comparison — [SensAI comparison](https://www.sensai.fit/blog/juggernaut-ai-vs-rp-hypertrophy-vs-alpha-progression-2026)
- Dr. Muscle: one App Store reviewer called the algorithm effective but the app poorly designed (single anecdote) — [Dr. Muscle App Store](https://apps.apple.com/us/app/-/id1073943857)

### Inferences
- The Fitbod complaints point to two design rules. (1) A manual override of the suggested load should immediately become the new baseline, because the last logged performance should dominate. (2) Never suggest a load for an unfamiliar exercise far above anything logged for a related exercise; cap the first suggestion, for example, at an estimated RIR of 3 or more.
- Transparency is a recurring gap. Showing *why* a recommendation was made (for example, "hit 12/12/12 last time → +2.5 kg") answers the "random" complaint.

### Gaps
- Stronger by Science app reviews: none surfaced in search.
- Reddit threads describing behavior: none retrieved directly. One app-review relay only.
- Founder interviews and podcasts on algorithm internals (Fitbod, Juggernaut / Chad Wesley Smith, RP / Mike Israetel): not retrieved, because of the tool-call budget.
- Patents: none found or searched specifically.
