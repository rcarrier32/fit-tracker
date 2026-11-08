"""Builds the "Move Like 30" programs into data/library.json (programs.athletic).

Three 6-week programs, each in 3 two-week phases, for staying strong and quick on the
court at 40 after a left-hip labral repair:

  1. Hip Function       3 days/wk  hinge, single-leg, rotation, lateral, Copenhagen every day
  2. Total Body         3 days/wk  full-body strength A/B/C, hip-friendly squat and hinge choices
  3. Court Ready        2 days/wk  landing, deceleration, elastic jumps, change of direction

Run them one at a time, or mix them through a Mixed Week schedule (e.g. Total Body
Mon/Wed/Fri + Court Ready Tue/Thu). Every exercise reuses a catalog entry that already
has a vetted video. Validate with: node data/check_program.mjs <id> --net
"""
from program_builder import Library, ex, w, expand_weeks

GROUP = 'Move Like 30'
lib = Library()

HIP_SAFETY = None   # no hip restrictions: the hip is trained, not protected (the user's call, 2026-11-08)

def phase(wk):
    return 1 if wk <= 2 else 2 if wk <= 4 else 3

PHASE_NOTE = {
    1: 'Phase 1 (weeks 1-2): own the positions. Pick a load you could lift 3-4 more reps with.',
    2: 'Phase 2 (weeks 3-4): add load or the harder version. Leave 2 reps in the tank.',
    3: 'Phase 3 (weeks 5-6): heaviest and most athletic. Leave 1-2 reps in the tank, crisp reps only.',
}

# ── 1. Hip Function ─────────────────────────────────────────────────────────
# Built on the user's own Motion RC + PT hip plan (the Hip tab's Session A/B exercises),
# progressed along the same ladders the Hip tab uses (hip_protocol.js LADDERS).
HIP_WARMUP = [
    w('Banded Distraction for Hip IR', reps='10 each side', notes='Motion RC prep'),
    w('Banded Distraction for Hip ER', reps='10 each side'),
    w('Seated Banded Hip IR', reps='12 each side'),
    w('Quadruped Hip Hikes', reps='10 each side', notes='Pelvic rotation warm-up'),
]

