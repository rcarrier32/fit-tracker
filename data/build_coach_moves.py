"""Adds moves from mobility coaches who train pro athletes to the catalog (classified, with videos).

Research and the user's approval (2026-11-14, "everything proposed"):
docs/research/portia-mitchell-and-similar.md

- Portia Mitchell (FramedFIT, source `framedfit`): read frame by frame from her Facebook reels. Each move
  plays its reel (opens in Facebook, like the Daily Mobility reels); her reels are montages with no
  per-move timestamps, so each move's cues say where in the reel it is.
- Dr. Andreo Spina (Functional Range Conditioning, source `frc`) and Ben Patrick (Knees Over Toes / ATG,
  source `atg`): demos from their own YouTube channels.

These are options, not a plan: once tagged they join the generator's pools, warm-up builder and Swap
lists (same pattern / level neighbours). No plan's own moves change.
Run: python3 data/build_coach_moves.py && node data/check_catalog.mjs
"""
from program_builder import Library

lib = Library()

PORTIA = 'Portia Mitchell (FramedFIT)'
REEL = lambda rid: f'https://www.facebook.com/reel/{rid}'


def T(primary, muscles, pattern, role, equipment, level, unilateral=True, plane='sagittal', hip_focus=True,
      progresses_by='variation'):
    # progresses_by is derived in src/lib/progression.js (variation for warm-up/mobility/balance/isometric moves);
    # kept here as a note of intent, not stored.
    return dict(primary_muscle=primary, muscles=muscles, pattern=pattern, role=role, equipment=equipment, level=level,
                unilateral=unilateral, plane=plane, hip_focus=hip_focus)


