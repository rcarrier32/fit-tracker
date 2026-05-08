#!/usr/bin/env python3
"""Build the unified exercise library + program index for the tracker.

Output: data/library.json
{
  "exercises": [
    {"id": "barbell-bench-press", "name": "Barbell Bench Press",
     "video_url": "https://youtu.be/...", "sources": ["bws"],
     "fallback_search": "https://youtube.com/@PJFPerformance/search?query=..."}
  ],
  "programs": [
    {"id": "pjf_durability_code_prime", "name": "The Durability Code Prime",
     "source": "PJF", "weeks": [...]}
  ]
}
"""
import json
import re
from pathlib import Path
from urllib.parse import quote

DATA = Path("/Users/carriermac/Downloads/fit-tracker/data")
OUT = DATA / "library.json"

def slugify(name):
    s = name.lower()
    s = re.sub(r'[^\w\s-]', '', s)
    s = re.sub(r'\s+', '-', s.strip())
    return s

def normalize(name):
    """Normalize for matching: lowercase, strip parens content, strip * and punctuation."""
    s = name.lower().strip()
    s = re.sub(r'\([^)]*\)', '', s)  # drop parenthetical
    s = re.sub(r'[^\w\s]', '', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s

def main():
    # 1. Load BWS exercise db (canonical names + YouTube URLs)
    bws = json.loads((DATA / "bws_exercise_db.json").read_text())
    bws_exercises = bws['exercises']

    # 2. Load all PJF programs and collect unique exercise names
    pjf_programs = []
    pjf_exercise_names = set()
    for fn, prog_id in [
        ("pjf_durability_code_prime.json", "pjf_durability_code_prime"),
        ("pjf_fat_dont_fly_phase1_parsed.json", "pjf_fat_dont_fly_phase1"),
        ("pjf_fat_dont_fly_phase2.json", "pjf_fat_dont_fly_phase2"),
        ("pjf_fat_dont_fly_phase3.json", "pjf_fat_dont_fly_phase3"),
    ]:
        path = DATA / fn
        if not path.exists(): continue
        prog = json.loads(path.read_text())
        prog['id'] = prog_id
        pjf_programs.append(prog)
        for week in prog.get('weeks', []):
            for day in week.get('days', []):
                for ex in day.get('exercises', []):
                    if not ex.get('is_alternate'):
                        pjf_exercise_names.add(ex['name'])

    # 3. Build unified exercise list
    # Use BWS canonical names first (they have videos), then add PJF-only names.
    library = {}  # normalized_key -> entry
    for ex in bws_exercises:
        key = normalize(ex['name'])
        if not key: continue
        library[key] = {
            "id": slugify(ex['name']),
            "name": ex['name'],
            "video_url": ex.get('video_url'),
            "sources": ["bws"],
            "aliases": [],
        }
    # Add PJF exercises not in library
    for name in sorted(pjf_exercise_names):
        key = normalize(name)
        if not key: continue
        if key in library:
            library[key]['sources'].append('pjf')
            if name != library[key]['name'] and name not in library[key]['aliases']:
                library[key]['aliases'].append(name)
        else:
            library[key] = {
                "id": slugify(name),
                "name": name,
                "video_url": None,
                "sources": ["pjf"],
                "aliases": [],
            }
    # Add fallback YouTube search for everything
    for entry in library.values():
        # Channel-scoped YouTube search as fallback when no direct video
        if not entry['video_url']:
            entry['fallback_search'] = f"https://www.youtube.com/@PJFPerformance/search?query={quote(entry['name'])}"
        else:
            entry['fallback_search'] = None

    exercises = sorted(library.values(), key=lambda e: e['name'].lower())

    # 4. Build BWS programs - normalize the structure
    bws_programs = []
    for prog_id, prog_data in bws['programs'].items():
        bws_programs.append({
            "id": prog_id,
            "name": prog_id.replace('_', ' ').title(),
            "source": "BWS",
            "days": prog_data['days'],
        })

    out = {
        "version": 1,
        "exercises": exercises,
        "programs": {
            "pjf": pjf_programs,
            "bws": bws_programs,
        },
        "stats": {
            "total_exercises": len(exercises),
            "with_video": sum(1 for e in exercises if e['video_url']),
            "pjf_only": sum(1 for e in exercises if e['sources'] == ['pjf']),
            "bws_only": sum(1 for e in exercises if e['sources'] == ['bws']),
            "shared": sum(1 for e in exercises if 'bws' in e['sources'] and 'pjf' in e['sources']),
            "pjf_programs": len(pjf_programs),
            "bws_programs": len(bws_programs),
        },
    }
    OUT.write_text(json.dumps(out, indent=2))
    print(f"[wrote] {OUT}")
    for k, v in out['stats'].items():
        print(f"  {k}: {v}")

if __name__ == "__main__":
    main()
