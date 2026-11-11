"""Learn program design patterns from the coach-written programs.

    python3 data/learn_patterns.py            # writes data/learned_patterns.json + docs/LEARNED_PATTERNS.md

Reads every coach-written program (PJF, BWS, Griffith/TrainHeroic, and the user's own BWS
splits), looks each exercise up in data/exercise_index.json for its role / muscle / pattern
tags, and measures what the coaches actually do:

- weekly working sets per muscle, by goal
- sets, reps, holds and rest for each role (main, secondary, accessory, core, power …)
- where each role sits in the session (0 = first, 1 = last)
- how programs progress week to week: exercises kept, sets / reps / hold changes, deloads,
  and how long a block runs before the exercises change
- which movement patterns get paired in supersets

Then it compares the result with data/design_rules.json, so a person can see where the
hand-written rules and the coaches disagree before any rule is changed.

Plans Claude built (Lean & Tone, Move like 30, Beginner At-Home, Hip Plan, Recovery) are left
out on purpose: they were made from the rules, so learning from them would be circular.
Nothing in the app reads this file yet.
"""
import json, re, statistics
from collections import Counter, defaultdict
from pathlib import Path

D = Path(__file__).parent
ROOT = D.parent
OUT = D / 'learned_patterns.json'
REPORT = ROOT / 'docs' / 'LEARNED_PATTERNS.md'

# Coach-written programs and the generator goal each one teaches.
COACH = {
    'pjf_durability_code_prime': 'durability',
    'pjf_fat_dont_fly_phase1': 'fat_loss',
    'pjf_fat_dont_fly_phase2': 'fat_loss',
    'pjf_fat_dont_fly_phase3': 'fat_loss',
    'pjf_extended_band_6wk': 'athletic',
    'bws_3day_full_body': 'muscle',
    'bws_5day_split_v1': 'muscle',
    'bws_4day_upper_lower': 'muscle',
    'bws_5day_split_v3': 'muscle',
    'bws_5day_30min': 'muscle',
    'bws_4day_30min': 'muscle',
    'ryhan_5day_personal': 'muscle',
    'ryhan_4day_personal': 'muscle',
    'ryhan_3day_personal': 'muscle',
    'th_runners_mobility_strength_8wk': 'durability',
    'hoopstudy_8wk_in_season': 'athletic',   # Adam Menner, HoopStudy: in-season basketball (dumbbell strength, speed, jumps)
}
ROLE_ORDER = ['warmup', 'power', 'main', 'secondary', 'accessory', 'core', 'conditioning', 'cooldown']
HEADER = re.compile(r'^(daily overview|start of workout.*overview|superset|circuit|combo cardio)\b', re.I)
med = lambda xs: round(statistics.median(xs), 1) if xs else None


# ── parsing ──────────────────────────────────────────────────────────────────────────────
def clock_secs(s):
    """'00:02:30' / '1:30' / '45' → seconds."""
    parts = [int(p) for p in s.split(':')]
    secs = 0
    for p in parts:
        secs = secs * 60 + p
    return secs


def parse_time(t):
    """'40s', '2 min', '00:05:00', '1:00 min', '45 sec' → seconds, or None."""
    if not t:
        return None
    s = str(t).strip().lower()
    if m := re.match(r'^(\d+(?::\d+){1,2})', s):
        return clock_secs(m.group(1))
    if m := re.match(r'^(\d+(?:\.\d+)?)\s*(?:-\s*(\d+(?:\.\d+)?))?\s*(s|sec|secs|seconds|min|mins|minutes)\b', s):
        lo = float(m.group(1)); hi = float(m.group(2) or lo)
        v = (lo + hi) / 2
        return round(v * 60 if m.group(3).startswith('m') else v)
    return None


def parse_rest(r):
    """Rest in seconds. PJF writes 'WORK REST min' ('00:00:45 1:00 min'); '--:--' means none given."""
    if not r:
        return None
    s = str(r).lower().replace('perform each side', '').strip()
    toks = s.replace('min', '').split()
    if len(toks) >= 2 and re.match(r'^[\d:-]+$', toks[0]):  # PJF two-field form: take the rest field
        s = toks[1] + ' min'
    if '--:--' in s:
        return None
    if re.match(r'^\d+:\d+', s):
        return clock_secs(re.match(r'^(\d+:\d+)', s).group(1))
    return parse_time(s if re.search(r'[a-z]', s) else s + 's')


