#!/usr/bin/env python3
"""Merge the PJF Extended Length Band database + its 6-week sample program into library.json.

Input:  data/pjf_band_database.json (from parse_pjf_band.py)
Output: data/library.json, patched in place. Re-runnable: earlier band entries and the
        program are replaced, nothing else in the library is touched.

The sample program (PDF pages 12-21) is typed in below rather than parsed — the table
layout wraps names and notes across lines. Three phases of two weeks, five sessions a
week: Mon/Fri = A, Tue/Thu = B, Wed = C.
"""
import json
import re
from pathlib import Path

DATA = Path(__file__).resolve().parent
LIB = DATA / "library.json"
BAND = DATA / "pjf_band_database.json"
PROGRAM_ID = "pjf_extended_band_6wk"

# Strength moves get a primary muscle so Lift's swap sheet can offer alternatives.
MUSCLE = {
    "Front Raise": "shoulders", "Shoulder Press": "shoulders", "1 Arm Shoulder Press": "shoulders",
    "Front Raise with Lateral Step": "shoulders", "Double Arm Press": "shoulders",
    "Tricep Extension": "triceps", "Max Iso Triceps": "triceps",
    "Bicep Curl": "biceps", "Max Iso Bicep Curls": "biceps",
    "Lateral Raise": "side_delts", "Defensive Shoulder Raises": "side_delts",
    "Bent Over Cross Body Row": "upper_back", "Bent Over 1 Arm Row": "lats",
    "Half Kneel Rotational Row": "upper_back", "Band Pullover": "lats",
    "Band Pull Apart": "rear_delts", "Double Arm Fly": "chest", "Band Resisted Push Up": "chest",
    "Split Stance 1 Arm Rotational Press": "chest",
    "Maximal Overcoming Hamstring Isometric": "hamstrings", "Supine Hamstring Curl": "hamstrings",
    "Stationary 1 Leg Hamstring Curl": "hamstrings", "1 Leg RDL with Hand Support": "hamstrings",
    "3D 1 Leg RDL with Hand Support": "hamstrings", "3D 1 Leg RDL": "hamstrings",
    "Maximal Post Chain Isometric": "hamstrings",
    "Supine Quad Extension Iso": "quads", "2 Leg TKE": "quads", "2 Leg Full Range TKE": "quads",
    "1 Leg Supported TKE": "quads", "1 Leg TKE Squat": "quads", "Band Resisted RFESS": "quads",
    "Forward Lunge Isometric": "quads", "Slider Lunge": "quads", "Lateral Lunge": "quads",
    "3D Lateral Lunge": "quads",
    "Stationary Hip Flexor Raise": "hips", "RDL Step Back Hip Flexor Raise": "hips",
    "Adductor Step Overs": "hips", "Abductor Raises": "glutes", "Abductor Lateral Tilts": "glutes",
    "Adductor Lateral Tilts": "hips",
}

RPE8 = ("Aim for RPE 8/10: a solid burn in the target muscles while leaving several reps "
        "in the tank. Not true failure.")
RPE9 = ("Aim for RPE 9/10: a huge burn in the target muscles without compromising form.")
SETUP = ("Not sure how to set up the band? Watch the category overview video in the band "
         "database.")