def hip_days(wk):
    p = phase(wk)
    sets = {1: 3, 2: 3, 3: 4}[p]
    pick = lambda *xs: xs[p - 1]
    cop = pick(('Copenhagen Side Plank (Knee)', '20s'), ('Copenhagen Side Plank (Long Lever)', '20s'), ('Copenhagen Side Plank (Long Lever)', '30s'))
    notes = [PHASE_NOTE[p], 'Your Motion RC and PT exercises, progressed each phase. Copenhagen every session; do the side work each side.']
    return [
        {'focus': 'Day 1 · Hinge & Posterior Chain', 'warmup': HIP_WARMUP, 'notes': notes, 'exercises': [
            ex('Single-Leg RDL with Kettlebell' if p < 3 else 'Single-Leg RDL to Knee Drive', '8 each leg', sets=sets, rest='90s',
               notes='Hips square to the floor. Reach long through the back heel.'),
            ex(pick('Elevated Hamstring Bridge', 'Single-Leg Elevated Hamstring Bridge', 'Single-Leg Slider Hamstring Curl'),
               pick('10', '8 each leg', '8 each leg'), sets=3, rest='60s', notes='Heels on a bench or box. Ribs down, squeeze the glutes at the top.'),
            ex('Bulgarian Split Squat', '8 each leg', sets=sets, rest='90s'),
            ex(pick('SL Hip Airplane w/ Foam Roller', 'Hip Airplane (No Support)', 'Weighted Hip Airplane'), '5 each leg', sets=3, rest='60s',
               notes='Slow open and close, pelvis level.'),
            ex(cop[0], time=cop[1], sets=3, rest='45s', notes='Each side.'),
            ex(pick('Banded Hip Flexor March', 'Standing Banded March (No Wall)', 'Standing Banded March (No Wall)'), '10 each side', sets=2, rest='45s'),
            ex('Bird Dog with Ankle Weight or Band', '8 each side', sets=2, rest='30s'),
        ]},
        {'focus': 'Day 2 · Lateral & Adductors', 'warmup': HIP_WARMUP, 'notes': notes, 'exercises': [
            ex('Adductor Slider Lunge', '8 each side', sets=sets, rest='75s', notes='Standing leg bends, the slider leg stays straight.'),
            ex('Side Step-Ups' if p == 1 else 'Weighted Side Step-Ups', '8 each side', sets=sets, rest='75s'),
            ex('Standing Hip Hikes', '10 each side', sets=3, rest='45s', notes='Level the pelvis, then hike the free side.'),
            ex(pick('Banded Side Plank Clamshell', 'Side Plank with Top-Leg Raise', 'Side Plank with Top-Leg Raise'), '8 each side', sets=3, rest='45s'),
            ex('Mini Band Monster Walk', '10 each way', sets=2, rest='45s'),
            ex(cop[0], time=cop[1], sets=3, rest='45s', notes='Each side.'),
            ex('Single Leg Hip IR/ER', '6 each way', sets=2, rest='45s'),
        ]},
        {'focus': 'Day 3 · Single-Leg Strength & Balance', 'warmup': HIP_WARMUP, 'notes': notes, 'exercises': [
            ex('Step Up with Leg Raise' if p == 1 else 'Weighted Step Up with Leg Raise', '8 each leg', sets=sets, rest='75s',
               notes='Drive through the whole foot, then raise the knee to hip height.'),
            ex('Single-Leg Pad Balance + Ball Catches', time='30s', sets=3, rest='30s',
               notes='Each leg, on a BOSU or soft pad. Add a weight pass-around once it is easy.'),
            ex('Posterior Lunge' if p == 1 else 'Deficit Reverse Lunge', '8 each leg', sets=sets, rest='75s'),
            ex('Bridge with Ball Squeeze' if p == 1 else 'Single-Leg Hip Thrust', '12' if p == 1 else '10 each leg', sets=3, rest='60s'),
            ex('Lateral Step-Down', '8 each leg', sets=3, rest='45s', notes='Knee tracks over the middle toes. Slow on the way down.'),
            ex(cop[0], time=cop[1], sets=3, rest='45s', notes='Each side.'),
            ex('Prone Hip Extension', '10 each side', sets=2, rest='30s'),
        ]},
    ]

hip_program = {
    'id': 'move30_hip_function_6wk',
    'program_name': 'Hip Function: 6 Weeks',
    'group': GROUP,
    'source': 'Athletic',
    'description': 'Built on your Motion RC and PT hip exercises (hamstring bridge to single-leg bench bridge, adductor slider lunge, '
                   'airplanes, hip hikes, side plank clamshell, Copenhagen), progressed over three 2-week phases.',
    'sessions_per_week': 3, 'session_length_min': 45, 'level': 'Intermediate',
    'equipment': ['Dumbbells or kettlebell', 'Bench or box', 'Slider', 'Mini band + long band', 'Foam roller', 'BOSU or balance pad', 'Ankle weight (optional)'],
    'goal': 'Move like 30: a strong, mobile hip that is ready for the court.',
    'safety': HIP_SAFETY,
    'weeks': expand_weeks(6, hip_days),
}

# ── 2. Total Body ───────────────────────────────────────────────────────────
TB_WARMUP = [
    w('Walking Sprinters Mobility', reps='5 each side'),
    w('90/90 Hip Opener', reps='5 each side'),
    w('Half Kneeling Thoracic Rotations', reps='6 each side'),
    w('Band Pull-Aparts', reps='15'),
    w('Bodyweight Squat', reps='10'),
]

