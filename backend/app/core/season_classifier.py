"""Color-season classification of makeup products.

The 12 seasons are three questions about a color: is it warm or cool (temperature, T), light or deep (value, V),
bright or muted (chroma, C)? Every season is a point on those three axes (SEASON_PROFILES). Every product shade is
measured on the same axes from its Lab color and scored 0..1 against all 12 seasons.

  * T: hue angle relative to a pivot that depends on the product type (a blue-red lip is cool, a coral one warm),
       mapped to -1..+1 with the pivot at 0. Low-chroma colors (greys, near-white, near-black) have no real hue, so
       their temperature is shrunk towards 0 and given less weight.
  * V, C: percentile rank of L* and chroma *within the product type* (SeasonNorms), so "light" and "bright" mean
       relative to what the market sells for that type, not absolute numbers.

Products are grouped into three bases (product_kind):
  harmony  lips, lip liner, blush, eyeshadow      -> ordered by season fit
  skin     foundation, concealer, powder, bronzer, contour, highlighter -> ordered by distance to the user's skin
  neutral  brows, eyeliner, mascara               -> no color target

Pure standard library, so the tagging script and the live API behave identically. The percentile norms are fitted
offline (fit_norms) and committed as season_norms.json; the API only loads them.

Season definitions are a convention (schools of color analysis disagree on some seasons). Bump PROFILE_VERSION when
they change: it forces every product to be re-tagged.
"""
import json
import math
import os
import re

PROFILE_VERSION = "p1"
NORMS_VERSION = "n1"
CLASSIFIER_VERSION = f"{PROFILE_VERSION}.{NORMS_VERSION}"

NORMS_PATH = os.path.join(os.path.dirname(__file__), "season_norms.json")

# ---------------------------------------------------------------------------------------------------------------
# Seasons

# (label, code, T temperature -1 cool..+1 warm, V value 0 deep..1 light, C chroma 0 muted..1 bright).
# Labels are the ones the season model outputs; codes are the ones color_matching.SEASON_CODE_MAP understands.
_SEASONS = [
    ("Light Spring", "sp-light", +0.30, 0.85, 0.50),
    ("Warm Spring", "sp-true", +0.80, 0.62, 0.75),
    ("Bright Spring", "sp-bright", +0.30, 0.55, 0.95),
    ("Light Summer", "su-light", -0.30, 0.85, 0.40),
    ("Cool Summer", "su-true", -0.70, 0.65, 0.35),
    ("Soft Summer", "su-soft", -0.25, 0.55, 0.25),
    ("Soft Autumn", "au-soft", +0.50, 0.55, 0.30),
    ("Warm Autumn", "au-true", +0.70, 0.40, 0.45),
    ("Deep Autumn", "au-deep", +0.50, 0.15, 0.50),
    ("Deep Winter", "wi-deep", -0.40, 0.10, 0.50),
    ("Cool Winter", "wi-true", -0.80, 0.40, 0.75),
    ("Bright Winter", "wi-bright", -0.40, 0.50, 0.95),
]
SEASON_PROFILES = {code: (t, v, c) for _label, code, t, v, c in _SEASONS}
SEASON_LABEL = {code: label for label, code, *_ in _SEASONS}
SEASON_CODE = {label.lower(): code for label, code, *_ in _SEASONS}
# Older labels the rest of the app still uses for the "true" seasons.
SEASON_CODE.update({"true autumn": "au-true", "true spring": "sp-true", "true summer": "su-true", "true winter": "wi-true"})

# Axis weights: temperature separates the four families, so it counts most.
AXIS_WEIGHTS = (1.0, 0.8, 0.8)
SIGMA = 0.35  # score = exp(-d^2 / (2 sigma^2))

