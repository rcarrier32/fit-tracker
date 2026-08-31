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

DATA = Path(__file__).resolve().parent
MEAL_DIR = DATA / "meal_pdfs"
OUT = DATA / "meal_library.json"

CAL_PROT_RE = re.compile(r'^\s*(\d{2,4})\s+(\d{1,3})g\s*$')
FAT_SOD_RE = re.compile(r'^\s*(\d{1,3})g\s*Sodium\s+(\d+)mg\s*$')
CARB_POT_RE = re.compile(r'^\s*(\d{1,3})g\s*Potassium\s+(\d+)mg\s*$')
FIBER_RE = re.compile(r'^\s*Fiber\s+(\d+)g')
# End-anchored variant of FIBER_RE, for skipping a line that's ONLY the fiber fact (no
# hint/tip text sharing its row) — FIBER_RE itself isn't end-anchored, since it's also
# used to pull fiber_g out of a hybrid row that NUTRITION_INLINE_RE hasn't stripped yet.
FIBER_ONLY_RE = re.compile(r'^\s*Fiber\s+\d+g\s*$')
# Some page layouts put a nutrition-fact fragment (Fiber, or "Ng Sodium Mmg" / "Ng
# Potassium Mmg") on the SAME row as trailing hint/tip text — a third column between the
# ingredient list and the instructions, e.g. "13g Sodium        880mg      with Fruit -
# 400-500" on the app.". Stripped from the front of a line before the normal column split
# runs, so neither the fact itself nor a stray "880mg" fragment leaks into an ingredient
# or into the instructions text right where MFP_RE is hunting for a closing quote.
NUTRITION_INLINE_RE = re.compile(
    r'^\s*(?:Fiber\s+\d+g|\d+g\s*Sodium\s+\d+mg|\d+g\s*Potassium\s+\d+mg)\s{2,}'
)
# The "BWS " prefix is optional (the Recipe Book source omits it), and the quoted hint
# frequently line-wraps in the -layout text dump — searched against the already
# column-isolated instructions text (built in step 2), never the raw page, see parse_page.
MFP_RE = re.compile(r'searching\s*[\"“”](?:BWS\s+)?([^\"“”]+?)[\"“”]', re.IGNORECASE)
CAL_BAND_RE = re.compile(r'(\d{3,4})-?(\d{3,4})?\s*calories', re.IGNORECASE)
TIME_RE = re.compile(r'^\s*\d{1,3}\s*MINUTES?\s*$', re.IGNORECASE)

# Lines that look like an ingredient: usually short, often have parens with measurements
ING_PARENS_RE = re.compile(r'\([^)]{2,}\)')

