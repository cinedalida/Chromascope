def print_results(results: list, show_flagged_details: bool = True):
    safe     = [r for r in results if r["verdict"] == "safe"]
    caution  = [r for r in results if r["verdict"] == "caution"]  
    excluded = [r for r in results if r["verdict"] == "excluded"]

    print(f"  ✓  SAFE     : {len(safe)}")
    print(f"  ⚠  CAUTION  : {len(caution)}")         
    print(f"  ✕  EXCLUDED : {len(excluded)}")

    sections = [
        ("✓  SAFE — Recommended", safe),
        ("⚠  CAUTION — Use with care", caution),     
        ("✕  EXCLUDED — Not recommended", excluded),
    ]
    
    for title, section in sections:
        if not section: continue
        print(f"\n  {title}")
        print("  " + "-" * 60)
        for r in section:
            print(f"\n  [{r['product_id']}] {r['brand']} — {r['product_name']}")
            print(f"       Category : {r['category']} / {r['sub_category']}")
            if r.get("price"):        print(f"       Price    : {r['price']}")
            if r.get("where_to_buy"): print(f"       Buy at   : {r['where_to_buy'][:55]}")
            if r.get("season_tags"):  print(f"       Seasons  : {r['season_tags'][:60]}")
            
            if show_flagged_details and r.get("flagged_ingredients"):
                for fi in r["flagged_ingredients"]:
                    print(f"         ⚑  {fi[:65]}")

def get_summary(results: list) -> dict:
    safe     = [r for r in results if r["verdict"] == "safe"]
    caution  = [r for r in results if r["verdict"] == "caution"]   
    excluded = [r for r in results if r["verdict"] == "excluded"]
    return {
        "total":             len(results),
        "safe_count":        len(safe),
        "caution_count":     len(caution),             
        "excluded_count":    len(excluded),
        "safe_products":     safe,
        "caution_products":  caution,                   
        "excluded_products": excluded,
    }

def print_profile_summary(skin_type: str, concerns: list, avoid_ingredients: list):
    print("\n" + "=" * 70)
    print("  USER SKIN PROFILE")
    print("=" * 70)
    print(f"  Skin type : {skin_type.replace('_', ' ').title()}")
    print(f"  Concerns  : {', '.join(concerns) if concerns else 'None'}")
    print(f"  Avoid     : {', '.join(avoid_ingredients) if avoid_ingredients else 'None'}")
    print("=" * 70 + "\n")