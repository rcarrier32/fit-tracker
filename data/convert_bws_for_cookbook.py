#!/usr/bin/env python3
"""
Convert the BWS PDF extractions into Family Cooking App recipe entries.

Why this isn't just a reshape of meal_library.json: that file collapses every page of
a recipe (one page per calorie band) into ONE "best" ingredient list picked by whichever
page happened to have the most items — there's no link from a specific variant's
calories back to the specific ingredient quantities that produced them. Re-parses the
same PDF text dumps here (reusing extract_meals.parse_page) but keeps every page intact,
so "the middle calorie band" and "that band's own ingredient list" are the same page.

Per recipe: pick the middle calorie-band page (by calories, not an average), double
every parsed ingredient quantity for a 2-person batch, keep macros_per_serving at the
printed middle-band value — per-serving macros don't change when a batch is doubled.
"""
import json
import re
import sys
from collections import defaultdict
from fractions import Fraction
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import extract_meals as em  # reuse parse_page / categorize / norm_name — see that file for the PDF-layout parsing itself

# Writes directly into the sibling Family Cooking App repo rather than somewhere in
# fit-tracker for a manual copy step — there's no clean relative path between two
# independent sibling repos on the same machine, so this is a deliberate absolute path,
# not a leftover from before the repo moved (compare extract_meals.py's history).
OUT = Path("/Users/carriermac/Developer/Family Cooking App/data/bws-recipes.json")

# Sources that are restaurant-ordering suggestions, not home-cooked recipes (same
# exclusion already applied to fit-tracker's own meal_library.json).
EXCLUDED_SOURCES = {"BWS_Recipe_Book_200-800__Calorie_Fast_Food"}

QTY_TOKEN_RE = re.compile(r'(\d+\s+\d+/\d+|\d+/\d+|\d+\.\d+|\d+)(?!\s*%)')

TIP_MARKERS = (
    'log this meal', 'myfitnesspal', 'searching "', "searching “",
    'aim for', 'substitute', "if you don't have", "if you don’t have",
    'optional:', 'check out our', 'goes great with',
)

PROTEIN_KEYWORDS = [
    ('chicken', 'chicken'),
    ('turkey', 'turkey'),
    ('beef', 'beef'), ('steak', 'beef'), ('sirloin', 'beef'), ('ground beef', 'beef'),
    ('salmon', 'salmon'),
    ('shrimp', 'shrimp'),
    ('tuna', 'tuna'),
    ('cod', 'fish'), ('tilapia', 'fish'), ('white fish', 'fish'), ('halibut', 'fish'),
    ('egg', 'egg'),
]
# Category enum is narrower than Protein (types.ts) — seafood covers salmon/shrimp/tuna/fish,
# and anything without a real meat match falls to 'breakfast', the app's own documented
# catch-all for "no detected protein" (matches extract.py's own categorize() convention).
PROTEIN_TO_CATEGORY = {
    'chicken': 'chicken', 'turkey': 'turkey', 'beef': 'beef',
    'salmon': 'seafood', 'shrimp': 'seafood', 'tuna': 'seafood', 'fish': 'seafood',
}


def parse_frac(s):
    s = s.strip()
    m = re.match(r'^(\d+)\s+(\d+)/(\d+)$', s)
    if m:
        return Fraction(int(m.group(1))) + Fraction(int(m.group(2)), int(m.group(3)))
    m = re.match(r'^(\d+)/(\d+)$', s)
    if m:
        return Fraction(int(m.group(1)), int(m.group(2)))
    if '.' in s:
        return Fraction(s).limit_denominator(100)
    return Fraction(int(s))


def format_frac(f):
    whole = f.numerator // f.denominator
    rem = f - whole
    if rem == 0:
        return str(whole)
    rem = Fraction(rem).limit_denominator(8)  # snap to common cooking fractions
    return f"{rem.numerator}/{rem.denominator}" if whole == 0 else f"{whole} {rem.numerator}/{rem.denominator}"


# Family Cooking App's own ingredient parser (src/lib/parse.ts) requires the quantity to
# LEAD the line — "600g (21oz) Chicken Breast, cut into strips" — and rewrites only that
# leading span when a recipe is scaled. BWS writes the opposite order, name first, quantity
# buried in a trailing paren: "Chicken Breast (3 oz; boneless, skinless)". Left as-is, that
# quantity is invisible to the app: no shopping-list amount, and — the one that actually
# matters — scaling to a different serving count would never touch it at all. This restructures
# each line into the app's own grammar instead of just doubling the number in place.
UNIT_WORDS = {
    'g', 'gram', 'grams', 'kg', 'kilo', 'kilos',
    'ml', 'millilitre', 'milliliter', 'l', 'litre', 'liter',
    'tsp', 'teaspoon', 'teaspoons', 'tbsp', 'tablespoon', 'tablespoons',
    'cup', 'cups', 'oz', 'ounce', 'ounces', 'lb', 'lbs', 'pound', 'pounds',
}


