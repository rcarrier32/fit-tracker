#!/usr/bin/env python3
"""Generic PJF program PDF-text parser.

Run: parse_pjf_program.py <input.txt> <output.json> "<Program Name>"
"""
import json
import re
import sys
from pathlib import Path

if len(sys.argv) >= 4:
    TXT = Path(sys.argv[1])
    OUT = Path(sys.argv[2])
    PROGRAM_NAME = sys.argv[3]
else:
    TXT = Path("/Users/carriermac/Downloads/fit-tracker/data/pjf_durability_code_prime.txt")
    OUT = Path("/Users/carriermac/Downloads/fit-tracker/data/pjf_durability_code_prime.json")
    PROGRAM_NAME = "The Durability Code Prime"

DAY_RE = re.compile(r'^Week\s+(\d+),\s+Day\s+(\d+)\s*-\s*(.+?)\s*$')
HEADER_RE = re.compile(r'\bExercise\b.*\bSets\b.*\bReps\b.*\bWeight\b', re.IGNORECASE)
END_RE = re.compile(r'^(Staff Member Notes|Additional Notes|Workout Recommendations|Time Limit)', re.IGNORECASE)

# A row pattern: optional round_group at start, then exercise name, then numbers/times.
# We'll split on multi-space gaps (pdftotext -layout preserves columns with spaces).

def parse_row(line):
    """Parse a single table row line into structured fields."""
    # Split on 2+ spaces
    parts = re.split(r'\s{2,}', line.rstrip())
    parts = [p.strip() for p in parts if p.strip()]
    if len(parts) < 2:
        return None

    # round_group is the first part if it looks like a label (e.g. "- 2 round", "Placeholder", "- 3 round")
    round_group = None
    name_idx = 0
    first = parts[0]
    if first.lower() in ('placeholder',) or re.match(r'^-?\s*\d+\s*round', first, re.IGNORECASE):
        round_group = first if first.lower() != 'placeholder' else None
        name_idx = 1

    if name_idx >= len(parts):
        return None
    name = parts[name_idx]

    # Skip table headers and other non-rows
    if name.lower() in ('exercise', 'sets', 'workouts'): return None
    if name.lower().startswith('week '): return None

    # Detect alternate row (starts with "Alternate:")
    is_alternate = name.lower().startswith('alternate:')
    if is_alternate:
        name = name[len('Alternate:'):].strip().rstrip(' (Alternate)').strip()

    # Numeric fields after the name: sets, reps, weight, distance, time, rest, notes
    # The remaining parts are: [sets] [reps] [weight] [distance] [time] [rest] [notes]
    # but many cells are blank, so positions aren't fixed. Let's just collect what's there.
    rest = parts[name_idx+1:]
    fields = {
        "name": name,
        "round_group": round_group,
        "is_alternate": is_alternate,
        "raw_fields": rest,
    }
    return fields

def assign_fields(row, all_fields):
    """Try to figure out which field each value is.
    Heuristic: scan for time patterns (00:00:00), rest patterns (X min, X sec),
    integer for sets, integer/range for reps."""
    # Initialize
    out = {
        "name": row['name'],
        "round_group": row['round_group'],
        "is_alternate": row['is_alternate'],
        "sets": None, "reps": None, "weight": None, "distance": None,
        "time": None, "rest": None, "notes": None,
    }
    fields = row['raw_fields']
    # First numeric field is likely sets
    used = [False] * len(fields)
    for i, f in enumerate(fields):
        if used[i]: continue
        if re.match(r'^\d{1,2}(?:[:.]\d{2})?$', f):
            # could be sets, reps, etc.
            if out['sets'] is None:
                try:
                    out['sets'] = int(f) if f.isdigit() else f
                    used[i] = True
                    continue
                except ValueError:
                    pass
            if out['reps'] is None:
                out['reps'] = f
                used[i] = True
                continue
        # time: HH:MM:SS or MM:SS
        if re.match(r'^\d{1,2}:\d{2}(?::\d{2})?$', f) and out['time'] is None:
            out['time'] = f
            used[i] = True
            continue
        # rest: "X min", "X sec", "--:-- min", "0 sec"
        if re.search(r'(min|sec)$', f) or '--:--' in f:
            if out['rest'] is None:
                out['rest'] = f
                used[i] = True
                continue
        # comma-separated reps like "10,10,10" or "15,15,15"
        if ',' in f and re.match(r'^[\d,\s]+$', f):
            if out['reps'] is None:
                out['reps'] = f
                used[i] = True
                continue
        # Range like "5-20"
        if re.match(r'^\d+\s*-\s*\d+$', f):
            if out['reps'] is None:
                out['reps'] = f
                used[i] = True
                continue
        # MAX
        if f.upper() == 'MAX' and out['reps'] is None:
            out['reps'] = 'MAX'
            used[i] = True
            continue

    # Anything unmatched - treat as notes
    leftover = [f for i, f in enumerate(fields) if not used[i]]
    if leftover:
        out['notes'] = ' | '.join(leftover)

    return out

def main():
    text = TXT.read_text()
    lines = text.splitlines()
    weeks = {}
    cur_week, cur_day, cur_focus = None, None, None
    in_table = False

    for ln_idx, line in enumerate(lines):
        line_strip = line.strip()
        if not line_strip:
            continue

        m = DAY_RE.match(line_strip)
        if m:
            cur_week = int(m.group(1))
            cur_day = int(m.group(2))
            cur_focus = m.group(3).strip()
            in_table = False
            weeks.setdefault(cur_week, {}).setdefault(cur_day, {
                "focus": cur_focus,
                "exercises": [],
            })
            continue

        if HEADER_RE.search(line):
            in_table = True
            continue

        if in_table:
            if END_RE.match(line_strip):
                in_table = False
                continue
            # Skip lines that are just dashes/separators
            if all(c in '-_= ' for c in line_strip):
                continue
            row = parse_row(line)
            if row and row.get('name'):
                # Filter out clearly-not-exercises
                nm = row['name'].lower()
                if nm in ('workout date:', 'total workout time:', 'sets', 'reps', 'weight', 'distance', 'time', 'rest', 'notes'):
                    continue
                if nm.startswith(('workout date', 'total workout', 'workout recommendations')):
                    continue
                fielded = assign_fields(row, lines)
                weeks[cur_week][cur_day]['exercises'].append(fielded)

    # Build final structure
    output = {
        "program_name": PROGRAM_NAME,
        "source": "PJF Performance",
        "weeks": [],
    }
    for week_num in sorted(weeks):
        week_data = {"week_num": week_num, "days": []}
        for day_num in sorted(weeks[week_num]):
            d = weeks[week_num][day_num]
            week_data["days"].append({
                "day_num": day_num,
                "focus": d["focus"],
                "exercises": d["exercises"],
            })
        output["weeks"].append(week_data)

    OUT.write_text(json.dumps(output, indent=2))
    # Stats
    total_days = sum(len(w['days']) for w in output['weeks'])
    total_ex = sum(len(d['exercises']) for w in output['weeks'] for d in w['days'])
    unique_names = set()
    for w in output['weeks']:
        for d in w['days']:
            for e in d['exercises']:
                if not e['is_alternate']:
                    unique_names.add(e['name'])
    print(f"[wrote] {OUT}")
    print(f"  Weeks: {len(output['weeks'])}")
    print(f"  Total days: {total_days}")
    print(f"  Total exercise rows: {total_ex}")
    print(f"  Unique main exercises: {len(unique_names)}")

if __name__ == "__main__":
    main()
