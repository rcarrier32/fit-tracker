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

# Moves from the user's Hip Mobility list, read off his saved reels (screen recordings, 2026-11-11).
# Their reels can't be opened from the cloud, so each borrows the closest demo the app already has
# (video_from) until a logged-in session links the reel itself: see
# docs/research/notes-daily-mobility/facebook_reels.md ("Stand-ins").
STANDIN = 'Demo is a stand-in until your saved reel is linked.'
NEW = {
    'Knee Circles': ('Fire Hydrants', dict(primary_muscle='glutes', muscles=['glutes', 'abductors', 'hip_flexors'], pattern='mobility', role='warmup',
                     equipment=['bodyweight'], level=1, unilateral=True, plane='transverse', hip_focus=True)),
    'Standing Hip Internal/External Lifts': ('Facing Wall Hip Circle Rotations', dict(primary_muscle='glutes', muscles=['glutes', 'hip_flexors', 'adductors'],
                     pattern='mobility', role='warmup', equipment=['bodyweight'], level=1, unilateral=True, plane='transverse', hip_focus=True)),
    'Knee Pull Heel Bridge': ('On Bench Single Leg Glute Bridge', dict(primary_muscle='glutes', muscles=['glutes', 'hip_flexors', 'abs'], pattern='isometric',
                     role='warmup', equipment=['bodyweight'], level=1, unilateral=True, plane='sagittal', hip_focus=True)),
    'Squat to Hamstring Stretch': ('Hamstring Stretch', dict(primary_muscle='hamstrings', muscles=['hamstrings', 'adductors', 'glutes'], pattern='mobility',
                     role='warmup', equipment=['bodyweight'], level=1, unilateral=False, plane='sagittal', hip_focus=False)),
    'Quadruped Swing Throughs': ('Donkey Kicks', dict(primary_muscle='glutes', muscles=['glutes', 'hip_flexors', 'hamstrings'], pattern='mobility',
                     role='warmup', equipment=['bodyweight'], level=1, unilateral=True, plane='sagittal', hip_focus=True)),
}
# These are options, not a checklist: Daily C uses some, the rest sit in its Swap lists, and all of
# them are warm-up moves the plan generator can pick for training-day warm-ups (it prefers the
# user's own moves: src/lib/generator.js, OWN_MOVES).
for name, (borrow, tags) in NEW.items():
    lib.ensure_exercise(name, 'daily', tags=tags, video_from=borrow)


def r(name, reps=None, time=None, sets=1, notes=None, group=None, alts=None, rest=None):
    row = ex(name, reps=reps, time=time, sets=sets, rest=rest, notes=notes, group=group)
    if alts:
        row['alternates'] = alts
    return row


# The user's own low-back routine opens every day.
LOW_BACK = [
    r('Cat Camel', '7', group='Low back reset', notes='Slow, segment by segment. (The old daily card\'s Cat Cow.)', alts=['Cat Cow']),
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
        'About 13 minutes. Your low-back reset, then hips. Every move has more options from your saved reels and coaches one tap away: ⋯ → Swap → Plan alternatives.',
        'Work through the pigeon levels slowly (PJF: levels 3 and 4 are hard for many people).'], [
        r('Optional Pigeon Length Under Load', '5 each side', group='Pigeon', notes='Your #1 "rotating pigeon". PJF\'s levels, slowly.',
          alts=['Banded Incline Pigeon Rotation']),
        r('Knee Circles', '5 each way', group='Rotation',
          alts=['Standing Hip Internal/External Lifts', 'Quadruped Swing Throughs', 'Facing Wall Hip Circle Rotations'],
          notes='Your #2. On hands and knees, circle one bent knee out to the side and back, slow; each leg (Yoga With Katharine). ' + STANDIN),
        r('90/90 Hip Opener', time='1:30', group='Rotation', notes='Your 90/90 series: holds, 30% rotations, swing-throughs, lean back, backside opener.',
          alts=['90/90 Knee Roll']),
        r('Banded Hip Distraction Pulling Into Hip Flexion', '8 each side', group='Band',
          notes='Your #8 (likely match): band low-anchored at the top of the thigh, knee to chest and across, different angles.',
          alts=['Knee Pull Heel Bridge']),
        r('Hamstring Floss', '8 each side', group='Hamstrings', notes='Your #18 "lunge to hamstring": tuck, then push the glute back.',
          alts=['Squat to Hamstring Stretch', 'Optional Downward Frog', 'Hip Flexor Rock Back']),
        r('Hip Flexor Length Under Load', time='45s', sets=2, group='Length under load', notes='Each side (PJF).',
          alts=['Hip Flexor/Quad Bridge', 'Lateral Lunge Length Under Load']),
        r('Single-Leg Balance', time='30s', sets=2, group='Finish', notes='Each side.',
          alts=['Single Leg Full Range Step Downs or Leg Press', 'Single Leg Stance']),
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
