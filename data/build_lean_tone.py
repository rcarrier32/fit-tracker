"""Builds "Lean & Tone: Home Full Body" into data/library.json (programs.lean_tone).

Designed 2026-11-08 for the user's home gear: dumbbells, bench, step/box, bands, PJF heavy
band, BOSU, treadmill. No barbell. 4 days a week, ~45 min, 6 weeks. Exercises run as
paired supersets (A1/A2 …) with a treadmill finisher. Starts at working weights: no
"learning" weeks (the user knows these moves). Every row carries `alternates` (shown first
in the Lift card's Swap menu, like BWS alternates). Validate with:
    node data/check_program.mjs lean_tone_home_6wk --net
"""
import re
from program_builder import Library, ex, w, expand_weeks
from session_prep import pick_cooldown, fill_warmup

lib = Library()
GROUP = 'Move Like 30'
# Every catalog name, including Hip tab exercises (tagged in exercise_tags.json).
KNOWN = {e['name'].lower() for e in lib.data['exercises']} | {t['name'].lower() for t in lib.tags['tags'].values()} | set(lib.providers)

# Moves this plan adds to the catalog (videos via enrich_program_videos.mjs --source lean).
NEW = {
    'Outdoor Sprint Intervals': {'primary_muscle': 'full_body', 'muscles': ['full_body', 'hamstrings', 'glutes'], 'pattern': 'conditioning', 'role': 'conditioning',
                                 'equipment': ['bodyweight'], 'level': 2, 'unilateral': False, 'plane': 'sagittal', 'hip_focus': False},
    'Bike Intervals': {'primary_muscle': 'full_body', 'muscles': ['full_body', 'quads'], 'pattern': 'conditioning', 'role': 'conditioning',
                       'equipment': ['bodyweight'], 'level': 1, 'unilateral': False, 'plane': 'sagittal', 'hip_focus': False},
    'Easy Bike Ride': {'primary_muscle': 'full_body', 'muscles': ['full_body', 'quads'], 'pattern': 'conditioning', 'role': 'conditioning',
                       'equipment': ['bodyweight'], 'level': 1, 'unilateral': False, 'plane': 'sagittal', 'hip_focus': False},
    'Easy Outdoor Run': {'primary_muscle': 'full_body', 'muscles': ['full_body', 'calves'], 'pattern': 'conditioning', 'role': 'conditioning',
                         'equipment': ['bodyweight'], 'level': 1, 'unilateral': False, 'plane': 'sagittal', 'hip_focus': False},
    'Banded Lat Pulldown': {'primary_muscle': 'lats', 'muscles': ['lats', 'biceps', 'upper_back'], 'pattern': 'pull_vertical', 'role': 'secondary',
                            'equipment': ['band'], 'level': 1, 'unilateral': False, 'plane': 'sagittal', 'hip_focus': False},
    'Single-Arm Banded Lat Pulldown': {'primary_muscle': 'lats', 'muscles': ['lats', 'biceps', 'obliques'], 'pattern': 'pull_vertical', 'role': 'secondary',
                            'equipment': ['band'], 'level': 1, 'unilateral': True, 'plane': 'sagittal', 'hip_focus': False},
    'Kettlebell Swing': {'primary_muscle': 'glutes', 'muscles': ['glutes', 'hamstrings', 'lower_back'], 'pattern': 'hinge', 'role': 'power',
                         'equipment': ['kettlebell'], 'level': 2, 'unilateral': False, 'plane': 'sagittal', 'hip_focus': False},
    'Med Ball Slam': {'primary_muscle': 'full_body', 'muscles': ['full_body', 'lats', 'abs'], 'pattern': 'plyo_jump', 'role': 'power',
                      'equipment': ['med_ball'], 'level': 1, 'unilateral': False, 'plane': 'sagittal', 'hip_focus': False},
}
for n, t in NEW.items():
    lib.ensure_exercise(n, 'lean', tags=t, search=f'{n} how to')
KNOWN |= {n.lower() for n in NEW}

