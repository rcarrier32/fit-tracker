"""Suggest taxonomy tags for an exercise from its name (and existing muscles / category).

    python3 data/suggest_tags.py "Single-Leg RDL with Kettlebell"     # one name
    from suggest_tags import suggest                                    # in build scripts

A first pass only: a person (or Claude) reviews every suggestion before it lands in
data/exercise_tags.json. See docs/EXERCISE_TAXONOMY.md for the values.
"""
import re, sys

MUSCLE_MAP = {'hips': 'glutes', 'spine': 'lower_back', 'mobility': None, 'back': 'lats',
              'mid_back': 'upper_back', 'cardio': 'full_body', 'shoulders': 'front_delts'}

def has(n, *words):
    return any(re.search(w, n) for w in words)

def pattern_of(n, cat=''):
    c = (cat or '').lower()
    if has(n, r'daily overview', r'^circuit$', r'^superset$', r'combo cardio', r'start of workout'):
        return 'header'
    if has(n, r'copenhagen'): return 'isometric'
    if has(n, r'stretch', r'length under load', r'\bopener\b', r'90/90', r'cat.?cow', r'mobility', r'rocker', r'\bcars\b',
           r'ankle circles', r'thoracic', r't.?spine', r'wall rotations', r'knee roll', r'sprinters mobility', r'hip circles',
           r'leg swings', r'distraction', r'grounding', r'pelvic tilt', r'hip shift drill', r'prone hip shift', r'tilt\b'):
        return 'mobility'
    if has(n, r'sprint(?!er)', r'accel', r'first step', r'start first step', r'stationary sprint', r'sprinter cycles', r'resisted acceleration'):
        return 'speed_accel'
    if has(n, r'decel', r'landing', r'\bstick\b', r'negative step', r'split drops'):
        return 'deceleration_landing'
    if has(n, r'shuffle', r'cross ?step', r'crossover', r'change of direction', r'euro step', r'push outs?', r'back ?peddle',
           r'rapid switches', r'side steps?\b(?!.*band)', r'diagonal steps', r'lateral dead start', r'sled drag'):
        return 'agility_cod'
    if has(n, r'\bhops?\b', r'bound', r'skips?\b', r'pogo', r'metronome', r'line hops', r'repeat jumps', r'extensive jumps?'):
        return 'plyo_bound_hop'
    if has(n, r'jump', r'dunk', r'box jump'):
        return 'plyo_jump'
    if has(n, r'\bmb\b', r'med(icine)? ball', r'slam', r'toss', r'throw', r'explosive rotation punch', r'spiral'):
        return 'rotation'
    if has(n, r'farmer', r'suitcase', r'\bcarry'):
        return 'carry'
    if has(n, r'airplane', r'balance', r'pad ', r'single leg motor control', r'eyes closed'):
        return 'balance'
    if has(n, r'\brdl\b', r'romanian'):
        return 'hinge'
    if has(n, r'side.?lying'):
        return 'isolation_lower'
    if has(n, r'side plank', r'oblique flexion', r'lateral flexion', r'lateral tilts', r'side crunch', r'side bend'):
        return 'lateral_flexion'
    if has(n, r'pall?of', r'anti rotation', r'anti-rotation', r'stability row'):
        return 'anti_rotation'
    if has(n, r'plank', r'dead ?bug', r'roll ?out', r'hollow', r'bird ?dog', r'heel slides?', r'flutter'):
        return 'anti_extension'
    if has(n, r'crunch', r'sit.?up', r'leg raise(?!.*side)', r'v.?up', r'knee tuck', r'knee.to.elbow', r'toe touch', r'hanging knee'):
        return 'flexion'
    if has(n, r'external rotation', r'\bir\b.*\ber\b'):
        return 'isolation_upper' if not has(n, r'hip') else 'isolation_lower'
    if has(n, r'leg press(?! calf)', r'squat(?!.*jump)', r'wall sit', r'sissy') and not has(n, r'split squat', r'1 leg', r'single.?leg', r'bulgarian', r'rfess', r'rotational split'):
        return 'squat'
    if has(n, r'woodchop', r'\bchop\b', r'russian twist', r'rip through', r'rotation(?!al (row|press|split|rdl|landing|pogo))', r'rotational (reach|shoulder raise)', r'screwdriver', r'dissociation', r'twist'):
        return 'rotation'
    if has(n, r'\bcurl', r'hammer'):
        return 'isolation_lower' if has(n, r'leg curl', r'hamstring curl', r'nordic', r'slider curl') else 'isolation_upper'
    if has(n, r'tricep', r'pushdown', r'push down', r'skull', r'overhead extension', r'kickback(?!.*glute)'):
        return 'isolation_upper'
    if has(n, r'lateral raise', r'front raise', r'upright row', r'scarecrow', r'\by.?raise', r'shrug', r'\bfly\b', r'flyes?', r'pec.?deck',
           r'external rotation', r'shoulder raise', r'rear delt (?!row)', r'reverse fly'):
        return 'isolation_upper'
    if has(n, r'calf', r'tib', r'ankle', r'leg extension', r'clam', r'abduct', r'adduct', r'fire hydrant', r'side.?lying', r'hip abduction',
           r'side steps', r'monster walk', r'band walks?', r'donkey', r'glute kickback', r'kickbacks?', r'hip ir', r'hip er', r'ir/er', r'hip hikes?', r'step overs?'):
        return 'isolation_lower'
    if has(n, r'lunge', r'split squat', r'step.?ups?', r'step.?downs?', r'curtsy', r'pistol', r'bulgarian', r'rfess', r'single leg full range'):
        return 'lunge_single_leg'
    if has(n, r'pull.?ups?', r'\bchin', r'pull.?down', r'lat pull', r'pullover', r'vertical pull'):
        return 'pull_vertical'
    if has(n, r'\brows?\b', r'face pull', r'pull.?apart', r'inverted row', r'\brow\b'):
        return 'pull_horizontal'
    if has(n, r'overhead press', r'shoulder press', r'military', r'landmine press', r'arnold', r'pike', r'underhand press',
           r'\bpress\b.*(standing|seated|half kneel)', r'(standing|seated|half kneel).*\bpress\b', r'push press', r'clean/press', r'dip press'):
        return 'push_vertical'
    if has(n, r'bench', r'push.?ups?', r'pushup', r'chest press', r'\bdips?\b', r'floor press', r'horizontal press', r'cable press', r'\bpress\b'):
        return 'push_horizontal'
    if has(n, r'lunge', r'split squat', r'step.?ups?', r'step.?downs?', r'curtsy', r'pistol', r'single.?leg squat', r'1 leg .*squat',
           r'bulgarian', r'rfess', r'step through', r'step back', r'forward step', r'single leg full range'):
        return 'lunge_single_leg'
    if has(n, r'deadlift', r'\brdl\b', r'hinge', r'good morning', r'swing', r'thrust', r'bridge', r'hyperextension', r'pull.?through',
           r'back extension', r'hip extension', r'hip lift', r'glute isometric', r'hamstring'):
        return 'hinge'
    if has(n, r'squat', r'leg press', r'wall sit', r'sissy'):
        return 'squat'
    if has(n, r'march', r'\bwalk\b', r'cardio', r'zone \d', r'\bbike\b', r'\bjog', r'stretching', r'burpee', r'jumping jack', r'mountain climber', r'sled push'):
        return 'conditioning'
    if has(n, r'\biso\b', r'isometric', r'\bhold\b'):
        return 'isometric'
    if c:
        if 'mobility' in c or 'stretch' in c: return 'mobility'
        if 'agility' in c: return 'agility_cod'
        if 'speed' in c: return 'speed_accel'
        if 'jump' in c: return 'plyo_bound_hop'
    return 'unknown'

