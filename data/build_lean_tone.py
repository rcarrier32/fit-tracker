"""Builds "Lean & Tone: Home Full Body" into data/library.json (programs.lean_tone).

Designed 2026-11-08 for the user's home gear: dumbbells, bench, step/box, bands, PJF heavy
band, BOSU, treadmill. No barbell. 4 days a week, ~45 min, 6 weeks. Exercises run as
paired supersets (A1/A2 …) with a treadmill finisher. Starts at working weights: no
"learning" weeks (the user knows these moves). Every row carries `alternates` (shown first
in the Lift card's Swap menu, like BWS alternates). Validate with:
    node data/check_program.mjs lean_tone_home_6wk --net
"""
from program_builder import Library, ex, w, expand_weeks

lib = Library()
GROUP = 'Move Like 30'
# Every catalog name, including Hip tab exercises (tagged in exercise_tags.json).
KNOWN = {e['name'].lower() for e in lib.data['exercises']} | {t['name'].lower() for t in lib.tags['tags'].values()}

# Moves this plan adds to the catalog (videos via enrich_program_videos.mjs --source lean).
NEW = {
    'Kettlebell Swing': {'primary_muscle': 'glutes', 'muscles': ['glutes', 'hamstrings', 'lower_back'], 'pattern': 'hinge', 'role': 'power',
                         'equipment': ['kettlebell'], 'level': 2, 'unilateral': False, 'plane': 'sagittal', 'hip_focus': False},
    'Med Ball Slam': {'primary_muscle': 'full_body', 'muscles': ['full_body', 'lats', 'abs'], 'pattern': 'plyo_jump', 'role': 'power',
                      'equipment': ['med_ball'], 'level': 1, 'unilateral': False, 'plane': 'sagittal', 'hip_focus': False},
}
for n, t in NEW.items():
    lib.ensure_exercise(n, 'lean', tags=t, search=f'{n} how to')
KNOWN |= {n.lower() for n in NEW}