# Tagging. A shade "belongs" to every season whose score is within TAG_REL_MARGIN of its best score (and at least
# TAG_MIN_SCORE). A product is tagged with a season when at least TAG_MIN_SHARE of its shades belong to it, so one
# stray shade in a big range does not tag the product for every season. Calibrated on the swatch sheets.
TAG_MIN_SCORE = 0.60
TAG_REL_MARGIN = 0.10
TAG_MIN_SHARE = 0.25
TAG_MAX = 4  # at most this many season codes per product
ALL_SEASONS_MIN = 7  # a product tagged for this many seasons is simply "ALL"

# ---------------------------------------------------------------------------------------------------------------
# Product kinds

# Normalized sub_category token -> region. Same table as frontend/src/utils/arProductMap.js.
TOKEN_REGION = {
    "lipstick": "lips", "lip color": "lips", "lip stain & tint": "lips", "lip gloss": "lips",
    "lip balm": "lips", "lip plumper": "lips", "lip liner": "lipLiner",
    "blush": "cheeks", "bronzer": "bronzer", "contour": "contour",
    "highlighter": "highlighter", "highlighter & illuminator": "highlighter",
    "eyeshadow": "eyeshadow", "eye shadow": "eyeshadow", "eyeshadow palette": "eyeshadow",
    "eyeliner": "eyeliner", "eyebrows": "brows", "brow": "brows", "mascara": "mascara",
    "foundation": "foundation", "bb & cc cream": "foundation",
    "concealer": "concealer", "under eye concealer": "concealer", "powder": "powder",
    # "face primer" is deliberately absent: it has no visible color.
}

REGION_BASIS = {
    "lips": "harmony", "lipLiner": "harmony", "cheeks": "harmony", "eyeshadow": "harmony",
    "foundation": "skin", "concealer": "skin", "powder": "skin", "bronzer": "skin", "contour": "skin",
    "highlighter": "skin",
    "brows": "neutral", "eyeliner": "neutral", "mascara": "neutral",
}

# For skin products: how much lighter (+) or deeper (-) than the user's skin the shade should be, in L*.
SKIN_TARGET_L_SHIFT = {"foundation": 0, "powder": 0, "concealer": 3, "bronzer": -10, "contour": -14, "highlighter": 10}

HARMONY_REGIONS = tuple(r for r, b in REGION_BASIS.items() if b == "harmony")


def product_region(product):
    """Region of a product (see TOKEN_REGION), or None when it can't be classified (e.g. face primer).

    A composite sub_category ("Blush;Highlighter & illuminator") resolves to its first known token. The scraper files
    some bronzers under "Powder" ("Smooth Blur Bronzer" exists as both), so a powder named bronzer is a bronzer.
    """
    region = None
    for token in str(product.get("sub_category") or "").split(";"):
        region = TOKEN_REGION.get(token.strip().lower())
        if region:
            break
    if region == "powder" and re.search(r"bronz", str(product.get("product_name") or ""), re.I):
        return "bronzer"
    return region


def product_basis(product):
    region = product_region(product)
    return REGION_BASIS.get(region) if region else None


# ---------------------------------------------------------------------------------------------------------------
# Color maths

def hex_to_lab(hex_color):
    """sRGB hex -> CIELAB (D65), CIELAB conversion from sRGB hex."""
    n = int(hex_color.lstrip("#"), 16)

    def lin(v):
        c = v / 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = lin((n >> 16) & 255), lin((n >> 8) & 255), lin(n & 255)
    x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047
    y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b
    z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883

    def f(t):
        return t ** (1 / 3) if t > 216 / 24389 else (24389 / 27 * t + 16) / 116

    fx, fy, fz = f(x), f(y), f(z)
    return (116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz))


def shade_lab(shade):
    """Lab of a shade dict ({hex, lab}), or None when it has no real color (no hex/Lab, or the #FFFFFF placeholder)."""
    lab = shade.get("lab")
    if lab and len(lab) == 3:
        try:
            lab = tuple(float(v) for v in lab)
            if any(lab):
                return lab
        except (TypeError, ValueError):
            pass
    hex_color = str(shade.get("hex") or "").strip()
    if re.fullmatch(r"#[0-9a-fA-F]{6}", hex_color) and hex_color.upper() != "#FFFFFF":
        return hex_to_lab(hex_color)
    return None