def parse_reps(r):
    """First rep figure: '8-10 per leg' → 9, '12,12,12' → 12, 'AMRAP' → None."""
    if r is None:
        return None
    s = str(r)
    m = re.match(r'^\s*(?:\d+\s+(?=\d))?(\d+)(?:\s*-\s*(\d+))?', s)  # '3 12,12,12' = sets then reps
    if not m:
        return None
    lo = int(m.group(1)); hi = int(m.group(2) or lo)
    if 'ft' in s or 'yd' in s or ' m' in s.split(',')[0][-3:]:
        return None  # distances
    return (lo + hi) / 2


def rows_of(day):
    out = []
    for x in day.get('exercises', []):
        if x.get('is_alternate') or HEADER.match(x['name']):
            continue
        sets = x.get('sets')
        if x.get('set_targets'):
            sets, reps = len(x['set_targets']), x['set_targets'][0]
        else:
            reps = x.get('reps')
            try:
                sets = int(sets) if sets else 1
            except (TypeError, ValueError):
                sets = 1
        group = x.get('round_group') or x.get('superset')
        out.append({'name': x['name'], 'sets': sets, 'reps': parse_reps(reps), 'hold': parse_time(x.get('time')),
                    'rest': parse_rest(x.get('rest')), 'group': group})
    return out


# ── load ─────────────────────────────────────────────────────────────────────────────────
def load():
    idx = json.loads((D / 'exercise_index.json').read_text())['exercises']
    tags = {e['name'].lower(): e for e in idx}
    lib = json.loads((D / 'library.json').read_text())
    for e in lib['exercises']:
        for a in e.get('aliases') or []:
            if e['name'].lower() in tags:
                tags.setdefault(a.lower(), tags[e['name'].lower()])
    progs = [p for ps in lib['programs'].values() for p in ps]
    for f in sorted((D / 'providers').glob('*.json')):
        progs += json.loads(f.read_text()).get('programs') or []
    progs = [p for p in progs if p.get('id') in COACH]
    rules = json.loads((D / 'design_rules.json').read_text())
    return progs, tags, rules