DEFAULT_MUSCLES = {
    'squat': ['quads', 'glutes'], 'hinge': ['hamstrings', 'glutes', 'lower_back'], 'lunge_single_leg': ['quads', 'glutes'],
    'push_horizontal': ['chest', 'triceps', 'front_delts'], 'push_vertical': ['front_delts', 'triceps'],
    'pull_horizontal': ['upper_back', 'lats', 'biceps'], 'pull_vertical': ['lats', 'biceps'], 'carry': ['forearms', 'obliques'],
    'anti_extension': ['abs'], 'anti_rotation': ['obliques', 'abs'], 'rotation': ['obliques', 'abs'], 'lateral_flexion': ['obliques'],
    'flexion': ['abs'], 'plyo_jump': ['quads', 'glutes', 'calves'], 'plyo_bound_hop': ['calves', 'quads', 'glutes'],
    'speed_accel': ['glutes', 'hamstrings', 'quads'], 'agility_cod': ['glutes', 'adductors', 'abductors'],
    'deceleration_landing': ['quads', 'glutes'], 'balance': ['glutes', 'abductors'], 'mobility': ['hip_flexors'],
    'isometric': ['adductors', 'obliques'], 'conditioning': ['full_body'],
}

def muscles_for(n, pattern):
    if has(n, r'copenhagen', r'adduct'): return ['adductors', 'obliques']
    if has(n, r'clam', r'abduct', r'fire hydrant', r'side.?lying', r'side steps', r'monster', r'band walk', r'hip hike'): return ['abductors', 'glutes']
    if has(n, r'calf', r'achilles'): return ['calves']
    if has(n, r'tib'): return ['calves']
    if has(n, r'leg extension', r'sissy'): return ['quads']
    if has(n, r'leg curl', r'hamstring curl', r'nordic'): return ['hamstrings']
    if has(n, r'hamstring'): return ['hamstrings', 'glutes']
    if has(n, r'hip flexor', r'knee drive', r'march', r'psoas'): return ['hip_flexors', 'abs']
    if has(n, r'curl', r'hammer'): return ['biceps', 'forearms']
    if has(n, r'tricep', r'pushdown', r'push down', r'skull', r'overhead extension', r'close.grip', r'dip\b'): return ['triceps', 'chest']
    if has(n, r'lateral raise', r'upright row', r'y.?raise'): return ['side_delts']
    if has(n, r'front raise'): return ['front_delts']
    if has(n, r'rear delt', r'face pull', r'reverse fly', r'scarecrow', r'pull.?apart', r'external rotation', r'post delt'): return ['rear_delts', 'upper_back']
    if has(n, r'shrug'): return ['upper_back']
    if has(n, r'\bfly\b', r'flyes?', r'pec'): return ['chest']
    if has(n, r'thrust', r'bridge', r'kickback', r'donkey', r'glute', r'hyperextension'): return ['glutes', 'hamstrings']
    if has(n, r'lateral lunge', r'cossack'): return ['adductors', 'glutes', 'quads']
    if has(n, r'step.?down', r'step.?up', r'split squat', r'bulgarian', r'heel elevated', r'narrow squat', r'front squat', r'goblet', r'leg press'): return ['quads', 'glutes']
    if has(n, r'sumo'): return ['glutes', 'adductors', 'hamstrings']
    if has(n, r'pull.?ups?', r'\bchin', r'pull.?down', r'lat\b'): return ['lats', 'biceps']
    if has(n, r'shoulder press', r'overhead', r'arnold', r'landmine press', r'military'): return ['front_delts', 'triceps', 'side_delts']
    if pattern == 'mobility':
        if has(n, r't.?spine', r'thoracic', r'shoulder', r'arm', r'wall side', r'over.and.backs', r'windmill'): return ['upper_back', 'rear_delts']
        if has(n, r'ankle', r'toe', r'dorsiflexion', r'plantar', r'calf', r'soleus'): return ['calves']
        if has(n, r'hamstring', r'post chain', r'back line'): return ['hamstrings']
        if has(n, r'adductor', r'wide stance'): return ['adductors']
        return ['hip_flexors', 'glutes']
    return list(DEFAULT_MUSCLES.get(pattern, []))

