"""Warm-ups and cooldowns that match the workout.

Rule: warm up what the day is about to work, and stretch what it worked.

1. `load(rows)` scores how hard the day works each body region, from the exercises' taxonomy
   tags (data/exercise_tags.json): primary muscle 2 points per set, other muscles 1 point per set.
   Conditioning finishers count once. Arms, core and grip are left out: no plan stretches those.
2. The day's *targets*: every region a main exercise trains directly (its primary muscle,
   2+ sets), plus any region scoring at least half of the day's top region.
3. `fill_warmup` keeps the plan's own prep (Griffith's, PJF's…) and adds a move from a
   warm-up pool for any target the prep doesn't touch yet.
4. `pick_cooldown` picks 2-4 holds from a stretch pool, greedily, so every target gets
   stretched, preferring holds whose main muscle is the target. Each pick gets a note saying
   which of today's exercises it is for, so the reasoning shows in the app.

Tags decide coverage, so a stretch's tags must say what it really stretches (they were checked
against PJF's own notes: Wide Stance LUL also stretches the hamstrings, Rotational RDL LUL is a
hamstring stretch, Hip Flexor/Quad Bridge is PJF's couch stretch).
"""
from collections import Counter

REGION = {
    'quads': 'quads', 'hamstrings': 'hamstrings', 'glutes': 'glutes', 'abductors': 'glutes',
    'adductors': 'adductors', 'hip_flexors': 'hip flexors', 'calves': 'calves',
    'chest': 'chest', 'front_delts': 'shoulders', 'side_delts': 'shoulders',
    'lats': 'lats', 'upper_back': 'upper back', 'rear_delts': 'upper back', 'traps': 'upper back',
    'lower_back': 'lower back',
}
SKIP_GROUPS = ('cooldown',)
TARGET_SHARE = 0.5      # a region is a target when it scores ≥ half the day's top region


def _tags(lib, name):
    n = name.lower()
    for t in lib.tags['tags'].values():
        if t.get('name', '').lower() == n:
            return t
    e = lib.by_name.get(n)
    if e and e.get('primary_muscle'):
        return e
    p = lib.provider(name)
    return (p or {}).get('tags') or p


def _regions(t):
    """{region: strength}: the primary muscle's region 1.0, the others 0.5."""
    out = {}
    if not t:
        return out
    for m in t.get('muscles') or []:
        r = REGION.get(m)
        if r:
            out[r] = max(out.get(r, 0), 0.5)
    r = REGION.get(t.get('primary_muscle'))
    if r:
        out[r] = 1.0
    return out


def load(lib, rows):
    """Region → score for the day's work, plus region → the exercises that worked it most."""
    score, by = Counter(), {}
    load.direct = set()
    for x in rows:
        if (x.get('round_group') or '').lower().startswith(SKIP_GROUPS):
            continue
        t = _tags(lib, x['name'])
        if not t:
            continue
        n = 1 if t.get('role') == 'conditioning' else int(x.get('sets') or 1)
        if n >= 2 and t.get('role') not in ('conditioning', 'warmup', 'cooldown') and REGION.get(t.get('primary_muscle')):
            load.direct.add(REGION[t['primary_muscle']])
        for r, s in _regions(t).items():
            pts = n * (2 if s == 1.0 else 1)
            score[r] += pts
            by.setdefault(r, Counter())[x['name']] += pts
    return score, by


def targets(score, direct=()):
    """Regions trained directly, plus any scoring ≥ TARGET_SHARE of the top, most-worked first."""
    if not score:
        return []
    top = max(score.values())
    return [r for r, v in score.most_common() if r in direct or v >= TARGET_SHARE * top]


def _why(regions, by):
    parts = []
    for r in regions:
        names = [n for n, _ in by.get(r, Counter()).most_common(2)]
        parts.append(f"{r} ({', '.join(names)})" if names else r)
    return 'For today\'s ' + '; '.join(parts) + '.'


def _greedy(lib, pool, need, score, have, k_min, k_max, strong=()):
    """Pick from pool until every region in `need` is reached (or k_max), best gain first.
    A region in `strong` only counts once a pick's *main* muscle is that region: the day's
    hardest-worked muscles get a real stretch, not a by-product of another one."""
    covered = dict(have)
    ok = lambda r, s: s >= (1.0 if r in strong else 0.5)
    picks = []
    # A region nothing in the pool reaches can't be covered: report it, don't stall on it.
    reach = {r for item in pool for r in _regions(_tags(lib, item[0]))}
    while len(picks) < k_max:
        left = [r for r in need if r not in covered and r in reach]
        if not left and len(picks) >= k_min:
            break
        # Targets first; once they're all covered, the next most-worked region still uncovered.
        aim = left or [r for r, v in score.most_common() if r not in covered and r in reach][:1] or need
        best, gain = None, 0
        for item in pool:
            if item in picks:
                continue
            reg = _regions(_tags(lib, item[0]))
            g = sum(score[r] * reg.get(r, 0) for r in aim if ok(r, reg.get(r, 0)))
            if g > gain:
                best, gain = item, g
        if not best:
            break
        picks.append(best)
        for r, st in _regions(_tags(lib, best[0])).items():
            if ok(r, st):
                covered[r] = True
    return picks, [r for r in need if r not in covered]


def pick_cooldown(lib, rows, pool, k_min=3, k_max=4):
    """[(name, time, note, regions_it_serves)], uncovered targets. Pool order = flow order."""
    score, by = load(lib, rows)
    need = targets(score, load.direct)
    strong = [r for r in need if r in load.direct][:2]     # the day's two hardest-worked muscles
    picks, missing = _greedy(lib, pool, need, score, {}, k_min, k_max, strong)
    picks.sort(key=pool.index)
    out = []
    for name, time, note in picks:
        serves = [r for r in need if r in _regions(_tags(lib, name))]
        out.append((name, time, ' '.join(filter(None, [note, _why(serves, by) if serves else None])), serves))
    return out, missing


def fill_warmup(lib, rows, prep, pool, max_moves=6, share=0.35):
    """The plan's prep plus pool moves (up to max_moves in all) for targets it doesn't touch.
    Returns (moves, missing)."""
    k_max = max(0, max_moves - len(prep))
    score, by = load(lib, rows)
    top = max(score.values()) if score else 0
    need = [r for r, v in score.most_common() if v >= share * top]
    have = {r: True for m in prep for r in _regions(_tags(lib, m['name']))}
    left = [r for r in need if r not in have]
    if not left:
        return list(prep), []
    picks, missing = _greedy(lib, pool, left, Counter({r: score[r] for r in left}), {}, 0, k_max)
    extra = []
    for name, reps, note in picks:
        serves = [r for r in left if r in _regions(_tags(lib, name))]
        why = 'Wakes up the ' + ' and '.join(serves) + ' for ' + ', '.join(
            dict.fromkeys(n for r in serves for n, _ in by[r].most_common(1))) + '.'
        extra.append({'name': name, 'reps': reps, 'notes': ' '.join(filter(None, [note, why]))})
    return list(prep) + extra, missing