def find_balanced_parens(text):
    """[(start, end, inner_text), ...] for each top-level (...) group — nested parens
    ("Non Fat (0%) Plain Greek Yogurt (1/3 cup)" has two SIBLING groups, not nested, but
    depth-tracking still matters so a comma or paren inside one group doesn't confuse it)."""
    groups, depth, start = [], 0, None
    for i, c in enumerate(text):
        if c == '(':
            if depth == 0:
                start = i
            depth += 1
        elif c == ')':
            depth = max(0, depth - 1)
            if depth == 0 and start is not None:
                groups.append((start, i + 1, text[start + 1:i]))
                start = None
    return groups


def reformat_and_double(text):
    """Doubles the quantity AND moves it (plus its unit, if recognized) to the front of the
    line, matching "qty unit item, prep" — the only shape parse.ts's `LEADING` regex reads.
    The first paren group that actually contains a real quantity (skipping one like "(0%)",
    where the number isn't an amount to scale) is treated as the source; anything else in
    that same paren becomes trailing prep text. A line with no such paren ("Sea Salt",
    "Cinnamon") is left untouched — matches the app's own qty:null / UNCOUNTABLE handling,
    the correct outcome for a quantity BWS never stated in the first place."""
    for start, end, content in find_balanced_parens(text):
        m = QTY_TOKEN_RE.search(content)
        if not m:
            continue
        try:
            doubled = format_frac(parse_frac(m.group(1)) * 2)
        except (ValueError, ZeroDivisionError):
            continue
        rest = content[m.end():]
        unit_m = re.match(r'\s*([a-zA-Z]+)\.?', rest)
        unit_word = unit_m.group(1) if unit_m and unit_m.group(1).lower() in UNIT_WORDS else None
        after_unit = rest[unit_m.end():] if (unit_m and unit_word) else rest
        extra = after_unit.strip(' ;,')
        item_name = re.sub(r'\s+', ' ', (text[:start] + text[end:])).strip()
        prefix = f'{doubled} {unit_word}' if unit_word else doubled
        return f'{prefix} {item_name}, {extra}' if extra else f'{prefix} {item_name}'
    return text


def detect_protein(ingredients, name):
    text = (name + ' ' + ' '.join(ingredients)).lower()
    for keyword, protein in PROTEIN_KEYWORDS:
        if keyword in text:
            return protein
    return 'none'


def steps_and_tips(instructions):
    """Splits the merged instruction paragraph into discrete cook-mode steps, routing
    MFP-hint / substitution / calorie-aim asides to tips instead — cook mode shows one
    step at a time and none of them should be "log this on MyFitnessPal"."""
    sentences = re.split(r'(?<=[.!])\s+(?=[A-Z])', instructions.strip())
    steps, tips = [], []
    for s in sentences:
        s = s.strip()
        if not s:
            continue
        if any(marker in s.lower() for marker in TIP_MARKERS):
            tips.append(s)
        else:
            steps.append(s)
    return steps, tips


def slugify(name):
    s = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
    return re.sub(r'-{2,}', '-', s)


JUNK_INGREDIENT_RE = re.compile(
    r'^(and\s+)?enjoy!?$|^…+$|^\.{3}$|^would be\b|^on the app\.?$', re.IGNORECASE
)


def clean_ingredients(items):
    """Two residual PDF-layout artifacts, fixed as a post-pass rather than in the
    line-by-line parser: (1) a long ingredient name wraps to a second physical line with
    nothing on its right side, e.g. "Whole Wheat Spaghetti (about" / "3 cups)" — read as
    two separate ingredients instead of one; rejoined here by detecting an unclosed paren
    or a continuation that starts lowercase/with a closing paren. (2) stray tip/hint
    fragments ("and enjoy!", "…") that still made it through — dropped outright."""
    joined = []
    for item in items:
        if JUNK_INGREDIENT_RE.match(item.strip()):
            continue  # drop outright — must happen before the rejoin check below, or a
            # junk fragment that happens to start lowercase ("and enjoy!") gets glued onto
            # the previous real ingredient instead of being discarded.
        if joined and (re.match(r'^[a-z)]', item) or joined[-1].count('(') > joined[-1].count(')')):
            joined[-1] = f'{joined[-1]} {item}'
        else:
            joined.append(item)
    return joined


