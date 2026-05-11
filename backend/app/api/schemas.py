from pydantic import BaseModel, Field
from typing import List, Optional

class FilterRequest(BaseModel):
    skin_type: str = Field("normal", pattern="^(normal|oily|dry|combination|acne_prone)$")
    concerns: List[str] = []
    avoid_ingredients: List[str] = []
    category: str = "Face"
    user_lab: Optional[List[float]] = None
    seasonal_label: Optional[str] = None