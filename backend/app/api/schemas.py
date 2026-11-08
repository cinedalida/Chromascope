"""Validated request bodies for the API (PLAN_OPTIMIZATION.md, Phase A4).

Bounds every list and string, so a request cannot push oversized data into Firestore or the filter.
Analysis results (season, LAB colour, confidence) are NOT accepted from the client: the backend saves them itself
after /api/analyze-color, so they cannot be faked.
"""
from typing import Annotated, List, Optional

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from ..core.constants import VALID_SKIN_TYPES

ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]
CATEGORIES = {"face", "concealer", "cheeks", "cheek", "lips", "lip", "eyes", "eye", "multiuse", "multi-use"}
SEASON_LABEL = r"^[A-Za-z_ ]{3,40}$"  # e.g. "Deep Autumn", as the classifier returns it


def normalize_label(label: str) -> str:
    return label.strip().lower().replace("-", "_").replace(" ", "_")


# The app shows friendly labels ("Fragrance / Parfum"); the filter uses short keys ("fragrance").
# Without this map, 8 of the 15 "ingredients to avoid" and 2 concerns were silently ignored by the filter.
AVOID_LABEL_TO_KEY = {
    "fragrance_/_parfum": "fragrance",
    "alcohol_(drying)": "alcohol",
    "sulfates_(sls/sles)": "sulfates",
    "bismuth_oxychloride": "bismuth",
    "formaldehyde_releaser": "formaldehyde",
    "chemical_uv_filters": "octinoxate",   # covers oxybenzone, octinoxate, avobenzone, octocrylene...
    "mi_/_mit_(preservative)": "mi",
    "ppd_(hair_dye_chemical)": "ppd",
    "mi_/_mit": "mi",                      # older profile-page label
    # Appendix B groups added as app options (decision D1-b)
    "propylene_glycol": "propylene_glycol",
    "capb_(cocamidopropyl_betaine)": "capb",
}
CONCERN_LABEL_TO_KEY = {
    "pregnancy_safe": "pregnancy",
    "pih_/_dark_spots": "pih",
}


def avoid_key(label: str) -> str:
    n = normalize_label(label)
    return AVOID_LABEL_TO_KEY.get(n, n)


def concern_key(label: str) -> str:
    n = normalize_label(label)
    return CONCERN_LABEL_TO_KEY.get(n, n)


def _check_skin_type(v: Optional[str]) -> Optional[str]:
    if v is None:
        return v
    n = normalize_label(v)
    if n == "sensitive":  # older profiles; the filter treats Sensitive as a concern
        return n
    if n not in VALID_SKIN_TYPES:
        raise ValueError(f"unknown skin type (allowed: {', '.join(VALID_SKIN_TYPES)})")
    return v


class FilterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    skin_type: Optional[Annotated[str, StringConstraints(max_length=40)]] = None
    concerns: Annotated[List[ShortText], Field(max_length=20)] = []
    avoid_ingredients: Annotated[List[ShortText], Field(max_length=40)] = []
    category: Annotated[str, StringConstraints(strip_whitespace=True, max_length=20)] = "Face"
    user_lab: Optional[Annotated[List[float], Field(min_length=3, max_length=3)]] = None
    seasonal_label: Optional[Annotated[str, StringConstraints(pattern=SEASON_LABEL)]] = None

    @field_validator("skin_type")
    @classmethod
    def _skin(cls, v):
        return _check_skin_type(v)

    @field_validator("category")
    @classmethod
    def _category(cls, v: str) -> str:
        if v.lower() not in CATEGORIES:
            raise ValueError("unknown product category")
        return v

    @field_validator("user_lab")
    @classmethod
    def _lab(cls, v):
        if v is not None and not (0 <= v[0] <= 100 and -128 <= v[1] <= 127 and -128 <= v[2] <= 127):
            raise ValueError("LAB values out of range")
        return v


class FilterBatchRequest(FilterRequest):
    """Several categories in one call (/run-filter-batch): the same profile fields as FilterRequest, read once.
    `category` is inherited but unused here."""

    categories: Annotated[List[Annotated[str, StringConstraints(strip_whitespace=True, max_length=20)]],
                          Field(min_length=1, max_length=6)]

    @field_validator("categories")
    @classmethod
    def _categories(cls, v: List[str]) -> List[str]:
        if any(c.lower() not in CATEGORIES for c in v):
            raise ValueError("unknown product category")
        return v


class AnalysisResultSave(BaseModel):
    """A color-analysis result the user chose to keep, with the backend's signed receipt (see result_receipt.py)."""
    model_config = ConfigDict(extra="forbid")

    season: Annotated[str, StringConstraints(pattern=SEASON_LABEL)]
    lab_color: Annotated[List[float], Field(min_length=3, max_length=3)]
    confidence: Annotated[float, Field(ge=0, le=100)]
    result_token: Annotated[str, StringConstraints(max_length=200)]


class ProfileUpdate(BaseModel):
    """Fields a user may change about themselves. No date of birth or melanin tier: the app does not use them."""
    model_config = ConfigDict(extra="forbid")

    display_name: Optional[Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]] = None
    skin_type: Optional[Annotated[str, StringConstraints(max_length=40)]] = None
    concerns: Optional[Annotated[List[ShortText], Field(max_length=20)]] = None
    avoid_ingredients: Optional[Annotated[List[ShortText], Field(max_length=40)]] = None

    @field_validator("skin_type")
    @classmethod
    def _skin(cls, v):
        return _check_skin_type(v)