def tb_days(wk):
    p = phase(wk)
    deload = wk == 6
    main = 2 if deload else {1: 3, 2: 4, 3: 4}[p]
    acc = 2 if deload else 3
    heavy = {1: '6', 2: '5', 3: '4'}[p] if not deload else '5'
    notes = [('Week 6 is a deload: fewer sets at the same weights. Leave the gym fresh.' if deload else PHASE_NOTE[p]),
             'Log the weight for every set. When you hit the top of the rep range on every set, add weight next time.']
    return [
        {'focus': 'Day A · Hinge, Push, Pull', 'warmup': TB_WARMUP, 'notes': notes, 'exercises': [
            ex('Trap Bar Deadlift', heavy, sets=main, rest='2-3 min'),
            ex('Dumbbell Bench Press', '8-10', sets=acc, rest='90s'),
            ex('Chest Supported DB Row (lat focus)', '10-12', sets=acc, rest='75s'),
            ex('Bulgarian Split Squat', '8 each leg', sets=acc, rest='75s'),
            ex('Half Kneeling Landmine Press', '8 each side', sets=2, rest='60s'),
            ex('Copenhagen Side Plank (Knee)', time='20s', sets=2, rest='45s', notes='Each side.'),
            ex('Palloff Press', '10 each side', sets=2, rest='45s'),
        ]},
        {'focus': 'Day B · Squat, Pull-Up, Press', 'warmup': TB_WARMUP, 'notes': notes, 'exercises': [
            ex('Barbell Back Box Squat', heavy, sets=main, rest='2-3 min', notes='Box at or just above parallel. Sit back, pause, drive up.'),
            ex('Lat Pull-Down OR Pull Up', '6-10', sets=acc, rest='90s'),
            ex('Standing Dumbbell Shoulder Press', '8-10', sets=acc, rest='75s'),
            ex('Barbell Hip Thrust', '8-10', sets=acc, rest='75s'),
            ex('Single-Leg RDL with Kettlebell', '8 each leg', sets=2, rest='60s'),
            ex('RKC Plank', time='20s', sets=3, rest='45s'),
        ]},
        {'focus': 'Day C · Single-Leg, Rotation, Carry-Over', 'warmup': TB_WARMUP, 'notes': notes, 'exercises': [
            ex('Weighted Step-Ups', '8 each leg', sets=main, rest='90s'),
            ex('Incline Bench Press', '6-8', sets=acc, rest='2 min'),
            ex('Inverted Row', '8-12', sets=acc, rest='75s'),
            ex('Dumbbell Romanian Deadlift', '8-10', sets=acc, rest='75s'),
            ex('Lateral Lunge', '8 each side', sets=2, rest='60s'),
            ex('Landmine or Dumbbell Rotational Row', '8 each side', sets=2, rest='60s'),
            ex('Standing Weighted Calf Raise', '12-15', sets=3, rest='45s'),
        ]},
    ]

tb_program = {
    'id': 'move30_total_body_6wk',
    'program_name': 'Total Body Strength: 6 Weeks',
    'group': GROUP,
    'source': 'Athletic',
    'description': 'Three full-body days a week: trap bar, box squat and single-leg work, '
                   'plus press, pull and core. Heavier each phase; week 6 deloads.',
    'sessions_per_week': 3, 'session_length_min': 55, 'level': 'Intermediate',
    'equipment': ['Gym: trap bar, barbell, box, bench, dumbbells, cable/landmine, pull-up bar'],
    'goal': 'Full-body strength that carries over to the court, without beating up the hip.',
    'safety': HIP_SAFETY,
    'weeks': expand_weeks(6, tb_days),
}

# ── 3. Court Ready ──────────────────────────────────────────────────────────
COURT_WARMUP = [
    w('Walking Sprinters Mobility', reps='5 each side'),
    w('Hip Mobility ER/IR Skips', reps='2 × 10 yd'),
    w('Extensive Locomotive Skips', reps='2 × 15 yd'),
    w('Backwards Extensive Locomotive Skips', reps='2 × 15 yd'),
    w('Side Shuffle', reps='2 × 10 yd each way'),
]

