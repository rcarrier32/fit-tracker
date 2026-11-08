"""Builds the Beginner At-Home 4-Week plan into data/library.json (programs.home).

Source: a beginner at-home plan document (glutes, lower core, waist, fat loss).
Mon-Sat sessions; Sunday is rest + progress check. Rounds grow by week:
W1 2 (1 is fine), W2 2, W3 3 (3rd optional), W4 3.

Re-run safely: replaces the program and upserts its catalog entries by id.
Videos: entries start with a vetted URL where the library already has one for the
same movement; the rest go through enrich_program_videos.mjs --source home.
"""
import json, re
from pathlib import Path

LIB = Path(__file__).with_name('library.json')
lib = json.loads(LIB.read_text())
by_name = {e['name'].lower(): e for e in lib['exercises']}

def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')

# name -> (primary muscle, muscles, video borrowed from an existing vetted entry or None)
def borrow(name):
    e = by_name.get(name.lower())
    return e and e.get('video_url')

CATALOG = {
    'March in Place':                  ('cardio',     ['cardio', 'hip_flexors'], None),
    'Hip Circles':                     ('hips',       ['hips'], None),
    'Bodyweight Squat':                ('quads',      ['quads', 'glutes'], None),
    'Leg Swings':                      ('hips',       ['hips', 'hamstrings'], borrow('Forward Leg Swings')),
    'Dumbbell Squat':                  ('quads',      ['quads', 'glutes'], borrow('Dumbbell Goblet Squat')),
    'Banded Glute Bridge':             ('glutes',     ['glutes', 'hamstrings'], None),
    'Resistance Band Side Steps':      ('glutes',     ['glutes', 'abductors'], None),
    'Standing Glute Kickback':         ('glutes',     ['glutes'], None),
    'Heel Slides':                     ('abs',        ['abs'], None),
    'Standing Side Crunch':            ('obliques',   ['obliques', 'abs'], None),
    'Dumbbell Sumo Squat':             ('glutes',     ['glutes', 'adductors', 'quads'], None),
    'Dumbbell Glute Bridge':           ('glutes',     ['glutes', 'hamstrings'], None),
    'Donkey Kicks':                    ('glutes',     ['glutes'], None),
    'Fire Hydrants':                   ('glutes',     ['glutes', 'abductors'], None),
    'Side-Lying Leg Raise':            ('glutes',     ['glutes', 'abductors'], borrow('Side Lying Leg Raise')),
    'Banded Clamshell':                ('glutes',     ['glutes', 'abductors'], None),
    'Dumbbell Bent-Over Row':          ('back',       ['back', 'biceps', 'rear_delts'], None),
    'Dumbbell Deadlift':               ('hamstrings', ['hamstrings', 'glutes', 'back'], None),
    'Standing Knee-to-Elbow Crunch':   ('obliques',   ['obliques', 'abs', 'hip_flexors'], None),
    'Brisk Walk':                      ('cardio',     ['cardio'], None),
    'Gentle Full-Body Stretch':        ('mobility',   ['mobility'], None),
}
# Already in the library or the hip tab with vetted videos — referenced by exact name:
# Dumbbell Romanian Deadlift, Dead Bug, Bird Dog, Standing Dumbbell Shoulder Press,
# Pelvic Tilts, Cat-Cow, Modified Side Plank.

SEARCH = {
    'Brisk Walk': '30 minute beginner indoor walking workout',
    'Gentle Full-Body Stretch': '10 minute gentle full body stretch beginner',
}

for name, (prim, muscles, video) in CATALOG.items():
    eid = 'home-' + slug(name)
    entry = by_name.get(name.lower())
    if entry and 'home' not in entry.get('sources', []):
        raise SystemExit(f'{name} already exists in the library; reference it instead')
    if entry is None:
        entry = {'id': eid, 'name': name, 'video_url': None, 'sources': ['home'], 'aliases': []}
        lib['exercises'].append(entry)
        by_name[name.lower()] = entry
    entry.update({
        'fallback_search': 'https://www.youtube.com/results?search_query=' + SEARCH.get(name, name + ' beginner form').replace(' ', '+'),
        'primary_muscle': prim, 'muscles': muscles,
    })
    if video and not entry.get('video_url'):
        entry['video_url'] = video

# ── program ─────────────────────────────────────────────────────────────────
REST = '45-60s'
ROUNDS = {1: 2, 2: 2, 3: 3, 4: 3}
WEEK_NOTE = {
    1: 'Week 1: learn the form. 1 round is fine; do 2 if it feels good.',
    2: 'Week 2: 2 rounds. Aim for consistency, all six sessions.',
    3: 'Week 3: 2-3 rounds. Only add the 3rd round if you feel good.',
    4: 'Week 4: 3 rounds, slow and controlled.',
}
PROGRESS = "Don't raise weight and reps in the same week. Progress one at a time."

def ex(name, reps=None, time=None, notes=None, group='Circuit', rest=REST, sets=None):
    return {'name': name, 'round_group': group, 'is_alternate': False, 'sets': sets,
            'reps': reps, 'weight': None, 'distance': None, 'time': time, 'rest': rest, 'notes': notes}

def w(name, reps=None, time=None, notes=None):
    return {'name': name, 'reps': reps, 'time': time, 'notes': notes}

STD_WARMUP = [w('March in Place', time='2 min'), w('Hip Circles', time='30 sec'),
              w('Bodyweight Squat', reps='10')]

DAYS = [
    {
        'focus': 'Mon · Glutes & Legs',
        'warmup': STD_WARMUP + [w('Leg Swings', reps='10 each leg')],
        'exercises': [
            ex('Dumbbell Squat', '10-12', notes='Hold one dumbbell at your chest, or one in each hand.'),
            ex('Banded Glute Bridge', '15'),
            ex('Dumbbell Romanian Deadlift', '10', notes='Soft knees, push hips back, flat back.'),
            ex('Resistance Band Side Steps', '10 each direction'),
            ex('Standing Glute Kickback', '12 each leg'),
        ],
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
        'exercises': [
            ex('Dumbbell Sumo Squat', '12'),
            ex('Dumbbell Glute Bridge', '15'),
            ex('Donkey Kicks', '12 each leg'),
            ex('Fire Hydrants', '12 each leg'),
            ex('Side-Lying Leg Raise', '15 each leg'),
            ex('Banded Clamshell', '12 each side'),
        ],
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
        circuit = any(e['round_group'] for e in day['exercises'])
        for e in day['exercises']:
            if e['sets'] is None:
                e['sets'] = ROUNDS[wk]
            if e['round_group']:
                e['round_group'] = f'Circuit · {ROUNDS[wk]} rounds'
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
    'description': 'Glutes, lower core, waist and fat loss for a complete beginner. Dumbbells, bands and a mat, 30-45 minutes. Two walking days, Sunday off.',
    'sessions_per_week': 6,
    'session_length_min': 40,
    'level': 'Beginner',
    'equipment': ['Exercise mat', 'Light dumbbells', 'Resistance bands', 'Walking shoes'],
    'safety': 'Stop any exercise that hurts. If you notice abdominal doming, pelvic heaviness or leaking, pause that move and consider a pelvic floor physical therapist.',
    'weeks': weeks,
}

lib['programs']['home'] = [program]
LIB.write_text(json.dumps(lib, indent=2, ensure_ascii=False) + "\n")
print('wrote', program['id'], sum(len(w['days']) for w in weeks), 'days;',
      sum(1 for e in lib['exercises'] if 'home' in e['sources']), 'home catalog entries')