# Vernon Griffith's own demos (his public YouTube channel) for moves from his hip plan that fit
# this home setup. Only the move names and public videos: the paid plan itself stays private.
GRIFFITH = {
    'Birddog Dumbbell Row': ('kAu6n0e9bQM', {"primary_muscle": "lats", "muscles": ["lats", "upper_back", "abs", "glutes"], "pattern": "pull_horizontal", "role": "secondary", "equipment": ["dumbbell", "bench"], "level": 2, "unilateral": True, "plane": "sagittal", "hip_focus": False}),
    'Kneeling Dumbbell Diagonal Chop': ('SL4lFwM9BXc', {"primary_muscle": "obliques", "muscles": ["obliques", "abs", "front_delts"], "pattern": "rotation", "role": "core", "equipment": ["dumbbell"], "level": 2, "unilateral": False, "plane": "transverse", "hip_focus": True}),
    'Incline Alternating Arms Dumbbell Press': ('gAcj2x2meNk', {"primary_muscle": "chest", "muscles": ["chest", "front_delts", "triceps", "obliques"], "pattern": "push_horizontal", "role": "secondary", "equipment": ["dumbbell", "bench"], "level": 2, "unilateral": True, "plane": "sagittal", "hip_focus": False}),
    'Contralateral Single Leg Row': ('KyfPBFgRw_o', {"primary_muscle": "lats", "muscles": ["lats", "upper_back", "glutes", "hamstrings"], "pattern": "pull_horizontal", "role": "secondary", "equipment": ["dumbbell"], "level": 2, "unilateral": True, "plane": "transverse", "hip_focus": True}),
    'Dumbbell Row From Single Leg': ('iD3-ypHepUU', {"primary_muscle": "lats", "muscles": ["lats", "upper_back", "glutes", "hamstrings"], "pattern": "pull_horizontal", "role": "secondary", "equipment": ["dumbbell"], "level": 2, "unilateral": True, "plane": "sagittal", "hip_focus": True}),
    'Reverse Step Back Lunge': ('um_OOswiPS4', {"primary_muscle": "quads", "muscles": ["quads", "glutes", "hamstrings"], "pattern": "lunge_single_leg", "role": "secondary", "equipment": ["dumbbell"], "level": 1, "unilateral": True, "plane": "sagittal", "hip_focus": True}),
    'Loaded Lateral Squat': ('w29bT04oiAM', {"primary_muscle": "adductors", "muscles": ["adductors", "quads", "glutes"], "pattern": "squat", "role": "secondary", "equipment": ["dumbbell"], "level": 2, "unilateral": True, "plane": "frontal", "hip_focus": True}),
    'Push Up To Shoulder Airplane': ('Au27fIpfOO0', {"primary_muscle": "chest", "muscles": ["chest", "triceps", "obliques", "rear_delts"], "pattern": "push_horizontal", "role": "secondary", "equipment": ["bodyweight"], "level": 2, "unilateral": False, "plane": "transverse", "hip_focus": False}),
    'Half Kneeling Lateral Bend': ('_JQT4q4nxHM', {"primary_muscle": "obliques", "muscles": ["obliques", "abs", "glutes"], "pattern": "lateral_flexion", "role": "core", "equipment": ["dumbbell"], "level": 1, "unilateral": False, "plane": "frontal", "hip_focus": True}),
    'Pogos': ('P9VR9_Buz48', {"primary_muscle": "calves", "muscles": ["calves", "quads"], "pattern": "plyo_bound_hop", "role": "warmup", "equipment": ["bodyweight"], "level": 1, "unilateral": False, "plane": "sagittal", "hip_focus": False}),
}
# These now live in the TrainHeroic provider file (data/providers/trainheroic.json) with Griffith's
# levels and videos, so drop the old library copies and use them by name (program_builder knows them).
drop = {f'lean-{re.sub(r"[^a-z0-9]+", "-", n.lower()).strip("-")}' for n in GRIFFITH}
lib.data['exercises'] = [e for e in lib.data['exercises'] if e['id'] not in drop]
for i in drop:
    lib.tags['tags'].pop(i, None)
lib.by_name = {k: v for k, v in lib.by_name.items() if v.get('id') not in drop}
for n, (yt, t) in GRIFFITH.items():
    if lib.provider(n) is None:          # not in the provider file: keep a library entry
        e = lib.ensure_exercise(n, 'lean', tags=t)
        e['video_url'] = f'https://youtu.be/{yt}'
KNOWN |= {n.lower() for n in GRIFFITH}

# Home versions of Griffith's landmine / barbell moves (no landmine or barbell at home). Researched
# 2026-11-09: same movement, single-arm or single-leg where possible. No provider demo exists, so these
# are the best stand-in clips; swap in a Griffith/PJF/BWS demo if one turns up.
HOME_ALTS = {
    'Half Kneeling Single Arm Dumbbell Press': ('FToms4U0sbY', {'primary_muscle': 'front_delts', 'muscles': ['front_delts', 'triceps', 'obliques', 'glutes'], 'pattern': 'push_vertical', 'role': 'secondary',
        'equipment': ['dumbbell'], 'level': 1, 'unilateral': True, 'plane': 'sagittal', 'hip_focus': True}),
    'Split Stance Single Arm Dumbbell Press': ('SXPpCD60gow', {'primary_muscle': 'front_delts', 'muscles': ['front_delts', 'triceps', 'obliques'], 'pattern': 'push_vertical', 'role': 'secondary',
        'equipment': ['dumbbell'], 'level': 2, 'unilateral': True, 'plane': 'sagittal', 'hip_focus': False}),
    'FFE Goblet Split Squat Isometric': ('J6A5CquiH9U', {'primary_muscle': 'quads', 'muscles': ['quads', 'glutes', 'adductors', 'hip_flexors'], 'pattern': 'isometric', 'role': 'secondary',
        'equipment': ['dumbbell', 'box'], 'level': 2, 'unilateral': True, 'plane': 'sagittal', 'hip_focus': True, 'progresses_by': 'variation'}),
    'Reverse Lunge to Single Arm Dumbbell Press': ('wko4Q0_onRE', {'primary_muscle': 'quads', 'muscles': ['quads', 'glutes', 'front_delts', 'triceps'], 'pattern': 'lunge_single_leg', 'role': 'secondary',
        'equipment': ['dumbbell'], 'level': 2, 'unilateral': True, 'plane': 'sagittal', 'hip_focus': True}),
    'Goblet Squat to Press': ('p9t5l5NVk9U', {'primary_muscle': 'quads', 'muscles': ['quads', 'glutes', 'front_delts', 'triceps'], 'pattern': 'squat', 'role': 'secondary',
        'equipment': ['dumbbell'], 'level': 2, 'unilateral': False, 'plane': 'sagittal', 'hip_focus': False}),
}
for n, (yt, t) in HOME_ALTS.items():
    e = lib.ensure_exercise(n, 'lean', tags=t)
    e['video_url'] = f'https://youtu.be/{yt}'
