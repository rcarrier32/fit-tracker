"""Builds "Daily Mobility" into data/library.json (programs.daily_mobility).

A ~12-15 minute daily routine for an almost-40 coach who sits at a computer: hips and whole body.
Plays like any other workout (sets, reps, timers, Next →). Rotation A → B → C, one a day.

Sources (docs/research/Daily hip and body health at 40.md and its notes):
- Every day opens with the user's own "Low Back Body" routine: Cat Camel 7x, lunge with overhead
  reach 6x, hip airplanes 3x3, standing stretch with breath.
- A and B: the report's A/B routine, shaped like DJ Sackmann's HoopStudy "Ten Minute Routine"
  (standing → floor → lunge & squat → finish), with Adam Menner's HoopStudy recovery work on B,
  and all five moves of the app's old daily card (Cat Cow as PJF's Cat Camel, World's Greatest
  Stretch, Half Kneeling Thoracic Rotations, Asian Squat, Wall Slides).
- C: hips, from the user's "Hip Mobility" list, PJF's pigeon / hip-flexor length-under-load
  progressions and plate step-downs, and the Proformance "4 moves for tight hips" reel, using the
  app's exercises that already have demos.
No Copenhagen or Nordics here: the training program covers those.
"""
from program_builder import Library, ex

lib = Library()
GROUP = 'Daily'

# Moves from the user's Hip Mobility list, read off the user's saved reels (screen recordings, 2026-11-11).
# Their reels can't be opened from the cloud, so each borrows the closest demo the app already has
# (video_from) until a logged-in session links the reel itself: see
# docs/research/notes-daily-mobility/facebook_reels.md ("Stand-ins").
STANDIN = 'Demo is a stand-in until your saved reel is linked.'
NEW = {
    'Knee Circles': (None, dict(primary_muscle='glutes', muscles=['glutes', 'abductors', 'hip_flexors'], pattern='mobility', role='warmup',
                     equipment=['bodyweight'], level=1, unilateral=True, plane='transverse', hip_focus=True)),
    'Standing Hip Internal/External Lifts': (None, dict(primary_muscle='glutes', muscles=['glutes', 'hip_flexors', 'adductors'],
                     pattern='mobility', role='warmup', equipment=['bodyweight'], level=1, unilateral=True, plane='transverse', hip_focus=True)),
    'Knee Pull Heel Bridge': (None, dict(primary_muscle='glutes', muscles=['glutes', 'hip_flexors', 'abs'], pattern='isometric',
                     role='cooldown', equipment=['bodyweight'], level=1, unilateral=True, plane='sagittal', hip_focus=True)),
    'Squat to Hamstring Stretch': (None, dict(primary_muscle='hamstrings', muscles=['hamstrings', 'adductors', 'glutes'], pattern='mobility',
                     role='warmup', equipment=['bodyweight'], level=1, unilateral=False, plane='sagittal', hip_focus=False)),
    'Quadruped Swing Throughs': (None, dict(primary_muscle='glutes', muscles=['glutes', 'hip_flexors', 'hamstrings'], pattern='mobility',
                     role='warmup', equipment=['bodyweight'], level=1, unilateral=True, plane='sagittal', hip_focus=True)),
}
# These are options, not a checklist: Daily C uses some, the rest sit in its Swap lists, and all of
# them are ordinary warm-up options the plan generator can pick for training-day warm-ups (no preference).
for name, (borrow, tags) in NEW.items():
    lib.ensure_exercise(name, 'daily', tags=tags, video_from=borrow)

