"""Builds the Beginner At-Home 4-Week plan into data/library.json (programs.home).

Source: a beginner at-home plan document (glutes, lower core, waist, fat loss).
Mon-Sat sessions; Sunday is rest + progress check. Rounds grow by week:
W1 2 (1 is fine), W2 2, W3 3 (3rd optional), W4 3.

Re-run safely: replaces the program and upserts its catalog entries by id.
Videos: entries start with a vetted URL where the library already has one for the
same movement; the rest go through enrich_program_videos.mjs --source home.
"""
import json
from program_builder import Library

lib = Library()

# Names this plan adds to the catalog (tags live in data/exercise_tags.json once added),
# with the existing entry to borrow a vetted video from, where there is one.
CATALOG = {
    'March in Place': None, 'Hip Circles': None, 'Bodyweight Squat': None,
    'Leg Swings': 'Forward Leg Swings', 'Dumbbell Squat': 'Dumbbell Goblet Squat',
    'Banded Glute Bridge': None, 'Resistance Band Side Steps': None, 'Standing Glute Kickback': None,
    'Heel Slides': None, 'Standing Side Crunch': None, 'Dumbbell Sumo Squat': None,
    'Dumbbell Glute Bridge': None, 'Donkey Kicks': None, 'Fire Hydrants': None,
    'Side-Lying Leg Raise': 'Side Lying Leg Raise', 'Banded Clamshell': None,
    'Dumbbell Bent-Over Row': None, 'Dumbbell Deadlift': None, 'Standing Knee-to-Elbow Crunch': None,
    'Brisk Walk': None, 'Gentle Full-Body Stretch': None,
}
# Already in the library or the hip tab with vetted videos, referenced by exact name:
# Dumbbell Romanian Deadlift, Dead Bug, Bird Dog, Standing Dumbbell Shoulder Press,
# Pelvic Tilts, Cat-Cow, Modified Side Plank.
SEARCH = {
    'Brisk Walk': '30 minute beginner indoor walking workout',
    'Gentle Full-Body Stretch': '10 minute gentle full body stretch beginner',
}

# Exercises the two follow-along videos use that the catalog didn't have (tags per docs/EXERCISE_TAXONOMY.md).
G = lambda pat, pm, ms, eq, uni=False, role='secondary', plane='sagittal', lvl=1: {
    'pattern': pat, 'role': role, 'primary_muscle': pm, 'muscles': ms, 'equipment': eq, 'level': lvl,
    'unilateral': uni, 'plane': plane, 'hip_focus': False}
VIDEO_MOVES = {
    'Dumbbell Hip Thrust': G('hinge', 'glutes', ['glutes', 'hamstrings'], ['dumbbell', 'bench']),
    'Hip Thrust Hold': G('isometric', 'glutes', ['glutes', 'hamstrings'], ['dumbbell', 'bench'], role='accessory'),
    'Hip Thrust Pulses': G('hinge', 'glutes', ['glutes'], ['dumbbell', 'bench'], role='accessory'),
    'Single-Leg Hip Thrust Hold': G('isometric', 'glutes', ['glutes', 'hamstrings'], ['bench'], True, 'accessory'),
    'Single-Leg Hip Thrust Pulses': G('hinge', 'glutes', ['glutes'], ['bench'], True, 'accessory'),
    'Glute Bridge': G('hinge', 'glutes', ['glutes', 'hamstrings'], ['bodyweight']),
    'Kneeling Hip Thrust': G('hinge', 'glutes', ['glutes', 'hamstrings'], ['dumbbell']),
    'Half-Kneeling Hip Thrust': G('hinge', 'glutes', ['glutes', 'hamstrings'], ['dumbbell'], True),
    'B-Stance RDL': G('hinge', 'hamstrings', ['hamstrings', 'glutes', 'lower_back'], ['dumbbell'], True, lvl=2),
    'Glute Rainbows': G('isolation_lower', 'glutes', ['glutes', 'abductors'], ['bodyweight'], True, 'accessory', 'frontal'),
    'Banded Squat': G('squat', 'quads', ['quads', 'glutes', 'abductors'], ['mini_band'], role='warmup'),
    'Banded Lateral Walk': G('isolation_lower', 'abductors', ['abductors', 'glutes'], ['mini_band'], role='accessory', plane='frontal'),
    'Banded Glute Kickback': G('isolation_lower', 'glutes', ['glutes'], ['mini_band'], True, 'accessory'),
    'Dumbbell Lateral Lunge': G('lunge_single_leg', 'glutes', ['glutes', 'adductors', 'quads'], ['dumbbell'], True, plane='frontal', lvl=2),
    'Curtsy Lunge': G('lunge_single_leg', 'glutes', ['glutes', 'quads', 'abductors'], ['dumbbell'], True, plane='frontal', lvl=2),
    '1¼ Goblet Squat': G('squat', 'quads', ['quads', 'glutes'], ['dumbbell'], lvl=2),
    'Squat Hold': G('isometric', 'quads', ['quads', 'glutes'], ['bodyweight'], role='accessory'),
    'Banded Bridge Hold Abductions': G('isolation_lower', 'abductors', ['abductors', 'glutes'], ['mini_band'], role='accessory', plane='frontal'),
    'Glute Bridge Hold': G('isometric', 'glutes', ['glutes', 'hamstrings'], ['bodyweight'], role='accessory'),
}

