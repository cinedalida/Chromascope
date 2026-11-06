// One list of profile options for onboarding AND the profile page (they had drifted apart: e.g. "MI / MIT" vs
// "MI / MIT (Preservative)"). The backend maps each label to the safety filter (backend/app/api/schemas.py).

export const SKIN_TYPES = ["Normal", "Oily", "Dry", "Combination", "Acne-prone"];

export const SKIN_CONCERNS = [
  "Sensitive", "Rosacea", "Eczema", "Pregnancy-safe", "Metal allergy", "Melasma", "PIH / Dark spots",
];

// Concerns saved to the profile that the safety filter (thesis Appendix B/C) has no rule for yet.
export const CONCERNS_WITHOUT_FILTER_RULE = ["Pregnancy-safe", "Melasma", "PIH / Dark spots"];

export const AVOID_INGREDIENTS = [
  "Fragrance / Parfum", "Parabens", "Chemical UV Filters", "Formaldehyde Releaser", "Lanolin",
  "Propylene Glycol", "MI / MIT (Preservative)", "CAPB (Cocamidopropyl Betaine)", "PPD (Hair Dye Chemical)",
  "Metallic Pigments", "Alcohol (Drying)", "Sulfates (SLS/SLES)", "Silicones", "Essential Oils", "Coconut Oil",
  "Bismuth Oxychloride", "Phthalates",
];
