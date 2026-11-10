"""Builds "Recovery & Mobility" into data/library.json (programs.recovery).

A two-day rotation for off days, built from what the source programs already do:
- Recovery A = PJF Durability Code's "Recovery + Correctives" day: foam roll, correctives,
  low-level locomotion, a length-under-load hold, Zone 2.
- Recovery B = BWS daily mobility + BWS prehab + the Hip tab's Pelvic Reset breathing, Zone 2.
Run it on off days through a Mixed Week schedule next to a training plan.
"""
from program_builder import Library, ex

lib = Library()
GROUP = 'Move Like 30'
EASY = ['Brisk Walk', 'Easy Bike Ride', 'Easy Outdoor Run', 'Zone 2 Low Impact']


def r(name, reps=None, time=None, sets=1, notes=None, group=None, alts=None):
    row = ex(name, reps=reps, time=time, sets=sets, rest=None, notes=notes, group=group)
    if alts:
        row['alternates'] = alts
    return row


days = [
    {'day_name': 'Recovery A · Foam roll, correctives, easy cardio',
     'notes': ['From PJF\'s recovery day. Everything easy: you should feel better at the end than the start.',
               'Easy cardio: walk, bike or easy jog, conversational pace.'],
     'exercises': [
         r('Optional Foam Roll Circuit', time='5:00', group='Release', notes='Quads, glutes, calves, lats, upper back.', alts=['Foam Roller Circuit']),
         r('Supine Cross Connect', '5 each side', sets=2, group='Correctives'),
         r('Rolling Arm Bar w/ Screwdriver Rotation', '5 each side', sets=2, group='Correctives'),
         r('Walking Sprinters Mobility', '8 each side', sets=2, group='Locomotion'),
         r('Extensive Locomotion Cariocas', time='1:00', sets=2, group='Locomotion', notes='Easy rhythm, both directions.'),
         r('Back Leg Lunge (Peterson Lunge)', '5 each leg', sets=2, group='Locomotion'),
         r('Wide Stance Length Under Load', time='45s', group='Hold'),
         r('Brisk Walk', time='25:00', group='Easy cardio', notes='Or bike/easy run: Swap to log it. Bike about 30 min.', alts=EASY[1:]),
     ]},
    {'day_name': 'Recovery B · Daily mobility, prehab, reset',
     'notes': ['BWS daily mobility + prehab, then your Hip tab\'s Pelvic Reset breathing.',
               'Easy cardio: walk, bike or easy jog, conversational pace.'],
     'exercises': [
         r('Cat Cow', time='1:00', group='Daily mobility'),
         r("World's Greatest Stretch", time='30s', sets=2, group='Daily mobility', notes='Each side.'),
         r('Asian Squat', time='1:00', group='Daily mobility', notes='30 s hold, then 30 s side to side.'),
         r('Wall Side T Spine Opener', time='30s', sets=2, group='Daily mobility', notes='Each side.',
           alts=['Half Kneeling Thoracic Rotations', 'T-Spine Wall Contour']),   # BWS's thoracic rotation, PJF's demo
         r('Wall Slides', '12', group='Daily mobility'),
         r('(Weighted) Prone Arm Circles', '12', sets=2, group='Prehab'),
         r('Banded Hip Abductions', '15', sets=2, group='Prehab'),
         r('Posterior Pelvic Tilt Breathing', '5 breaths', sets=3, group='Reset', alts=['7/11 Breathing', 'Sidelying Grounding']),
         r('Easy Bike Ride', time='30:00', group='Easy cardio', notes='Or walk/easy run: Swap to log it.', alts=['Brisk Walk', 'Easy Outdoor Run', 'Zone 2 Low Impact']),
     ]},
]
program = {
    'id': 'move30_recovery_mobility',
    'name': 'Recovery & Mobility',
    'program_name': 'Recovery & Mobility',
    'group': GROUP,
    'source': 'Athletic',
    'description': 'Two off-day sessions (30-45 min) from PJF\'s recovery day and BWS daily mobility + prehab, plus easy cardio. '
                   'Pair it with a training plan through Today → Set up Mixed Week.',
    'sessions_per_week': 2, 'session_length_min': 40, 'level': 'All levels',
    'recommended_weeks': 6,
    'rotation_note': 'use on off days, alternate A and B',
    'days': days,
}
lib.set_programs('recovery', [program])
lib.save()
print('wrote', program['id'])
