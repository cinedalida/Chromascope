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
