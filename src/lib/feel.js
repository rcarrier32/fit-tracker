/**
 * The finish screen's "How did it feel?": 5 energy levels, and reading the free-text note on the phone
 * (no AI service): soreness, pain and tiredness, and which body areas. Plain module so it runs in node:
 * `node data/check_feel.mjs`.
 *
 * Used by: the finish screen (shows what it read), the "How you've been feeling" card and the
 * lighter-week advice (src/lib/home_extras.js, src/lib/learn.js), and Daily Mobility's adjustment for
 * yesterday (src/lib/daily_adjust.js: sore areas get one more set of their stretches).
 */
export const ENERGY = [
  { v: 1, emoji: '😫', label: 'Drained' },
  { v: 2, emoji: '😕', label: 'Low' },
  { v: 3, emoji: '🙂', label: 'OK' },
  { v: 4, emoji: '😀', label: 'Good' },
  { v: 5, emoji: '💪', label: 'Strong' },
];

/** Energy on the 5-point scale. Check-ins saved before it (1 Drained, 2 OK, 3 Strong) map across. */
export function energyOf(feel) {
  if (!feel) return null;
  if (feel.energy5 != null) return +feel.energy5;
  if (feel.energy != null) return { 1: 1, 2: 3, 3: 5 }[+feel.energy] ?? null;
  return null;
}

/** Areas, in the words people use. Order matters: "hip flexor" before "hip". */
const AREAS = [
  ['hip flexors', /hip[\s-]*flexors?|psoas|front of (?:the |my )?hips?/],
  ['quads', /quads?|quadriceps|front (?:of (?:the |my )?)?(?:thighs?|legs?)|thighs? front/],
  ['hamstrings', /hamstrings?|hammys?|back of (?:the |my )?(?:thighs?|legs?)/],
  ['glutes', /glutes?|butt|backside|piriformis/],
  ['adductors', /adductors?|groin|inner thighs?/],
  ['calves', /calf|calves|achilles|shins?/],
  ['lower back', /low(?:er)? back|lumbar/],
  ['upper back', /upper back|traps?|between (?:the |my )?shoulder blades/],
  ['shoulders', /shoulders?|delts?|rotator/],
  ['chest', /chest|pecs?/],
  ['knees', /knees?(?! up)(?! down)/],
  ['hips', /\bhips?\b/],
  ['neck', /neck/],
  ['arms', /biceps?|triceps?|forearms?|elbows?|wrists?/],
];
const SORE = /sore|soreness|tight|stiff|achy|aching|doms|tender|heavy legs|beat up|fatigued/;
const PAIN = /pain|hurts?|hurting|sharp|pinch|pinching|tweak|strain|pulled|injur|swollen|throbb/;
const TIRED = /tired|exhausted|drained|no energy|low energy|wiped|slept (?:bad|badly|poorly)|bad sleep|little sleep|didn'?t sleep|run down|burnt? out|sick/;
const STRONG = /felt (?:great|strong|good)|strong today|lots of energy|fresh/;

/**
 * What a note says, area by area. "above the knee up to the hip flexor" names the quads and hip
 * flexors, not the knee: a knee only counts when the note says it's the knee that's sore or hurts.
 * @returns { sore: [area], pain: [area], tired, strong }
 */
export function readNote(text) {
  const t = String(text || '').toLowerCase();
  const out = { sore: [], pain: [], tired: TIRED.test(t), strong: STRONG.test(t) };
  if (!t.trim()) return out;
  // Each clause on its own, so "knee feels fine, quads sore" doesn't mark the knee. A clause that only
  // names areas ("quads, hamstrings sore") takes the word from the next clause in its sentence.
  for (const sentence of t.split(/[.;!?\n]/)) {
    const clauses = sentence.split(/,|\bbut\b|\band\b|\bwith\b/).map(c => ({ c, sore: SORE.test(c), pain: PAIN.test(c) }));
    for (let i = clauses.length - 2; i >= 0; i--) if (!clauses[i].sore && !clauses[i].pain) Object.assign(clauses[i], { sore: clauses[i + 1].sore, pain: clauses[i + 1].pain });
    for (const { c, sore, pain } of clauses) {
      if (!sore && !pain) continue;
      let rest = c.replace(/(?:above|below|over|under|from|up to|down to) (?:the |my )?knees?/g, ' ');
      const hit = [];
      for (const [area, re] of AREAS) if (re.test(rest)) { hit.push(area); rest = rest.replace(new RegExp(re.source, 'g'), ' '); }
      if (pain) out.pain.push(...hit); else out.sore.push(...hit);
    }
  }
  out.sore = [...new Set(out.sore)].filter(a => !out.pain.includes(a));
  out.pain = [...new Set(out.pain)];
  return out;
}

/** A check-in that points to a lighter week: too much, Drained/Low, or a tired note. */
export function heavyCheckIn(s) {
  const f = s?.feel || {};
  const e = energyOf(f);
  return f.effort === 'hard' || (e != null && e <= 2) || readNote(s?.note).tired;
}

/** One line for the finish screen: what the app took from the note. */
export function noteSummary(r) {
  const parts = [];
  if (r.sore.length) parts.push(`sore ${r.sore.join(', ')}: Daily Mobility adds a set of stretches for ${r.sore.length > 1 ? 'them' : 'it'} next time`);
  if (r.pain.length) parts.push(`pain in ${r.pain.join(', ')}: it shows on Today's "How you've been feeling" card; if it's sharp or lasts, ease off and get it checked`);
  if (r.tired) parts.push('tired: counts toward the lighter-week advice');
  return parts.length ? 'Read from your note: ' + parts.join('; ') + '.' : '';
}