def main():
    # canonical name -> list of page dicts (each a full parse_page() result)
    by_recipe = defaultdict(list)
    for txt in sorted(em.MEAL_DIR.glob('*.txt')):
        source = txt.stem
        if source in EXCLUDED_SOURCES:
            continue
        text = txt.read_text(errors='replace')
        for page in text.split('\f'):
            m = em.parse_page(page, source)
            if not m or 'name' not in m or not m.get('ingredients') or not m.get('instructions'):
                continue
            key = m['name'].lower().strip()
            by_recipe[key].append(m)

    recipes = []
    skipped_single_ingredient = 0
    for key, pages in by_recipe.items():
        pages.sort(key=lambda p: p['calories'])
        mid = pages[len(pages) // 2] if len(pages) % 2 else pages[(len(pages) - 1) // 2]
        name = mid['name']
        ingredients = clean_ingredients(mid.get('ingredients') or [])
        # A single-item "ingredient list" (e.g. "Banana (small, frozen)") is a whole-food
        # snack, not a cooked recipe with steps — not what this conversion is for.
        if len(ingredients) < 2:
            skipped_single_ingredient += 1
            continue

        doubled = [reformat_and_double(i) for i in ingredients]
        protein = detect_protein(ingredients, name)
        steps, tips = steps_and_tips(mid['instructions'])
        if not steps:
            continue

        recipes.append({
            "id": slugify(name),
            "title": name,
            "blurb": f"From Built With Science, {mid['calories']} kcal per serving — doubled here for two.",
            "protein": protein,
            "category": PROTEIN_TO_CATEGORY.get(protein, 'breakfast'),
            "servings": 2,
            "batch_cook": False,
            "macros_per_serving": {
                "calories": mid['calories'],
                "protein_g": mid.get('protein_g') or 0,
                "carbs_g": mid.get('carbs_g') or 0,
                "fat_g": mid.get('fat_g') or 0,
            },
            "macros_estimated": False,
            "_macros_basis": (
                f"BWS-measured, {mid.get('cal_band') or mid['calories']} calorie band, one serving; "
                f"ingredient quantities doubled from that band's printed list for two servings."
            ),
            "ingredient_groups": [{"section": None, "items": doubled}],
            "steps": steps,
            "tips": tips,
            "_bws_source": mid['source'],
            "_bws_all_bands": [p['calories'] for p in pages],
        })

    recipes.sort(key=lambda r: r['title'].lower())

    # Slugified titles can collide (two dishes that only differ by punctuation) — the app's
    # own dataIntegrityReport fails the build on a duplicate id, so catch it here instead.
    seen_ids = {}
    for r in recipes:
        if r['id'] in seen_ids:
            seen_ids[r['id']] += 1
            r['id'] = f"{r['id']}-{seen_ids[r['id']]}"
        else:
            seen_ids[r['id']] = 1

    out = {
        "_readme": [
            "Converted from Built With Science PDF meal-plan/coaching-guide extractions —",
            "see fit-tracker's data/convert_bws_for_cookbook.py (and extract_meals.py, which",
            "does the actual PDF-layout parsing). Not hand-authored, so origin is 'bws', not",
            "'added' — no source_url (a PDF program, not a web page) and no photo_credit (no",
            "photo). Never in family-set.json on generation; promoting one is the same",
            "one-line edit as promoting an added recipe.",
            "",
            "BWS prints each dish across several calorie bands sized for one dieter. This",
            "picks the MIDDLE band per recipe and doubles every parsed ingredient quantity",
            "into a 2-serving batch — macros_per_serving is left at that band's printed,",
            "measured value, since per-serving macros don't change when a batch doubles.",
            "`_macros_basis` on each recipe records which band it came from.",
            "",
            "Regenerate with: python3 convert_bws_for_cookbook.py (from fit-tracker/data/).",
            "Re-running OVERWRITES this file — any hand edits belong in corrections.json",
            "instead, exactly like the book's recipes.",
        ],
        "recipes": recipes,
    }
    OUT.write_text(json.dumps(out, indent=2))
    print(f"[wrote] {OUT}")
    print(f"  recipes: {len(recipes)}")
    print(f"  skipped (single-ingredient, not a real recipe): {skipped_single_ingredient}")
    by_cat = defaultdict(int)
    for r in recipes:
        by_cat[r['category']] += 1
    print(f"  by category: {dict(by_cat)}")


if __name__ == "__main__":
    main()