def product_shades(product):
    """The product's shades as dicts, falling back to its single top-level color when it has no shades list."""
    shades = [s for s in (product.get("shades") or []) if isinstance(s, dict)]
    if shades:
        return shades
    lab = [product.get("lab_L"), product.get("lab_a"), product.get("lab_b")]
    return [{"hex": product.get("hex_color"), "lab": lab if all(v is not None for v in lab) else None}]


def _lch(lab):
    l, a, b = lab
    return l, math.hypot(a, b), math.degrees(math.atan2(b, a)) % 360


def _smoothstep(x, lo, hi):
    t = min(1.0, max(0.0, (x - lo) / (hi - lo)))
    return t * t * (3 - 2 * t)


# ---------------------------------------------------------------------------------------------------------------
# Norms (per-product-type percentiles)

# Lip and blush colors all sit in the red range, so temperature is relative to a pivot hue inside it: blue-reds and
# pinks are cool, coral and orange warm. The pivot (degrees) is the catalog's median lip/blush hue, i.e. the
# "neutral red" of what is actually sold.
HUE_PIVOT = {"lips": 30.0, "lipLiner": 30.0, "cheeks": 35.0}

# Every other region (eyeshadow) spans all hues, so it uses a color-temperature wheel: (hue degrees, temperature)
# anchors, interpolated around the circle. Red-orange to yellow is warm, pink and blue-green to violet is cool.
TEMPERATURE_WHEEL = [
    (0, -0.6), (20, -0.4), (35, 0.0), (55, 0.9), (80, 1.0), (110, 0.5), (140, 0.0),
    (180, -0.5), (250, -1.0), (300, -0.8), (340, -0.6), (360, -0.6),
]

# Colors with little chroma show little temperature. T is damped to 0 below CHROMA_NO_TEMPERATURE and fully
# expressed from CHROMA_FULL_TEMPERATURE; this is what separates a Soft season from a True one.
CHROMA_NO_TEMPERATURE = 4.0
CHROMA_FULL_TEMPERATURE = 30.0

# Fallback when a region has too few shades to fit its own norms.
MIN_SHADES_FOR_NORMS = 30
KNOT_STEP = 5  # percentile knots every 5% (21 knots)


def t_raw(region, hue):
    """Raw temperature of a hue (degrees) for a region: negative cool, positive warm, zero neutral."""
    if region in HUE_PIVOT:
        return ((hue - HUE_PIVOT[region] + 180) % 360) - 180
    hue %= 360
    for (h0, t0), (h1, t1) in zip(TEMPERATURE_WHEEL, TEMPERATURE_WHEEL[1:]):
        if h0 <= hue <= h1:
            return 100 * (t0 + (t1 - t0) * (hue - h0) / (h1 - h0))
    return 0.0


def _percentile_knots(values):
    values = sorted(values)
    knots = []
    for step in range(0, 101, KNOT_STEP):
        pos = step / 100 * (len(values) - 1)
        lo, hi = math.floor(pos), math.ceil(pos)
        knots.append(values[lo] + (values[hi] - values[lo]) * (pos - lo))
    return knots


def _rank(value, knots):
    """Percentile rank 0..1 of a value among percentile knots (linear between knots, clamped)."""
    if value <= knots[0]:
        return 0.0
    if value >= knots[-1]:
        return 1.0
    for i in range(1, len(knots)):
        if value <= knots[i]:
            span = knots[i] - knots[i - 1]
            frac = 0.5 if span == 0 else (value - knots[i - 1]) / span
            return ((i - 1) + frac) * KNOT_STEP / 100
    return 1.0