KNOWN |= {n.lower() for n in HOME_ALTS}

ALTS = {
    'Dumbbell Goblet Squat': ['Heel Elevated Goblet Squat', 'Dumbbell Sumo Squat', '1¼ Goblet Squat'],
    'Heel Elevated Goblet Squat': ['Dumbbell Goblet Squat', 'Dumbbell Sumo Squat', '1¼ Goblet Squat'],
    'Dumbbell Bench Press': ['Incline Alternating Arms Dumbbell Press', 'Low Incline Dumbbell Press', 'Neutral Grip DB Press', 'Push Ups', 'Band Resisted Push Up'],
    'Dumbbell Romanian Deadlift': ['Single-Leg RDL with Kettlebell', 'Staggered Stance RDL w/ Same Side Load', 'B-Stance RDL', 'Kickstand RDL'],
    'Chest Supported DB Row (lat focus)': ['Birddog Dumbbell Row', '3 Point Dumbbell Row', 'DB Chest Supported Row (mid/upper back)', 'Bent Over 1 Arm Row'],
    'Reverse Lunges': ['Reverse Step Back Lunge', 'Slider Lunge', 'Curtsy Lunge', 'Deficit Reverse Lunge', 'Front Foot Elevated Reverse Lunge', 'Walking Lunges (quad focus)'],
    'Curtsy Lunge': ['Reverse Lunges', 'Deficit Reverse Lunge', 'Dumbbell Lateral Lunge'],
    'Standing Dumbbell Shoulder Press': ['Arnold Press', 'Seated Dumbbell Shoulder Press', 'Shoulder Press'],
    'Palloff Press': ['Kneeling Dumbbell Diagonal Chop', 'Half Kneeling Lateral Bend', 'Core Rotation Pallof Press', 'Anti Rotation ABC\'s'],
    'Copenhagen Side Plank (Knee)': ['Copenhagen Side Plank (Long Lever)', 'Side Plank with Top-Leg Raise'],
    'Copenhagen Side Plank (Long Lever)': ['Copenhagen Side Plank (Knee)', 'Side Plank with Top-Leg Raise'],
    'Sprint 10s/Jog 20s/Walk 40s': ['Outdoor Sprint Intervals', 'Bike Intervals', 'Zone 4 Workout'],
    'Weighted Step-Ups': ['Weighted Step Up with Leg Raise', 'Weighted Side Step-Ups', 'High Box Step Up', 'Lateral Step-Down'],
    '3 Point Dumbbell Row': ['Birddog Dumbbell Row', 'Dumbbell Row From Single Leg', 'Chest Supported DB Row (lat focus)', 'DB Split Stance Row', 'Bent Over 1 Arm Row'],
    'Single-Leg RDL with Kettlebell': ['Single-Leg RDL to Knee Drive', 'Kickstand RDL', 'Dumbbell Romanian Deadlift'],
    'Single-Leg RDL to Knee Drive': ['Single-Leg RDL with Kettlebell', 'Kickstand RDL', 'Dumbbell Romanian Deadlift'],
    'Low Incline Dumbbell Press': ['Incline Alternating Arms Dumbbell Press', 'Dumbbell Bench Press', 'Neutral Grip DB Press', 'Push Ups'],
    'Single-Leg Hip Thrust': ['Dumbbell Hip Thrust', 'Single-Leg Glute Bridge', 'Dumbbell Glute Bridge'],
    'Dumbbell Lateral Raise': ['Lean In Lateral Raise', 'Lateral Raise'],
    'Dead Bug': ['Bird Dog with Ankle Weight or Band', 'RKC Plank'],
    'Side Plank with Top-Leg Raise': ['Half Kneeling Lateral Bend', 'Copenhagen Side Plank (Knee)', 'Banded Side Plank Clamshell'],
    'Zone 2 Low Impact': ['Brisk Walk', 'Easy Outdoor Run', 'Easy Bike Ride'],
    'Bulgarian Split Squat': ['FFE Dumbbell Split Squats', 'FFE Goblet Split Squat Isometric', 'Heel Elevated Split Squat', 'Reverse Lunges', 'Front Foot Elevated Reverse Lunge'],
    'Band Resisted Push Up': ['Push Up To Shoulder Airplane', 'Push Ups', 'Dumbbell Bench Press'],
    'Dumbbell Lateral Lunge': ['Loaded Lateral Squat', 'Adductor Slider Lunge', 'Lateral Lunge', 'Curtsy Lunge'],
    'Bent Over 1 Arm Row': ['Birddog Dumbbell Row', '3 Point Dumbbell Row', 'Bent Over Cross Body Row'],
    'Single-Leg Balance on BOSU / Pad + Weight Pass-Arounds': ['Single-Leg Pad Balance + Ball Catches', 'Weighted Hip Airplane'],
    'Weighted Hip Airplane': ['Single-Leg Balance on BOSU / Pad + Weight Pass-Arounds', 'Hip Airplane (No Support)'],
    'Arnold Press': ['Standing Dumbbell Shoulder Press', 'Seated Dumbbell Shoulder Press'],
    'Hammer Curls': ['Seated Dumbbell Curls', 'Incline Dumbbell Curls', 'Bicep Curl'],
    'Incline DB Overhead Extensions': ['Tricep Extension', 'Close-Grip Push-Ups'],
    'Zone 4 Workout': ['Outdoor Sprint Intervals', 'Bike Intervals', 'Sprint 10s/Jog 20s/Walk 40s'],
    'Hip Flexor Length Under Load': ['Half-Kneeling Hip Flexor Stretch', 'Optional Static Stretch'],
    'Lateral Lunge Length Under Load': ['Optional Adductor Stretch Progressions', 'Wide Stance Length Under Load'],
    'Optional Pigeon Length Under Load': ['Brettzel Stretch', '90/90 Hip Opener'],
    'Wide Stance Length Under Load': ['Lateral Lunge Length Under Load', 'Optional Adductor Stretch Progressions'],
    'Rotational RDL Length Under Load': ['Optional Post Chain Stretch', 'Hamstring Floss'],
    "World's Greatest Stretch": ['Front Chain Stretch w/ Reach and Tu', 'Half Kneeling Thoracic Rotations'],
    'Half Kneeling Thoracic Rotations': ["World's Greatest Stretch", 'Lateral Line Stretch'],
    '7/11 Breathing': ['Posterior Pelvic Tilt Breathing', 'Sidelying Grounding'],
    'Banded Glute Bridge': ['Dumbbell Glute Bridge', 'Single-Leg Glute Bridge'],
    'Mini Band Monster Walk': ['Resistance Band Side Steps'],
    'Band Pull-Aparts': ['Bent Over Dumbbell Face Pulls', 'Band Pull Apart'],
    'Dumbbell Sumo Squat': ['Kettlebell Swing', 'Dumbbell Goblet Squat', '1¼ Goblet Squat'],
    'Band Pullover': ['Banded Lat Pulldown', 'Single-Arm Banded Lat Pulldown', 'Bent Over 1 Arm Row'],
    'Banded Lat Pulldown': ['Single-Arm Banded Lat Pulldown', 'Band Pullover'],
    'Single-Arm Banded Lat Pulldown': ['Banded Lat Pulldown', 'Band Pullover'],
    'Lateral Bounds': ['Lateral Hops', 'Double Lateral Extensive Hops', 'Mutli-direction Bounds'],
    'Mutli-direction Bounds': ['Lateral Bounds', 'Lateral Hops'],
    '1¼ Goblet Squat': ['Dumbbell Goblet Squat', 'Heel Elevated Goblet Squat', 'Bulgarian Split Squat'],
    'B-Stance RDL': ['Single-Leg RDL with Kettlebell', 'Dumbbell Romanian Deadlift', 'Staggered Stance RDL w/ Same Side Load'],
    'DB Split Stance Row': ['Contralateral Single Leg Row', 'Birddog Dumbbell Row', '3 Point Dumbbell Row', 'Bent Over 1 Arm Row'],
    'Weighted Step Up with Leg Raise': ['Weighted Step-Ups', 'Weighted Side Step-Ups', 'Lateral Step-Down'],
    'Lean In Lateral Raise': ['Dumbbell Lateral Raise', 'Lateral Raise'],
    'Banded Bridge Hold Abductions': ['Glute Bridge Hold', 'Banded Glute Bridge'],
    'Single-Leg Hip Thrust Hold': ['Glute Bridge Hold', 'Single-Leg Hip Thrust'],
    'Squat Hold': ['Dumbbell Sumo Squat', 'Dumbbell Goblet Squat'],
    'Slider Hamstring Curl': ['Single-Leg Slider Hamstring Curl', 'Dumbbell Lying Leg Curls', 'Single-Leg Hip Thrust'],
    'Single-Leg Slider Hamstring Curl': ['Slider Hamstring Curl', 'Dumbbell Lying Leg Curls'],
    'Kettlebell Swing': ['Med Ball Slam', 'Penultimate Box Jumps (Optional)', 'KB Swing + Box Jump Contrast', 'Single-Leg RDL with Kettlebell'],
    'Med Ball Slam': ['Kettlebell Swing', 'Penultimate Box Jumps (Optional)', 'MB Rapid Lateral Toss'],
    'MB Rapid Lateral Toss': ['Med Ball Slam'],
    '90/90 Copenhagen': ['Copenhagen Side Plank (Knee)', 'Side Bridge Adductor Scissor', 'Copenhagen Straight Leg'],
    'Copenhagen Straight Leg': ['90/90 Copenhagen', 'Copenhagen Side Plank (Long Lever)', 'Dynamic Copenhagen'],
    'Dynamic Copenhagen': ['Copenhagen Straight Leg', 'Copenhagen Side Plank (Long Lever)'],
    'Hand Supported SLDL Loaded': ['Single-Leg RDL with Kettlebell', 'SLDL With Loaded Hip Flexion', 'B-Stance RDL'],
    'SLDL With Loaded Hip Flexion': ['Hand Supported SLDL Loaded', 'Single-Leg RDL to Knee Drive', 'Single-Leg RDL with Kettlebell'],
    'FFE Dumbbell Split Squats': ['Bulgarian Split Squat', 'FFE Floating Heel', 'FFE Goblet Split Squat Isometric'],
    'FFE Floating Heel': ['FFE Dumbbell Split Squats', 'Dynamic Kettlebell Split Squat Drops', 'Bulgarian Split Squat'],
    'Dumbbell Lateral Squat Drop In': ['Loaded Lateral Squat', 'Dumbbell Lateral Lunge', 'Goblet Squat Drop Step'],
    'Facing Wall Hip Airplane': ['Loaded Hip Airplane', 'Weighted Hip Airplane', 'Single-Leg Balance on BOSU / Pad + Weight Pass-Arounds'],
    'Loaded Hip Airplane': ['Facing Wall Hip Airplane', 'Weighted Hip Airplane'],
    'Single Leg Kettlebell Swing': ['Kettlebell Swing', 'Explosive Step Up', 'Med Ball Slam'],
    'Kettlebell Loaded Hip Flexor Lift': ['Banded Hip Flexion Using A Medicine Ball', 'Standing Hip Flexion Supported With ISO Hold'],
    'Banded Hip Flexion Using A Medicine Ball': ['Kettlebell Loaded Hip Flexor Lift', 'Standing Hip Flexion Supported With ISO Hold'],
    'Dumbbell Row From Single Leg': ['Contralateral Single Leg Row', 'Birddog Dumbbell Row', '3 Point Dumbbell Row'],
    'Contralateral Single Leg Row': ['Dumbbell Row From Single Leg', 'Birddog Dumbbell Row', 'DB Split Stance Row'],
    'Birddog Dumbbell Row': ['3 Point Dumbbell Row', 'Contralateral Single Leg Row', 'Dumbbell Row From Single Leg', 'Chest Supported DB Row (lat focus)'],
    'Incline Alternating Arms Dumbbell Press': ['Low Incline Dumbbell Press', 'Dumbbell Bench Press', 'Push Up To Shoulder Airplane'],
    'Kneeling Dumbbell Diagonal Chop': ['Palloff Press', 'Half Kneeling Lateral Bend', 'Core Rotation Pallof Press'],
}


