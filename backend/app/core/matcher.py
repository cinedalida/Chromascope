try:
    from rapidfuzz import fuzz
    FUZZY_AVAILABLE = True
except ImportError:
    FUZZY_AVAILABLE = False

class INCIMatcher:
    def __init__(self, ingredient_db: dict, fuzzy_threshold: int = 80):
        self.db = ingredient_db
        self.fuzzy_threshold = fuzzy_threshold
        if not FUZZY_AVAILABLE:
            print("Warning: rapidfuzz not available. Fuzzy matching will be disabled.")
            print(" Install with: pip install rapidfuzz")

    def lookup(self, token:str):
            if not token:
                return None
            token_lower = token.lower().strip()

            if token_lower in self.db:
                return self.db[token_lower]
            
            for key in self.db:
                if token_lower in key or key in token_lower:
                    return self.db[key]
            
            if FUZZY_AVAILABLE:
                best_score = 0
                best_entry = None
                for key, entry in self.db.items():
                    score = fuzz.ratio(token_lower, key)
                    if score > best_score and score >= self.fuzzy_threshold:
                        best_score = score
                        best_entry = entry
                
                if best_entry:
                    return best_entry
                
            return None
        
    def lookup_many(self, tokens: list):
        matched, unmatched = [], []
        for token in tokens:
            entry = self.lookup(token)
            if entry:
                # FIX: Append only the entry dictionary, not (token, entry)
                matched.append(entry) 
            else:
                unmatched.append(token)
        return matched, unmatched
        