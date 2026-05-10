from .constants import VALID_SKIN_TYPES, VALID_CONCERNS, VALID_AVOID
from .database import ChromascopeDatabase
from .filter import SafetyFilter
from .display import print_results, get_summary

class ChromascopeSafetyEngine:

    def __init__(self, service_account_json: str = "serviceAccountKey.json", fuzzy_threshold: int = 85):
        self.db = ChromascopeDatabase(service_account_json)
        self._filter = SafetyFilter(
            ingredient_db=self.db.ingredient_db,
            profiles=self.db.profiles,
            synergy_pairs=self.db.synergy_pairs,
            fuzzy_threshold=fuzzy_threshold,
        )

    def filter(self, skin_type: str, concerns: list = None, avoid_ingredients: list = None, category: str = None, show_excluded: bool = True) -> list:
        concerns = concerns or []
        avoid_ingredients = avoid_ingredients or []

        if skin_type not in VALID_SKIN_TYPES:
            raise ValueError(f"Invalid skin_type '{skin_type}'. Choose from: {VALID_SKIN_TYPES}")

        concerns = [c for c in concerns if c in VALID_CONCERNS]
        avoid_ingredients = [a for a in avoid_ingredients if a in VALID_AVOID]

        products = self.db.products
        if category:
            products = [p for p in products if p.get("category") == category]

        return self._filter.filter_products(
            products=products,
            skin_type=skin_type,
            concerns=concerns,
            avoid_ingredients=avoid_ingredients,
            show_excluded=show_excluded,
        )

    def get_safe_products(self, skin_type, concerns=None, avoid_ingredients=None, category=None) -> list:
        return [r for r in self.filter(skin_type, concerns, avoid_ingredients, category)
                if r["verdict"] == "safe"]

    def get_summary(self, results) -> dict:
        return get_summary(results)

    def print_results(self, results) -> None:
        print_results(results)