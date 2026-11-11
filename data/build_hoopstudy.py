"""Builds "HoopStudy 8-Week In-Season Strength" into data/library.json (programs.hoopstudy).

Source: HoopStudy's "8 Week In Season Strength Training Program" PDF by Adam Menner (20 pages, read in
full 2026-11-11; notes in docs/research/notes-daily-mobility/hoopstudy_8wk_in_season.md). Dumbbell
strength 3 days a week, speed and jumps 2 days, recovery 2 days, for 8 weeks.

What the PDF has, and where it goes:
- Training warm-up (LAX/soft ball on calves, hamstrings, glutes, 30 s each) → every training day's warm-up.
  "Pregame Warm Up Routine" is named but not written out → a day note points to Daily Mobility instead.
- Days 1/3/5 strength, all 8 reps; high-school volume (the adult option): weeks 1-2 3×8, weeks 3-8 4×8.
  (Middle-school volume, 2×8 → 4×8, is left out.)
- "How to progress weights": record every weight, work up to a top set, restart weeks 5-6 from the
  weeks 1-2 top set → day notes and the guide.
- Days 2/4 speed and jumps with their week-by-week doses → per-week loop. "Have someone time you and
  record time" → the sprint row's note (log the time with ⋯ → Note).
- Days 6/7 recovery (identical) → two recovery days.
- Not in the PDF: rest times, pictures or videos of the moves. Rests here are standard (lifts 90 s,
  sprints and jumps full recovery). Every move uses a demo the app already has; moves the app had no
  demo for are added with the closest demo and say so (STANDIN).
Validate with: node data/check_program.mjs hoopstudy_8wk_in_season --net
"""
from program_builder import Library, ex, w, expand_weeks

lib = Library()
GROUP = 'HoopStudy'
STANDIN = 'Demo is the closest match in the app; HoopStudy\'s PDF names this move without a picture or video.'

# Moves the app didn't have: tagged, with the nearest vetted demo borrowed (video_from).
NEW = {
    'Hollow Hold Sit Up': ('Reverse 1/2 Crunch', dict(primary_muscle='abs', muscles=['abs', 'hip_flexors'], pattern='flexion', role='core',
                           equipment=['bodyweight'], level=2, unilateral=False, plane='sagittal', hip_focus=False)),
    'Prone Pull Through': ('(Weighted) Prone Arm Circles', dict(primary_muscle='upper_back', muscles=['upper_back', 'rear_delts', 'lower_back'], pattern='mobility',
                           role='accessory', equipment=['dumbbell'], level=1, unilateral=False, plane='sagittal', hip_focus=False)),
    'Single Leg Wall Stride': ('Sprint Drills', dict(primary_muscle='hip_flexors', muscles=['hip_flexors', 'glutes', 'calves'], pattern='speed_accel',
                           role='warmup', equipment=['bodyweight'], level=1, unilateral=True, plane='sagittal', hip_focus=True)),
    'OH March': ('Sprint Drills', dict(primary_muscle='hip_flexors', muscles=['hip_flexors', 'abs', 'calves'], pattern='speed_accel', role='warmup',
                           equipment=['bodyweight'], level=1, unilateral=False, plane='sagittal', hip_focus=True)),
    'A-March': ('Sprint Drills', dict(primary_muscle='hip_flexors', muscles=['hip_flexors', 'glutes', 'calves'], pattern='speed_accel', role='warmup',
                           equipment=['bodyweight'], level=1, unilateral=False, plane='sagittal', hip_focus=True)),
    'A-Skip': ('Extensive Locomotive Skips', dict(primary_muscle='calves', muscles=['calves', 'hip_flexors', 'glutes'], pattern='plyo_bound_hop', role='warmup',
                           equipment=['bodyweight'], level=1, unilateral=False, plane='sagittal', hip_focus=False)),
    'Power Skip': ('Extensive Locomotive Skips', dict(primary_muscle='glutes', muscles=['glutes', 'calves', 'quads'], pattern='plyo_bound_hop', role='power',
                           equipment=['bodyweight'], level=2, unilateral=False, plane='sagittal', hip_focus=False)),
    'Falling Sprints': ('Sprint Accelerations', dict(primary_muscle='glutes', muscles=['glutes', 'hamstrings', 'quads'], pattern='speed_accel', role='power',
                           equipment=['bodyweight'], level=2, unilateral=False, plane='sagittal', hip_focus=False)),
    '90/90 Sprints': ('Sprint Accelerations', dict(primary_muscle='glutes', muscles=['glutes', 'hamstrings', 'quads'], pattern='speed_accel', role='power',
                           equipment=['bodyweight'], level=2, unilateral=False, plane='sagittal', hip_focus=True)),
    '90/90 Single Power Jumps': ('Extensive Knee Dominant Jump', dict(primary_muscle='quads', muscles=['quads', 'glutes', 'calves'], pattern='plyo_jump', role='power',
                           equipment=['bodyweight'], level=2, unilateral=False, plane='sagittal', hip_focus=True)),
    'Paused Squat Jumps': ('Resisted Pause Jumps', dict(primary_muscle='quads', muscles=['quads', 'glutes', 'calves'], pattern='plyo_jump', role='power',
                           equipment=['bodyweight'], level=2, unilateral=False, plane='sagittal', hip_focus=False)),
    'Hook Plank': ('Dead Bug', dict(primary_muscle='abs', muscles=['abs', 'obliques', 'lower_back'], pattern='anti_extension', role='core',
                           equipment=['bodyweight'], level=1, unilateral=False, plane='sagittal', hip_focus=False)),
}
for name, (borrow, tags) in NEW.items():
    lib.ensure_exercise(name, 'hoopstudy', tags=tags, video_from=borrow)