def r(name, reps=None, time=None, sets=3, rest='60s', notes=None, group=None):
    row = ex(name, reps=reps, time=time, sets=sets, rest=rest, notes=notes, group=group)
    alts = [a for a in ALTS.get(name, []) if a.lower() in KNOWN]
    if alts:
        row['alternates'] = alts
    return row


# Griffith-style prep, 2 rounds, progressing like his plan: band-assisted → active control → loaded/dynamic.
PREP_NOTE = 'Easy pace: this is the mobility work, built into every session.'
PREP = {
    'lower': {
        1: [w('Banded Hip Distraction Pulling Into Hip Flexion', reps='3 x 5s hold each side', notes=PREP_NOTE),
            w('Hamstring Floss With Knee Flexion', reps='8 each leg'), w('Poliquin Step Down', reps='8 each leg')],
        2: [w('Shin Box Rotation', reps='8', notes=PREP_NOTE), w('Single Leg Hinge To Hip Flexor Drive', reps='6 each leg'),
            w('Poliquin Step Down With TKE', reps='10 each leg')],
        3: [w('Facing Wall Hip Circle Rotations', reps='6 each leg', notes=PREP_NOTE), w('Single Leg Hinge To Hip Flexor Drive', reps='6 each leg'),
            w('Two Leg Drop Into Split Squat', reps='6 each leg')],
    },
    # Full-body days also press and pull: one push and one pull/shoulder move so the upper body is warm too.
    'upper': {
        1: [w('Push-Up To Pike', reps='8'), w('Band Pull-Aparts', reps='15')],
        2: [w('Push Up To Shoulder Airplane', reps='5 each side'), w('Rolling Shoulder Armbar', reps='5 each side', notes='Light kettlebell.')],
        3: [w('Serratus Slides', reps='8'), w('Rolling Shoulder Armbar', reps='5 each side', notes='Light kettlebell.')],
    },
    'power': {
        1: [w('Push-Up To Pike', reps='8', notes=PREP_NOTE), w('Supported Lateral Squat', reps='8 each side'), w('Band Pull-Aparts', reps='15'), w('Pogos', reps='20')],
        2: [w('Dynamic Groin Drift', reps='8', notes=PREP_NOTE), w('Lunge Matrix', reps='6 each leg'), w('Push Up To Shoulder Airplane', reps='5 each side'), w('Lateral Hops', reps='30')],
        3: [w('Star Toe Tap', reps='6 each leg', notes=PREP_NOTE), w('Shin Box Reach And Row', reps='8'), w('Push Up To Shoulder Airplane', reps='5 each side'), w('Lateral Hops', reps='30')],
    },
}
for _kind in PREP.values():          # Griffith's prep: 2 rounds of each move
    for _moves in _kind.values():
        for _m in _moves:
            _m['sets'] = 2


