from ..core.constants import VALID_SKIN_TYPES, VALID_CONCERNS, VALID_AVOID, PRODUCT_SHEETS
from ..core.display import print_profile_summary, print_results, get_summary

def run_interactive(engine):
    print("\n" + "=" * 70)
    print("  CHROMASCOPE — Skin Profile Setup")
    print("=" * 70)

    # Step 1: Skin type
    print("\n  STEP 1 — Select skin type:\n")
    for i, st in enumerate(VALID_SKIN_TYPES, 1):
        print(f"    {i}. {st.replace('_',' ').title()}")
    while True:
        try:
            skin_type = VALID_SKIN_TYPES[int(input("\n  Enter number: ").strip()) - 1]
            break
        except (ValueError, IndexError):
            print("  Invalid. Enter 1-5.")

    # Step 2: Concerns
    print("\n  STEP 2 — Skin concerns (optional, comma-separated or Enter to skip):\n")
    for i, c in enumerate(VALID_CONCERNS, 1):
        print(f"    {i}. {c.replace('_',' ').title()}")
    concerns_input = input("\n  Enter numbers: ").strip()
    concerns = []
    if concerns_input:
        for n in concerns_input.split(","):
            try: concerns.append(VALID_CONCERNS[int(n.strip()) - 1])
            except: pass

    # Step 3: Avoid ingredients
    print("\n  STEP 3 — Avoid ingredients (optional, comma-separated or Enter to skip):\n")
    for i, a in enumerate(VALID_AVOID, 1):
        print(f"    {i:2}. {a.replace('_',' ').title()}")
    avoid_input = input("\n  Enter numbers: ").strip()
    avoid_ingredients = []
    if avoid_input:
        for n in avoid_input.split(","):
            try: avoid_ingredients.append(VALID_AVOID[int(n.strip()) - 1])
            except: pass

    # Step 4: Category
    cats = ["All"] + list(PRODUCT_SHEETS.keys())
    print("\n  STEP 4 — Filter by category (optional):\n")
    for i, c in enumerate(cats, 1):
        print(f"    {i}. {c}")
    cat_input = input("\n  Enter number (or Enter for All): ").strip()
    category = None
    if cat_input:
        try:
            idx = int(cat_input) - 1
            if idx > 0: category = cats[idx]
        except: pass

    print_profile_summary(skin_type, concerns, avoid_ingredients)
    results = engine.filter(skin_type, concerns, avoid_ingredients, category)
    print_results(results)
    s = get_summary(results)
    print(f"\n  → {s['safe_count']} safe | {s['flagged_count']} flagged | {s['excluded_count']} excluded\n")

def run_examples(engine):
    examples = [
        {"label": "Acne-prone + Sensitive, avoid Fragrance & Coconut Oil (Lip)",
         "skin_type": "acne_prone", "concerns": ["sensitive"],
         "avoid_ingredients": ["fragrance", "coconut_oil"], "category": "Lip"},
        {"label": "Dry skin, avoid Alcohol & Fragrance (all categories)",
         "skin_type": "dry", "concerns": [],
         "avoid_ingredients": ["fragrance", "alcohol"], "category": None},
        {"label": "Normal + Pregnancy-safe, avoid Octinoxate (Face)",
         "skin_type": "normal", "concerns": ["pregnancy"],
         "avoid_ingredients": ["octinoxate"], "category": "Face"},
    ]
    for ex in examples:
        print("\n" + "=" * 70)
        print(f"  {ex['label']}")
        print_profile_summary(ex["skin_type"], ex["concerns"], ex["avoid_ingredients"])
        results = engine.filter(**{k: v for k, v in ex.items() if k != "label"})
        print_results(results)
        s = get_summary(results)
        print(f"  → {s['safe_count']} safe | {s['flagged_count']} flagged | {s['excluded_count']} excluded\n")