def court_days(wk):
    p = phase(wk)
    notes = [
        {1: 'Phase 1 (weeks 1-2): landings and stopping. Quiet feet, hips back, knees over toes. Stick every landing.',
         2: 'Phase 2 (weeks 3-4): elastic. Quick off the ground, still in control on landing.',
         3: 'Phase 3 (weeks 5-6): game speed. Full effort on every rep, full rest between them.'}[p],
        'Quality over fatigue: stop a set when reps get slow or sloppy. Do this on fresh legs, before lifting or on its own day.',
    ]
    rest = '60-90s'
    if p == 1:
        linear = [
            ex('Rotational Landing Progressions', '4 each side', sets=3, rest=rest),
            ex('Eccentric Linear Decels', '4', sets=3, rest=rest),
            ex('2 Leg Metronome Plyo Progressions', '10', sets=3, rest=rest),
            ex('Achilles Negative Steps', '6 each leg', sets=2, rest='45s'),
            ex('Sprint Accelerations', '3 × 10 yd at 80%', sets=1, rest='90s'),
        ]
        lateral = [
            ex('Lateral Landing Progressions', '4 each side', sets=3, rest=rest),
            ex('Lateral Split Stance Decels', '4 each side', sets=3, rest=rest),
            ex('Double Lateral Extensive Hops', '8 each way', sets=2, rest=rest),
            ex('Cross Step Change of Direction', '4 each side', sets=3, rest=rest),
            ex('MB Rapid Lateral Toss', '8 each side', sets=2, rest='45s'),
        ]
    elif p == 2:
        linear = [
            ex('Extensive Knee Dominant Jump', '6', sets=3, rest=rest),
            ex('Linear Line Hops', '10 each leg', sets=3, rest=rest),
            ex('Rapid Forward Decels', '4', sets=3, rest=rest),
            ex('Linear 1 Leg Forward Hops', '4 each leg', sets=3, rest=rest),
            ex('Sprint Accelerations', '4 × 15 yd at 90%', sets=1, rest='2 min'),
        ]
        lateral = [
            ex('Lateral Bounds', '4 each side', sets=3, rest=rest, notes='Stick each landing for a 1-count.'),
            ex('Circle Line Hops', '10 each way', sets=2, rest=rest),
            ex('Posterior Lateral Change of Direction', '4 each side', sets=3, rest=rest),
            ex('Cross Step Lateral Push Out', '4 each side', sets=3, rest=rest),
            ex('Metronome Decels', '6', sets=2, rest=rest),
        ]
    else:
        linear = [
            ex('Penultimate Box Jumps (Optional)', '4', sets=3, rest='90s', notes='Step off the box, don\'t jump down.'),
            ex('Hip Loaded Diagonal Jumps', '4 each side', sets=3, rest=rest),
            ex('Short Accel/Decel Progressions', '4', sets=3, rest='90s'),
            ex('Sprint Accelerations', '5 × 20 yd full speed', sets=1, rest='2 min'),
        ]
        lateral = [
            ex('Mutli-direction Bounds', '3 each direction', sets=3, rest='90s'),
            ex('Diagonal Split Lateral Jumps', '4 each side', sets=3, rest=rest),
            ex('Euro Step Freestyles', '6', sets=3, rest=rest),
            ex('Cross Step Change of Direction', '4 each side at game speed', sets=3, rest='90s'),
            ex('MB Rapid Lateral Toss', '8 each side', sets=3, rest='45s'),
        ]
    return [
        {'focus': 'Day 1 · Linear: Land, Jump, Accelerate', 'warmup': COURT_WARMUP, 'notes': notes, 'exercises': linear},
        {'focus': 'Day 2 · Lateral: Cut, Shuffle, Change Direction', 'warmup': COURT_WARMUP, 'notes': notes, 'exercises': lateral},
    ]

court_program = {
    'id': 'move30_court_ready_6wk',
    'program_name': 'Court Ready: Plyo & Agility, 6 Weeks',
    'group': GROUP,
    'source': 'Athletic',
    'description': 'Two short sessions a week for basketball: learn to land and stop, then get springy, then move at game speed. '
                   'Pairs with Total Body or Hip Function on a Mixed Week schedule.',
    'sessions_per_week': 2, 'session_length_min': 35, 'level': 'Intermediate',
    'equipment': ['Court or open floor', 'Low box (12-18")', 'Medicine ball', 'Cones or a line'],
    'goal': 'First step, stops and cuts that feel like 30 again.',
    'safety': None,
    'weeks': expand_weeks(6, court_days),
}

# Warm-up/plan names not in the library proper but in the hip tab resolve at runtime.
lib.ensure_exercise('Bodyweight Squat', 'home')  # already in the catalog; no-op
lib.set_programs('athletic', [hip_program, tb_program, court_program])
lib.save()
print('wrote', ', '.join(p['id'] for p in (hip_program, tb_program, court_program)))
