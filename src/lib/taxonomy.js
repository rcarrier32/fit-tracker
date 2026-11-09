/**
 * Exercise taxonomy helpers for the UI: labels, tag chips, and "similar exercise" ranking.
 * Values and meanings: docs/EXERCISE_TAXONOMY.md. Tags come from data/exercise_tags.json.
 */
import { localFor, playable } from './local_videos.js';

export const PATTERN_LABEL = {
  squat: 'Squat', hinge: 'Hinge', lunge_single_leg: 'Single-leg', push_horizontal: 'Horizontal push',
  push_vertical: 'Vertical push', pull_horizontal: 'Horizontal pull', pull_vertical: 'Vertical pull', carry: 'Carry',
  isolation_upper: 'Upper isolation', isolation_lower: 'Lower isolation', anti_extension: 'Anti-extension',
  anti_rotation: 'Anti-rotation', rotation: 'Rotation', lateral_flexion: 'Side bend', flexion: 'Crunch',
  plyo_jump: 'Jump', plyo_bound_hop: 'Hops & bounds', speed_accel: 'Sprint', agility_cod: 'Agility',
  deceleration_landing: 'Landing & decel', balance: 'Balance', mobility: 'Mobility', isometric: 'Isometric',
  conditioning: 'Conditioning',
};
export const EQUIPMENT_LABEL = {
  bodyweight: 'Bodyweight', dumbbell: 'Dumbbell', kettlebell: 'Kettlebell', barbell: 'Barbell', trap_bar: 'Trap bar',
  band: 'Band', mini_band: 'Mini band', cable: 'Cable', machine: 'Machine', bench: 'Bench', box: 'Box', med_ball: 'Med ball',
  sled: 'Sled', slider: 'Slider', bosu_pad: 'BOSU / pad', pullup_bar: 'Pull-up bar', landmine: 'Landmine', smith: 'Smith', suspension: 'Suspension (TRX)',
};
export { LEVEL_LABEL, progressesBy } from './progression.js';
import { progressesBy } from './progression.js';

/** Same movement, one level easier / harder (for exercises that progress by variation). */
export function levelNeighbors(ex, all) {
  if (!ex?.pattern) return { easier: [], harder: [] };
  const lv = ex.level || 2;
  const same = all.filter(e => e.name !== ex.name && e.pattern === ex.pattern && hasVideo(e) &&
    (e.primary_muscle === ex.primary_muscle || (e.muscles || []).includes(ex.primary_muscle)));
  const near = (L) => rankSimilar(ex, same.filter(e => (e.level || 2) === L), { limit: 4 });
  return { easier: lv > 1 ? near(lv - 1) : [], harder: lv < 3 ? near(lv + 1) : [] };
}

export const muscleLabel = (m) => String(m || '').replace(/_/g, ' ').replace(/\bdelts\b/, 'delts');

/** Filter groups for the exercise picker: label → test on an exercise. */
export const MUSCLE_GROUPS = {
  Chest: ['chest'], Back: ['lats', 'upper_back'], Shoulders: ['front_delts', 'side_delts', 'rear_delts'],
  Arms: ['biceps', 'triceps', 'forearms'], Quads: ['quads'], 'Hams & glutes': ['hamstrings', 'glutes'],
  Hips: ['adductors', 'abductors', 'hip_flexors'], Core: ['abs', 'obliques', 'lower_back'], Calves: ['calves'],
};
export const TYPE_GROUPS = {
  Push: ['push_horizontal', 'push_vertical'], Pull: ['pull_horizontal', 'pull_vertical'], Squat: ['squat'],
  Hinge: ['hinge'], 'Single-leg': ['lunge_single_leg'], Isolation: ['isolation_upper', 'isolation_lower'],
  Core: ['anti_extension', 'anti_rotation', 'rotation', 'lateral_flexion', 'flexion', 'carry'],
  'Plyo & speed': ['plyo_jump', 'plyo_bound_hop', 'speed_accel', 'agility_cod', 'deceleration_landing'],
  'Mobility & balance': ['mobility', 'balance', 'isometric'], Cardio: ['conditioning'],
};

export const hasVideo = (e) => !!(e?.video_url || playable(localFor(e?.name)));

/** Small chips: primary muscle, other muscles, pattern, equipment. Empty for untagged entries. */
export function tagChipsHTML(e) {
  if (!e?.pattern) return '';
  const chip = (t, strong) => `<span style="font-size:11px;padding:3px 8px;border-radius:6px;background:rgba(255,255,255,${strong ? 0.1 : 0.05});color:${strong ? '#e2e8f0' : '#94a3b8'};text-transform:capitalize">${t}</span>`;
  const others = (e.muscles || []).filter(m => m !== e.primary_muscle && m !== 'full_body').slice(0, 3);
  const eq = (e.equipment || []).filter(q => q !== 'bodyweight');
  return [
    chip(muscleLabel(e.primary_muscle), true),
    ...others.map(m => chip(muscleLabel(m))),
    chip(PATTERN_LABEL[e.pattern] || e.pattern),
    ...(eq.length ? eq : ['bodyweight']).map(q => chip(EQUIPMENT_LABEL[q] || q)),
  ].join('');
}

/** One-line summary for compact cards: "Glutes · hamstrings · Hinge". */
export function tagLine(e) {
  if (!e?.pattern) return '';
  const ms = [e.primary_muscle, ...(e.muscles || []).filter(m => m !== e.primary_muscle && m !== 'full_body')].slice(0, 3).map(muscleLabel);
  return `${ms.join(' · ')} · ${PATTERN_LABEL[e.pattern] || e.pattern}`;
}

/**
 * Exercises like `ex`, best first: same pattern + same primary muscle, then same pattern,
 * then same primary muscle. Only ones with a video; equipment you have (if given) ranks higher.
 */
export function rankSimilar(ex, all, { have = null, limit = 12 } = {}) {
  if (!ex) return [];
  const score = (e) => {
    let s = 0;
    if (ex.pattern && e.pattern === ex.pattern) s += 4;
    if (ex.primary_muscle && e.primary_muscle === ex.primary_muscle) s += 3;
    s += (e.muscles || []).filter(m => (ex.muscles || []).includes(m)).length * 0.5;
    if (ex.role && e.role === ex.role) s += 1;
    if (have && (e.equipment || []).every(q => q === 'bodyweight' || have.includes(q))) s += 1.5;
    if (e.unilateral === ex.unilateral) s += 0.25;
    return s;
  };
  return all
    .filter(e => e.name !== ex.name && e.pattern && hasVideo(e))
    .map(e => [score(e), e])
    .filter(([s]) => s >= 3)
    .sort((a, b) => b[0] - a[0] || a[1].name.localeCompare(b[1].name))
    .slice(0, limit)
    .map(([, e]) => e);
}