# The user's saved Facebook reels, read in a logged-in local session on 2026-11-11 (all 29 are listed in
# docs/research/notes-daily-mobility/facebook_reels.md). A reel link opens in the browser (no embed).
REEL = {
    'igor_hips': 'https://www.facebook.com/reel/1838906024154994',        # Igor system: pigeon rotation, 90/90 swing-through, quadruped swing-through
    'griffith_lotion': 'https://www.facebook.com/share/v/1FLcHuHnk8/',     # Vernon Griffith, "Motion is lotion" hip routine
    'jtm_ladder': 'https://www.facebook.com/reel/776388821846395',         # Jtm_fit, 5 ladder drills
}
# Moves from the reels the app had no exercise for: options (warm-ups the plan builder can pick), not a checklist.
REEL_NEW = {
    # Griffith's routine: "1-2 sets ... to work on your hip mobility, restore range of motion, explore tension and tightness".
    # Dynamic Groin Drift and Figure 4 Flow from the same routine already play his TrainHeroic demos.
    'Hip Pry to Lateral Stretch': ('griffith_lotion', dict(primary_muscle='adductors', muscles=['adductors', 'glutes', 'hip_flexors'],
                                   pattern='mobility', role='warmup', equipment=['bodyweight'], level=1, unilateral=True, plane='frontal', hip_focus=True)),
    'Side Lying Hip Opener': ('griffith_lotion', dict(primary_muscle='glutes', muscles=['glutes', 'abductors', 'hip_flexors'],
                              pattern='mobility', role='warmup', equipment=['bodyweight'], level=1, unilateral=True, plane='transverse', hip_focus=True)),
    'Adductor Rock Back': ('griffith_lotion', dict(primary_muscle='adductors', muscles=['adductors', 'hamstrings', 'glutes'],
                           pattern='mobility', role='warmup', equipment=['bodyweight'], level=1, unilateral=True, plane='frontal', hip_focus=True)),
    # Jtm_fit's ladder drills (all five in one reel), for the agility ladder in Plans → Generate a plan.
    'Ladder Twist Hops': ('jtm_ladder', dict(primary_muscle='calves', muscles=['calves', 'obliques', 'hip_flexors'], pattern='agility_cod',
                          role='warmup', equipment=['agility_ladder'], level=1, unilateral=False, plane='transverse', hip_focus=False)),
    'Ladder In & Out Hops': ('jtm_ladder', dict(primary_muscle='calves', muscles=['calves', 'quads', 'abductors'], pattern='agility_cod',
                             role='warmup', equipment=['agility_ladder'], level=1, unilateral=False, plane='frontal', hip_focus=False)),
    'Ladder Lateral In & Outs': ('jtm_ladder', dict(primary_muscle='calves', muscles=['calves', 'quads', 'abductors'], pattern='agility_cod',
                                 role='warmup', equipment=['agility_ladder'], level=1, unilateral=False, plane='frontal', hip_focus=False)),
    'Ickey Shuffle': ('jtm_ladder', dict(primary_muscle='calves', muscles=['calves', 'quads', 'abductors'], pattern='agility_cod',
                      role='power', equipment=['agility_ladder'], level=2, unilateral=False, plane='frontal', hip_focus=False)),
    'Ali Shuffle': ('jtm_ladder', dict(primary_muscle='calves', muscles=['calves', 'quads', 'hip_flexors'], pattern='agility_cod',
                    role='power', equipment=['agility_ladder'], level=2, unilateral=False, plane='sagittal', hip_focus=False)),
}
for name, (reel, tags) in REEL_NEW.items():
    lib.ensure_exercise(name, 'daily', tags=tags)
# Give a move its reel as its own video (replaces a borrowed stand-in).
for name, reel in {**{n: r for n, (r, _) in REEL_NEW.items()}, 'Quadruped Swing Throughs': 'igor_hips'}.items():
    e = lib.by_name[name.lower()]
    e['video_url'] = REEL[reel]
    e['video_own'] = True
    e.pop('video_standin', None)
# YouTube demos until the user's reels are linked (strict title-match search, approved 2026-11-12).
for name, url in {
    'Knee Circles': 'https://youtu.be/E3GeFyXlOwI',                          # MDSportsInjury
    'Standing Hip Internal/External Lifts': 'https://youtu.be/AnkBK38UNhA',  # Strive2Move
    'Squat to Hamstring Stretch': 'https://youtu.be/1oQSsXhbhjk',            # Champion Physical Therapy
    'Knee Pull Heel Bridge': 'https://youtu.be/Z6sv_sfNI5U',                 # Muscle & Strength (user's pick)
    # One demo per ladder drill (Jtm_fit's reel shows all five at once; approved 2026-11-12).
    'Ladder Twist Hops': 'https://youtu.be/6mvsei1Ict4',                     # Spartan Sports Medicine
    'Ladder In & Out Hops': 'https://youtu.be/PAqQQj3LE_g',                  # Gold's Gym India
    'Ladder Lateral In & Outs': 'https://youtu.be/Ng5sOmAfeR0',              # Live Lean TV
    'Ickey Shuffle': 'https://youtu.be/9PDkdZD2eWA',                         # Live Lean TV
    'Ali Shuffle': 'https://youtu.be/_Tc751vW_lM',                           # NASM
}.items():
    e = lib.by_name[name.lower()]
    e['video_url'] = url
    e['video_own'] = True
    e.pop('video_standin', None)