ALTS = {
    'Dumbbell Goblet Squat': ['Heel Elevated Goblet Squat', 'Dumbbell Sumo Squat', '1¼ Goblet Squat'],
    'Heel Elevated Goblet Squat': ['Dumbbell Goblet Squat', 'Dumbbell Sumo Squat', '1¼ Goblet Squat'],
    'Dumbbell Bench Press': ['Low Incline Dumbbell Press', 'Neutral Grip DB Press', 'Push Ups', 'Band Resisted Push Up'],
    'Dumbbell Romanian Deadlift': ['Single-Leg RDL with Kettlebell', 'Staggered Stance RDL w/ Same Side Load', 'B-Stance RDL', 'Kickstand RDL'],
    'Chest Supported DB Row (lat focus)': ['3 Point Dumbbell Row', 'DB Chest Supported Row (mid/upper back)', 'Bent Over 1 Arm Row'],
    'Reverse Lunges': ['Slider Lunge', 'Curtsy Lunge', 'Deficit Reverse Lunge', 'Front Foot Elevated Reverse Lunge', 'Walking Lunges (quad focus)'],
    'Curtsy Lunge': ['Reverse Lunges', 'Deficit Reverse Lunge', 'Dumbbell Lateral Lunge'],
    'Standing Dumbbell Shoulder Press': ['Arnold Press', 'Seated Dumbbell Shoulder Press', 'Shoulder Press'],
    'Palloff Press': ['Core Rotation Pallof Press', 'Anti Rotation ABC\'s'],
    'Copenhagen Side Plank (Knee)': ['Copenhagen Side Plank (Long Lever)', 'Side Plank with Top-Leg Raise'],
    'Copenhagen Side Plank (Long Lever)': ['Copenhagen Side Plank (Knee)', 'Side Plank with Top-Leg Raise'],
    'Sprint 10s/Jog 20s/Walk 40s': ['Zone 4 Workout'],
    'Weighted Step-Ups': ['Weighted Step Up with Leg Raise', 'Weighted Side Step-Ups', 'High Box Step Up', 'Lateral Step-Down'],
    '3 Point Dumbbell Row': ['Chest Supported DB Row (lat focus)', 'DB Split Stance Row', 'Bent Over 1 Arm Row'],
    'Single-Leg RDL with Kettlebell': ['Single-Leg RDL to Knee Drive', 'Kickstand RDL', 'Dumbbell Romanian Deadlift'],
    'Single-Leg RDL to Knee Drive': ['Single-Leg RDL with Kettlebell', 'Kickstand RDL', 'Dumbbell Romanian Deadlift'],
    'Low Incline Dumbbell Press': ['Dumbbell Bench Press', 'Neutral Grip DB Press', 'Push Ups'],
    'Single-Leg Hip Thrust': ['Dumbbell Hip Thrust', 'Single-Leg Glute Bridge', 'Dumbbell Glute Bridge'],
    'Dumbbell Lateral Raise': ['Lean In Lateral Raise', 'Lateral Raise'],
    'Dead Bug': ['Bird Dog with Ankle Weight or Band', 'RKC Plank'],
    'Side Plank with Top-Leg Raise': ['Copenhagen Side Plank (Knee)', 'Banded Side Plank Clamshell'],
    'Zone 2 Low Impact': ['Brisk Walk'],
    'Bulgarian Split Squat': ['Heel Elevated Split Squat', 'Reverse Lunges', 'Front Foot Elevated Reverse Lunge'],
    'Band Resisted Push Up': ['Push Ups', 'Dumbbell Bench Press'],
    'Dumbbell Lateral Lunge': ['Adductor Slider Lunge', 'Lateral Lunge', 'Curtsy Lunge'],
    'Bent Over 1 Arm Row': ['3 Point Dumbbell Row', 'Bent Over Cross Body Row'],
    'Single-Leg Balance on BOSU / Pad + Weight Pass-Arounds': ['Single-Leg Pad Balance + Ball Catches', 'Weighted Hip Airplane'],
    'Weighted Hip Airplane': ['Single-Leg Balance on BOSU / Pad + Weight Pass-Arounds', 'Hip Airplane (No Support)'],
    'Arnold Press': ['Standing Dumbbell Shoulder Press', 'Seated Dumbbell Shoulder Press'],
    'Hammer Curls': ['Seated Dumbbell Curls', 'Incline Dumbbell Curls', 'Bicep Curl'],
    'Incline DB Overhead Extensions': ['Tricep Extension', 'Close-Grip Push-Ups'],
    'Zone 4 Workout': ['Sprint 10s/Jog 20s/Walk 40s'],
    'Banded Glute Bridge': ['Dumbbell Glute Bridge', 'Single-Leg Glute Bridge'],
    'Mini Band Monster Walk': ['Resistance Band Side Steps'],
    'Band Pull-Aparts': ['Bent Over Dumbbell Face Pulls', 'Band Pull Apart'],
    'Dumbbell Sumo Squat': ['Kettlebell Swing', 'Dumbbell Goblet Squat', '1¼ Goblet Squat'],
    'Band Pullover': ['Band Pull-Aparts', 'Bent Over 1 Arm Row'],
    'Slider Hamstring Curl': ['Single-Leg Slider Hamstring Curl', 'Dumbbell Lying Leg Curls', 'Single-Leg Hip Thrust'],
    'Single-Leg Slider Hamstring Curl': ['Slider Hamstring Curl', 'Dumbbell Lying Leg Curls'],
    'Kettlebell Swing': ['Med Ball Slam', 'Penultimate Box Jumps (Optional)', 'KB Swing + Box Jump Contrast', 'Single-Leg RDL with Kettlebell'],
    'Med Ball Slam': ['Kettlebell Swing', 'Penultimate Box Jumps (Optional)', 'MB Rapid Lateral Toss'],
    'MB Rapid Lateral Toss': ['Med Ball Slam'],
}


def r(name, reps=None, time=None, sets=3, rest='60s', notes=None, group=None):
    row = ex(name, reps=reps, time=time, sets=sets, rest=rest, notes=notes, group=group)
    alts = [a for a in ALTS.get(name, []) if a.lower() in KNOWN]
    if alts:
        row['alternates'] = alts
    return row