def r(name, reps=None, time=None, sets=None, rest=None, notes=None, group=None, alts=None):
    row = ex(name, reps=reps, time=time, sets=sets, rest=rest, notes=notes, group=group)
    if alts:
        row['alternates'] = alts
    return row


TISSUE = [w('Foam Roller Circuit', time='1:30', notes='LAX or soft ball: calves, hamstrings, glutes, 30 s each (HoopStudy\'s tissue work).')]
# The PDF's "Pregame Warm Up Routine" isn't written out: a short movement prep stands in on lifting days.
LIFT_WARMUP = TISSUE + [
    w("World's Greatest Stretch", reps='3 each side', notes='Stands in for HoopStudy\'s pregame warm-up, which the PDF doesn\'t write out.'),
    w('Glute Bridge', reps='10'),
    w('Arm Circles', reps='10 each way'),
]
PROGRESS = 'Record your weights. Work up to a top set across the sets (for example 10, 15, 20, 25 lb).'


def lift_sets(wk):
    return 3 if wk <= 2 else 4   # high-school volume: weeks 1-2 3×8, weeks 3-8 4×8


def sprint_reps(wk):
    return 4 if wk <= 2 else 6 if wk <= 4 else 8 if wk <= 6 else 10


def jump_rounds(wk):
    return 3 if wk <= 2 else 4 if wk <= 6 else 5


def lift_notes(wk):
    n = [PROGRESS]
    if wk == 5:
        n.append('Weeks 5-6 restart: begin from the top set you hit in weeks 1-2, then build again.')
    n.append('Rest about 90 s between sets (the PDF doesn\'t set rest times).')
    return n


def speed_drills(build_ups=True):
    return [
        r('Pogos', '10 each way', sets=2, rest='30s', group='Drills',
          notes='HoopStudy\'s 4-way extensive ankle pop series: forward/back, side to side, and both diagonals, quick and springy off the ankles.',
          alts=['Extensive Locomotive Skips']),
        r('OH March', '10 each side', sets=2, rest='30s', group='Drills', notes='Arms locked overhead, tall posture, knee up to hip height. ' + STANDIN),
        r('A-March', '10 each side', sets=2, rest='30s', group='Drills', notes='Sprint posture: drive the knee up, toes up, punch the foot down under the hip. ' + STANDIN),
        r('A-Skip', '10 each side', sets=2, rest='30s', group='Drills', notes='The A-march with a skip. ' + STANDIN),
        r('Power Skip', '5 each side', sets=2, rest='45s', group='Drills', notes='Skip for height: big knee drive and arm swing. ' + STANDIN),
    ] + ([r('Falling Sprints', '10 yd', sets=3, rest='60s', group='Sprint warm-up',
          notes='Falling-start sprint warm-ups: 1 at 50%, 1 at 75%, 1 at 100% effort. Lean forward until you have to step, then go. ' + STANDIN)] if build_ups else [])


