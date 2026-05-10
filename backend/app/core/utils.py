import re
from .constants import VERDICT_RANK

def normalize_inci(raw: str) -> str:
    if not raw:
        return ""
    raw = re.sub(r'\+-.*$', '', raw, flags=re.IGNORECASE)
    raw = re.sub(r'\(.*?\)', '', raw)
    raw = re.sub(r'\(may contain.*?\)', '', raw, flags=re.IGNORECASE)
    raw = re.sub(r'may contain.*$', '', raw, flags=re.IGNORECASE)
    return raw.lower().strip()

def parse_inci(inci_string: str) -> list:
    if not inci_string:
        return []
    cleaned = normalize_inci(inci_string)
    tokens = [t.strip().strip('.').strip() for t in cleaned.split(',')]
    return [t for t in tokens if t and len(t) > 1]

def bool_val(val) -> bool:
    if isinstance(val, bool):
        return val
    if isinstance(val, str):
        return val.strip().upper() in ("TRUE", "YES", "1", "Y")
    return False

def merge_verdict(current: str, new: str) -> str:
    if VERDICT_RANK.get(new, 0) > VERDICT_RANK.get(current, 0):
        return new
    return current

def clean_str(val) -> str:
    if val is None:
        return ""
    return str(val).strip()