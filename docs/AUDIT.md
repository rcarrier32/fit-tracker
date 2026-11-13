# App audit, 2026-11-13 (v156)

How the app handles the situations that most often cause bad reviews of workout apps (Strong, Hevy, Fitbod,
JEFIT, Nike Training Club, Boostcamp, Trainerize and similar). The complaints come from app store reviews,
review roundups and help-center threads, ranked by how often each one came up across those sources. The
statuses come from reading the code; key claims were re-checked by hand. `wk` = `src/views/workout.js`.

Legend: ✅ handled · 🟡 partial · ❌ missing

## 1. Review pain points → this app

| # | What users complain about (most common first) | Here | Notes |
|---|---|---|---|
| 1 | Features locked behind a paywall | ✅ | Personal app, no paywall |
| 2 | **Lost workout data** (update wipes, crash, no backup) | 🟡 | Sets save on every tap; a backup copy is kept on the phone (`backup.js`), but it's wiped along with the app's data if iPhone clears it; the backup file is manual, with no reminder and no "last backed up" date; restore isn't atomic; progress photos are never backed up |
| 3 | Wrong weight suggestions | 🟡 | Double progression, a drop after 2 misses, ~90% after 14+ days off (`adapt.js:52-99`). **No suggestion the first time you do a move, none after a swap (history is by exact name), RPE is logged but ignored** |
| 4 | **Schedule breaks after a missed day** | ✅ | Follow mode waits for you; the training/recovery week follows what you did (`week_flow.js`); catch-up on Basketball/rest days (v155-156) |
| 5 | Watch / Health sync | ❌ | Not built (no Apple Health, by design so far) |
| 6 | Crash mid-workout loses the session | 🟡 | Sets survive; **the rest timer and hold timer don't**; a workout that runs past midnight starts a new empty session (`wk:249`) |
| 7 | **Rest timer fails when the phone locks** | 🟡 | Time stays correct, but **the end-of-rest alert is likely silent on iPhone** (a new AudioContext each time, outside a tap: `wk:150`, `exercise_session.js:56`; vibrate does nothing on iPhone; no notification) |
| 8 | No swap when equipment is busy or missing | ✅ | ⋯ → Swap: plan alternates, easier/harder, similar movement, search; "Just today" or "Save for this day"; gym toggle. The similar list doesn't filter by your equipment |
| 9 | Cluttered UI | 🟡 | Clean, but tap targets are under 44 pt (✓ ~36, +5 28 px, rest controls ~20 px); lots of 11-12 px text |
| 10 | Programs or content removed | ✅ | Programs and provider videos ship in the repo |
| 11 | Repetitive / no variety | ✅ | Many programs, plan builder, swaps |
| 12 | No long-term structure, stalls | 🟡 | Deload is advice text only (3+ lifts going down) |
| 13 | **Coming back after a break** | 🟡 | Weights restart at ~90% after 14+ days; nothing on Home says "welcome back, ease in" |
| 14 | Streak guilt | ✅ | Skip keeps the day; no punishing streak UI found |
| 16 | Pain mid-session | 🟡 | "🤕 This hurts" flag; 2 flags drop the move from *new* plans only; it doesn't offer a swap on the spot |
| 19 | Couples / family | ✅ | Sadie runs her own copy on her phone |
| — | **Editing a finished workout** | ❌ | The Done screen has no Edit; there's no session history list and no delete. A typo (185 for 135) stays in PRs, charts and suggestions |
| — | **Short on time** | ❌ | No "short version"; only removing moves one by one, or Finish early with no warning |
| — | Units | 🟡 | lb only, no kg setting |
| — | **Updates reaching the phone** | 🟡 | "Update now" banner exists, but can miss a release (see §2) |
| — | **Offline at the gym** | 🟡 | Catalog and app work, but see the update/offline risk in §2; videos need signal and show a black box if they fail |

## 2. Bugs found (confirmed in code)

1. **Update banner can miss a release.** `updates.js:56` takes the first version.json read after boot as
   "the version I'm running". GitHub Pages caches index.html for ~10 min, so a stale page can boot while
   version.json already has the new number, and then no banner shows. Checks are also throttled to 5 min.
   Fix: compare against `window.__FIT_V` (what actually booted); check on every return to the app.
2. **Blank app offline right after an update.** `sw.js` activates the new worker and deletes the old cache
   at once, but modules are cached only at runtime, so the first offline launch after an update can have no
   app code. Fix: keep the old cache until the new one holds the module set, or precache the module list.
3. **Mixed versions for ~10 min after a deploy.** Only app.js and styles.css carry `?v=`; views and lib
   modules load from plain URLs, so a new app.js can run with old views.