for name, borrow in CATALOG.items():
    lib.ensure_exercise(name, 'home', video_from=borrow, search=SEARCH.get(name, name + ' beginner form'))

# ── program ─────────────────────────────────────────────────────────────────
REST = '45-60s'
ROUNDS = {1: 2, 2: 2, 3: 3, 4: 3}
WEEK_NOTE = {
    1: 'Week 1: learn the form. 1 round is fine; do 2 if it feels good.',
    2: 'Week 2: 2 rounds. Aim for consistency, all six sessions.',
    3: 'Week 3: 2-3 rounds. Only add the 3rd round if you feel good.',
    4: 'Week 4: 3 rounds, slow and controlled.',
}
WEEK_NOTE_VIDEO = {
    1: 'Week 1: learn the moves. Light dumbbells; pause the video between blocks if you need to.',
    2: 'Week 2: same video. Rest less between blocks.',
    3: 'Week 3: go a little heavier on the dumbbells.',
    4: 'Week 4: heavier again, slow and controlled.',
}
PROGRESS = "Don't raise weight and reps in the same week. Progress one at a time."

def ex(name, reps=None, time=None, notes=None, group='Circuit', rest=REST, sets=None):
    return {'name': name, 'round_group': group, 'is_alternate': False, 'sets': sets,
            'reps': reps, 'weight': None, 'distance': None, 'time': time, 'rest': rest, 'notes': notes}

def w(name, reps=None, time=None, notes=None):
    return {'name': name, 'reps': reps, 'time': time, 'notes': notes}


# ── Video-led days ──────────────────────────────────────────────────────────
# Monday and Thursday follow the exact follow-along videos from the plan document
# (40 s work / 20 s rest). Each row opens that same video at the moment the exercise starts.
MON_VID = '3D7vdq1pvOw'   # 30 Min Dumbbell Glute Workout (TIFF x DAN), chapters from YouTube
THU_VID = 'z-lsr8cVuqo'   # 20 Min Lower Body Dumbbell Workout (Jasmine Dawn), read from the video's on-screen titles

def vx(name, start, vid, sets, time='40s', notes=None, group=None, rest='20s'):
    """One exercise from a follow-along video: timed, with the video opening at `start` seconds."""
    return {'name': name, 'round_group': group, 'is_alternate': False, 'sets': sets, 'reps': None, 'weight': None,
            'distance': None, 'time': time, 'rest': rest, 'notes': notes,
            'video_url': f'https://www.youtube.com/watch?v={vid}&t={start}', 'video_led': True}

MONDAY_EXERCISES = [
    vx('Dumbbell Hip Thrust', 28, MON_VID, 2, group='Hip thrusts · 2 rounds', notes='Shoulders on a bench or couch, dumbbell on the hips.'),
    vx('Hip Thrust Hold', 88, MON_VID, 2, group='Hip thrusts · 2 rounds'),
    vx('Hip Thrust Pulses', 148, MON_VID, 2, group='Hip thrusts · 2 rounds'),
    vx('Single-Leg Hip Thrust', 388, MON_VID, 2, group='Single-leg hip thrusts', notes='Right side, then left.'),
    vx('Single-Leg Hip Thrust Hold', 508, MON_VID, 2, group='Single-leg hip thrusts', notes='Right side, then left.'),
    vx('Single-Leg Hip Thrust Pulses', 628, MON_VID, 2, group='Single-leg hip thrusts', notes='Right side, then left.'),
    vx('Glute Bridge', 748, MON_VID, 2, group='Bridges · 2 rounds'),
    vx('Single-Leg Glute Bridge', 808, MON_VID, 4, group='Bridges · 2 rounds', notes='Right, then left, each round.'),
    vx('Kneeling Hip Thrust', 1108, MON_VID, 2, group='Kneeling hip thrusts · 2 rounds'),
    vx('Half-Kneeling Hip Thrust', 1168, MON_VID, 4, group='Kneeling hip thrusts · 2 rounds', notes='Right, then left, each round.'),
    vx('Dumbbell Romanian Deadlift', 1468, MON_VID, 2, group='RDLs · 2 rounds'),
    vx('B-Stance RDL', 1528, MON_VID, 4, group='RDLs · 2 rounds', notes='Right, then left, each round.'),
    vx('Fire Hydrants', 1828, MON_VID, 2, time='30s', rest='0s', group='Finisher · each side', notes='Right side, then left.'),
    vx('Donkey Kicks', 1858, MON_VID, 2, time='30s', rest='0s', group='Finisher · each side'),
    vx('Glute Rainbows', 1888, MON_VID, 2, time='30s', rest='0s', group='Finisher · each side'),
]