def r(name, reps=None, time=None, sets=1, notes=None, group=None, alts=None, rest=None):
    row = ex(name, reps=reps, time=time, sets=sets, rest=rest, notes=notes, group=group)
    if alts:
        row['alternates'] = alts
    return row


# The user's own low-back routine opens every day.
LOW_BACK = [
    r('Cat Camel', '7', group='Low back reset', notes='Slow, segment by segment. (Cat Cow works too: it\'s in the swaps.)', alts=['Cat Cow']),
    r('Split Stance Lunge Overhead Reach with Rotation', '6 each side', group='Low back reset',
      notes='Your "lunge with overhead reach": tuck the back-leg glute, reach long.', alts=['Half Kneeling Hip Flexor Stretch']),
    r('Hip Airplane (No Support)', '3 each side', sets=3, group='Low back reset', rest='15s',
      notes='Your hip airplanes (split-lunge rotation): slow open and close.', alts=['Facing Wall Hip Airplane']),
    r('7/11 Breathing', time='1:00', group='Low back reset',
      notes='Your standing stretch with breath: stand tall, reach overhead, in for 7, out for 11.'),
]


def day(title, notes, rows):
    return {'day_name': title, 'notes': notes, 'exercises': LOW_BACK + rows}


days = [
    day('Daily A · Ankles, hips, T-spine', [
        'About 13 minutes. Your low-back reset, then stand → floor → lunge & squat → finish, like HoopStudy\'s Ten Minute Routine.',
        'Smooth and steady, not a workout. Stop any move that hurts sharply.'], [
        r('Pogos', '25', group='Standing', alts=['Single Leg Stance']),
        r('Arm Circles', '10 each way', group='Standing'),
        r('Double Leg Functional Calf Raise (Optional)', '15', group='Standing', alts=['Bent Knee Calf Raise (Optional)']),
        r('Resisted Ankle Circles', '10 each way', group='Standing', notes='Each foot. No band needed.'),
        r('Dead Bug', '10', group='Floor', notes='5 slow breaths first, then 10 alternating.'),
        r('90/90 Hip Opener', time='1:00', group='Floor', notes='5 s hold each way, then 5 slow transitions.', alts=['90/90 Knee Roll']),
        r('Glute Bridge', '10', sets=2, group='Floor', rest='15s', notes='3 s squeeze at the top.', alts=['Glute Bridge Hold']),
        r("World's Greatest Stretch", '5 each side', group='Lunge & squat', alts=['Half Kneeling Thoracic Rotations']),
        r('Hip Flexor/Quad Bridge', time='45s', sets=2, group='Lunge & squat', notes='Each side. PJF\'s couch stretch.', alts=['Half Kneeling Hip Flexor Stretch']),
        r('Asian Squat', time='45s', group='Lunge & squat', notes='Hold, then rock side to side.'),
        r('Wall Slides', '8', group='Lunge & squat'),
        r('Band Pull-Aparts', '15', group='Finish', alts=['Band External Rotations']),
        r('Single Leg Stance', time='30s', sets=2, group='Finish', notes='Each side.', alts=['Single-Leg Balance']),
    ]),
    day('Daily B · Breathing, glutes, shoulders', [
        'About 13 minutes. Your low-back reset, then the B versions: Menner\'s lying-down breathing and bridge hold, thoracic rotations, band rotations.',
        'Smooth and steady, not a workout. Stop any move that hurts sharply.'], [
        r('Pogos', '25', group='Standing', alts=['Single Leg Stance']),
        r('Arm Circles', '10 each way', group='Standing'),
        r('Bent Knee Calf Raise (Optional)', '15', group='Standing', notes='Bent knee works the soleus.', alts=['Double Leg Functional Calf Raise (Optional)']),
        r('Resisted Ankle Circles', '10 each way', group='Standing', notes='Each foot.'),
        r('Posterior Pelvic Tilt Breathing', '10 breaths', sets=2, group='Floor', rest='15s',
          notes='HoopStudy recovery\'s "90/90 lift": lying down, feet on a wall with hips and knees at 90°, slight tuck, slow breaths.',
          alts=['Rock Back Breathing']),
        r('90/90 Hip Opener', time='1:00', group='Floor', notes='5 s hold each way, then 5 slow transitions.', alts=['90/90 Knee Roll']),
        r('Glute Bridge Hold', time='25s', sets=2, group='Floor', rest='15s', notes='One leg if you can (Menner\'s single-leg heel bridge hold): each side.', alts=['Glute Bridge']),
        r('Half Kneeling Thoracic Rotations', '5 each side', group='Lunge & squat', alts=["World's Greatest Stretch"]),
        r('Half Kneeling Hip Flexor Stretch', time='45s', sets=2, group='Lunge & squat', notes='Each side, reach the same-side arm overhead.', alts=['Hip Flexor/Quad Bridge']),
        r('Asian Squat', time='45s', group='Lunge & squat', notes='Hold, then rock side to side.'),
        r('Wall Slides', '8', group='Lunge & squat'),
        r('Band External Rotations', '10 each side', group='Finish', alts=['Band Pull-Aparts']),
        r('Single-Leg Balance', time='30s', sets=2, group='Finish', notes='Each side. Eyes closed once 30 s is easy.', alts=['Single Leg Stance']),
    ]),
    day('Daily C · Hips', [
        'About 13 minutes. Your low-back reset, then the hip moves that earn a daily slot (docs/research/notes-daily-mobility/move_review.md): rotation, extension for all the sitting, adductors, hamstrings, balance.',
        'Holds here are for daily range, not before lifting: long holds (60 s+) right before training cost a little power.'], [
        r('90/90 Hip Opener', time='1:30', group='Rotation', notes='Your 90/90 series: holds, 30% rotations, swing-throughs, lean back, backside opener. Hip rotation is the range most tied to hip and groin trouble.',
          alts=['90/90 Knee Roll', 'Knee Circles', 'Standing Hip Internal/External Lifts', 'Quadruped Swing Throughs', 'Side Lying Hip Opener']),
        r('Optional Pigeon Length Under Load', '5 each side', group='Rotation', notes='Your #1 "rotating pigeon". PJF\'s levels, slowly.',
          alts=['Banded Incline Pigeon Rotation']),
        r('Knee Pull Heel Bridge', '5 breaths', sets=2, group='Extension', rest='10s', alts=['Posterior Pelvic Tilt Breathing', 'Banded Hip Distraction Pulling Into Hip Flexion'],
          notes='Your #9. On your back, hug one knee to the chest, lift the other foot\'s toes, drive that heel and lift the hip, low back pressed down. Hold 5 breaths (exhale back down, inhale hip up); each side (Dr. Devon Hoffman). Hip extension for the hours of sitting.'),
        r('Hip Flexor Length Under Load', time='45s', sets=2, group='Extension', notes='Each side (PJF). 45 s a side most days reaches the weekly stretch dose for range.',
          alts=['Hip Flexor/Quad Bridge', 'Half Kneeling Hip Flexor Stretch']),
        r('Lateral Lunge Length Under Load', time='45s', sets=2, group='Adductors', notes='Each side (PJF). The reel\'s bench lateral lunge works too.',
          alts=['Optional Downward Frog', 'Adductor Rock Back', 'Hip Pry to Lateral Stretch']),
        r('Hamstring Floss', '8 each side', group='Hamstrings', notes='Your #18 "lunge to hamstring": tuck, then push the glute back.',
          alts=['Squat to Hamstring Stretch']),
        r('Single-Leg Balance', time='30s', sets=2, group='Finish', notes='Each side. Balance work has the strongest injury-prevention evidence of anything here.',
          alts=['Single Leg Stance']),
    ]),
]

program = {
    'id': 'daily_mobility',
    'name': 'Daily Mobility',
    'program_name': 'Daily Mobility',
    'group': GROUP,
    'source': 'Daily',
    'description': 'Hips and whole body, 12-15 minutes a day, rotating A → B → C. Opens with your low-back reset, then '
                   'ankles, hips, T-spine, shoulders and balance, shaped like HoopStudy\'s Ten Minute Routine. Runs '
                   'next to your training plan (Copenhagen and Nordics stay in the training).',
    'sessions_per_week': 7, 'session_length_min': 14, 'level': 'All levels',
    'recommended_weeks': 12,
    'rotation_note': 'every day, A → B → C',
    'equipment': ['Light band', 'Bench or step', 'Weight plate or step'],
    'goal': 'Keep the hips and whole body feeling good when you coach a lot and sit at a computer.',
    'days': days,
}
lib.set_programs('daily_mobility', [program])
lib.save()
print('wrote', program['id'], '·', ', '.join(f"{d['day_name']} ({len(d['exercises'])})" for d in days))