def phase(wk):
    return 1 if wk <= 2 else 2 if wk <= 4 else 3


NOTE = {
    1: 'Weeks 1–2: working weights from day one, 10–12 reps leaving 1–2 in the tank. Pairs run back to back; rest after the pair.',
    2: 'Weeks 3–4: same moves, more reps (12–15) and a 3-second pause at the hardest point of every rep. Same dumbbells: the pause and reps are the progression.',
    3: 'Week 5: single-leg and single-arm versions with isometric holds (one side holds while the other works). Harder without going heavier.',
}
PAUSE = '3-second pause at the bottom of every rep.'


def days(wk):
    p = phase(wk)
    deload = wk == 6
    S = 2 if deload else 3
    s = 2 if deload else 3
    reps = {1: '10-12', 2: '12-15', 3: '12-15'}[p]
    each = {1: '10 each', 2: '12 each', 3: '12 each'}[p]
    pause = PAUSE if p == 2 else None
    rest = '45s' if p == 3 else '60s'
    sprint_rounds = {1: 8, 2: 10, 3: 12}[p] if not deload else 6
    walk = {1: '10:00', 2: '12:00', 3: '15:00'}[p] if not deload else '8:00'
    intervals = {1: 5, 2: 6, 3: 8}[p] if not deload else 4
    z2 = {1: '25:00', 2: '30:00', 3: '30:00'}[p] if not deload else '20:00'
    hold = {1: '20s', 2: '25s', 3: '30s'}[p]
    alt_iso = 'Alternate arms: one dumbbell holds locked out (isometric) while the other works.'
    notes = ['Deload week: half the sets, same weights. Leave fresh.' if deload else NOTE[p]]
    pick = lambda a, b, c: (a, b, c)[p - 1]
    return [
        {'focus': 'Day 1 · Full Body A: Squat, Push, Pull', 'warmup': PREP['lower'][p] + PREP['upper'][p], 'notes': notes, 'exercises': [
            r(pick('Dumbbell Goblet Squat', 'Dumbbell Goblet Squat', '1¼ Goblet Squat'), reps, sets=S, rest=rest, group='Superset A', notes=pause),
            r('Dumbbell Bench Press', reps, sets=S, rest=rest, group='Superset A', notes=alt_iso if p == 3 else pause),
            r(pick('Dumbbell Romanian Deadlift', 'Dumbbell Romanian Deadlift', 'B-Stance RDL'), reps if p < 3 else each + ' leg', sets=S, rest=rest, group='Superset B', notes=pause),
            r(pick('Chest Supported DB Row (lat focus)', 'Chest Supported DB Row (lat focus)', 'Dumbbell Row From Single Leg'), reps if p < 3 else each + ' arm', sets=S, rest=rest,
              group='Superset B', notes='Bench on an incline.' if p < 3 else 'Stand on the leg on the rowing side, hinge, 2-second hold at the top.'),
            r(pick('Reverse Lunges', 'Reverse Lunges', 'Curtsy Lunge'), each + ' leg', sets=s, rest=rest, group='Superset C', notes=pause),
            r('Standing Dumbbell Shoulder Press', reps, sets=s, rest=rest, group='Superset C', notes=alt_iso if p == 3 else None),
            r('Palloff Press', '12 each side', sets=2, rest='30s', group='Superset D', notes='Anchor the band at chest height.') if p == 1 else
            r('Kneeling Dumbbell Diagonal Chop', '10 each side', sets=2, rest='30s', group='Superset D',
              notes='Tall kneeling: dig the dumbbell to the outside hip, then chop it high across the body. Hips stay square.'),
            r(pick('90/90 Copenhagen', 'Copenhagen Straight Leg', 'Dynamic Copenhagen'), reps='6 each side' if p == 3 else None,
              time=None if p == 3 else hold, sets=2, rest='30s', group='Superset D', notes='Each side, top leg on the bench.'),
            r('Sprint 10s/Jog 20s/Walk 40s', f'{sprint_rounds} rounds', sets=1, rest=None, group='Treadmill finisher', notes='10 s fast, 20 s jog, 40 s walk.'),
        ]},
        {'focus': 'Day 2 · Full Body B: Hinge, Single-Leg, Pull', 'warmup': PREP['lower'][p] + [PREP['upper'][p][0], {**w('Banded Lat Pulldown', reps='10 light', notes='Band anchored high: wakes up the lats before the rows and pulldowns.'), 'sets': 2}], 'notes': notes, 'exercises': [
            r('Weighted Step Up with Leg Raise' if p == 3 else 'Weighted Step-Ups', each + ' leg', sets=S, rest=rest, group='Superset A'),
            r(pick('3 Point Dumbbell Row', 'Birddog Dumbbell Row', 'Contralateral Single Leg Row'), each + ' arm', sets=S, rest=rest, group='Superset A'),
            r(pick('Single-Leg RDL with Kettlebell', 'Hand Supported SLDL Loaded', 'SLDL With Loaded Hip Flexion'), each + ' leg', sets=S, rest=rest, group='Superset B', notes=pause),
            r('Incline Alternating Arms Dumbbell Press' if p == 3 else 'Low Incline Dumbbell Press', reps if p < 3 else each + ' arm', sets=S, rest=rest, group='Superset B',
              notes='One arm holds locked out while the other presses.' if p == 3 else pause),
            r('Single-Leg Hip Thrust', each + ' leg', sets=s, rest=rest, group='Superset C',
              notes='Shoulders on the bench.' + (' 3-second squeeze at the top.' if p >= 2 else '')),
            r('Lean In Lateral Raise' if p == 3 else 'Dumbbell Lateral Raise', '15' if p < 3 else '15 each arm', sets=s, rest=rest, group='Superset C'),
            r('Single-Arm Banded Lat Pulldown' if p == 3 else 'Banded Lat Pulldown', '12-15' if p < 3 else '12 each arm', sets=s, rest=rest, group='Superset D',
              notes='Band anchored high in the garage, kneeling. Your vertical pull.'),
            r('Single-Leg Slider Hamstring Curl' if p == 3 else 'Slider Hamstring Curl', each + ' leg' if p == 3 else '12', sets=s, rest=rest, group='Superset D'),
            r('Dead Bug', '10 each side', sets=2, rest='30s', group='Superset E'),
            r('Side Plank with Top-Leg Raise', '8 each side', sets=2, rest='30s', group='Superset E'),
            r('Zone 2 Low Impact', time=walk, sets=1, rest=None, group='Treadmill finisher', notes='Incline walk, conversational pace.'),
        ]},
        {'focus': 'Day 3 · Power, Stability + Bands', 'warmup': PREP['power'][p], 'notes': notes, 'exercises': [
            r('Single Leg Kettlebell Swing' if p == 3 else 'Kettlebell Swing', '8 each leg' if p == 3 else '10', sets=3, rest='0-15s', group='Superset P',
              notes='Full effort. Got a slam ball? Swap to Med Ball Slam (not with a heavy hard med ball).'),
            r('Mutli-direction Bounds' if p == 3 else 'Lateral Bounds', '3 each direction' if p == 3 else ('4 each side' if p == 1 else '5 each side'),
              sets=3, rest='60s', group='Superset P', notes='Stick each landing for a 1-count. Quiet feet.'),
            r(pick('Bulgarian Split Squat', 'FFE Dumbbell Split Squats', 'FFE Floating Heel'), each + ' leg', sets=S, rest=rest, group='Superset A', notes=pause),
            r('Band Resisted Push Up', reps, sets=S, rest=rest, group='Superset A', notes='PJF heavy band across the back.' + (' 3-second hold at the bottom.' if p >= 2 else '')),
            r('Dumbbell Lateral Lunge' if p == 1 else 'Dumbbell Lateral Squat Drop In', each + ' side', sets=S, rest=rest, group='Superset B'),
            r('Band Pullover', '12-15', sets=S, rest=rest, group='Superset B', notes='PJF heavy band anchored high. Second vertical pull.'),
            r(pick('Single-Leg Balance on BOSU / Pad + Weight Pass-Arounds', 'Facing Wall Hip Airplane', 'Loaded Hip Airplane'),
              time='30s' if p == 1 else None, reps=None if p == 1 else '6 each leg', sets=s, rest='30s', group='Superset C',
              notes='On the BOSU.' if p == 1 else 'Slow open and close, pelvis level.'),
            r('Arnold Press', reps, sets=s, rest=rest, group='Superset C', notes=alt_iso if p == 3 else None),
            r('Hammer Curls', '12-15', sets=2, rest='30s', group='Superset D'),
            r('Incline DB Overhead Extensions', '12-15', sets=2, rest='30s', group='Superset D'),
            r('Zone 4 Workout', f'{intervals} rounds', sets=1, rest=None, group='Treadmill finisher', notes='1 min hard, 1 min easy.'),
        ]},
        {'focus': 'Day 4 · Conditioning + Glutes', 'warmup': PREP['lower'][p][:2], 'notes': notes + ['Treadmill first, then the band circuit 3 times through.'], 'exercises': [
            r('Zone 2 Low Impact', time=z2, sets=1, rest=None, group='Treadmill', notes='Incline walk or easy jog, conversational pace.'),
            r(pick('Banded Glute Bridge', 'Banded Bridge Hold Abductions', 'Single-Leg Hip Thrust Hold'), '15' if p == 1 else None,
              time=None if p == 1 else hold, sets=s, rest='0s', group='Band circuit', notes=None if p < 3 else 'Each leg.'),
            r('Mini Band Monster Walk', '10 each way', sets=s, rest='0s', group='Band circuit'),
            r('Banded Hip Flexion Using A Medicine Ball' if p == 3 else 'Kettlebell Loaded Hip Flexor Lift', '6 each leg' if p == 3 else '8 each leg', sets=s, rest='0s', group='Band circuit',
              notes='Hip flexor strength (Griffith): tall posture, lift without leaning back.'),
            r('Band Pull-Aparts', '15', sets=s, rest='0s', group='Band circuit'),
            r('Squat Hold' if p == 3 else 'Dumbbell Sumo Squat', None if p == 3 else '15', time=hold if p == 3 else None, sets=s, rest='60s', group='Band circuit'),
        ]},
    ]