4. **Superset rest timer** starts after A1 (`wk:629`), so you hear "Rest" when you should go to A2.
5. **Progression chart counts unticked sets** (`wk:1421` doesn't check `set.done`).
6. **The Dashboard (top e1RMs, exercise history, volume) can't be reached:** the route exists (`app.js:24`),
   but nothing links to it, and the installed app has no address bar.
7. **Silent save failures:** no `unhandledrejection` / `error` handler; a failed save in a tap handler shows
   ✓ with nothing stored. Crash card shows a raw stack trace with no Reload.

8. **Skip leaves Today stuck on "✓ Done".** `followPosition` (`schedule.js:573`) counts a skipped session
   as done today, and the Done screen hides "Do the next workout" for skipped sessions (`wk:2123`). Skip
   says "moves to the next day", but there's no way to do it today.
9. **Programs tab "Start plan" wipes your place** in that program with no warning
   (`programs.js:298, 416` pass `restart: true`); no "Resume at Week X Day Y".
10. **Plan badge counts calendar weeks, not workouts** (`plans.js:39-53`): after missed days it says
    "Week 3 of 8" while you're on Week 2, and can offer "Close plan" mid-program.

## Schedule situations (follow-up check)

| Situation | Here | Notes |
|---|---|---|
| Missed day | ✅ | Program waits; catch-up on labelled days this week. A day with no slot set ("No workout assigned") offers none |
| Whole week off | 🟡 | Picks up where you left off; 90% restart only at 14+ days and only for weighted lifts; no welcome-back |
| Train on a different day / work ahead on a rest day | 🟡 | Single-program: any day. Mixed Week: rest day only offers "Just log something" unless you're behind |
| Two workouts in a day | ✅ | "Do the next workout today →" |
| Wrong Skip / Finish, undo | ❌ | No undo, no delete (see bug 8) |
| Log a workout late (did it yesterday) | ❌ | Session date is always today |
| Change the week mid-week | 🟡 | New slots apply back to Monday, so catch-up may count workouts you were never scheduled for |
| Basketball | 🟡 | A game on a non-Basketball day can't be logged; Day 3 + Day 4 merge happens even if you didn't play either game |
| Streak | 🟡 | 🔥 breaks on a scheduled rest day if nothing (not even Daily Mobility) is done |
| Sadie's phone | 🟡 | With no Basketball week, Daily Mobility still shows a "Basketball warm-up" row Mon/Wed/Fri for everyone |

## Fixed in v157 (2026-11-13)

Bugs 1-6, 8-10: update banner compares against the version that booted and checks every 30 s on return;
the service worker carries the old cache over and falls back across `?v=` offline; Skip moves Today to the
next workout; Start plan offers Resume at Week X Day Y; the plan week and % follow workouts done; superset
and circuit rest comes after the round's last move; the chart counts ticked sets only; Body links to Lifting
stats (the Dashboard). Still open: bug 3 (module `?v=`), bug 7 and the rest of the list below.

## Fixed in v159-171 (2026-11-13)

Warm-up swaps; supersets on one screen with 🔄 ♡ ⋯ per move; ← Back; superset rest; edit/undo a finished
or skipped workout and a Past workouts list (fix sets, change date, delete); duplicate-session save race;
end-of-rest alert (one AudioContext, notification when backgrounded, survives reload); weekly backup
nudge + share-sheet export; Short on time; first-time / after-swap starting weight and RPE 9.5+ hold;
44 px set-row targets and a +2.5 step for light dumbbells; welcome-back note after 7+ days; a workout
past midnight stays one session; video fallback link. Still open: module `?v=` mixing (bug 3), global
error handler (bug 7), kg setting, pain flag offering a swap, Apple Health / Google Fit export.

## 3. Suggested fixes, by impact

| Priority | Fix | Size |
|---|---|---|
| 1 | Update banner + offline-after-update fixes (bugs 1-3) | S-M |
| 1 | **Skip → next workout today** (bug 8: one-line fix) and **Resume vs Start over** in Programs (bug 9) | S |
| 2 | **Edit / undo a finished or skipped workout** (Done screen → Edit; Undo moves the program back a day) + a past-workouts list with edit, delete and change date (covers late logging) | M |
| 3 | **Reliable rest alert on iPhone:** one AudioContext unlocked on first tap, speech "Go", a full-screen flash when you come back; save the rest timer so it survives a reload | S-M |
| 4 | **Backup habit:** "Last backed up N days ago" + weekly nudge; Share sheet export (straight to iCloud Drive); atomic, version-checked restore | M |
| 5 | **Short on time** button: drops accessory and finisher rows by catalog role, or 2 sets each | S |
| 6 | Weight suggestions: a starting weight for first-time moves, history carried across swaps, hold weight when RPE ≥ 9.5 | M |
| 7 | Superset rest fix, chart `set.done`, link the Dashboard from Progress | S |
| 8 | Bigger tap targets (44 pt), −5 and 2.5 steps | S |
| 9 | "Welcome back" on Home after 7+ days off (first week at ~90%, fewer sets) | S |
| 10 | Workout past midnight stays one session; video "Open on YouTube" fallback when a stream fails | S |
| later | kg setting · pain flag offers a swap on the spot · Apple Health export | — |