# (name, sets, reps, time, notes, superset)
P1_A = [
    ("3-Way Hip Hinge with Band Distraction", 2, "5 each way", None, SETUP, None),
    ("Split Stance Hip Flexor 2-Way Reach with Band Distraction", 2, "5 each way", None, None, None),
    ("First Step Acceleration Hip Before Knee", 2, "8", None, None, None),
    ("Resisted Skips", 4, "50 ft", None, None, None),
    ("Linear Deceleration", 2, "8", None, None, None),
    ("Resisted Punch Side Steps", 2, "50 ft each leg", None, None, None),
    ("Resisted Step Backs", 2, "50 ft each leg", None, None, None),
    ("Slider Lunge", 3, "10", None, None, None),
    ("1 Leg Supported TKE", 2, "AMRAP (9/10 quad burn)", None, RPE9, None),
]
P1_B = [
    ("Diagonal Split Rotational Reach to Crash Through", 2, "8", None, None, None),
    ("Band Resisted Push Up", 3, "AMRAP (8/10 burn)", None, RPE8, "Superset 2"),
    ("Half Kneel Rotational Row", 3, "AMRAP (8/10 burn)", None, RPE8, "Superset 2"),
    ("Lateral Raise", 3, "AMRAP (8/10 burn)", None, RPE8, "Superset 3"),
    ("Bicep Curl", 3, "AMRAP (8/10 burn)", None, RPE8, "Superset 3"),
    ("Tricep Extension", 3, "AMRAP (8/10 burn)", None, RPE8, "Superset 3"),
]
P1_C = [
    ("Lateral Lunge Adductor Stretch", 2, "8", None, None, None),
    ("Half Kneel Underhand Press with Band Distraction", 2, "8", None, None, None),
    ("Hand Assisted Marching", 2, "10", None, None, None),
    ("Stationary Sprinting", 2, None, "00:00:20", None, None),
    ("Lateral Split Stance Rapid Switches", 2, "AMRAP (8/10 burn)", None, RPE8, None),
    # The program row just says "Resisted Split Stance"; its link is the Rapid Switches video.
    ("Resisted Split Stance Rapid Switches", 3, "6 each", None, None, None),
    ("Resisted Pause Jumps", 3, "6 each", None, None, None),
    ("Maximal Overcoming Hamstring Isometric", 5, None, "00:00:08", None, None),
    ("Supine Quad Extension Iso", 5, None, "00:00:08", None, None),
]
P2_A = [
    ("Step Back Hip Hinge", 2, "15", None, None, None),
    ("Band Around the Back Ankle Circles", 1, None, "00:01:00", "30 seconds each way.", None),
    ("Resisted Straight Leg Bounds", 3, "50 ft", None, None, None),
    ("Resisted 2 Step Acceleration", 3, "50 ft", None, None, None),
    ("Lunge Rapid Switches", 3, "10", None, None, None),
    ("Lateral Split Stance Decels", 3, "10", None, None, None),
    ("3D Lateral Lunge", 3, "10", None, None, None),
    ("3D 1 Leg RDL with Hand Support", 3, "AMRAP (9/10 burn)", None, RPE9, None),
]
P2_B = [
    ("3D Rotation with ER Isometric", 3, "8", None, None, None),
    ("Band Resisted Push Up", 3, "AMRAP (9/10 burn)", None, RPE9, "Superset 2"),
    ("Bent Over 1 Arm Row", 3, "AMRAP (9/10 burn)", None, RPE9, "Superset 2"),
    ("Front Raise", 3, "AMRAP (9/10 burn)", None, RPE9, "Superset 3"),
    ("Bicep Curl", 3, "AMRAP (9/10 burn)", None, RPE9, "Superset 3"),
    ("Tricep Extension", 3, "AMRAP (9/10 burn)", None, RPE9, "Superset 3"),
]
P2_C = [
    ("Supine Long Length Hamstring Raise", 2, "15", None, None, None),
    ("Floating Toes Dorsiflexion with Band Distraction", 2, "15", None, None, None),
    ("Cross Step Change of Direction", 3, "8", None, None, None),
    ("Diagonal Split Floor Touches", 3, "8", None, None, None),
    ("Resisted Repeat Jumps", 3, "8", None, None, None),
    ("Resisted Pogos", 3, "15", None, None, None),
    ("Forward Lunge Isometric", 3, None, "00:00:45", None, None),
    ("Adductor Step Overs", 3, "15", None, None, None),
]
P3_A = [
    ("Back Line/Front Line Stretch", 2, "12", None, None, None),
    ("Curtsy Hinge to Step Through", 2, "12", None, None, None),
    ("Resisted Triple Switch Cycle Overs", 4, "50 ft", None, None, None),
    ("Resisted 1 Leg Cycle Overs", 4, "50 ft", None, None, None),
    ("Resisted Acceleration", 6, "50 ft", None, None, None),
    ("Diagonal Split Lateral Jumps", 3, "8", None, None, None),
    ("Linear 1 Leg Forward Hops", 3, "15", None, None, None),
    ("3D 1 Leg RDL", 3, "AMRAP (9/10 burn)", None, RPE9, None),
    ("Band Resisted RFESS", 3, "15", None, None, None),
]
P3_B = [
    ("Hip Flexor + Rotational Shoulder Press", 3, "12", None, None, None),
    ("Split Stance Lunge Rotational Row", 3, "AMRAP (9/10 burn)", None, RPE9, "Superset 2"),
    ("Split Stance Lunge Rotational Press", 3, "AMRAP (9/10 burn)", None, RPE9, "Superset 2"),
    ("Double Arm Fly", 3, "AMRAP (9/10 burn)", None, RPE9, "Superset 3"),
    ("Band Pullover", 3, "AMRAP (9/10 burn)", None, RPE9, "Superset 3"),
    ("Front Raise with Lateral Step", 3, "AMRAP (9/10 burn)", None, RPE9, "Superset 4"),
    ("Max Iso Bicep Curls", 3, "3 × 4-sec max hold", None, RPE9, "Superset 4"),
    ("Max Iso Triceps", 3, "3 × 4-sec max hold", None, None, "Superset 4"),
]
P3_C = [
    ("Eccentric Forward Step with Reach", 2, "12", None, None, None),
    ("Band Around the Back Plantar Flexion", 2, None, "00:01:00", None, None),
    ("Half Kneel Lateral Jump", 3, "5", None, None, None),
    ("Resisted Step in Jumps", 3, "4", None, None, None),
    ("Resisted RFESS Jumps", 3, "12", None, None, None),
    ("Resisted RFESS Pogos", 3, "20", None, None, None),
    # Named "Maximal Overcoming Hamstring/Hip Flexor Isometric" in the program table.
    ("Maximal Overcoming Hamstring/Hip Flexor Bridge Isometric", 3, "3 × 4-sec max hold", None, None, None),
    ("2 Leg Full Range TKE", 3, "AMRAP (9/10 burn)", None, RPE9, None),
]

