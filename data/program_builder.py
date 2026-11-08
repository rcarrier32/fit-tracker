"""Shared helpers for program build scripts (see docs/ADDING_A_PROGRAM.md).

    from program_builder import Library, ex, w
    lib = Library()
    lib.ensure_exercise('Brisk Walk', 'cardio', ['cardio'], source='home')   # only for new names
    lib.set_programs('athletic', [program, ...])
    lib.save()

Programs go in library.json under programs.<key>. Any key other than pjf/bws is
picked up automatically and listed under the program's `group` on the Programs screen.
"""
import json, re
from pathlib import Path

LIB_PATH = Path(__file__).with_name('library.json')


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
        self.by_name = {}
        for e in self.data['exercises']:
            for n in [e['name']] + (e.get('aliases') or []):
                self.by_name.setdefault(n.lower(), e)

    def has(self, name):
        return name.lower() in self.by_name

    def ensure_exercise(self, name, primary, muscles, source, video_from=None, search=None):
        """Add a catalog entry for a new movement (no-op if the name exists).
        video_from: borrow the vetted video of an existing entry with that name."""
        e = self.by_name.get(name.lower())
        if e is None:
            e = {'id': f'{source}-{slug(name)}', 'name': name, 'video_url': None,
                 'sources': [source], 'aliases': []}
            self.data['exercises'].append(e)
            self.by_name[name.lower()] = e
        e.setdefault('primary_muscle', primary)
        e.setdefault('muscles', muscles)
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
        LIB_PATH.write_text(json.dumps(self.data, indent=2, ensure_ascii=False) + '\n')


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
