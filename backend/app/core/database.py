import firebase_admin
from firebase_admin import credentials, firestore

class ChromascopeDatabase:
    def __init__(self, service_account_json: str = "serviceAccountKey.json"):
        if not firebase_admin._apps:
            cred = credentials.Certificate(service_account_json)
            firebase_admin.initialize_app(cred)
        
        self.db = firestore.client()
        
        self.ingredient_db = self._load_ingredient_db()
        self.products      = self._load_all_products()
        self.profiles      = self._load_all_profiles()
        self.synergy_pairs = self._load_synergy_pairs() 

    def _load_ingredient_db(self) -> dict:
        db_dict = {}
        docs = self.db.collection("ingredients").stream()
        
        for doc in docs:
            data = doc.to_dict()
            key = data.get("inci_name", "").lower()
            if key:
                db_dict[key] = data
                
            aliases_raw = data.get("common_aliases", "")
            if aliases_raw:
                aliases = [a.strip().lower() for a in aliases_raw.split(",") if a.strip()]
                for alias in aliases:
                    if alias not in db_dict:
                        db_dict[alias] = data
        return db_dict

    def _load_all_products(self) -> list:
        docs = self.db.collection("products").stream()
        return [doc.to_dict() for doc in docs]

    def _load_all_profiles(self) -> dict:
        profiles = {}
        docs = self.db.collection("safety_profiles").stream()
        for doc in docs:
            data = doc.to_dict()
            pid = data.get("product_id")
            if pid:
                profiles[pid] = data
        return profiles

    def _load_synergy_pairs(self) -> list:    
        pairs = []
        docs  = self.db.collection("synergy_pairs").stream()

        for doc in docs:
            data = doc.to_dict()
            a = data.get("ingredient_a_inci", "").lower().strip()
            b = data.get("ingredient_b_inci", "").lower().strip()
            if not a or not b:
                continue
            pairs.append({
                "pair":     (a, b),
                "verdict":  data.get("verdict",  "caution"),
                "severity": data.get("severity", "medium"),
                "reason":   data.get("reason",   ""),
            })

        if not pairs:
            print("  [WARNING] No synergy pairs in Firestore — using defaults from constants.py")

        return pairs