def norm_name(s):
    s = re.sub(r'\s+', ' ', s).strip()
    s = re.sub(r'\s*-\s*\d{3,4}\+?(?:-\d{3,4})?\s*$', '', s)  # strip trailing "-200-300" / "-800+"
    s = re.sub(r'^BWS\s+', '', s, flags=re.IGNORECASE)
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

    # 2. Ingredients + instructions.
    # Heuristic: lines below the time stamp ("15 MINUTES") have ingredients on the left,
    # instructions (and, further down some layouts, the MFP hint + tips) on the right,
    # split by 3+ spaces. Scans the WHOLE rest of the page, not just up to the calorie
    # line — some sources put the hint sentence and tips after the nutrition block, and
    # confining the scan to before it silently dropped that content and the recipe's
    # only reliable name signal along with it (see MFP_RE / step 3 below).
    start = 0
    for i, l in enumerate(lines):
        if TIME_RE.match(l):
            start = i + 1
            break
    block = lines[start:]
    ingredients = []
    instructions = []
    for l in block:
        if not l.strip(): continue
        # Skip "Go to the recipe" and similar, and the page footer byline.
        if 'go to the recipe' in l.lower() or 'contact@' in l.lower(): continue
        # Pure nutrition-fact lines (calories/fat+sodium/carbs+potassium) carry no
        # ingredient or instruction text at all — never candidates for either column.
        if CAL_PROT_RE.match(l) or FAT_SOD_RE.match(l) or CARB_POT_RE.match(l) or FIBER_ONLY_RE.match(l): continue
        l = NUTRITION_INLINE_RE.sub('', l)
        if not l.strip(): continue
        # Split on 3+ spaces — left = ingredient, right = instruction. The ingredient
        # column is itself indented (a left margin, not a column boundary) — split on
        # the STRIPPED line, or maxsplit=1 fires on that leading run and "left" comes
        # back empty with the real ingredient text still glued to the instruction side.
        parts = re.split(r'\s{3,}', l.strip(), maxsplit=1)
        if len(parts) == 2:
            left, right = parts[0].strip(), parts[1].strip()
            if left: ingredients.append(left)
            if right: instructions.append(right)
        else:
            single = parts[0].strip()
            if not single: continue
            # A bare quote-close/calorie-band tail — '- 200-300" on the app.', or an
            # ingredient-column word that the hint sentence's closing quote landed on top
            # of, e.g. 'Cucumbers" on the app.' — is short and parens-free like an
            # ingredient, but it's the END of the hint sentence, not an ingredient. Must
            # be `search`, not `match`: "on the app" is frequently NOT at the start of the
            # fragment. Route it back to instructions or MFP_RE loses its closing quote
            # and the recipe silently loses its only reliable name signal. "enjoy!" gets
            # the same treatment for a different reason — it's always the tail of a step
            # sentence ("...and enjoy!"), never an ingredient, and at 1-2 words it easily
            # passes the short-line ingredient heuristic below. A trailing period is the
            # general case of the same problem: a substitution tip ("...ground turkey or
            # chicken.") can wrap with nothing but its last word on the next line —
            # "chicken." — which is short and parens-free enough to read as an ingredient,
            # and would then get glued onto whatever real ingredient came before it by the
            # lowercase-continuation rejoin downstream. No real ingredient in this dataset
            # ends in a sentence period, so this is a safe, general tell.
            if (re.match(r'^[-–]\s*\d', single) or re.search(r'on the app\b', single, re.IGNORECASE)
                    or re.search(r'\benjoy!?\s*$', single, re.IGNORECASE)
                    or re.search(r'\.\s*$', single)):
                instructions.append(single)
            # If line is short and parens-like, ingredient. Otherwise instruction.
            elif (len(single) < 60 and (ING_PARENS_RE.search(single) or len(single.split()) <= 6)):
                ingredients.append(single)
            else:
                instructions.append(single)

    if ingredients: meal['ingredients'] = ingredients
    if instructions: meal['instructions'] = ' '.join(instructions)

    # 3. Find name via MyFitnessPal hint or page heading.
    # The hint sentence often wraps across 2+ physical lines in the -layout dump, so a
    # single-line regex misses it — search the already-reconstructed instructions text
    # instead of the raw page. Pages routinely carry a THIRD column (nutrition facts:
    # "Fiber 3g") positioned between the ingredient and instruction columns; naively
    # flattening the whole page interleaves that column's text into the middle of the
    # hint sentence ("BWS BBQ Chicken, Rice & Broccoli\nFiber 3g\n- 200-300" reads as
    # one line in -layout output). `instructions` is built from the RIGHT half of each
    # split line only, so it's already immune to that — the nutrition-facts numbers
    # live in dedicated fixed-format lines (CAL_PROT_RE etc.) that never reach it.
    mh = MFP_RE.search(meal.get('instructions', ''))
    if mh:
        meal['name'] = norm_name(mh.group(1))
        meal['name_source'] = 'mfp_hint'
    if 'name' not in meal:
        # Fallback: first non-empty heading-ish line. Apply the same 3+-space
        # column split used for ingredients/instructions above so a line that's
        # really "<ingredient>   <instruction>" doesn't get read as one heading.
        for line in lines[:8]:
            left = re.split(r'\s{3,}', line.strip(), maxsplit=1)[0]
            s = left.strip()
            if not s or len(s) < 4: continue
            if any(skip in s.lower() for skip in ['minutes', 'calories', 'recipe', 'go to', 'contact@']): continue
            if re.match(r'^[A-Z]', s) and len(s.split()) <= 10:
                meal['name'] = s
                meal['name_source'] = 'fallback_heading'
                break

    # 4. Calorie band (e.g. "500-600 calories")
    for line in lines[:30]:
        mb = CAL_BAND_RE.search(line)
        if mb:
            lo = int(mb.group(1))
            hi = int(mb.group(2)) if mb.group(2) else lo + 100
            meal['cal_band'] = f"{lo}-{hi}"
            break

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