def day1(wk):
    s = lift_sets(wk)
    return {'focus': 'Day 1 · Strength 1', 'warmup': LIFT_WARMUP, 'notes': lift_notes(wk), 'exercises': [
        r('Dumbbell Bench Press', '8', sets=s, rest='90s', alts=['Low Incline Dumbbell Press', 'Incline Alternating Arms Dumbbell Press', 'Push Ups']),
        r('3 Point Dumbbell Row', '8 each side', sets=s, rest='90s', notes='HoopStudy\'s single-arm DB row: one hand on a bench.',
          alts=['DB Split Stance Row', 'Birddog Dumbbell Row', 'Dumbbell Bent-Over Row']),
        r('Reverse Step Back Lunge', '8 each side', sets=s, rest='90s', notes='HoopStudy\'s dumbbell reverse lunge: hold dumbbells at your sides.',
          alts=['Reverse Lunges', 'Front Foot Elevated Reverse Lunge']),
        r('Hollow Hold Sit Up', '8', sets=s, rest='60s',
          notes='Hold a hollow body (low back pressed down, legs and shoulders off the floor), sit up, lower back to the hollow. ' + STANDIN,
          alts=['Reverse 1/2 Crunch', 'Dead Bug']),
    ]}


def day2(wk):
    return {'focus': 'Day 2 · Sports Performance 1', 'warmup': TISSUE, 'notes': [
        'Speed day: drills, then sprints and jumps at full effort with full rest. Quality over fatigue: stop if you slow down.',
        'Have someone time your sprints and record the time (⋯ → Note on the sprint row).'],
        'exercises': speed_drills() + [
        r('90/90 Sprints', '10 yd', sets=sprint_reps(wk), rest='60-90s',
          notes='10 yd at 100% effort, from a 90/90 start: sit on the ground in a 90/90 hip position, get up and sprint. Walk back between reps. ' + STANDIN,
          alts=['Falling Sprints', 'Sprint Accelerations']),
        r('90/90 Single Power Jumps', '3', sets=jump_rounds(wk), rest='60s',
          notes='One explosive jump at a time, reset between reps, land softly. ' + STANDIN, alts=['Extensive Knee Dominant Jump']),
        r('Lateral Bounds', '3 each side', sets=jump_rounds(wk), rest='60s', notes='HoopStudy\'s lateral bounders: push off one leg sideways, stick the landing on the other.',
          alts=['Half Kneel Lateral Jump']),
    ]}


def day3(wk):
    s = lift_sets(wk)
    return {'focus': 'Day 3 · Strength 2', 'warmup': LIFT_WARMUP, 'notes': lift_notes(wk), 'exercises': [
        r('Dumbbell Goblet Squat', '8', sets=s, rest='90s', alts=['Heel Elevated Goblet Squat', 'Tempo Goblet Squat']),
        r('Dumbbell Lateral Lunge', '8 each side', sets=s, rest='90s',
          notes='HoopStudy\'s DB Cossack lunge: sit deep into one side, the other leg straight with toes up.', alts=['Lateral Lunge', 'Loaded Lateral Squat']),
        r('Yoga Pushup', '8', sets=s, rest='60s', notes='HoopStudy\'s version adds a heel touch: push up to a downward dog, reach one hand back to the opposite heel.',
          alts=['Push Ups', 'Push Up To Shoulder Airplane']),
        r('Dumbbell Glute Bridge', '8', sets=s, rest='60s', alts=['Glute Bridge', 'Single-Leg Glute Bridge']),
        r('Prone Pull Through', '8', sets=s, rest='60s',
          notes='Lying face down, pass a light dumbbell from overhead, out to the sides and behind your back, and return. ' + STANDIN,
          alts=['(Weighted) Prone Arm Circles', 'Band Pull-Aparts']),
    ]}


def day4(wk):
    return {'focus': 'Day 4 · Sports Specific 2', 'warmup': TISSUE, 'notes': [
        'Speed day: drills, then sprints and jumps at full effort with full rest.',
        'Have someone time your sprints and record the time (⋯ → Note on the sprint row).'],
        'exercises': speed_drills(build_ups=False) + [
        r('Falling Sprints', '10 yd', sets=sprint_reps(wk) + 3, rest='60-90s',
          notes=f'First 3 are build-ups at 50%, 75% and 100% effort, then {sprint_reps(wk)} × 10 yd at 100% from a falling start: lean forward until you have to step, then go. Walk back between reps. ' + STANDIN,
          alts=['Sprint Accelerations']),
        r('Paused Squat Jumps', '3', sets=jump_rounds(wk), rest='60s', notes='Squat down, pause 2 s, jump as high as you can, land softly. ' + STANDIN,
          alts=['Extensive Knee Dominant Jump']),
    ]}