# ── measure ──────────────────────────────────────────────────────────────────────────────
def analyse(progs, tags):
    per_prog, missing = [], Counter()
    role_stats = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))  # goal → role → field → values
    positions = defaultdict(lambda: defaultdict(list))                        # goal → role → positions
    pairs = defaultdict(Counter)                                              # goal → pattern pair
    progression = defaultdict(lambda: defaultdict(list))                      # goal → metric → values

    for p in progs:
        goal = COACH[p['id']]
        weeks = p.get('weeks') or [{'week_num': 1, 'days': p.get('days', [])}]
        weekly = []
        for wi, w in enumerate(weeks):
            sets_by_muscle, total, ex_names = Counter(), 0, set()
            for d in w['days']:
                rows = rows_of(d)
                tagged = []
                for r in rows:
                    t = tags.get(r['name'].lower())
                    if not t:
                        missing[r['name']] += 1
                        continue
                    tagged.append((r, t))
                    ex_names.add(r['name'].lower())
                    if t['role'] not in ('warmup', 'cooldown'):
                        # Counted as the generator's summary counts: full sets for the main muscle,
                        # half for up to three others.
                        sets_by_muscle[t['primary_muscle']] += r['sets']
                        for m in (t.get('muscles') or [])[:3]:
                            if m != t['primary_muscle']:
                                sets_by_muscle[m] += r['sets'] / 2
                        total += r['sets']
                    if wi == 0:  # roles and order from week 1 only, so long programs don't dominate
                        rs = role_stats[goal][t['role']]
                        rs['sets'].append(r['sets'])
                        if r['reps'] is not None: rs['reps'].append(r['reps'])
                        if r['hold'] is not None and r['reps'] is None: rs['hold'].append(r['hold'])
                        if r['rest'] is not None: rs['rest'].append(r['rest'])
                if wi == 0 and len(tagged) > 1:
                    for i, (r, t) in enumerate(tagged):
                        positions[goal][t['role']].append(i / (len(tagged) - 1))
                    by_group = defaultdict(list)
                    for r, t in tagged:
                        if r['group'] and t['role'] not in ('warmup', 'cooldown'):
                            by_group[r['group']].append(t['pattern'])
                    for pats in by_group.values():
                        if 2 <= len(pats) <= 3:
                            for a in range(len(pats)):
                                for b in range(a + 1, len(pats)):
                                    pairs[goal][' + '.join(sorted((pats[a], pats[b])))] += 1
            weekly.append({'sets_by_muscle': sets_by_muscle, 'total_sets': total, 'names': ex_names, 'days': w['days']})

        # Progression between consecutive weeks.
        kept_series, totals = [], [wk['total_sets'] for wk in weekly]
        for a, b in zip(weekly, weekly[1:]):
            kept = len(a['names'] & b['names']) / max(1, len(a['names']))
            kept_series.append(round(kept, 2))
            ra = {r['name'].lower(): r for d in a['days'] for r in rows_of(d)}
            rb = {r['name'].lower(): r for d in b['days'] for r in rows_of(d)}
            for n in a['names'] & b['names']:
                x, y = ra.get(n), rb.get(n)
                if not x or not y:
                    continue
                progression[goal]['sets_change'].append(y['sets'] - x['sets'])
                if x['reps'] is not None and y['reps'] is not None:
                    progression[goal]['reps_change'].append(y['reps'] - x['reps'])
                if x['hold'] and y['hold'] and x['reps'] is None:
                    progression[goal]['hold_change_secs'].append(y['hold'] - x['hold'])
        # Block length: weeks between big exercise turnovers (< 50% kept).
        blocks, run = [], 1
        for k in kept_series:
            if k < 0.5:
                blocks.append(run); run = 1
            else:
                run += 1
        if len(weekly) > 1:
            blocks.append(run)
            progression[goal]['block_weeks'] += blocks
        deloads = [i + 1 for i in range(1, len(totals)) if totals[i] < 0.75 * max(totals[:i])]

        n_days = len(weeks[0]['days'])
        used = sorted({r['name'] for w in weeks for d in w['days'] for r in rows_of(d) if r['name'].lower() in tags
                       and tags[r['name'].lower()]['role'] not in ('warmup', 'cooldown', 'conditioning')})
        per_prog.append({
            'exercises': used,
            'id': p['id'], 'name': p.get('program_name') or p.get('name'), 'goal': goal,
            'weeks': len(weeks) if p.get('weeks') else None, 'days_per_week': n_days,
            'weekly_sets_by_muscle': {m: round(v, 1) for m, v in weekly[0]['sets_by_muscle'].most_common()},
            'volume_growth': round(totals[-1] / totals[0], 2) if len(totals) > 1 and totals[0] else None,
            'total_sets_by_week': totals, 'exercises_kept_week_to_week': kept_series,
            'block_weeks': blocks if len(weekly) > 1 else None, 'deload_weeks': deloads,
        })
    return per_prog, role_stats, positions, pairs, progression, missing