FINISHER_NOTE = 'Outdoors, on a track or on the bike all work: Swap to log it. Bike: add about 25% more time to steady work.'
# Cooldown: PJF's format (length-under-load holds, then 3 min of 7/11 breathing), with the holds
# picked by session_prep.py from what the day worked. Pool order is the flow order: standing and
# kneeling holds first, then the floor, so you end lying down for the breathing.
COOLDOWN_POOL = [
    ('Hip Flexor/Quad Bridge', '45s', 'Each side. PJF\'s couch stretch: back knee down, foot up on the couch or bench. '
     'Level 1 = elbows resting on the couch or bench. Knee pain: use Hip Flexor Length Under Load instead.'),
    ('Hip Flexor Length Under Load', '45s', 'Each side. Slow breaths, sink a little deeper each exhale.'),
    ('Rotational RDL Length Under Load', '45s', 'Each side.'),
    ('Lateral Lunge Length Under Load', '45s', 'Each side.'),
    ('Wide Stance Length Under Load', '45s', None),
    ("World's Greatest Stretch", '30s', 'Each side.'),
    ('Half Kneeling Thoracic Rotations', '30s', 'Each side.'),
    ('Optional Post Chain Stretch', '45s', 'Each side. Hamstrings and calves.'),
    ('Optional Pigeon Length Under Load', '45s', 'Each side.'),
]
# Warm-up top-ups: added only when the day's prep doesn't already reach a muscle it is about to work.
WARMUP_POOL = [
    ('Poliquin Step Down', '8 each leg', None),
    ('Hamstring Floss With Knee Flexion', '8 each leg', None),
    ('Supported Lateral Squat', '8 each side', None),
    ('Push-Up To Pike', '8', None),
    ('Band Pull-Aparts', '15', None),
    ('Banded Lat Pulldown', '10 light', 'Band anchored high.'),
    ('Pogos', '20', None),
]
COOLDOWN_REPORT = []