# name: (source, video, credit, cues, tags)
MOVES = {
    # ── Portia Mitchell ──
    'Seated Bench Hip Lift-Outs': ('framedfit', REEL('1120461587051506'), PORTIA, [
        'Sit tall on the edge of a bench, arms straight out in front.',
        'Lift one knee as high as you can, take it out to the side, then back and down. Slow, no leaning back.',
        '5-8 each side. The whole reel is this move (her NFL athlete, week 1 vs week 2).'],
        T('hip_flexors', ['hip_flexors', 'glutes', 'abductors', 'abs'], 'mobility', 'warmup', ['bench'], 2, plane='transverse')),
    'Seated Bench Leg Lift-Overs': ('framedfit', REEL('1536781117967222'), PORTIA, [
        'Sit on a bench. Lift one leg up and over onto the bench beside you, then back to the floor.',
        'Stay tall and keep the moving knee bent; control it both ways.',
        '5-8 each side. The whole reel is this move.'],
        T('glutes', ['glutes', 'hip_flexors', 'adductors', 'abductors'], 'mobility', 'warmup', ['bench'], 2, plane='transverse')),
    'BOSU Single-Leg Knee Drive Hold': ('framedfit', REEL('1412761060385011'), PORTIA, [
        'Stand on one leg on a BOSU (or a pad). Drive the other knee up to hip height and hold.',
        'Brace the core first: she shows the wobble stop the moment the core switches on.',
        '20-30 s each side.'],
        T('glutes', ['glutes', 'hip_flexors', 'abs', 'calves'], 'balance', 'warmup', ['bosu_pad'], 2)),
    'BOSU Single-Leg Balance with Kettlebell Foot Hold': ('framedfit', REEL('1161788139355756'), PORTIA, [
        'On one leg on a BOSU, hook a light kettlebell on the toes of the raised foot, knee up.',
        'Hold it level without leaning back. Start very light.',
        '20-30 s each side.'],
        T('hip_flexors', ['hip_flexors', 'glutes', 'abs', 'calves'], 'balance', 'accessory', ['bosu_pad', 'kettlebell'], 3)),
    'BOSU Bottoms-Up Kettlebell Knee Drive': ('framedfit', REEL('2401400023649258'), PORTIA, [
        'On one leg on a BOSU, knee driven up, hold a kettlebell bottoms-up overhead on the same side as the raised knee.',
        'In the reel at 6-8 s.', '20 s each side.'],
        T('glutes', ['glutes', 'hip_flexors', 'abs', 'side_delts'], 'balance', 'accessory', ['bosu_pad', 'kettlebell'], 3)),
    'BOSU Tap-Downs': ('framedfit', REEL('2401400023649258'), PORTIA, [
        'Stand on a BOSU. Slowly lower one foot out to the side to tap the floor (or a ball), then stand back up.',
        'The standing knee stays over the toes; slow down, quick up.', 'In the reel at 9-16 s. 6-8 each side.'],
        T('quads', ['quads', 'glutes', 'abductors'], 'balance', 'accessory', ['bosu_pad'], 2, plane='frontal')),
    'Kettlebell Half-Kneeling Adductor Rock': ('framedfit', REEL('1251238676855212'), PORTIA, [
        'Half-kneeling, the other leg straight out to the side, kettlebell held at the chest.',
        'Rock the hips side to side into the inner thigh, then back.', 'In the reel at 1-4 s. 8 each side.'],
        T('adductors', ['adductors', 'glutes', 'hip_flexors'], 'mobility', 'warmup', ['kettlebell'], 2, plane='frontal')),
    'Kettlebell Lateral Lunge Reach': ('framedfit', REEL('1251238676855212'), PORTIA, [
        'Lateral lunge holding a kettlebell; reach it to the floor beside the bent foot, other leg long.',
        'Push back up through the bent leg.', 'In the reel at 6-11 s (her groin-health series). 6-8 each side.'],
        T('adductors', ['adductors', 'quads', 'glutes'], 'lunge_single_leg', 'secondary', ['kettlebell'], 2, plane='frontal',
          progresses_by='load')),
    'Seated Banded Dorsiflexion': ('framedfit', REEL('1350178646789004'), PORTIA, [
        'Sit with legs long, band around the forefoot held in both hands.',
        'Pull the toes back toward you against the band, then point. Slow.', 'In the reel at 1-6 s. 10-12 each foot.'],
        T('calves', ['calves'], 'mobility', 'warmup', ['band'], 1, hip_focus=False)),
    'Seated Kettlebell Leg Extension Hold': ('framedfit', REEL('1350178646789004'), PORTIA, [
        'Sit on a bench, a light kettlebell hooked on the foot. Straighten the knee and hold the leg up.',
        'Sit tall; don\'t lean back to lift it.', 'In the reel at 29 s. 15-20 s holds, 2-3 each side.'],
        T('quads', ['quads', 'hip_flexors'], 'isometric', 'accessory', ['bench', 'kettlebell'], 2, hip_focus=False)),
    'Tall-Kneeling Kettlebell Hold': ('framedfit', REEL('3355400421328031'), PORTIA, [
        'Tall kneeling on a pad, kettlebell held at the chest.',
        'Squeeze the glutes, ribs down, hips fully forward. Breathe.', 'In the reel at 19 s. 30 s.'],
        T('glutes', ['glutes', 'abs', 'hip_flexors'], 'isometric', 'warmup', ['kettlebell'], 1, unilateral=False)),
    'Standing Banded Hip Flexion': ('framedfit', REEL('3355400421328031'), PORTIA, [
        'Band anchored low behind you around one ankle. Stand tall and drive that knee up against it, hold 2 s, lower slow.',
        'Hold something for balance if needed.', 'In the reel at 40-43 s. 8-10 each side.'],
        T('hip_flexors', ['hip_flexors', 'abs'], 'isolation_lower', 'accessory', ['band'], 2)),

    # ── Dr. Andreo Spina, Functional Range Conditioning ──
    'Hip CARs': ('frc', None, 'Dr. Andreo Spina (FRC)', [
        'Standing tall, holding a rack or wall. Make the biggest, slowest circle you can with one hip: knee up, out to the side, back, and in.',
        'Only the hip moves: brace everything else. Full tension.', '3 slow circles each way, each side.'],
        T('glutes', ['glutes', 'hip_flexors', 'adductors', 'abductors'], 'mobility', 'warmup', ['bodyweight'], 1, plane='transverse')),
    '90/90 Hip Lift-Offs': ('frc', None, 'Dr. Andreo Spina (FRC)', [
        'Sit in 90/90. Keep the torso tall and lift the back knee and foot off the floor, hold 2 s, lower.',
        'Then lift the front shin off the floor. Lean only as much as you need.', '5 each side.'],
        T('glutes', ['glutes', 'hip_flexors', 'abductors'], 'mobility', 'warmup', ['bodyweight'], 2, plane='transverse')),

    # ── Ben Patrick, Knees Over Toes (ATG) ──
    'Tib Raise': ('atg', None, 'Ben Patrick (Knees Over Toes)', [
        'Back against a wall, heels a foot or two out. Lift the toes as high as you can, lower slow.',
        'Further from the wall = harder. Builds the shins that protect the knees.', '2-3 sets of 15-25.'],
        T('calves', ['calves'], 'isolation_lower', 'accessory', ['bodyweight'], 1, unilateral=False, hip_focus=False,
          progresses_by='load')),
    'Patrick Step': ('atg', None, 'Ben Patrick (Knees Over Toes)', [
        'Stand on a low step on one leg. Slowly lower the other heel to the floor in front by letting the knee travel over the toes, then stand back up.',
        'Heel of the standing foot stays down. Start on a very low step.', '2 sets of 10-15 each side.'],
        T('quads', ['quads', 'glutes'], 'lunge_single_leg', 'accessory', ['box'], 1, hip_focus=False, progresses_by='variation')),
}

for name, (src, video, credit, cues, tags) in MOVES.items():
    e = lib.ensure_exercise(name, src, tags=tags)
    if video:
        e['video_url'] = video
        e['video_own'] = True
        e.pop('video_standin', None)
    e['cues'] = cues
    e['credit'] = credit

# Neither coach's own channel has a clean single-move demo, so: FRC-certified coaches for Spina's moves,
# a physio for the tib raise, and Griffith (a provider) for the Patrick step. Picked 2026-11-14.
YT = {
    'Hip CARs': 'https://youtu.be/NNMW_h-fzLg',              # The FARM with Dr. Beau Beard (FRC instructor)
    '90/90 Hip Lift-Offs': 'https://youtu.be/C3SY7eL0WUk',   # The Sustainable Training Method, "FRC 90/90 Hip IR Lift-offs"
    'Tib Raise': 'https://youtu.be/pQcvW08rnAk',             # Physio Room Co, wall tib raise
    'Patrick Step': 'https://youtu.be/XI4NdfD3Xfo',          # Vernon Griffith's Poliquin Step Down: the same move Patrick's step comes from
}
for name, url in YT.items():
    e = lib.by_name[name.lower()]
    e['video_url'] = url
    e['video_own'] = True
    e.pop('video_standin', None)

lib.save()
print('added/updated', len(MOVES), 'coach moves')
