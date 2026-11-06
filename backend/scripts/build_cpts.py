"""Build app/core/bayes_filter/cpts.json from the survey (PLAN_OPTIMIZATION.md, Phase A11).

The Bayesian network's probability tables are computed from the survey exactly as in the evaluation
(build_cpts(chromascope_500_balanced.csv), prior strength 20). Only the aggregate numbers are saved: one probability
and one weighted count per (ingredient group, vulnerable/acne-prone) pair, no respondent rows. The survey itself stays
in the PRIVATE chromascope-data repo.

Usage (from backend/):  venv\\Scripts\\python -m scripts.build_cpts <path to chromascope-data>/survey/chromascope_500_balanced.csv
"""
import hashlib
import json
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import pandas as pd  # noqa: E402
from app.core.bayes_filter.safety_filter import build_cpts  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), "..", "app", "core", "bayes_filter", "cpts.json")


def build_cpts_with_priors(df, priors: dict, prior_strength=20):
    """safety_filter.build_cpts with the allergen prior mean replaced by a published rate where one is given."""
    from app.core.bayes_filter import safety_filter as sf
    cpt = build_cpts(df, prior_strength)
    vul = (df.skin_type == "Sensitive") | (df.diag_eczema == "Yes") | (df.diag_rosacea == "Yes")
    for g in sf.ALLERGEN:
        if g not in priors:
            continue
        used = df[f"used_{g}"] == "Yes"
        for flag, mask in ((True, vul), (False, ~vul)):
            sub = df[used & mask]
            w, y = sub.weight.values, sub[f"reacted_{g}"].values
            prior = priors[g]["percent_positive"] / 100
            a = prior * prior_strength + (w * y).sum()
            b = (1 - prior) * prior_strength + (w * (1 - y)).sum()
            cpt[(g, flag)] = (a / (a + b), float(w.sum()))
    return cpt


def compute(csv_path: str, priors_path: str = ""):
    df = pd.read_csv(csv_path)
    if priors_path:
        return build_cpts_with_priors(df, json.load(open(priors_path, encoding="utf-8"))["priors"])
    return build_cpts(df)


def main(csv_path: str, priors_path: str = ""):
    raw = open(csv_path, "rb").read()
    cpt = compute(csv_path, priors_path)
    data = {
        "source": f"survey/{os.path.basename(csv_path)} (private chromascope-data repo)",
        "priors": (f"{os.path.basename(priors_path)} (sha256 {hashlib.sha256(open(priors_path, 'rb').read()).hexdigest()[:16]})"
                   if priors_path else "safety_filter.build_cpts defaults"),
        "source_sha256": hashlib.sha256(raw).hexdigest(),
        "prior_strength": 20,
        "note": "Aggregate probabilities only: P(reaction or breakout | group, vulnerable or acne-prone), weighted count.",
        "tables": [{"group": g, "flag": flag, "p": p, "weighted_n": n} for (g, flag), (p, n) in sorted(cpt.items())],
    }
    with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(data, fh, indent=1)
    print(f"wrote {os.path.normpath(OUT)}: {len(data['tables'])} entries from {os.path.basename(csv_path)} "
          f"(sha256 {data['source_sha256'][:16]})")


if __name__ == "__main__":
    if len(sys.argv) not in (2, 3):
        sys.exit(__doc__)
    main(*sys.argv[1:])