def default_norms():
    """Absolute, market-independent norms. Used by unit tests and as a last-resort fallback."""
    lin = lambda lo, hi: [lo + (hi - lo) * i / 20 for i in range(21)]
    group = {"L": lin(5, 95), "C": lin(0, 80), "t_neg": -60.0, "t_pos": 60.0, "n": 0}
    return {"version": NORMS_VERSION, "groups": {r: dict(group) for r in HARMONY_REGIONS}}


def fit_norms(products):
    """Percentile norms per harmony region from a catalog (list of product dicts)."""
    samples = {r: {"L": [], "C": [], "t": []} for r in HARMONY_REGIONS}
    for p in products:
        region = product_region(p)
        if region not in samples:
            continue
        for shade in product_shades(p):
            lab = shade_lab(shade)
            if not lab:
                continue
            l, c, h = _lch(lab)
            samples[region]["L"].append(l)
            samples[region]["C"].append(c)
            if c >= CHROMA_NO_TEMPERATURE:  # greys have no real hue, so they say nothing about temperature
                samples[region]["t"].append(t_raw(region, h))
    pooled = {k: sum((s[k] for s in samples.values()), []) for k in ("L", "C", "t")}
    groups = {}
    for region, s in samples.items():
        source = s if len(s["L"]) >= MIN_SHADES_FOR_NORMS and len(s["t"]) >= MIN_SHADES_FOR_NORMS else pooled
        t_sorted = sorted(source["t"])
        p10 = t_sorted[int(0.10 * (len(t_sorted) - 1))]
        p90 = t_sorted[int(0.90 * (len(t_sorted) - 1))]
        groups[region] = {
            "L": [round(v, 3) for v in _percentile_knots(source["L"])],
            "C": [round(v, 3) for v in _percentile_knots(source["C"])],
            # Raw temperature that maps to -1 / +1. Kept away from 0 so the mapping never divides by ~nothing.
            "t_neg": round(min(p10, -1.0), 3),
            "t_pos": round(max(p90, 1.0), 3),
            "n": len(s["L"]),
        }
    return {"version": NORMS_VERSION, "groups": groups}


def load_norms(path=NORMS_PATH):
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except FileNotFoundError:
        return default_norms()


_NORMS_CACHE = {}


def get_norms():
    if "norms" not in _NORMS_CACHE:
        _NORMS_CACHE["norms"] = load_norms()
    return _NORMS_CACHE["norms"]


# ---------------------------------------------------------------------------------------------------------------
# Shade -> axes -> season scores

def shade_axes(lab, region, norms=None):
    """(T, V, C, weights) of a shade for a harmony region. `weights` are the axis weights after low-chroma damping."""
    norms = norms or get_norms()
    group = norms["groups"][region]
    l, c, h = _lch(lab)

    v = _rank(l, group["L"])
    chroma = _rank(c, group["C"])

    raw = t_raw(region, h)
    t = raw / group["t_pos"] if raw >= 0 else raw / -group["t_neg"]
    t = max(-1.0, min(1.0, t))
    # Greys and near-white/black have no real hue: shrink T to 0 and trust the other axes more.
    confidence = _smoothstep(c, CHROMA_NO_TEMPERATURE, CHROMA_FULL_TEMPERATURE)
    t *= confidence

    wt, wv, wc = AXIS_WEIGHTS
    wt *= confidence
    if l > 93 or l < 10:
        wc *= 0.5
    return t, v, chroma, (wt, wv, wc)


def scores_from_axes(t, v, c, weights=AXIS_WEIGHTS):
    """{season code: 0..1} for a point on the three axes."""
    total = sum(weights)
    scores = {}
    for code, profile in SEASON_PROFILES.items():
        d2 = sum(w * (x - s) ** 2 for w, x, s in zip(weights, (t, v, c), profile)) / total
        scores[code] = math.exp(-d2 / (2 * SIGMA ** 2))
    return scores


def season_scores(lab, region, norms=None):
    """{season code: 0..1} for one shade."""
    t, v, c, weights = shade_axes(lab, region, norms)
    return scores_from_axes(t, v, c, weights)


