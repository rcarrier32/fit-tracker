#!/usr/bin/env python3
"""Extract meal library from BWS meal plan PDF text dumps.

v2: page-based parsing.
- pdftotext -layout output has page-feed (\f) separators.
- Within a page, find: meal name, calorie band, calories+macros, ingredients block, instructions block.
- Dedupe by canonical name + calorie band so "Savory Arugula Oatmeal (300-400)" and "(500-600)" become
  variants of one recipe.
"""
import json
import re
from pathlib import Path

DATA = Path("/Users/carriermac/Downloads/fit-tracker/data")
MEAL_DIR = DATA / "meal_pdfs"
OUT = DATA / "meal_library.json"

CAL_PROT_RE = re.compile(r'^\s*(\d{2,4})\s+(\d{1,3})g\s*$')
FAT_SOD_RE = re.compile(r'^\s*(\d{1,3})g\s*Sodium\s+(\d+)mg\s*$')
CARB_POT_RE = re.compile(r'^\s*(\d{1,3})g\s*Potassium\s+(\d+)mg\s*$')
FIBER_RE = re.compile(r'^\s*Fiber\s+(\d+)g')
MFP_RE = re.compile(r'searching\s*[\"“”](BWS [^\"“”]+?)[\"“”]', re.IGNORECASE)
CAL_BAND_RE = re.compile(r'(\d{3,4})-?(\d{3,4})?\s*calories', re.IGNORECASE)
TIME_RE = re.compile(r'^\s*\d{1,3}\s*MINUTES\s*$', re.IGNORECASE)

# Lines that look like an ingredient: usually short, often have parens with measurements
ING_PARENS_RE = re.compile(r'\([^)]{2,}\)')

def norm_name(s):
    s = s.strip()
    s = re.sub(r'\s*-\s*\d{3,4}-?\d*\s*$', '', s)  # strip trailing "-200-300"
    s = re.sub(r'BWS\s+', '', s, flags=re.IGNORECASE)
    return s.strip()

def parse_page(page_text, source):
    """Parse a single page of a meal plan PDF and return one meal dict, or None."""
    lines = page_text.splitlines()
    meal = {"source": source}

    # 1. Find calories + macros (the canonical signal that this is a meal page)
    cal_idx = None
    for i, line in enumerate(lines):
        m = CAL_PROT_RE.match(line)
        if m:
            cal = int(m.group(1))
            prot = int(m.group(2))
            if 100 <= cal <= 1500 and 1 <= prot <= 120:
                cal_idx = i
                meal['calories'] = cal
                meal['protein_g'] = prot
                break
    if cal_idx is None: return None

    for j in range(cal_idx + 1, min(cal_idx + 8, len(lines))):
        l = lines[j]
        mf = FAT_SOD_RE.match(l)
        if mf and 'fat_g' not in meal:
            meal['fat_g'] = int(mf.group(1))
            continue
        mc = CARB_POT_RE.match(l)
        if mc and 'carbs_g' not in meal:
            meal['carbs_g'] = int(mc.group(1))
            continue
        mfib = FIBER_RE.match(l)
        if mfib and 'fiber_g' not in meal:
            meal['fiber_g'] = int(mfib.group(1))

    # 2. Find name via MyFitnessPal hint or page heading
    for line in lines:
        mh = MFP_RE.search(line)
        if mh:
            meal['name'] = norm_name(mh.group(1))
            break
    if 'name' not in meal:
        # Fallback: first non-empty heading-ish line
        for line in lines[:8]:
            s = line.strip()
            if not s or len(s) < 4: continue
            if any(skip in s.lower() for skip in ['minutes', 'calories', 'recipe', 'go to', 'contact@']): continue
            if re.match(r'^[A-Z]', s) and len(s.split()) <= 10:
                meal['name'] = s
                break

    # 3. Calorie band (e.g. "500-600 calories")
    for line in lines[:30]:
        mb = CAL_BAND_RE.search(line)
        if mb:
            lo = int(mb.group(1))
            hi = int(mb.group(2)) if mb.group(2) else lo + 100
            meal['cal_band'] = f"{lo}-{hi}"
            break

    # 4. Ingredients + instructions
    # Heuristic: lines below the time stamp ("15 MINUTES") and before nutrition
    # have ingredients on left, instructions on right (split by 3+ spaces).
    start = 0
    for i, l in enumerate(lines):
        if TIME_RE.match(l):
            start = i + 1
            break
    end = cal_idx
    block = lines[start:end]
    ingredients = []
    instructions = []
    for l in block:
        if not l.strip(): continue
        # Skip "Go to the recipe" and similar
        if 'go to the recipe' in l.lower() or 'contact@' in l.lower(): continue
        # Split on 3+ spaces — left = ingredient, right = instruction
        parts = re.split(r'\s{3,}', l, maxsplit=1)
        if len(parts) == 2:
            left, right = parts[0].strip(), parts[1].strip()
            if left: ingredients.append(left)
            if right: instructions.append(right)
        else:
            single = parts[0].strip()
            if not single: continue
            # If line is short and parens-like, ingredient. Otherwise instruction.
            if (len(single) < 60 and (ING_PARENS_RE.search(single) or len(single.split()) <= 6)):
                ingredients.append(single)
            else:
                instructions.append(single)

    if ingredients: meal['ingredients'] = ingredients
    if instructions: meal['instructions'] = ' '.join(instructions)

    return meal