def equipment_for(n, sources, cat):
    eq = []
    add = lambda *xs: [eq.append(x) for x in xs if x not in eq]
    if has(n, r'dumbbell', r'\bdbs?\b', r'goblet'): add('dumbbell')
    if has(n, r'kettlebell', r'\bkb\b') or (has(n, r'swing') and not has(n, r'leg swing')): add('kettlebell')
    if has(n, r'trap bar'): add('trap_bar')
    if has(n, r'barbell', r'\bbb\b', r'back squat', r'box squat', r'(?<!dumbbell )bench press', r'^hip thrust$', r'sumo deadlift', r'good morning', r'ez bar', r't-bar', r'skullcrush'): add('barbell')
    if has(n, r'arnold', r'hammer', r'concentration', r'lean in lateral', r'21 curls', r'crazy 8', r'spider', r'scarecrow', r'kickstand', r'staggered', r'goblet') and 'dumbbell' not in eq: add('dumbbell')
    if has(n, r'hack squat', r'abduction machine', r'machine'): add('machine')
    if has(n, r'copenhagen'): add('bench')
    if has(n, r'smith'): add('smith')
    if has(n, r'cable', r'pushdown', r'pull.?down', r'face pull', r'pull.?through'): add('cable')
    if has(n, r'leg press', r'pec.?deck', r'(?<!dumbbell lying )leg curl', r'leg extension', r'hyperextension', r'45 degree'): add('machine')
    if has(n, r'mini.?band', r'clam', r'side steps', r'monster', r'band walk', r'banded (glute|hip abduction|side)'): add('mini_band')
    elif has(n, r'\bband', r'resisted', r'distraction') or 'band' in sources: add('band')
    if has(n, r'landmine'): add('landmine')
    if has(n, r'\bbox\b', r'step.?ups?', r'step.?downs?', r'penultimate'): add('box')
    if has(n, r'bench(?! press)', r'bulgarian', r'chest supported', r'incline', r'decline', r'hip thrust', r'seated', r'rfess', r'elevated'): add('bench')
    if has(n, r'\bmb\b', r'med(icine)? ball', r'slam', r'toss'): add('med_ball')
    if has(n, r'sled'): add('sled')
    if has(n, r'slider'): add('slider')
    if has(n, r'bosu', r'\bpad\b', r'slant board'): add('bosu_pad')
    if has(n, r'pull.?ups?', r'\bchin', r'hanging'): add('pullup_bar')
    if has(n, r'ankle weight'): add('ankle_weight') if False else None
    bodyweight_curl = has(n, r'(leg|ring|razor|towel|nordic|swiss ball leg|hamstring|slider) curl')
    if not eq and ((has(n, r'curl') and not bodyweight_curl) or has(n, r'weighted', r'tricep extension', r'zottman', r'tricep dropset')):
        eq = ['dumbbell']
    if has(n, r'preacher') and 'bench' not in eq: eq += ['bench']
    if has(n, r'rope') and 'cable' not in eq: eq = ['cable']
    if not eq: eq = ['bodyweight']
    return eq

