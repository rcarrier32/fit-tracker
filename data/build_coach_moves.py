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
PROFORMANCE = 'Proformance'
REEL = lambda rid: f'https://www.facebook.com/reel/{rid}'
# Her YouTube short of the hip-IR reel (FB 4146226679040642): same four moves, plays in the app.
PF_IR = 'https://youtu.be/iQhEqtez11k'
PF = lambda vid, t: f'https://youtu.be/{vid}' + (f'?t={t}' if t else '')   # her YouTube short, from the move's second


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

    # Second pass through her reels (2026-11-15): 33 of 81 read; these four were new.
    'BOSU Single-Leg Airplane': ('framedfit', REEL('28461603656808078'), PORTIA, [
        'Stand on one leg on a BOSU, arms out to the sides. Hinge forward as the free leg reaches back, then open the hips and chest to the side and back.',
        'Slow; stop the wobble before you move. Hold a wall at first if you need to.', '5 each side.'],
        T('glutes', ['glutes', 'hamstrings', 'abductors', 'abs'], 'balance', 'accessory', ['bosu_pad'], 3, plane='transverse')),
    'BOSU Single-Leg Squat': ('framedfit', REEL('3124315827757447'), PORTIA, [
        'Stand on one leg on a BOSU, the other foot off the dome. Sit back into a shallow squat and stand up.',
        'Knee tracks over the middle toes, no caving in. Only as deep as you can control.', 'In the reel at 9-12 s. 5-6 each side.'],
        T('quads', ['quads', 'glutes', 'abductors'], 'lunge_single_leg', 'accessory', ['bosu_pad'], 3)),
    '90/90 Overhead Dowel Reach': ('framedfit', REEL('923450963851725'), PORTIA, [
        'Sit in 90/90, a dowel, towel or band held overhead with straight arms.',
        'Sit tall, rotate toward the front knee and lean over it, back to the middle, then turn to the back leg.', '5 each way, then switch sides.'],
        T('glutes', ['glutes', 'obliques', 'upper_back', 'hip_flexors'], 'mobility', 'warmup', ['bodyweight'], 2, plane='transverse')),
    'Seated Leg Hurdle Lift-Overs': ('framedfit', REEL('941634598293800'), PORTIA, [
        'Sit on the floor leaning back on your hands, a kettlebell or ball beside one leg.',
        'Lift the straight leg up and over it and back, without rocking the trunk. Add a second "hurdle" as it gets easy.',
        'Proformance\'s short shows it from 11 s (chair-assisted first, then roller height). 6-8 each side.'],
        T('hip_flexors', ['hip_flexors', 'abductors', 'adductors', 'abs'], 'mobility', 'warmup', ['bodyweight'], 2, plane='frontal')),

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

    # ── Proformance (a physical therapist; the user's saved reels, read frame by frame 2026-11-21) ──
    # Hip internal rotation, which she says is what usually limits tight, pinchy hips. Survey of her other
    # reels: docs/research/proformance.md.
    'Bench Pigeon Rotation': ('proformance', REEL('2300750430439720'), PROFORMANCE, [
        'Sit on a bench with one shin across it in front of you, knee out (pigeon), the other foot on the floor.',
        'Lift that knee up and turn it down and in toward the bench (the hip turns in), then back out to pigeon. Slow, sitting tall.',
        'Feet stay wide of your midline as the knee drops in. In the reel at 0-3 s. 6-8 each side.'],
        T('glutes', ['glutes', 'hip_flexors', 'abductors', 'adductors'], 'mobility', 'warmup', ['bench'], 1, plane='transverse')),
    'Side-Lying Hip IR Lift with Roller': ('proformance', PF_IR, PROFORMANCE, [
        'Lie on your side, knees bent, a foam roller or firm pillow between the knees.',
        'Keep the knees on the roller and lift the top foot toward the ceiling (the top hip turns in), hold 2 s, lower slowly.',
        'Pad under the bottom hip and keep sets short on the sore side. Second of the four moves in the clip. 10-12 each side.'],
        T('glutes', ['glutes', 'abductors'], 'isolation_lower', 'accessory', ['bodyweight'], 1, plane='transverse')),
    'Standing Bench Hip Rotations with Med Ball': ('proformance', PF_IR, PROFORMANCE, [
        'Stand facing along a bench with one heel up on it, leg long, a ball held at your chest.',
        'Turn your hips and chest toward the raised leg, then away: the standing hip rotates under you. Stay tall, no leaning.',
        'Third of the four moves in the clip. 8 each way, each side.'],
        T('glutes', ['glutes', 'hip_flexors', 'adductors', 'obliques'], 'mobility', 'warmup', ['bench', 'med_ball'], 2, plane='transverse')),
    'Prone Banded Hip IR': ('proformance', PF_IR, PROFORMANCE, [
        'Lie face down, one knee bent to 90°, a long band from that foot to your hands.',
        'Let the foot fall out to the side (the hip turns in), ease a little further with the band, then bring the foot back to the middle with the hip.',
        'Hips stay flat on the floor. Last of the four moves in the clip. 10 each side.'],
        T('glutes', ['glutes', 'hip_flexors'], 'mobility', 'warmup', ['band'], 1, plane='transverse')),

    # Her survey's best moves (docs/research/proformance.md), the user's "all" (2026-11-21). Each plays her
    # YouTube short from the second the move starts. Read frame by frame where the cues say how.
    'Two-Bench Side Plank with Top-Leg Abduction': ('proformance', PF('LDhUmFAOflY', 0), PROFORMANCE, [
        'Two benches a body-length apart: forearm or hand on one, the bottom shin on the other, hips up in a side plank.',
        'Lift the straight top leg up and lower it slowly, hips stacked and level. The bottom side holds you up.',
        'Her answer to outer-hip pain: the side hip works through its range without being squeezed. Regress: knees on the bench. 8-10 each side.'],
        T('abductors', ['abductors', 'glutes', 'obliques'], 'lateral_flexion', 'accessory', ['bench'], 3, plane='frontal')),
    'Quadruped Abduction Lift-Overs': ('proformance', PF('LDhUmFAOflY', 2), PROFORMANCE, [
        'On hands and knees with a foam roller standing up beside one knee.',
        'Lift that knee out to the side, up and over the roller, tap down on the far side, and back. Hips stay level, no leaning away.',
        'End-range hip opening without lying on the sore side. 6-8 each side.'],
        T('abductors', ['abductors', 'glutes'], 'isolation_lower', 'accessory', ['bodyweight'], 2, plane='frontal')),
    'Cossack Squat': ('proformance', PF('QINs-Pfd-fw', 4), PROFORMANCE, [
        'Wide stance, toes slightly out. Sit down over one leg while the other stays straight, toes up; then shift across to the other side.',
        'Heel of the bent leg stays down, chest up. Hold a post or the bench at first; later a kettlebell at the chest.',
        'Regress (in the clip): a wide squat with hands on the floor, shifting side to side. 5-6 each side.'],
        T('adductors', ['adductors', 'glutes', 'quads'], 'lunge_single_leg', 'secondary', ['bodyweight'], 2, plane='frontal')),
    'Cossack Switches': ('proformance', PF('5hvYmoK3rl0', 0), PROFORMANCE, [
        'Drop into a low Cossack on one side, hands at the chest, then switch to the other side without standing up.',
        'Quick but controlled, like a goalie or a defender sliding: stay low, heels down.',
        '8-10 switches.'],
        T('adductors', ['adductors', 'quads', 'glutes'], 'mobility', 'warmup', ['bodyweight'], 2, plane='frontal')),
    'Seated Straight-Leg Raise with Rotation': ('proformance', PF('InrgFXjTsTE', 7), PROFORMANCE, [
        'Sit tall on the floor, legs straight, hands beside the hips.',
        'Lift one straight leg with the toes turned out, lower; then with the toes turned in, lower. Don\'t lean back.',
        'Hip-flexor strength at short range. 5 each way, each side.'],
        T('hip_flexors', ['hip_flexors', 'quads', 'abs'], 'isolation_lower', 'accessory', ['bodyweight'], 2, plane='sagittal')),
    'Hip Flexor + IR Combo': ('proformance', PF('bTbeSTI5ZHc', 7), PROFORMANCE, [
        'Sit with one leg straight in front and the other bent behind you to the side (back hip turned in, like the back leg of a 90/90).',
        'Hands at the chest, sit tall and lift the straight front leg, then lower it. The back hip holds its turned-in position.',
        'Active hip internal rotation under load. 8 each side.'],
        T('hip_flexors', ['hip_flexors', 'glutes', 'abs'], 'mobility', 'accessory', ['bodyweight'], 2, plane='transverse')),
    'Bench IR Knee Taps': ('proformance', PF('1zXtCNDtZE8', 11), PROFORMANCE, [
        'Sit on the end of a bench with one foot up on it, knee bent, and the other leg long and wide to the floor.',
        'Drop the bent knee down and in toward the bench (the hip turns in), then lift it back up. Sit tall.',
        'Feet stay wide so the knee drops in without crossing over. 10 each side.'],
        T('glutes', ['glutes', 'hip_flexors', 'adductors'], 'mobility', 'warmup', ['bench'], 1, plane='transverse')),
    'Squat Knee Taps': ('proformance', PF('STBUgwmceFs', 3), PROFORMANCE, [
        'Sit in a deep squat, hands in front for balance.',
        'Drop one knee in toward the floor (that hip turns in), back up, then the other.',
        'Only as deep as the front of the hip stays comfortable. 6 each side.'],
        T('glutes', ['glutes', 'adductors', 'quads'], 'mobility', 'warmup', ['bodyweight'], 2, plane='transverse')),
    'Squat Shifts': ('proformance', PF('STBUgwmceFs', 5), PROFORMANCE, [
        'In a deep squat, shift your weight slowly onto one foot, then across to the other, staying low.',
        'Heels down, chest up. 6 each side.'],
        T('adductors', ['adductors', 'glutes', 'quads'], 'mobility', 'warmup', ['bodyweight'], 1, unilateral=False, plane='frontal')),
    'SI-Joint Band-Traction Side-Lying Rotations': ('proformance', PF('nqpRbvZgTQ0', 0), PROFORMANCE, [
        'Lie on your side, knees bent with a foam roller between them, a long band looped high around the top thigh and anchored behind you so it gently pulls the hip.',
        'Turn the top hip open and closed against that pull, slowly.',
        'For the SI joint and low back. Pad under the bottom hip on the sore side. 12 each side.'],
        T('glutes', ['glutes', 'lower_back', 'hip_flexors'], 'mobility', 'warmup', ['band', 'foam_roller'], 1, plane='transverse')),
    'Weighted Standing Side Bend': ('proformance', PF('lJCvShYI_OA', 7), PROFORMANCE, [
        'Stand tall, a dumbbell or kettlebell in one hand.',
        'Bend sideways toward the weight, then come back up past the middle, ribs and hips stacked, no twisting.',
        'Light weight, smooth range. 10 each side.'],
        T('obliques', ['obliques', 'lower_back'], 'lateral_flexion', 'core', ['dumbbell'], 1, plane='frontal', hip_focus=False,
          progresses_by='load')),
    'Standing Bench Pigeon Hinge': ('proformance', PF('S3QAKuUbWjQ', 3), PROFORMANCE, [
        'Stand at a bench and lay one shin across it in a pigeon, the other leg straight under you, a kettlebell in your hands.',
        'Hinge forward over the shin with a long back, then stand tall. The front hip turns out under load.',
        '8 each side.'],
        T('glutes', ['glutes', 'hip_flexors', 'hamstrings'], 'mobility', 'accessory', ['bench', 'kettlebell'], 2, plane='transverse')),
    # The user's old "Hip Mobility" list, 90/90 series (#13-#17), v215: her progressions short (CD6oMwgpR14) and her
    # "Fix your 90/90" tutorial, read frame by frame 2026-11-22. Swaps on the 90/90 rows, not extra rows.
    '90/90 Switch (Controlled)': ('proformance', PF('x8oCRELbUdg', 0), PROFORMANCE, [
        'Sit in 90/90, hands behind you to take pressure off. Turn the front hip to start the switch; the back leg follows.',
        'Slow, both knees over to the other side, keep the hips down. Her tutorial: feel the hips working, not momentum.',
        'Your "90/90 rotations / swing-through". 5 each way.'],
        T('glutes', ['glutes', 'hip_flexors', 'adductors', 'abductors'], 'mobility', 'warmup', ['bodyweight'], 1, plane='transverse')),
    '90/90 Switch + Hip Thrust': ('proformance', PF('CD6oMwgpR14', 13), PROFORMANCE, [
        'From 90/90, swing both knees through to the other side, then lift the hips up and forward off the floor, squeezing the back glute.',
        'Lower, switch back, thrust again. Third of her four 90/90 progressions (from 13 s).',
        'Your "90/90 lift back". 5 each side.'],
        T('glutes', ['glutes', 'hip_flexors', 'adductors'], 'mobility', 'warmup', ['bodyweight'], 2, plane='transverse')),
    '90/90 Shin Box Get-Up': ('proformance', PF('CD6oMwgpR14', 17), PROFORMANCE, [
        'From 90/90, drive up onto both knees to tall kneeling without using your hands, then sit back down to the other side.',
        'Hands at the chest, hips lead. Last of her four 90/90 progressions (from 17 s). 4-5 each side.'],
        T('glutes', ['glutes', 'quads', 'hip_flexors', 'adductors'], 'mobility', 'warmup', ['bodyweight'], 2, plane='transverse')),
    'Isometric Wall Sit': ('proformance', PF('xNHQup7c2x8', 12), PROFORMANCE, [
        'Back flat on a wall, slide down until the knees are at about 90°, feet hip-width.',
        'Hold, weight through the whole foot. Knees over the middle toes.',
        'For the knees: 3-5 holds of 30-45 s.'],
        T('quads', ['quads', 'glutes'], 'isometric', 'accessory', ['bodyweight'], 1, unilateral=False, hip_focus=False)),
    # The user's old list #11 "Heel clicks" (v215): no saved reel showed it; demo by Driven with Morgan (YouTube).
    '90/90 Heel Clicks': ('coach', 'https://youtu.be/TATEBVUe4ts', 'Driven with Morgan', [
        'Sit in 90/90, hands on the floor behind you.',
        'Lift the back foot off the floor (the back hip turns in) and tap that heel toward the front foot, then lower it. Keep both sit bones down.',
        'Active hip internal rotation. 8 each side, then switch the 90/90.'],
        T('glutes', ['glutes', 'abductors', 'hip_flexors'], 'mobility', 'warmup', ['bodyweight'], 2, plane='transverse')),
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
YT['Seated Leg Hurdle Lift-Overs'] = PF('InrgFXjTsTE', 11)   # Proformance's seated straddle lift-overs: same move, plays in-app
for name, url in YT.items():
    e = lib.by_name[name.lower()]
    e['video_url'] = url
    e['video_own'] = True
    e.pop('video_standin', None)

lib.save()
print('added/updated', len(MOVES), 'coach moves')
