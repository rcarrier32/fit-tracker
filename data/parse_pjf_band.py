#!/usr/bin/env python3
"""Extract the PJF Extended Length Band exercise database (PDF, pages 2-11) into JSON.

Each database row is "-Exercise Name   [VIEW EXERCISE]", and the [VIEW EXERCISE] text is a
link annotation to the PJF demo video. Rows are paired with links by vertical position.
Category overview videos ("[OVERVIEW]") are kept separately.

Usage: python3 data/parse_pjf_band.py <path/to/PJF_Extended_Band_Exercise_Database.pdf>
Output: data/pjf_band_database.json
"""
import json
import re
import sys
from pathlib import Path

import pypdf

OUT = Path(__file__).resolve().parent / "pjf_band_database.json"

CATEGORIES = [
    "Stretching/Mobility",
    "Lower Body Strength",
    "Full Body Intergraded Strength",   # sic in the PDF
    "Agility/Change of Direction",
    "Speed",
    "Jumping",
    "Upper Body",
]
CATEGORY_NAME = {"Full Body Intergraded Strength": "Full Body Integrated Strength"}


def page_rows(page):
    """Left-column text lines with their y position."""
    items = []

    def visit(text, cm, tm, fd, fs):
        t = text.strip()
        if t and tm[4] < 400:
            items.append((round(tm[5]), t))

    page.extract_text(visitor_text=visit)
    lines = {}
    for y, t in items:
        key = next((k for k in lines if abs(k - y) <= 3), y)
        lines.setdefault(key, []).append(t)
    return sorted(((y, " ".join(ts)) for y, ts in lines.items()), reverse=True)


def page_links(page):
    out = []
    for a in page.get("/Annots") or []:
        a = a.get_object()
        uri = (a.get("/A") or {}).get("/URI")
        if uri:
            y0, y1 = float(a["/Rect"][1]), float(a["/Rect"][3])
            out.append(((y0 + y1) / 2, str(uri)))
    return sorted(out, reverse=True)


def main(pdf_path):
    reader = pypdf.PdfReader(pdf_path)
    exercises, overviews = [], {}
    category = None
    for page in reader.pages[1:11]:
        rows = page_rows(page)
        for y, uri in page_links(page):
            # Header lines (category titles) sit above the first link, so walk every row.
            for _, text in rows:
                if text in CATEGORIES:
                    category = CATEGORY_NAME.get(text, text)
            y_text, text = min(rows, key=lambda r: abs(r[0] - y))
            name = re.sub(r"^-\s*", "", text).strip()
            name = re.sub(r"(\d) - (?=[A-Za-z])", r"\1-", name)   # "3 - Way" -> "3-Way"
            name = name.replace("Push O ut", "Push Out").replace("2-way", "2-Way")
            url = re.sub(r"\?si=.*$", "", uri)
            if name.lower() == "overview":
                overviews[category] = url
            else:
                exercises.append({"name": name, "category": category, "video_url": url})
    # Drop exact duplicate rows (same name and video).
    seen, unique = set(), []
    for e in exercises:
        k = (e["name"].lower(), e["video_url"])
        if k not in seen:
            seen.add(k)
            unique.append(e)
    OUT.write_text(json.dumps({"source": "PJF Extended Length Band: Exercise Database V.4",
                               "overviews": overviews, "exercises": unique}, indent=2) + "\n")
    print(f"[wrote] {OUT}: {len(unique)} exercises, {len(overviews)} overviews")


if __name__ == "__main__":
    main(sys.argv[1])