def add_cooldown(day, n):
    """PJF closes every session the same way: length-under-load holds, then 3 min of 7/11 breathing.
    The holds follow the day's work (session_prep.pick_cooldown)."""
    holds, missing = pick_cooldown(lib, day['exercises'], COOLDOWN_POOL)
    COOLDOWN_REPORT.append((day['focus'], [h[0] for h in holds], missing))
    for name, t, note, _ in holds:
        day['exercises'].append(r(name, time=t, sets=1, rest=None, group='Cooldown', notes=note))
    day['exercises'].append(r('7/11 Breathing', time='3:00', sets=1, rest=None, group='Cooldown',
                              notes='Lie on your back: in through the nose for 7, out for 11.'))
    for x in day['exercises']:
        if (x.get('round_group') or '').lower().startswith('treadmill'):
            x['notes'] = ' '.join(filter(None, [x.get('notes'), FINISHER_NOTE]))
    return day


def match_warmup(day):
    """Griffith's prep stays; anything the day works hard that it doesn't reach gets a top-up move."""
    moves, missing = fill_warmup(lib, day['exercises'], day.get('warmup') or [], WARMUP_POOL)
    for m in moves[len(day.get('warmup') or []):]:
        m.setdefault('time', None)
        m['sets'] = 2
    day['warmup'] = moves
    COOLDOWN_REPORT.append((day['focus'] + ' · warm-up', [m['name'] for m in moves], missing))
    return day