PHASES = [
    ("Phase 1", {"A": P1_A, "B": P1_B, "C": P1_C}),
    ("Phase 2", {"A": P2_A, "B": P2_B, "C": P2_C}),
    ("Phase 3", {"A": P3_A, "B": P3_B, "C": P3_C}),
]
# Mon/Fri = A, Tue/Thu = B, Wed = C. Focus names avoid the warm-up keywords (upper, lower,
# legs, push, pull, full) so Lift doesn't attach the BWS gym warm-up. Each band session
# opens with its own mobility.
WEEK = [("A", "Mon"), ("B", "Tue"), ("C", "Wed"), ("B", "Thu"), ("A", "Fri")]
FOCUS = {"A": "Speed, Agility & Strength", "B": "Rotation & Arms (Band)", "C": "Jumps, Mobility & Isos"}


def slugify(name):
    s = re.sub(r"[^\w\s-]", "", name.lower())
    return re.sub(r"[\s_]+", "-", s.strip())


def build_program():
    weeks = []
    for pi, (phase, days) in enumerate(PHASES):
        for wi in range(2):
            week_num = pi * 2 + wi + 1
            week_days = []
            for di, (key, dow) in enumerate(WEEK):
                week_days.append({
                    "day_num": di + 1,
                    "focus": f"{phase} · {dow}: {FOCUS[key]}",
                    "exercises": [{
                        "name": n, "round_group": grp, "is_alternate": False, "sets": sets,
                        "reps": reps, "weight": None, "distance": None, "time": time,
                        "rest": None, "notes": notes,
                    } for (n, sets, reps, time, notes, grp) in days[key]],
                })
            weeks.append({"week_num": week_num, "days": week_days})
    return {
        "program_name": "Extended Band: 6-Week Athleticism",
        "source": "PJF Performance",
        "description": ("Extended-length band only. Three 2-week phases of mobility, speed, "
                        "change of direction, jumping and band strength, 5 days a week. "
                        "Already lifting? Drop the strength work and keep the mobility, speed, "
                        "agility and jumps."),
        "sessions_per_week": 5,
        "level": "Band only",
        "weeks": weeks,
        "id": PROGRAM_ID,
    }


def main():
    lib = json.loads(LIB.read_text())
    band = json.loads(BAND.read_text())

    entries = []
    for e in band["exercises"]:
        name = e["name"]
        entry = {
            "id": "band-" + slugify(name),
            "name": name,
            "video_url": e["video_url"],
            "sources": ["pjf", "band"],
            "aliases": [],
            "fallback_search": None,
            "category": e["category"],
            "equipment": "band",
        }
        if name in MUSCLE:
            entry["primary_muscle"] = MUSCLE[name]
            entry["muscles"] = [MUSCLE[name]]
        entries.append(entry)
    by_name = {x["name"]: x for x in entries}
    by_name["Lateral Split Stance Rapid Switches"]["aliases"].append("Lateral Split Stance Rapid Switching")
    by_name["Maximal Overcoming Hamstring/Hip Flexor Bridge Isometric"]["aliases"].append(
        "Maximal Overcoming Hamstring/Hip Flexor Isometric")

    program = build_program()
    missing = {x["name"] for w in program["weeks"] for d in w["days"] for x in d["exercises"]} - set(by_name)
    if missing:
        raise SystemExit(f"program names not in the band database: {sorted(missing)}")

    existing = {x["name"].lower() for x in lib["exercises"] if "band" not in x.get("sources", [])}
    clash = [x["name"] for x in entries if x["name"].lower() in existing]
    if clash:
        raise SystemExit(f"band names already in the library: {clash}")

    lib["exercises"] = [x for x in lib["exercises"] if "band" not in x.get("sources", [])] + entries
    lib["programs"]["pjf"] = [p for p in lib["programs"]["pjf"] if p.get("id") != PROGRAM_ID] + [program]
    lib["band_overviews"] = band["overviews"]

    ex = lib["exercises"]
    lib["stats"].update({
        "total_exercises": len(ex),
        "with_video": sum(1 for x in ex if x.get("video_url")),
        "pjf_only": sum(1 for x in ex if x["sources"] == ["pjf"]),
        "pjf_programs": len(lib["programs"]["pjf"]),
        "band": len(entries),
    })
    LIB.write_text(json.dumps(lib, indent=2, ensure_ascii=False) + "\n")
    print(f"[wrote] {LIB}: +{len(entries)} band exercises, program {PROGRAM_ID}")


if __name__ == "__main__":
    main()