def role_for(n, pattern, eq, sources):
    if pattern == 'mobility':
        return 'cooldown' if has(n, r'stretch', r'length under load', r'breathing') else 'warmup'
    if pattern in ('plyo_jump', 'plyo_bound_hop', 'speed_accel', 'agility_cod', 'deceleration_landing'):
        return 'warmup' if has(n, r'skips?\b(?!.*resisted)', r'extensive locomotive', r'mechanics') and not has(n, r'bound') else 'power'
    if pattern == 'rotation' and has(n, r'\bmb\b', r'ball', r'toss', r'slam', r'throw', r'punch'): return 'power'
    if pattern == 'conditioning': return 'conditioning'
    if pattern in ('anti_extension', 'anti_rotation', 'rotation', 'lateral_flexion', 'flexion', 'carry'): return 'core'
    if pattern in ('isolation_upper', 'isolation_lower', 'balance', 'isometric'): return 'accessory'
    if pattern == 'pull_horizontal' and has(n, r'face pull', r'pull.?apart', r'rear delt', r'post delt'): return 'accessory'
    if pattern in ('squat', 'hinge', 'push_horizontal', 'push_vertical', 'pull_vertical', 'pull_horizontal'):
        heavy = any(x in eq for x in ('barbell', 'trap_bar', 'smith')) or has(n, r'pull.?ups?', r'chin.?ups?', r'leg press(?! calf)', r'lat pull.?down$')
        single = has(n, r'single', r'1 leg', r'one leg', r'1 arm', r'one arm', r'kickstand', r'staggered')
        return 'main' if heavy and not single else 'secondary'
    if pattern == 'lunge_single_leg': return 'secondary'
    return 'accessory'