def main():
    by_recipe = {}  # canonical name -> recipe with variants
    for txt in sorted(MEAL_DIR.glob("*.txt")):
        source = txt.stem
        text = txt.read_text(errors='replace')
        # Split by form-feed for page boundaries
        pages = text.split('\f')
        page_meals = 0
        for page in pages:
            m = parse_page(page, source)
            if not m or 'name' not in m: continue
            page_meals += 1
            name = m['name']
            key = name.lower().strip()
            if key not in by_recipe:
                by_recipe[key] = {
                    "name": name,
                    "category": categorize(source),
                    "ingredients": m.get('ingredients'),
                    "instructions": m.get('instructions'),
                    "sources": set(),
                    "variants": [],
                }
            entry = by_recipe[key]
            entry['sources'].add(source)
            # Prefer fuller ingredient/instruction lists
            if m.get('ingredients') and (not entry.get('ingredients') or len(m['ingredients']) > len(entry.get('ingredients') or [])):
                entry['ingredients'] = m['ingredients']
            if m.get('instructions') and (not entry.get('instructions') or len(m['instructions']) > len(entry.get('instructions') or '')):
                entry['instructions'] = m['instructions']
            entry['variants'].append({
                "cal_band": m.get('cal_band'),
                "calories": m['calories'],
                "protein_g": m.get('protein_g'),
                "fat_g": m.get('fat_g'),
                "carbs_g": m.get('carbs_g'),
                "fiber_g": m.get('fiber_g'),
                "source": source,
            })
        print(f"  {source}: {page_meals} meals from {len(pages)} pages")

    # Finalize: pick a default variant per recipe (median calories)
    recipes = []
    for key, r in by_recipe.items():
        # Sort variants by calories
        r['variants'].sort(key=lambda v: v['calories'])
        # Default = median
        mid = r['variants'][len(r['variants']) // 2]
        r['default_calories'] = mid['calories']
        r['default_protein_g'] = mid['protein_g']
        r['default_fat_g'] = mid['fat_g']
        r['default_carbs_g'] = mid['carbs_g']
        r['sources'] = sorted(r['sources'])
        recipes.append(r)
    recipes.sort(key=lambda r: r['name'].lower())

    out = {
        "recipes": recipes,
        "stats": {
            "total_recipes": len(recipes),
            "with_ingredients": sum(1 for r in recipes if r.get('ingredients')),
            "with_instructions": sum(1 for r in recipes if r.get('instructions')),
            "by_category": {c: sum(1 for r in recipes if r['category'] == c)
                            for c in set(r['category'] for r in recipes)},
            "total_variants": sum(len(r['variants']) for r in recipes),
        }
    }
    OUT.write_text(json.dumps(out, indent=2))
    print(f"\n[wrote] {OUT}")
    for k, v in out['stats'].items():
        print(f"  {k}: {v}")

def categorize(source_label):
    s = source_label.lower()
    if 'breakfast' in s: return 'breakfast'
    if 'lunch' in s: return 'lunch'
    if 'dinner' in s: return 'dinner'
    if 'snack' in s: return 'snack'
    if 'meal_plan' in s or 'meal plan' in s: return 'plan'
    if 'recipe' in s: return 'recipe'
    if 'budget' in s: return 'budget'
    if '5min' in s: return 'quick'
    return 'other'

if __name__ == "__main__":
    main()
