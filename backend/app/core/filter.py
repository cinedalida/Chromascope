from .constants import (
    AVOID_TRIGGER_MAP, CONCERN_CATEGORY_FLAGS,
    HARD_BLOCK_INCI, DEFAULT_SYNERGY_PAIRS
)
from .utils import parse_inci, normalize_inci, merge_verdict
from .matcher import INCIMatcher

COMEDOGENIC_THRESHOLD = 10

def get_weight(pos: int) -> float:
    if pos < 5:  return 1.5
    if pos < 20: return 1.0
    return 0.5

class SafetyFilter:
    def __init__(self, ingredient_db: dict, profiles: dict, synergy_pairs: list = None, fuzzy_threshold: int = 85):
        self.profiles      = profiles
        self.matcher       = INCIMatcher(ingredient_db, fuzzy_threshold)
        self.synergy_pairs = synergy_pairs or DEFAULT_SYNERGY_PAIRS  # ← new

    def _severity_to_verdict(self, severity: str) -> str:
        match severity:
            case "high":   return "excluded"
            case "medium": return "caution"
            case _:        return "safe"

    def _check_hard_blocks(self, inci_normalized: str) -> list:
        return [
            f"HARD BLOCK: {b} — excluded for all skin types"
            for b in HARD_BLOCK_INCI if b in inci_normalized
        ]

    def _check_avoid_ingredients(self, inci_normalized: str, avoid_list: list) -> list:
        triggered = []
        for avoid_key in avoid_list:
            for trigger in AVOID_TRIGGER_MAP.get(avoid_key, []):
                if trigger in inci_normalized:
                    label = avoid_key.replace("_", " ").title()
                    triggered.append((f"User avoided: {label} ({trigger})", "high"))
                    break
        return triggered

    def _check_concerns(self, matched_entries: list, concerns: list) -> list:
        triggered = []
        for concern in concerns:
            flagged_cats = CONCERN_CATEGORY_FLAGS.get(concern, [])
            for entry in matched_entries:
                if entry.get("concern_category", "") in flagged_cats:
                    triggered.append((
                        f"{entry['inci_name']} — {concern.replace('_',' ')} concern",
                        entry.get("severity", "low")
                    ))
        return triggered

    def _check_skin_type_live(self, matched_entries: list, skin_type: str) -> list:
        flag_col = f"safety_flag_{skin_type}"
        return [
            (f"{e['inci_name']} — flagged for {skin_type.replace('_',' ')} skin", e.get("severity", "low"))
            for e in matched_entries if e.get(flag_col)
        ]

  
    def _check_synergy_pairs(self, inci_normalized: str, matched_names: list) -> list:
        triggered = []
        names_lower = [n.lower() for n in matched_names]
        for pair_def in self.synergy_pairs:
            a, b    = pair_def["pair"]
            verdict = pair_def["verdict"]
            severity = pair_def["severity"]
            reason   = pair_def["reason"]
            if verdict == "safe":
                continue
            a_found = any(a in name for name in names_lower) or a in inci_normalized
            b_found = any(b in name for name in names_lower) or b in inci_normalized
            if a_found and b_found:
                triggered.append((f"⚡ SYNERGY: {reason}", verdict, severity))
        return triggered

    def _check_comedogenic_load(self, matched_entries: list, tokens: list, skin_type: str) -> tuple:
        if skin_type not in ("acne_prone", "oily", "combination"):
            return None, 0.0

        total = 0.0
        contributors = []
        for idx, token in enumerate(tokens):
            entry = next(
                (e for e in matched_entries if e["inci_name"].lower() in token or token in e["inci_name"].lower()),
                None,
            )
            if not entry:
                continue
            rating = float(entry.get("comedogenic_rating", 0))
            if rating <= 0:
                continue
            weight       = get_weight(idx)
            contribution = rating * weight
            total       += contribution
            if contribution >= 1.0:
                contributors.append(
                    f"{entry['inci_name']} (rating {rating:.0f} × {weight} = {contribution:.1f})"
                )

        if total >= COMEDOGENIC_THRESHOLD:
            return "caution", round(total, 2)
        return None, round(total, 2)

    def evaluate(self, product: dict, skin_type: str, concerns: list = None, avoid_ingredients: list = None) -> dict:
        concerns          = concerns or []
        avoid_ingredients = avoid_ingredients or []

        pid     = product["product_id"]
        verdict = "safe"
        flagged = []

        inci_raw        = product.get("full_inci_list", "")
        inci_normalized = normalize_inci(inci_raw)
        inci_tokens     = parse_inci(inci_raw)
        matched_entries, unmatched = self.matcher.lookup_many(inci_tokens)
        matched_names = [e["inci_name"] for e in matched_entries]

        # Pre-built profile
        if pid in self.profiles:
            profile  = self.profiles[pid]
            skin_col = f"safe_for_{skin_type}"
            if not profile.get(skin_col, True):
                verdict = merge_verdict(verdict, "excluded")
                fi = profile["flagged_ingredients"]
                if fi and fi.lower() != "none":
                    flagged.append(fi)
            if skin_type == "oily" and profile.get("filter_out_oily"):
                verdict = merge_verdict(verdict, "excluded")
            if skin_type == "acne_prone" and profile.get("filter_out_acne_prone"):
                verdict = merge_verdict(verdict, "excluded")

        # Concentration-weighted skin type flags ← NEW
        for idx, token in enumerate(inci_tokens):
            entry = next(
                (e for e in matched_entries if e["inci_name"].lower() in token or token in e["inci_name"].lower()),
                None,
            )
            if not entry:
                continue
            skin_flag = f"safety_flag_{skin_type}"
            if entry.get(skin_flag):
                raw_sev    = entry.get("severity", "low")
                weight     = get_weight(idx)
                bumped_sev = raw_sev
                if weight >= 1.5:
                    if raw_sev == "medium": bumped_sev = "high"
                    if raw_sev == "low":    bumped_sev = "medium"
                verdict = merge_verdict(verdict, self._severity_to_verdict(bumped_sev))
                msg = (f"{entry['inci_name']} (pos {idx+1}) — "f"{skin_type.replace('_',' ')} flag"+ (f" [bumped {raw_sev}→{bumped_sev}]" if bumped_sev != raw_sev else ""))
                if msg not in flagged:
                    flagged.append(msg)

        # Synergy check ← NEW
        for msg, syn_verdict, _ in self._check_synergy_pairs(inci_normalized, matched_names):
            verdict = merge_verdict(verdict, syn_verdict)
            if msg not in flagged:
                flagged.append(msg)

        # Comedogenic load ← NEW
        load_verdict, comed_load = self._check_comedogenic_load(
            matched_entries, inci_tokens, skin_type
        )
        if load_verdict:
            verdict = merge_verdict(verdict, load_verdict)
            flagged.append(
                f"📊 COMEDOGENIC LOAD: {comed_load:.1f} exceeds threshold of {COMEDOGENIC_THRESHOLD}"
            )

        # Concern flags
        for msg, sev in self._check_concerns(matched_entries, concerns):
            verdict = merge_verdict(verdict, self._severity_to_verdict(sev))
            if msg not in flagged:
                flagged.append(msg)

        # Avoid ingredient overrides
        for msg, sev in self._check_avoid_ingredients(inci_normalized, avoid_ingredients):
            verdict = merge_verdict(verdict, "excluded")
            if msg not in flagged:
                flagged.append(msg)

        for msg in self._check_hard_blocks(inci_normalized):
            verdict = "excluded"
            if msg not in flagged:
                flagged.append(msg)

        severity = "high" if verdict == "excluded" else "medium" if verdict == "caution" else "low"

        return {
            "product_id":          pid,
            "product_name":        product["product_name"],
            "brand":               product["brand"],
            "category":            product["category"],
            "sub_category":        product.get("sub_category", ""),
            "verdict":             verdict,
            "flagged_ingredients": flagged,
            "severity":            severity,
            "unmatched_tokens":    unmatched,
            "comedogenic_load":    comed_load,
            "season_tags":         product.get("season_tags", ""),
            "hex_color":           product.get("hex_color", ""),
            "where_to_buy":        product.get("where_to_buy", ""),
            "price":               product.get("price", ""),
            "image_url":           product.get("image_url", ""),
            "full_inci_list":      product.get("full_inci_list", ""),
            "key_actives":         product.get("key_actives", "")
        }
    def filter_products(self, products: list, skin_type: str,
                        concerns: list = None, avoid_ingredients: list = None,
                        show_excluded: bool = True) -> list:
        results = [
            self.evaluate(p, skin_type, concerns, avoid_ingredients)
            for p in products
        ]
        if not show_excluded:
            results = [r for r in results if r["verdict"] != "excluded"]
        sort_order = {"safe": 0, "caution": 1, "excluded": 2}
        results.sort(key=lambda r: sort_order.get(r["verdict"], 3))
        return results