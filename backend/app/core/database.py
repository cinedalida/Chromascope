import firebase_admin
from firebase_admin import credentials, firestore
import os

class ChromascopeDatabase:
    def __init__(self, key_filename: str = "serviceAccountKey.json"):
        base_dir = os.path.dirname(os.path.abspath(__file__))
        service_account_path = os.path.join(base_dir, "..", "..", key_filename)

        if not firebase_admin._apps:
            try:
                cred = credentials.Certificate(service_account_path)
                firebase_admin.initialize_app(cred)
            except Exception as e:
                print(f" [ERROR] Could not initialize Firebase: {e}")
                raise

        self.db = firestore.client()
        
        print(" [SYSTEM] Syncing Chromascope Database with Firestore...")
        self.ingredient_db = self._load_ingredient_db()
        self.products      = self._load_all_products()
        self.profiles      = self._load_all_profiles()
        self.synergy_pairs = self._load_synergy_pairs()
        print(f" [SUCCESS] Loaded {len(self.products)} products and {len(self.ingredient_db)} ingredients.")

    def _load_ingredient_db(self) -> dict:
        """Loads ingredient data and creates an alias map for fuzzy matching."""
        db_dict = {}
        docs = self.db.collection("ingredients").stream()
        
        for doc in docs:
            data = doc.to_dict()
            inci = data.get("inci_name", "").lower().strip()
            if not inci:
                continue
                
            db_dict[inci] = data
            
            # Map common aliases (e.g., 'Vit C' -> 'Ascorbic Acid')
            aliases_raw = data.get("common_aliases", "")
            if aliases_raw:
                aliases = [a.strip().lower() for a in aliases_raw.split(",") if a.strip()]
                for alias in aliases:
                    if alias not in db_dict:
                        db_dict[alias] = data
        return db_dict

    def _load_all_products(self) -> list:
        """Fetches the full product catalog including 'image_url' from Cloud."""
        docs = self.db.collection("products").stream()
        return [doc.to_dict() for doc in docs]

    def _load_all_profiles(self) -> dict:
        """Maps product IDs to their specific safety profiles."""
        profiles = {}
        docs = self.db.collection("safety_profiles").stream()
        for doc in docs:
            data = doc.to_dict()
            pid = data.get("product_id")
            if pid:
                profiles[pid] = data
        return profiles

    def _load_synergy_pairs(self) -> list:    
        """Loads ingredient interactions and sorts them alphabetically for lookup stability."""
        pairs = []
        docs  = self.db.collection("synergy_pairs").stream()

        for doc in docs:
            data = doc.to_dict()
            a = data.get("ingredient_a_inci", "").lower().strip()
            b = data.get("ingredient_b_inci", "").lower().strip()
            
            if not a or not b:
                continue
            
            # Alphabetical sorting ensures (A, B) is treated the same as (B, A)
            sorted_pair = tuple(sorted([a, b]))
            
            pairs.append({
                "pair":     sorted_pair,
                "verdict":  data.get("verdict",  "caution"),
                "severity": data.get("severity", "medium"),
                "reason":   data.get("reason",   ""),
            })

        if not pairs:
            print(" [WARNING] No synergy pairs found in Firestore.")

        return pairs