THURSDAY_EXERCISES = [
    vx('Banded Squat', 25, THU_VID, 1, group='Band activation'),
    vx('Banded Lateral Walk', 85, THU_VID, 1, group='Band activation'),
    vx('Banded Glute Kickback', 145, THU_VID, 2, group='Band activation', notes='One side, then the other.'),
    vx('Banded Glute Bridge', 265, THU_VID, 1, group='Band activation'),
    vx('Dumbbell Goblet Squat', 325, THU_VID, 1, group='Standing'),
    vx('Reverse Lunges', 385, THU_VID, 1, group='Standing'),
    vx('Dumbbell Romanian Deadlift', 445, THU_VID, 1, group='Standing'),
    vx('Dumbbell Lateral Lunge', 505, THU_VID, 1, group='Standing'),
    vx('Dumbbell Sumo Squat', 565, THU_VID, 1, group='Standing'),
    vx('Curtsy Lunge', 625, THU_VID, 1, group='Standing'),
    vx('B-Stance RDL', 685, THU_VID, 2, group='Standing', notes='One side, then the other.'),
    vx('1¼ Goblet Squat', 805, THU_VID, 1, group='Standing', notes='All the way down, a quarter up, back down, then stand.'),
    vx('Squat Hold', 865, THU_VID, 1, group='Standing'),
    vx('Dumbbell Glute Bridge', 925, THU_VID, 1, group='On the mat'),
    vx('Banded Bridge Hold Abductions', 985, THU_VID, 1, group='On the mat'),
    vx('Single-Leg Glute Bridge', 1045, THU_VID, 2, group='On the mat', notes='One side, then the other.'),
    vx('Glute Bridge Hold', 1165, THU_VID, 1, group='On the mat'),
]
VIDEO_NOTE = 'Follow along with the video: 40 seconds on, 20 off. Tap ▶ Video on any exercise to jump to that part.'

STD_WARMUP = [w('March in Place', time='2 min'), w('Hip Circles', time='30 sec'),
              w('Bodyweight Squat', reps='10')]

DAYS = [
    {
        'focus': 'Mon · Glutes & Legs',
        'warmup': STD_WARMUP + [w('Leg Swings', reps='10 each leg')],
        'exercises': MONDAY_EXERCISES,
        'notes': [VIDEO_NOTE],
        'video': {'title': '30-Minute At-Home Dumbbell Glute Workout',
                  'url': 'https://www.youtube.com/watch?v=3D7vdq1pvOw'},
    },
    {
        'focus': 'Tue · Lower Belly & Core',
        'warmup': [w('March in Place', time='2 min', notes='Gentle pace'),
                   w('Pelvic Tilts', reps='10'), w('Cat-Cow', reps='8')],
        'notes': ['Move slowly and breathe. Keep your back comfortable and don\'t let it arch.'],
        'exercises': [
            ex('Pelvic Tilts', '12', rest='30s'),
            ex('Dead Bug', '8 each side', rest='30s'),
            ex('Heel Slides', '10 each side', rest='30s'),
            ex('Bird Dog', '10 each side', rest='30s'),
            ex('Standing Side Crunch', '12 each side', rest='30s'),
            ex('Modified Side Plank', time='15s', notes='Each side. Knees down.', rest='30s'),
        ],
        'video': {'title': '12-Minute Beginner Deep Core Workout',
                  'url': 'https://notbroken.io/videos/beginner-deep-core-workout-floor-or-bed/index.html'},
    },
    {
        'focus': 'Wed · Walking & Recovery',
        'notes': ['Comfortable pace: you should still be able to hold a conversation.'],
        'exercises': [
            ex('Brisk Walk', time='30:00', group=None, rest=None, sets=1, notes='Indoors or outside.'),
            ex('Gentle Full-Body Stretch', time='5:00', group=None, rest=None, sets=1, notes='5-10 minutes.'),
        ],
        'video': {'title': '30-Minute Beginner Walking Workout',
                  'url': 'https://www.notbroken.io/videos/walk-at-home-fast-30-minute-walk/'},
    },
    {
        'focus': 'Thu · Glute Lift & Shaping',
        'warmup': STD_WARMUP,
        'exercises': THURSDAY_EXERCISES,
        'notes': [VIDEO_NOTE],
        'video': {'title': '20-Minute Dumbbell Lower Body Workout',
                  'url': 'https://www.youtube.com/watch?v=z-lsr8cVuqo'},
    },
    {
        'focus': 'Fri · Full Body & Waist',
        'warmup': STD_WARMUP + [w('Leg Swings', reps='10 each leg')],
        'exercises': [
            ex('Dumbbell Squat', '12'),
            ex('Dumbbell Bent-Over Row', '12'),
            ex('Standing Dumbbell Shoulder Press', '10'),
            ex('Dumbbell Deadlift', '10'),
            ex('Standing Knee-to-Elbow Crunch', '12 each side'),
            ex('March in Place', time='2:00'),
        ],
        'video': {'title': 'Beginner Full-Body Strength Workouts',
                  'url': 'https://www.erikakehrwaldfitness.com/free-workouts',
                  'note': 'Pick a beginner-level routine.'},
    },
    {
        'focus': 'Sat · Walking & Stretching',
        'notes': ['Optional: add 10 minutes of gentle glute activation (bridges, clamshells, side steps) if you feel recovered.',
                  'Sunday is rest. Do your progress check (button below, or Body tab): measurements, energy, how clothes fit, photos.'],
        'exercises': [
            ex('Brisk Walk', time='30:00', group=None, rest=None, sets=1),
            ex('Gentle Full-Body Stretch', time='10:00', group=None, rest=None, sets=1),
        ],
    },
]

