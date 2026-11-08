/**
 * Validate the whole exercise catalog against the taxonomy (docs/EXERCISE_TAXONOMY.md).
 *
 *   node data/check_catalog.mjs
 *   node data/check_catalog.mjs --local ~/Documents/fit-tracker-private/pjf-local-videos.json
 *
 * Fails (exit 1) when an exercise (library.json or the hip tab) has no tags or a value
 * outside the taxonomy. Exercises with no video are reported as warnings: with --local,
 * on-device videos count, the same way the phone does.
 */
import { readFileSync } from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');
const flags = process.argv.slice(2);
const LOCAL = flags.includes('--local') ? flags[flags.indexOf('--local') + 1] : null;

export const TAXONOMY = {
  muscles: ['chest', 'lats', 'upper_back', 'rear_delts', 'side_delts', 'front_delts', 'biceps', 'triceps', 'forearms',
    'quads', 'hamstrings', 'glutes', 'adductors', 'abductors', 'hip_flexors', 'calves', 'abs', 'obliques', 'lower_back', 'neck', 'full_body'],
  pattern: ['squat', 'hinge', 'lunge_single_leg', 'push_horizontal', 'push_vertical', 'pull_horizontal', 'pull_vertical', 'carry',
    'isolation_upper', 'isolation_lower', 'anti_extension', 'anti_rotation', 'rotation', 'lateral_flexion', 'flexion',
    'plyo_jump', 'plyo_bound_hop', 'speed_accel', 'agility_cod', 'deceleration_landing', 'balance', 'mobility', 'isometric', 'conditioning'],
  role: ['warmup', 'power', 'main', 'secondary', 'accessory', 'core', 'conditioning', 'cooldown'],
  equipment: ['bodyweight', 'dumbbell', 'kettlebell', 'barbell', 'trap_bar', 'band', 'mini_band', 'cable', 'machine', 'bench', 'box',
    'med_ball', 'sled', 'slider', 'bosu_pad', 'pullup_bar', 'landmine', 'smith', 'suspension'],
  plane: ['sagittal', 'frontal', 'transverse'],
};

export function tagErrors(e) {
  const errs = [];
  const T = TAXONOMY;
  if (!T.muscles.includes(e.primary_muscle)) errs.push(`primary_muscle "${e.primary_muscle}"`);
  if (!Array.isArray(e.muscles) || !e.muscles.length || e.muscles.some(m => !T.muscles.includes(m))) errs.push(`muscles ${JSON.stringify(e.muscles)}`);
  if (!T.pattern.includes(e.pattern)) errs.push(`pattern "${e.pattern}"`);
  if (!T.role.includes(e.role)) errs.push(`role "${e.role}"`);
  if (!Array.isArray(e.equipment) || !e.equipment.length || e.equipment.some(q => !T.equipment.includes(q))) errs.push(`equipment ${JSON.stringify(e.equipment)}`);
  if (![1, 2, 3].includes(e.level)) errs.push(`level ${e.level}`);
  if (typeof e.unilateral !== 'boolean') errs.push('unilateral');
  if (!T.plane.includes(e.plane)) errs.push(`plane "${e.plane}"`);
  if (typeof e.hip_focus !== 'boolean') errs.push('hip_focus');
  return errs;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const lib = JSON.parse(readFileSync(path.join(ROOT, 'data/library.json'), 'utf8'));
  const { HIP_CATALOG_ENTRIES } = await import(path.join(ROOT, 'src/lib/hip_protocol.js'));
  const names = new Set(lib.exercises.map(e => e.name.toLowerCase()));
  const all = [
    ...lib.exercises,
    ...HIP_CATALOG_ENTRIES.filter(h => !names.has(h.name.toLowerCase())).map(h => ({ ...h, ...(lib.extra_tags?.[h.id] || {}) })),
  ];
  const norm = (s) => String(s ?? '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '');
  let local = [];
  if (LOCAL) {
    const buf = readFileSync(LOCAL.replace(/^~/, process.env.HOME));
    let txt = buf.toString('utf8');
    if (txt.includes('�')) txt = buf.toString('latin1');
    const vids = Object.values(JSON.parse(txt).videos || {}).filter(o => o?.name);
    local = vids.filter(o => o.v || o.url || o.yt).map(o => norm(o.name));
    // Private-only exercises (tagged in the file) join the catalog on the phone, so check them too.
    const known = new Set(all.map(e => e.name.toLowerCase()));
    for (const o of vids) {
      if (!o.tags || known.has(o.name.toLowerCase())) continue;
      known.add(o.name.toLowerCase());
      all.push({ id: `private-${o.name}`, name: o.name, video_url: o.yt ? `https://youtu.be/${o.yt}` : o.url || null, ...o.tags });
    }
  }
  const hasLocal = (n) => { const k = norm(n); return local.includes(k) || (k.length >= 12 && local.some(x => x.startsWith(k))); };

  let errors = 0; const noVideo = [];
  for (const e of all) {
    const errs = tagErrors(e);
    if (errs.length) { errors++; console.log(`  ERROR ${e.id} "${e.name}": ${errs.join(', ')}`); }
    if (!e.video_url && !hasLocal(e.name)) noVideo.push(e.name);
  }
  const by = (k) => all.reduce((m, e) => (m[e[k]] = (m[e[k]] || 0) + 1, m), {});
  console.log(`${all.length} exercises · patterns ${Object.keys(by('pattern')).length} · roles ${JSON.stringify(by('role'))}`);
  if (noVideo.length) console.log(`  warn  ${noVideo.length} without a video${LOCAL ? '' : ' (add --local to count on-device PJF videos)'}: ${noVideo.slice(0, 12).join('; ')}${noVideo.length > 12 ? '…' : ''}`);
  console.log(errors ? `\n${errors} exercise(s) with tag errors. Fix in data/exercise_tags.json, then run data/tag_exercises.py.` : '\nOK: every exercise is tagged with taxonomy values.');
  process.exit(errors ? 1 : 0);
}
