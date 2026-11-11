"""Builds "Basketball Warm-up" into data/library.json (programs.basketball_warmup).

About 10 minutes before an early (5:45) pickup game, for a coach around 40 who sits a lot. RAMP order
(raise, mobilise, activate, potentiate), the structure of the warm-ups with the best injury evidence for
court and field sports (FIFA 11+, and basketball versions of it: roughly a third fewer lower-limb injuries
when done regularly). Single-leg balance is in for ankle sprains, which it prevents better than anything
else here; lateral lunges for the groin; the ramp to full-speed jumps and sprints comes last, because a
cold body at 5:45 needs longer to get there. Starts with two moves at home (the user's low-back reset).

Opened from Today on basketball days (#/routine/basketball_warmup) without changing the active plan.
Every move is already in the app with a vetted demo. Validate with:
    node data/check_program.mjs basketball_warmup
"""
from program_builder import Library, ex

lib = Library()

# The game itself, as an activity the app can log ("Played" on a basketball day): pickup ball is sprints,
# jumps and cuts, so the next day's Daily Mobility and workout treat it as impact work. No demo needed:
# it has no video, so plan generators never pick it.
lib.ensure_exercise('Basketball', 'daily', tags=dict(primary_muscle='quads', muscles=['quads', 'calves', 'glutes'], pattern='agility_cod',
                    role='conditioning', equipment=['bodyweight'], level=2, unilateral=False, plane='frontal', hip_focus=False))


def r(name, reps=None, time=None, sets=1, notes=None, group=None, alts=None, rest=None):
    row = ex(name, reps=reps, time=time, sets=sets, rest=rest, notes=notes, group=group)
    if alts:
        row['alternates'] = alts
    return row


rows = [
    # At home, while the coffee brews: wakes the back up before the drive.
    r('Cat Camel', '7', group='At home', notes='Slow, segment by segment.'),
    r('Split Stance Lunge Overhead Reach with Rotation', '5 each side', group='At home', notes='Tuck the back-leg glute, reach long.'),
    # Raise: warm the tissue.
    r('Easy Outdoor Run', time='2:00', group='Raise', notes='Easy jog around the court, both directions. Slower than you think.',
      alts=['Brisk Walk']),
    r('Extensive Locomotion Cariocas', '1 length each way', group='Raise', notes='Easy rhythm, hips turning.'),
    # Mobilise: the ranges the game uses.
    r("World's Greatest Stretch", '3 each side', group='Mobilise'),
    r('Walking Sprinters Mobility', '6 each side', group='Mobilise'),
    r('Lateral Lunge', '5 each side', group='Mobilise', notes='No band needed. Sit back into the hip: the groin takes the cuts and slides.'),
    r('Hip Airplane (No Support)', '3 each side', group='Mobilise', notes='Slow open and close.'),
    r('Resisted Ankle Circles', '10 each way', group='Mobilise', notes='Each foot, no band.'),
    # Activate: ankles and glutes on.
    r('Single-Leg Balance', time='20s', sets=2, group='Activate', notes='Each side. Balance work prevents ankle sprains better than anything else in a warm-up.'),
    r('Glute Bridge', '10', group='Activate', notes='2 s squeeze at the top.'),
    # Potentiate: build to game speed.
    r('Extensive Locomotive Skips', '1 length', group='Build to game speed', notes='A-skips: knee up, quick off the ground.'),
    r('Pogos', '15', sets=2, rest='20s', group='Build to game speed', notes='Quick and springy off the ankles.'),
    r('Lateral Bounds', '4 each side', group='Build to game speed', rest='30s', notes='No band. Push off one leg, stick the landing on the other for a second.'),
    r('Sprint Accelerations', '10 yd', sets=3, rest='30s', group='Build to game speed', notes='At about 60%, 80%, then 95%. Walk back.'),
]

program = {
    'id': 'basketball_warmup',
    'name': 'Basketball Warm-up',
    'program_name': 'Basketball Warm-up',
    'group': 'Daily',
    'source': 'Daily',
    'description': 'About 10 minutes before an early pickup game: raise, mobilise, activate, then build to game-speed jumps and '
                   'sprints. Opens from Today on basketball days without changing your plan.',
    'sessions_per_week': 2, 'session_length_min': 10, 'level': 'All levels',
    'rotation_note': 'before each game',
    'equipment': ['A court or 15 yards of space'],
    'goal': 'Get game-ready at 5:45 and keep ankles, groin and hamstrings healthy.',
    'guide': [
        {'title': 'Getting up for a 5:45 game', 'items': [
            'Night before: shoes, clothes and water bottle by the door; aim to be asleep 7 hours before the alarm.',
            'Alarm across the room; lights on and a glass of water as soon as you\'re up.',
            'Something small if you like (banana, coffee) and the two at-home moves while it brews.',
            'Play the first 5 minutes at about 70%: your body is coldest early in the morning.']},
    ],
    'days': [{'day_name': 'Basketball warm-up', 'notes': [
        'About 10 minutes. Early morning means a colder body: if you feel stiff, add another lap of the jog and the skips.',
        'Then the first few minutes of the game at about 70%.'], 'exercises': rows}],
}
lib.set_programs('basketball_warmup', [program])
lib.save()
print('wrote', program['id'])