def shade_season_codes(lab, region, norms=None):
    """The seasons one shade belongs to, best first: every season scoring at least TAG_MIN_SCORE and within
    TAG_REL_MARGIN of the shade's own best score (the same rule product tagging uses). A shade can belong to
    several neighbouring seasons; this is what the app shows for the shade itself, not for the whole product."""
    scores = season_scores(lab, region, norms)
    top = max(scores.values())
    return sorted((c for c, s in scores.items() if s >= TAG_MIN_SCORE and s >= top - TAG_REL_MARGIN), key=lambda c: -scores[c])


def rank_shades(product, season_code, norms=None):
    """Harmony product: its shades with their fit for one season, best first. [(score, shade_dict), ...]"""
    region = product_region(product)
    if REGION_BASIS.get(region) != "harmony" or season_code not in SEASON_PROFILES:
        return []
    ranked = []
    for shade in product_shades(product):
        lab = shade_lab(shade)
        if lab:
            ranked.append((season_scores(lab, region, norms)[season_code], shade))
    ranked.sort(key=lambda pair: -pair[0])
    return ranked


# ---------------------------------------------------------------------------------------------------------------
# Product-level classification

def classify_product(product, norms=None):
    """Season fields for one product, or None when it can't be classified (unknown type, or no usable color).

    Returns {season_tag_computed, season_tags, season_scores, match_basis, season_classifier_version} plus
    `_debug` (not meant for the database): per-season shade votes and the top-3 seasons.
    """
    region = product_region(product)
    basis = REGION_BASIS.get(region) if region else None
    if basis is None:
        return None
    base = {"match_basis": basis, "season_classifier_version": CLASSIFIER_VERSION}

    if basis == "skin":
        return {**base, "season_tag_computed": "N/A – matched at runtime", "season_tags": "ALL", "season_scores": {}}
    if basis == "neutral":
        return {**base, "season_tag_computed": "N/A – no season target", "season_tags": "ALL", "season_scores": {}}

    best = {code: 0.0 for code in SEASON_PROFILES}
    votes = {code: 0 for code in SEASON_PROFILES}
    vote_score = {code: 0.0 for code in SEASON_PROFILES}
    belongs = {code: 0 for code in SEASON_PROFILES}
    usable = 0
    for shade in product_shades(product):
        lab = shade_lab(shade)
        if not lab:
            continue
        usable += 1
        scores = season_scores(lab, region, norms)
        top = max(scores, key=scores.get)
        votes[top] += 1
        vote_score[top] += scores[top]
        for code, score in scores.items():
            best[code] = max(best[code], score)
            if score >= TAG_MIN_SCORE and score >= scores[top] - TAG_REL_MARGIN:
                belongs[code] += 1
    if not usable:
        return None

    # Primary season: most shades land in it; ties go to the higher mean score, then the higher best score.
    primary = max(votes, key=lambda c: (votes[c], vote_score[c] / votes[c] if votes[c] else 0, best[c]))
    strong = sorted((c for c in belongs if belongs[c] / usable >= TAG_MIN_SHARE), key=lambda c: (-belongs[c], -best[c]))
    # No season holding a real share, but shades scattered across many seasons: the range is broad ("ALL"). A big range
    # with a clear core (most shades in two or three seasons) keeps those tags instead.
    reach = sum(1 for c in belongs if belongs[c])
    if len(strong) >= ALL_SEASONS_MIN or (not strong and reach >= ALL_SEASONS_MIN):
        tags = "ALL"
    else:
        tags = ", ".join(c.upper() for c in (strong[:TAG_MAX] or [primary]))
    ordered = sorted(best, key=lambda c: -best[c])
    return {
        **base,
        "season_tag_computed": SEASON_LABEL[primary],
        "season_tags": tags,
        "season_scores": {c: round(best[c], 2) for c in SEASON_PROFILES},
        "_debug": {"votes": votes, "usable_shades": usable, "top3": ordered[:3], "strong": len(strong)},
    }