def summarise(per_prog, role_stats, positions, pairs, progression):
    goals = {}
    for goal in sorted({p['goal'] for p in per_prog}):
        ps = [p for p in per_prog if p['goal'] == goal]
        muscles = sorted({m for p in ps for m in p['weekly_sets_by_muscle']})
        volume = {}
        for m in muscles:
            vals = [p['weekly_sets_by_muscle'].get(m, 0) for p in ps]
            volume[m] = {'median': med(vals), 'min': min(vals), 'max': max(vals)}
        roles = {}
        for role in ROLE_ORDER:
            rs = role_stats[goal].get(role)
            if not rs:
                continue
            roles[role] = {'n': len(rs['sets']), 'sets': med(rs['sets']), 'reps': med(rs['reps']),
                           'hold_secs': med(rs['hold']), 'rest_secs': med(rs['rest'])}
        pos = {r: med(positions[goal][r]) for r in ROLE_ORDER if positions[goal].get(r)}
        pr = progression[goal]
        prog = {
            'weekly_sets_change': med(pr['sets_change']),
            'weekly_reps_change': med(pr['reps_change']),
            'weekly_hold_change_secs': med(pr['hold_change_secs']),
            'reps_up_share': round(sum(1 for v in pr['reps_change'] if v > 0) / len(pr['reps_change']), 2) if pr['reps_change'] else None,
            'block_weeks': med(pr['block_weeks']),
            'programs_with_deload': sum(1 for p in ps if p['deload_weeks']),
            'volume_growth_first_to_last_week': med([p['volume_growth'] for p in ps if p['volume_growth']]),
        }
        # Which exercises the coaches use for this goal (in how many of its programs): the generator prefers them.
        usage = Counter(n for p in ps for n in p['exercises'])
        goals[goal] = {'programs': [p['id'] for p in ps], 'days_per_week': med([p['days_per_week'] for p in ps]),
                       'exercises': dict(usage.most_common()),
                       'volume': volume, 'roles': roles, 'role_position': pos, 'progression': prog,
                       'superset_pairs': dict(pairs[goal].most_common(8))}
    return goals


# ── compare with design_rules.json ───────────────────────────────────────────────────────
def compare(goals, rules):
    notes = []
    vt = rules['volume_targets']
    for goal, g in goals.items():
        for m, v in g['volume'].items():
            if m not in vt or v['median'] is None or len(g['programs']) < 2:
                continue
            lo, hi = vt[m]
            if v['median'] < lo * 0.7 or v['median'] > hi * 1.3:
                notes.append({'goal': goal, 'area': 'volume', 'what': m,
                              'rule': f'{lo}-{hi} sets/wk', 'coaches': f"{v['median']} (range {v['min']}-{v['max']})"})
        for role, r in g['roles'].items():
            rr = rules['roles'].get(role)
            if not rr or r['n'] < 5:
                continue
            if r['sets'] is not None and abs(r['sets'] - rr['sets']) >= 1:
                notes.append({'goal': goal, 'area': 'sets', 'what': role, 'rule': rr['sets'], 'coaches': r['sets']})
            rest_rule = rr.get('rest_secs')
            if rest_rule and r['rest_secs'] is not None and abs(r['rest_secs'] - rest_rule) > max(20, rest_rule * 0.35):
                notes.append({'goal': goal, 'area': 'rest', 'what': role, 'rule': f'{rest_rule}s', 'coaches': f"{r['rest_secs']}s"})
        pos = g['role_position']
        seq = [r for r in ROLE_ORDER if r in pos and r not in ('warmup', 'cooldown') and g['roles'].get(r, {}).get('n', 0) >= 5]
        for a, b in zip(seq, seq[1:]):
            if pos[a] > pos[b] + 0.1:
                notes.append({'goal': goal, 'area': 'order', 'what': f'{a} before {b}',
                              'rule': 'yes', 'coaches': f'{a} sits at {pos[a]}, {b} at {pos[b]}'})
        pr, ph = g['progression'], rules['phases']
        if pr['block_weeks'] and abs(pr['block_weeks'] - ph['length_weeks']) >= 1:
            notes.append({'goal': goal, 'area': 'progression', 'what': 'weeks before exercises change',
                          'rule': ph['length_weeks'], 'coaches': pr['block_weeks']})
    return notes


