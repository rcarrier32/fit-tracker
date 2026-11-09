"""Shared helpers for program build scripts (see docs/ADDING_A_PROGRAM.md).

    from program_builder import Library, ex, w
    lib = Library()
    lib.ensure_exercise('Brisk Walk', 'home', tags={'pattern': 'conditioning', 'role': 'conditioning', ...})
    lib.set_programs('athletic', [program, ...])
    lib.save()

Programs go in library.json under programs.<key>. Any key other than pjf/bws is
picked up automatically and listed under the program's `group` on the Programs screen.
"""
import json, re, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from suggest_tags import suggest  # noqa: E402
import tag_exercises  # noqa: E402

LIB_PATH = Path(__file__).with_name('library.json')
TAGS_PATH = Path(__file__).with_name('exercise_tags.json')
TAG_FIELDS = ['primary_muscle', 'muscles', 'pattern', 'role', 'equipment', 'level', 'unilateral', 'plane', 'hip_focus']


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


def ex(name, reps=None, time=None, sets=None, rest=None, notes=None, group=None):
    """One exercise row. Give reps OR time ('20s', '2:00'). rest like '60-90s'."""
    return {'name': name, 'round_group': group, 'is_alternate': False, 'sets': sets,
            'reps': reps, 'weight': None, 'distance': None, 'time': time, 'rest': rest, 'notes': notes}


def w(name, reps=None, time=None, notes=None):
    """One warm-up item. Timed items get a countdown button."""
    return {'name': name, 'reps': reps, 'time': time, 'notes': notes}


class Library:
    def __init__(self):
        self.data = json.loads(LIB_PATH.read_text())
        self.tags = json.loads(TAGS_PATH.read_text())
        self.by_name = {}
        for e in self.data['exercises']:
            for n in [e['name']] + (e.get('aliases') or []):
                self.by_name.setdefault(n.lower(), e)
        # Provider exercises (data/providers/*.json: TrainHeroic, PJF …) are part of the catalog on
        # every phone, with their own videos, so plans can use them by name. They are never copied
        # into library.json: the provider file owns them (see data/catalog.mjs).
        self.providers = {}
        for f in sorted((LIB_PATH.parent / 'providers').glob('*.json')):
            d = json.loads(f.read_text())
            for o in (d.get('videos') or {}).values():
                if o.get('name') and o.get('tags') and o['name'].lower() not in self.by_name:
                    vid = f"https://youtu.be/{o['yt']}" if o.get('yt') else o.get('url')
                    self.providers[o['name'].lower()] = {'name': o['name'], 'source': d.get('source'), 'video_url': vid, **o['tags']}

    def provider(self, name):
        """The provider entry (tags + video) for a provider-only exercise, or None."""
        return self.providers.get(name.lower())

    def has(self, name):
        return name.lower() in self.by_name or name.lower() in self.providers

    def ensure_exercise(self, name, source, tags=None, video_from=None, search=None):
        """Add a catalog entry for a new movement, classified (no-op for names that exist).

        tags: taxonomy fields (docs/EXERCISE_TAXONOMY.md): primary_muscle, muscles, pattern,
        role, equipment, level, unilateral, plane, hip_focus. Anything left out is filled
        from data/suggest_tags.py and printed as REVIEW, so a guess never lands silently.
        video_from: borrow the vetted video of an existing entry with that name."""
        e = self.by_name.get(name.lower())
        if e is None and self.provider(name):
            return self.provider(name)   # already in the catalog via its provider file, with its video
        if e is None:
            e = {'id': f'{source}-{slug(name)}', 'name': name, 'video_url': None,
                 'sources': [source], 'aliases': []}
            self.data['exercises'].append(e)
            self.by_name[name.lower()] = e
        if e['id'] not in self.tags['tags']:
            guess = suggest(name, [source])
            given = tags or {}
            missing = [k for k in TAG_FIELDS if k not in given]
            if missing:
                print(f'REVIEW tags for "{name}": guessed {", ".join(f"{k}={guess.get(k)}" for k in missing)}')
            t = {k: given.get(k, guess.get(k)) for k in TAG_FIELDS}
            if t['primary_muscle'] not in t['muscles']:
                t['muscles'] = [t['primary_muscle']] + list(t['muscles'])
            self.tags['tags'][e['id']] = {'name': name, **t}
        q = (search or f'{name} form').replace(' ', '+')
        e.setdefault('fallback_search', f'https://www.youtube.com/results?search_query={q}')
        if video_from and not e.get('video_url'):
            src = self.by_name.get(video_from.lower())
            if src and src.get('video_url'):
                e['video_url'] = src['video_url']
        return e

    def set_programs(self, key, programs):
        self.data['programs'][key] = programs

    def save(self):
        """Write library.json and exercise_tags.json, then merge tags and rebuild program_index.json."""
        LIB_PATH.write_text(json.dumps(self.data, indent=2, ensure_ascii=False) + '\n')
        self.tags['tags'] = dict(sorted(self.tags['tags'].items()))
        TAGS_PATH.write_text(json.dumps(self.tags, indent=1, ensure_ascii=False))
        tag_exercises.main()


def expand_weeks(n_weeks, days_for_week):
    """days_for_week(week) -> list of day dicts (focus, exercises, optional warmup/notes/video).
    Numbers the days and wraps them in weeks[]."""
    weeks = []
    for wk in range(1, n_weeks + 1):
        days = days_for_week(wk)
        for i, d in enumerate(days, 1):
            d['day_num'] = i
        weeks.append({'week_num': wk, 'days': days})
    return weeks