def level_for(n, pattern, role, eq, sources):
    if 'home' in sources or pattern == 'mobility' or has(n, r'bodyweight', r'assisted', r'modified', r'knee\)?$', r'wall'): return 1
    if has(n, r'triple', r'depth', r'altitude', r'max(imal)?\b', r'dunk', r'1 leg .*hop', r'single.?leg.*(hop|bound)', r'intensive',
           r'weighted pull', r'weighted chin', r'long lever', r'no support', r'contrast', r'penultimate', r'velocity'):
        return 3
    if role == 'main' and any(x in eq for x in ('barbell', 'trap_bar')): return 2
    if eq == ['bodyweight'] and pattern in ('anti_extension', 'lateral_flexion', 'flexion', 'isolation_lower'): return 1
    return 2

def suggest(name, sources=(), category='', primary_muscle=None, muscles=None):
    n = name.lower()
    pattern = pattern_of(n, category)
    if pattern == 'header':
        return {'header': True}
    mus = [MUSCLE_MAP.get(m, m) for m in (muscles or [])]
    mus = [m for m in mus if m]
    if not mus or primary_muscle in (None, 'hips', 'mobility', 'spine', 'cardio'):
        mus = muscles_for(n, pattern) or mus
    pm = MUSCLE_MAP.get(primary_muscle, primary_muscle) if primary_muscle not in (None, 'hips', 'mobility', 'spine', 'cardio') else None
    pm = pm or (mus[0] if mus else 'full_body')
    if pm not in mus: mus = [pm] + mus
    eq = equipment_for(n, list(sources), category)
    role = role_for(n, pattern, eq, list(sources))
    uni = has(n, r'single', r'1 leg', r'one leg', r'1 arm', r'one arm', r'split', r'lunge', r'step', r'unilateral', r'kickstand',
              r'staggered', r'bulgarian', r'rfess', r'each', r'side plank', r'copenhagen', r'airplane', r'clam', r'side.?lying', r'curtsy')
    plane = ('frontal' if has(n, r'lateral', r'side', r'abduct', r'adduct', r'copenhagen', r'shuffle', r'cossack', r'clam', r'hydrant')
             else 'transverse' if has(n, r'rotat', r'twist', r'chop', r'pall?of', r'cross', r'90/90', r'\bir\b', r'\ber\b', r'ir/er', r'spiral', r'screwdriver', r'diagonal')
             else 'sagittal')
    hip = ('hip' in sources) or has(n, r'copenhagen', r'airplane', r'90/90', r'\bhip\b', r'clam', r'abduct', r'adduct', r'lateral lunge',
                                     r'single.?leg rdl', r'1 leg rdl', r'hip flexor', r'hydrant', r'cossack', r'hip shift', r'pelvic',
                                     r'step.?down', r'lateral step', r'side step', r'monster', r'band walk', r'curtsy')
    return {'primary_muscle': pm, 'muscles': mus[:4], 'pattern': pattern, 'role': role, 'equipment': eq,
            'level': level_for(n, pattern, role, eq, list(sources)), 'unilateral': bool(uni), 'plane': plane, 'hip_focus': bool(hip)}

if __name__ == '__main__':
    import json
    for name in sys.argv[1:]:
        print(name, json.dumps(suggest(name)))