# ── report ───────────────────────────────────────────────────────────────────────────────
def report(per_prog, goals, notes, missing):
    L = ['# What the coach programs actually do', '',
         'Generated by `python3 data/learn_patterns.py` from the coach-written programs. ',
         'Machine-readable copy: [`data/learned_patterns.json`](../data/learned_patterns.json). ',
         'Nothing in the app reads this yet: it is for checking `data/design_rules.json` against the coaches.', '',
         'Sets count working sets (warm-up and cooldown left out). Reps are the first figure written ',
         '(8-10 → 9). Rest is only counted where the coach wrote one. Muscle sets are counted the way the ',
         "generator's summary counts them: full sets for the main muscle, half for up to three others. ",
         'Volume is only compared with the rules for goals with 2+ programs; role order only for roles with 5+ exercises.', '']
    L += ['## Where the rules and the coaches disagree', '']
    if notes:
        L += ['| Goal | Area | What | Rule now | Coaches |', '|---|---|---|---|---|']
        L += [f"| {n['goal']} | {n['area']} | {n['what']} | {n['rule']} | {n['coaches']} |" for n in notes]
    else:
        L.append('No big differences.')
    for goal, g in goals.items():
        L += ['', f'## {goal}', '', f"From {len(g['programs'])} programs: " + ', '.join(f'`{i}`' for i in g['programs']) + '.',
              f"Median {g['days_per_week']} days a week.", '', '### Weekly sets per muscle (week 1)', '',
              '| Muscle | Median | Range |', '|---|---|---|']
        for m, v in sorted(g['volume'].items(), key=lambda kv: -kv[1]['median']):
            L.append(f"| {m} | {v['median']} | {v['min']}-{v['max']} |")
        L += ['', '### By role (week 1)', '', '| Role | Exercises | Sets | Reps | Hold | Rest | Position in session |', '|---|---|---|---|---|---|---|']
        for role, r in g['roles'].items():
            f = lambda v, u='': '–' if v is None else f'{v}{u}'
            L.append(f"| {role} | {r['n']} | {f(r['sets'])} | {f(r['reps'])} | {f(r['hold_secs'], 's')} | {f(r['rest_secs'], 's')} | {f(g['role_position'].get(role))} |")
        pr = g['progression']
        L += ['', '### Progression', '',
              f"- Exercises stay the same for a median of **{pr['block_weeks']} weeks** before they change." if pr['block_weeks'] else '- Rotation program: no week-to-week progression written.',
              f"- Same exercise, next week: sets {pr['weekly_sets_change']:+}, reps {pr['weekly_reps_change']:+} "
              f"(reps go up {int((pr['reps_up_share'] or 0) * 100)}% of the time), holds {pr['weekly_hold_change_secs'] or 0:+} s." if pr['weekly_sets_change'] is not None else '',
              f"- Total weekly sets, last week vs first: ×{pr['volume_growth_first_to_last_week']}." if pr['volume_growth_first_to_last_week'] else None,
              f"- Programs with a deload week: {pr['programs_with_deload']} of {len(g['programs'])}."]
        if g['superset_pairs']:
            L += ['', '### Most common superset pairs', ''] + [f'- {k} ({v})' for k, v in g['superset_pairs'].items()]
    L += ['', '## Per program', '', '| Program | Goal | Weeks | Days | Total sets by week | Kept week to week | Deload |', '|---|---|---|---|---|---|---|']
    for p in per_prog:
        L.append(f"| {p['name']} | {p['goal']} | {p['weeks'] or '–'} | {p['days_per_week']} | {' '.join(map(str, p['total_sets_by_week']))} | "
                 f"{' '.join(f'{int(k * 100)}%' for k in p['exercises_kept_week_to_week']) or '–'} | {', '.join(f'wk {w}' for w in p['deload_weeks']) or '–'} |")
    if missing:
        L += ['', f'## Untagged exercises ({len(missing)})', '', 'Not in the exercise index, so left out of the numbers above. Tag them to include them.', '',
              ', '.join(f'{n} ×{c}' for n, c in missing.most_common(40))]
    REPORT.write_text('\n'.join(l for l in L if l is not None) + '\n')


def main():
    progs, tags, rules = load()
    per_prog, role_stats, positions, pairs, progression, missing = analyse(progs, tags)
    goals = summarise(per_prog, role_stats, positions, pairs, progression)
    notes = compare(goals, rules)
    OUT.write_text(json.dumps({'_doc': 'Generated by data/learn_patterns.py from the coach-written programs. Report: docs/LEARNED_PATTERNS.md.',
                               'goals': goals, 'programs': per_prog, 'disagreements': notes,
                               'untagged': dict(missing.most_common())}, indent=1, ensure_ascii=False) + '\n')
    report(per_prog, goals, notes, missing)
    print(f'{len(per_prog)} coach programs, {len(goals)} goals, {len(notes)} disagreements with design_rules.json, '
          f'{len(missing)} untagged exercise names')


if __name__ == '__main__':
    main()