def day5(wk):
    s = lift_sets(wk)
    return {'focus': 'Day 5 · Strength 3', 'warmup': LIFT_WARMUP, 'notes': lift_notes(wk), 'exercises': [
        r('Half Kneeling Single Arm Dumbbell Press', '8 each side', sets=s, rest='90s',
          notes='HoopStudy\'s DB ½ kneeling clean and press: clean the dumbbell from the floor to the shoulder, then press.',
          alts=['Dumbbell Kickstand Clean/Press', 'Landmine Kneeling Press']),
        r('Dumbbell Bent-Over Row', '8', sets=s, rest='90s', alts=['3 Point Dumbbell Row', 'Chest Supported DB Row (lat focus)']),
        r('Dumbbell Romanian Deadlift', '8', sets=s, rest='90s', notes='HoopStudy\'s DB 2-point RDL: both feet down.',
          alts=['Kickstand RDL', 'B-Stance RDL']),
        r('Single-Leg Glute Bridge', '8 each side', sets=s, rest='60s', notes='HoopStudy\'s single-leg DB heel bridge: dumbbell on the hip, drive through the heel.',
          alts=['Dumbbell Glute Bridge', 'On Bench Single Leg Glute Bridge']),
        r('Single Leg Wall Stride', '8 each side', sets=s, rest='60s',
          notes='Hands on a wall, body leaning in a sprint angle; drive one knee up and hold the stride position. ' + STANDIN, alts=['A-March']),
    ]}


def recovery(n):
    return {'focus': f'Day {n} · Recovery', 'notes': [
        'About 12 minutes, mostly lying down and breathing. Easy: this is recovery, not training.'], 'exercises': [
        r('Foam Roller Circuit', time='1:30', sets=1, notes='Foam roll and LAX ball: calves, hamstrings, glutes, 30 s each.'),
        r('Hook Plank', '10 breaths', sets=2, rest='15s', notes='On your back, knees bent, feet flat (hook-lying), low back down, abs braced; 10 slow breaths. ' + STANDIN,
          alts=['Dead Bug']),
        r('Posterior Pelvic Tilt Breathing', '10 breaths', sets=2, rest='15s',
          notes='HoopStudy\'s 90/90 lift with internal rotation: on your back, feet on a wall with hips and knees at 90°, slight tuck, slow breaths.'),
        r('Single-Leg Elevated Hamstring Bridge', '10 each side', sets=2, rest='15s', notes='HoopStudy\'s 90/90 single-leg bridge: feet on the wall at 90/90, bridge one leg.',
          alts=['Single-Leg Glute Bridge']),
        r('90/90 Knee Roll', '10 each side', sets=2, rest='15s', notes='HoopStudy\'s 90/90 knee rolls: knees side to side, slow.'),
        r('Forward Lunge Isometric', time='25s', sets=2, rest='15s', notes='HoopStudy\'s single-leg ISO hold: split stance, hold the bottom position. Each side.',
          alts=['Single-Leg Balance']),
        r('Glute Bridge Hold', time='25s', sets=2, rest='15s', notes='HoopStudy\'s single-leg ISO heel bridge hold: one leg, drive through the heel. Each side.',
          alts=['Knee Pull Heel Bridge']),
    ]}


def days(wk):
    return [day1(wk), day2(wk), day3(wk), day4(wk), day5(wk), recovery(6), recovery(7)]


program = {
    'id': 'hoopstudy_8wk_in_season',
    'program_name': 'HoopStudy 8-Week In-Season Strength',
    'group': GROUP,
    'source': 'HoopStudy',
    'description': 'Adam Menner\'s HoopStudy program: dumbbell strength 3 days a week (all sets of 8), speed and jumps 2 days, '
                   'recovery 2 days, for 8 weeks. Built for basketball players in season; uses the high-school volume (3×8, then 4×8 from week 3).',
    'sessions_per_week': 7, 'session_length_min': 35, 'level': 'All levels',
    'equipment': ['Dumbbells', 'Bench', 'Wall', 'Foam roller or LAX ball', '10+ yards of space to sprint'],
    'goal': 'Stronger, faster and healthier through a season, without wearing down.',
    'guide': [
        {'title': 'How to progress weights (from the program)', 'items': [
            'Record your weights on every exercise.',
            'Work up to a top set across your sets, for example 10, 15, 20, 25 lb.',
            'Weeks 5-6 restart: begin from the top set you hit in weeks 1-2 and build again.']},
        {'title': 'Fitting it into your week', 'items': [
            'Days 6 and 7 are recovery: Daily Mobility covers the same kind of work if you\'d rather do that.',
            'The PDF\'s "Pregame Warm Up Routine" isn\'t written out; use your Daily Mobility routine or the drills from the speed days.',
            'Sprints are at 100%: warm up fully, and if it\'s been a while since you sprinted, run the first week at 90%.']},
    ],
    'safety': 'Sprints and jumps are full effort: stop a rep that hurts or when you slow down. Land softly and quietly.',
    'weeks': expand_weeks(8, days),
}
lib.set_programs('hoopstudy', [program])
lib.save()
print('wrote', program['id'])