def superset_rest(day):
    """In a superset only the last exercise rests: A1 → straight to A2 (≤15 s), rest after A2."""
    ex_ = day['exercises']
    for i, x in enumerate(ex_):
        g = x.get('round_group') or ''
        nxt = ex_[i + 1] if i + 1 < len(ex_) else None
        if g.startswith('Superset') and nxt and nxt.get('round_group') == g:
            x['rest'] = '0-15s'
            x['notes'] = ' '.join(filter(None, [x.get('notes'), f'Go straight into the next exercise; rest after the pair.']))
    return day


def days_with_rest(wk):
    return [add_cooldown(match_warmup(superset_rest(d)), i) for i, d in enumerate(days(wk), 1)]


program = {
    'id': 'lean_tone_home_6wk',
    'program_name': 'Lean & Tone: Home Full Body',
    'group': GROUP,
    'source': 'Athletic',
    'description': '4 days a week, ~50 min including a PJF-style cooldown matched to the day\'s work, built for a home setup (dumbbells, bench, step, bands, BOSU, treadmill). '
                   'Paired supersets plus a treadmill finisher. Progresses by reps, pauses, isometric holds and single-leg/arm work rather than heavier weight; week 6 deload. Every exercise has swap alternatives.',
    'sessions_per_week': 4, 'session_length_min': 50, 'level': 'Intermediate',
    'equipment': ['Dumbbells', 'Bench', 'Step / box', 'Mini band + long band (PJF heavy band)', 'BOSU', 'Treadmill'],
    'goal': 'Lose fat, keep muscle, look and move athletic.',
    # Sun..Sat: 4 training days, Recovery & Mobility on 2 off days, 1 full rest day.
    'suggested_week': {'days': ['rest', 'train', 'train', 'move30_recovery_mobility', 'train', 'train', 'move30_recovery_mobility'],
                       'labels': {'move30_recovery_mobility': 'Recovery & Mobility'}},
    'weeks': expand_weeks(6, days_with_rest),
}
lib.set_programs('lean_tone', [program])
lib.save()
print('wrote', program['id'])
seen = set()
for focus, names, missing in COOLDOWN_REPORT:
    if (focus, tuple(names)) in seen:
        continue
    seen.add((focus, tuple(names)))
    print(f'  {focus}: {names}' + (f'  NOT COVERED: {missing}' if missing else ''))
