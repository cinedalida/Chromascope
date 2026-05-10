PRODUCT_SHEETS = {
    "Lip": "Products — Lip",
    "Face": "Products — Face",
    "Cheek": "Products — Cheek",
    "Eye": "Products — Eye",
    "Concealer": "Products — Concealer",
    "Multi-use": "Products — Multi-use",
}

PROFILE_SHEETS = {
    "Lip": "Profiles — Lip",
    "Face": "Profiles — Face",
    "Cheek": "Profiles — Cheek",
    "Eye": "Profiles — Eye",
    "Concealer": "Profiles — Concealer",
    "Multi-use": "Profiles — Multi-use",
}

INGREDIENT_SHEET = "Ingredient Safety DB"

VALID_SKIN_TYPES = ["oily", "dry", "combination", "normal", "acne_prone"]

VALID_CONCERNS = ["sensitive", "rosacea", "eczema", "pregnancy", "metal_allergy", "pih", "melasma", "psoriasis"]

VALID_AVOID = [
    "fragrance", "alcohol", "parabens", "coconut_oil",
    "sulfates", "silicones", "essential_oils", "lanolin",
    "bismuth", "formaldehyde", "octinoxate", "phthalates",
    "metallic_pigments", "mi", "ppd",
]

SEVERITY_RANK = {"high": 3, "medium": 2, "low": 1, "none": 0}

VERDICT_RANK = {"excluded": 3, "caution": 2, "safe": 1}

AVOID_TRIGGER_MAP = {
    "fragrance":       ["parfum", "fragrance", "linalool", "limonene", "geraniol",
                        "eugenol", "menthol", "citronellol", "hexyl cinnamal",
                        "benzyl alcohol", "alpha-isomethyl ionone", "coumarin"],
    "alcohol":         ["alcohol denat", "sd alcohol", "isopropyl alcohol",
                        "alcohol (denat", "denatured alcohol", "ethanol"],
    "parabens":        ["methylparaben", "propylparaben", "butylparaben", "ethylparaben"],
    "coconut_oil":     ["cocos nucifera", "coconut oil", "hydrogenated coconut oil"],
    "sulfates":        ["sodium lauryl sulfate", "sls", "sodium laureth sulfate", "sles"],
    "silicones":       ["dimethicone", "cyclopentasiloxane", "cyclohexasiloxane",
                        "trimethylsiloxysilicate", "dimethiconol", "polysilicone"],
    "essential_oils":  ["linalool", "limonene", "geraniol", "eugenol", "menthol",
                        "tea tree", "melaleuca", "citrus", "lavandula", "rosmarinus",
                        "salvia", "eucalyptus", "peppermint"],
    "lanolin":         ["lanolin", "wool alcohol", "anhydrous lanolin", "lanolin alcohol"],
    "bismuth":         ["bismuth oxychloride", "ci 77163"],
    "formaldehyde":    ["dmdm hydantoin", "imidazolidinyl urea",
                        "quaternium-15", "diazolidinyl urea"],
    "octinoxate":      ["ethylhexyl methoxycinnamate", "octinoxate", "oxybenzone",
                        "benzophenone-3", "octisalate", "ethylhexyl salicylate",
                        "octocrylene", "avobenzone", "butyl methoxydibenzoylmethane"],
    "phthalates":      ["dibutyl phthalate", "diethyl phthalate", "dimethyl phthalate"],
    "metallic_pigments": ["ci 77742", "ci 77510", "ci 77007",
                        "manganese violet", "ferric ferrocyanide", "ultramarines", "tin oxide"],
    "mi":               ["methylisothiazolinone", "mit", "neolone 950"],
    "ppd":              ["p-phenylenediamine", "ppd", "ci 76060", "1,4-diaminobenzene"],
}

CONCERN_CATEGORY_FLAGS = {
    "sensitive": ["fragrance_sensitizer", "fragrance_component", "irritant_fragrance",
                    "sensitizer_preservative", "formaldehyde_releaser",
                    "sensitizer_surfactant", "sensitizer_comedogenic", "metallic_pigment"],
    "rosacea": ["fragrance_sensitizer", "fragrance_component", "irritant_fragrance",
                    "sensitizer_preservative", "formaldehyde_releaser", "metallic_pigment"],
    "eczema": ["fragrance_sensitizer", "fragrance_component", "formaldehyde_releaser",
                    "sensitizer_preservative", "sensitizer_surfactant"],
    "pregnancy": ["chemical_sunscreen_allergen"],
    "metal_allergy": ["colorant_metallic"],
}

HARD_BLOCK_INCI = [
    "methylisothiazolinone", "neolone 950", "p-phenylenediamine", "ppd", "ci 76060", "1,4-diaminobenzene",
]

DEFAULT_SYNERGY_PAIRS = [
    {"pair": ("parfum", "alcohol denat"),
     "verdict": "excluded", "severity": "high",
     "reason": "Fragrance + Alcohol — dual irritant combination."},
    {"pair": ("cocos nucifera", "isopropyl myristate"),
     "verdict": "excluded", "severity": "high",
     "reason": "Coconut Oil (Rating 4) + Isopropyl Myristate (Rating 3) — very high comedogenic load."},
    {"pair": ("bismuth oxychloride", "parfum"),
     "verdict": "caution", "severity": "medium",
     "reason": "Bismuth Oxychloride + Fragrance — dual sensitizer for rosacea/sensitive skin."},
]