first_use = {}
for row in MONDAY_EXERCISES + THURSDAY_EXERCISES:
    first_use.setdefault(row['name'], row['video_url'])
for name, tags in VIDEO_MOVES.items():
    e = lib.ensure_exercise(name, 'home', tags=tags)
    if not e.get('video_url'):
        e['video_url'] = first_use.get(name)   # catalog demo = the moment in Sadie's video

weeks = []
for wk in (1, 2, 3, 4):
    days = []
    for i, d in enumerate(DAYS, 1):
        day = json.loads(json.dumps(d))
        day['day_num'] = i
        if wk == 1 and i == 1:
            day['progress_check'] = 'Take starting measurements & photos'
            day.setdefault('notes', []).insert(0, 'Before your first workout: take your starting measurements and photos.')
        if i == 6:
            day['progress_check'] = 'Sunday progress check'
        video_led = any(e.get('video_led') for e in day['exercises'])
        for e in day['exercises']:
            e.pop('video_led', None)
        circuit = not video_led and any(e['round_group'] for e in day['exercises'])
        for e in day['exercises']:
            if e['sets'] is None:
                e['sets'] = ROUNDS[wk]
            if e['round_group'] and not video_led:
                e['round_group'] = f'Circuit · {ROUNDS[wk]} rounds'
        if video_led:
            day['notes'] = [WEEK_NOTE_VIDEO[wk]] + day.get('notes', [])
        if circuit:
            rest = day['exercises'][0]['rest']
            day['notes'] = [WEEK_NOTE[wk], f'Go through every exercise once, then repeat. Rest {rest.rstrip("s")} seconds between exercises.'] \
                + day.get('notes', []) + ([PROGRESS] if wk >= 2 else [])
        days.append(day)
    weeks.append({'week_num': wk, 'days': days})

program = {
    'id': 'home_beginner_4wk',
    'program_name': 'Beginner At-Home: 4 Weeks',
    'source': 'Home',
    'group': 'At-Home Beginner',
    'description': 'Glutes, lower core, waist and fat loss for a complete beginner. Dumbbells, bands and a mat, 30-45 minutes. Two walking days, Sunday off.',
    'sessions_per_week': 6,
    'session_length_min': 40,
    'level': 'Beginner',
    'equipment': ['Exercise mat', 'Light dumbbells', 'Resistance bands', 'Walking shoes'],
    'goal': 'Get stronger, build my glutes, strengthen my core, and feel confident in my body.',
    'guide': [
        {'title': 'Daily habits for fat loss', 'items': [
            'Eat protein with every meal.',
            'Drink plenty of water.',
            'Walk regularly.',
            'Get enough sleep.',
            'Keep a sustainable calorie deficit if weight loss is the goal.',
            'Give your muscles time to recover.',
        ]},
        {'title': 'Remember', 'items': [
            "Ab exercises strengthen your stomach, but they can't burn fat from one spot. "
            'Lower-belly and love-handle fat comes off with overall fat loss, strength training and consistency.',
        ]},
    ],
    'safety': 'Stop any exercise that hurts. If you notice abdominal doming, pelvic heaviness or leaking, pause that move and consider a pelvic floor physical therapist.',
    'weeks': weeks,
}

lib.set_programs('home', [program])
lib.save()
print('wrote', program['id'], sum(len(w['days']) for w in weeks), 'days')