WARM_LOWER = [w('Hip Circles', time='30s'), w('Forward Leg Swings', reps='10 each leg'), w('Bodyweight Squat', reps='10'), w('Band Pull-Aparts', reps='15')]
WARM_UPPER = [w('Arm Circles', reps='10 each way'), w('Band Over-and-Backs', reps='10'), w('Band Pull-Aparts', reps='15'), w('Bodyweight Squat', reps='10')]


def phase(wk):
    return 1 if wk <= 2 else 2 if wk <= 4 else 3


NOTE = {
    1: 'Working weights from day one: pick loads that leave 1–2 reps in the tank. Pairs run back to back, rest after the pair.',
    2: 'Heavier than weeks 1–2 at slightly lower reps. Finishers get longer.',
    3: 'Harder variations and shorter rests. Push the pace.',
}


def days(wk):
    p = phase(wk)
    deload = wk == 6
    S = 2 if deload else (4 if p == 3 else 3)          # sets on the main pairs
    s = 2 if deload else 3                              # sets on accessory pairs
    main = {1: '10-12', 2: '8-10', 3: '8-10'}[p]
    rest = '45s' if p == 3 else '60s'
    sprint_rounds = {1: 8, 2: 10, 3: 12}[p] if not deload else 6
    walk = {1: '10:00', 2: '12:00', 3: '15:00'}[p] if not deload else '8:00'
    intervals = {1: 5, 2: 6, 3: 8}[p] if not deload else 4
    z2 = {1: '25:00', 2: '30:00', 3: '30:00'}[p] if not deload else '20:00'
    squat = 'Heel Elevated Goblet Squat' if p == 3 else 'Dumbbell Goblet Squat'
    lunge = 'Curtsy Lunge' if p == 3 else 'Reverse Lunges'
    cop = 'Copenhagen Side Plank (Long Lever)' if p == 3 else 'Copenhagen Side Plank (Knee)'
    slrdl = 'Single-Leg RDL to Knee Drive' if p == 3 else 'Single-Leg RDL with Kettlebell'
    balance = 'Weighted Hip Airplane' if p == 3 else 'Single-Leg Balance on BOSU / Pad + Weight Pass-Arounds'
    notes = ['Deload week: half the sets, same weights. Leave fresh.' if deload else NOTE[p]]
    return [
        {'focus': 'Day 1 · Full Body A: Squat, Push, Pull', 'warmup': WARM_LOWER, 'notes': notes, 'exercises': [
            r(squat, main, sets=S, rest=rest, group='Superset A'),
            r('Dumbbell Bench Press', main, sets=S, rest=rest, group='Superset A'),
            r('Dumbbell Romanian Deadlift', main, sets=S, rest=rest, group='Superset B'),
            r('Chest Supported DB Row (lat focus)', '10-12', sets=S, rest=rest, group='Superset B', notes='Bench on an incline.'),
            r(lunge, '10 each leg', sets=s, rest=rest, group='Superset C'),
            r('Standing Dumbbell Shoulder Press', '10', sets=s, rest=rest, group='Superset C'),
            r('Palloff Press', '12 each side', sets=2, rest='30s', group='Superset D', notes='Anchor the band at chest height.'),
            r(cop, time='20s', sets=2, rest='30s', group='Superset D', notes='Each side, top leg on the bench.'),
            r('Sprint 10s/Jog 20s/Walk 40s', f'{sprint_rounds} rounds', sets=1, rest=None, group='Treadmill finisher',
              notes='10 s fast, 20 s jog, 40 s walk.'),
        ]},
        {'focus': 'Day 2 · Full Body B: Hinge, Single-Leg, Press', 'warmup': WARM_LOWER, 'notes': notes, 'exercises': [
            r('Weighted Step-Ups', '10 each leg', sets=S, rest=rest, group='Superset A'),
            r('3 Point Dumbbell Row', '10 each arm', sets=S, rest=rest, group='Superset A'),
            r(slrdl, '8 each leg', sets=S, rest=rest, group='Superset B'),
            r('Low Incline Dumbbell Press', main, sets=S, rest=rest, group='Superset B'),
            r('Single-Leg Hip Thrust', '12 each leg', sets=s, rest=rest, group='Superset C', notes='Shoulders on the bench.'),
            r('Dumbbell Lateral Raise', '15', sets=s, rest=rest, group='Superset C'),
            r('Band Pullover', '12', sets=s, rest=rest, group='Superset D', notes='PJF heavy band anchored high: your vertical pull (no pull-up bar).'),
            r('Single-Leg Slider Hamstring Curl' if p == 3 else 'Slider Hamstring Curl', '8 each leg' if p == 3 else '10', sets=s, rest=rest, group='Superset D'),
            r('Zone 2 Low Impact', time=walk, sets=1, rest=None, group='Treadmill finisher', notes='Incline walk, conversational pace.'),
        ]},
        {'focus': 'Day 3 · Stability + Bands', 'warmup': WARM_UPPER, 'notes': notes, 'exercises': [
            r('Kettlebell Swing', '12' if p == 3 else '10', sets=3, rest='45s', group='Power',
              notes='Full effort, then rest. Got a slam ball? Swap to Med Ball Slam (not with a heavy hard med ball).'),
            r('Bulgarian Split Squat', '8 each leg', sets=S, rest=rest, group='Superset A'),
            r('Band Resisted Push Up', '10', sets=S, rest=rest, group='Superset A', notes='PJF heavy band across the back.'),
            r('Dumbbell Lateral Lunge', '8 each side', sets=S, rest=rest, group='Superset B'),
            r('Bent Over 1 Arm Row', '12 each arm', sets=S, rest=rest, group='Superset B', notes='PJF heavy band.'),
            r(balance, time='30s' if p < 3 else None, reps='5 each leg' if p == 3 else None, sets=s, rest='30s', group='Superset C',
              notes='On the BOSU.' if p < 3 else 'Slow open and close, pelvis level.'),
            r('Arnold Press', '10', sets=s, rest=rest, group='Superset C'),
            r('Hammer Curls', '12', sets=2, rest='30s', group='Superset D'),
            r('Incline DB Overhead Extensions', '12', sets=2, rest='30s', group='Superset D'),
            r('Zone 4 Workout', f'{intervals} rounds', sets=1, rest=None, group='Treadmill finisher', notes='1 min hard, 1 min easy.'),
        ]},
        {'focus': 'Day 4 · Conditioning + Glutes', 'warmup': WARM_LOWER[:2], 'notes': notes + ['Treadmill first, then the band circuit 3 times through.'], 'exercises': [
            r('Zone 2 Low Impact', time=z2, sets=1, rest=None, group='Treadmill', notes='Incline walk or easy jog, conversational pace.'),
            r('Banded Glute Bridge', '15', sets=s, rest='0s', group='Band circuit'),
            r('Mini Band Monster Walk', '10 each way', sets=s, rest='0s', group='Band circuit'),
            r('Band Pull-Aparts', '15', sets=s, rest='0s', group='Band circuit'),
            r('Dumbbell Sumo Squat', '12', sets=s, rest='60s', group='Band circuit'),
        ]},
    ]


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
    return [superset_rest(d) for d in days(wk)]


program = {
    'id': 'lean_tone_home_6wk',
    'program_name': 'Lean & Tone: Home Full Body',
    'group': GROUP,
    'source': 'Athletic',
    'description': '4 days a week, ~45 min, built for a home setup (dumbbells, bench, step, bands, BOSU, treadmill). '
                   'Paired supersets plus a treadmill finisher, heavier each phase, week 6 deload. Every exercise has swap alternatives.',
    'sessions_per_week': 4, 'session_length_min': 45, 'level': 'Intermediate',
    'equipment': ['Dumbbells', 'Bench', 'Step / box', 'Mini band + long band (PJF heavy band)', 'BOSU', 'Treadmill'],
    'goal': 'Lose fat, keep muscle, look and move athletic.',
    'weeks': expand_weeks(6, days_with_rest),
}
lib.set_programs('lean_tone', [program])
lib.save()
print('wrote', program['id'])
