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


def main(csv_path: str):
    raw = open(csv_path, "rb").read()
    cpt = build_cpts(pd.read_csv(csv_path))
    data = {
        "source": f"survey/{os.path.basename(csv_path)} (private chromascope-data repo)",
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
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
