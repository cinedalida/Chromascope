"""Numeric checks on AR QA renders (run.mjs matrix output).

    python scripts/ar-qa/analyze.py <outDir>/<label> base      matched / lighter / darker / warm / cool foundation on skin
    python scripts/ar-qa/analyze.py <outDir>/<label> stack     full-face stack: how far the skin drifts from the bare face
    python scripts/ar-qa/analyze.py <outDir>/<label> solo      each skin product alone: visible but not overdone, inside the face
    python scripts/ar-qa/analyze.py <outDir>/<label> mouth     lip products: lips change, teeth and the open mouth do not
    python scripts/ar-qa/analyze.py <outDir>/<label> finish    shimmer reads brighter than matte; "matte" / no finish = default look

"Skin" = small windows around fixed face landmarks (cheeks, forehead, chin, nose side), in the bare photo and in the
render, compared in CIELAB. Exit code 1 if a check fails, so it can gate a stage.
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image

# MediaPipe landmark ids: cheeks and cheekbones only. Forehead and chin land on hair and shadow in many photos.
SKIN_POINTS = [205, 425, 50, 280, 187, 411, 117, 346]
WINDOW = 6  # half-size in pixels


def srgb_to_lab(rgb):
    c = rgb / 255.0
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    m = np.array([[0.4124564, 0.3575761, 0.1804375], [0.2126729, 0.7151522, 0.072175], [0.0193339, 0.119192, 0.9503041]])
    xyz = lin @ m.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 216 / 24389, np.cbrt(xyz), (24389 / 27 * xyz + 16) / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], axis=-1)


def de76(a, b):
    return float(np.linalg.norm(a - b))


def skin_lab(img, points):
    """Mean Lab of the skin windows."""
    h, w, _ = img.shape
    vals = []
    for x, y in points:
        x, y = int(round(x)), int(round(y))
        if WINDOW <= x < w - WINDOW and WINDOW <= y < h - WINDOW:
            vals.append(srgb_to_lab(img[y - WINDOW:y + WINDOW, x - WINDOW:x + WINDOW].reshape(-1, 3).astype(float)).mean(axis=0))
    return np.mean(vals, axis=0)


def load(photo_dir, name):
    return np.array(Image.open(os.path.join(photo_dir, name + ".png")).convert("RGB"))


def photos(root):
    return sorted(d for d in os.listdir(root) if os.path.isfile(os.path.join(root, d, "landmarks.json")))


def points_for(photo_dir, img):
    lm = json.load(open(os.path.join(photo_dir, "landmarks.json")))
    sx, sy = img.shape[1] / lm["w"], img.shape[0] / lm["h"]
    return [(lm["points"][i][0] * sx, lm["points"][i][1] * sy) for i in SKIN_POINTS], lm


def check_base(root):
    failures = []
    print(f"{'photo':34} {'skinL':>6} | matched dE | light dL(+12) | dark dL(-12) | warm db | cool db")
    for p in photos(root):
        d = os.path.join(root, p)
        bare = load(d, "bare")
        pts, lm = points_for(d, bare)
        base = skin_lab(bare, pts)
        row = {}
        for name in ("fnd_matched", "fnd_light", "fnd_dark", "fnd_warm", "fnd_cool", "pwd_matched", "cnc_matched"):
            row[name] = skin_lab(load(d, name), pts) - base
        matched = float(np.linalg.norm(row["fnd_matched"]))
        print(f"{p[:34]:34} {lm['skin']['L']:6.1f} | {matched:10.2f} | {row['fnd_light'][0]:13.2f} | {row['fnd_dark'][0]:12.2f} | {row['fnd_warm'][2]:7.2f} | {row['fnd_cool'][2]:7.2f}")
        if matched > 3.0:
            failures.append(f"{p}: matched foundation moved the skin by dE {matched:.2f} (> 3)")
        if not row["fnd_light"][0] > 1.0:
            failures.append(f"{p}: a lighter foundation must lighten (dL {row['fnd_light'][0]:.2f})")
        if not row["fnd_dark"][0] < -1.0:
            failures.append(f"{p}: a darker foundation must darken (dL {row['fnd_dark'][0]:.2f})")
        if not row["fnd_warm"][2] > row["fnd_cool"][2] + 1.0:
            failures.append(f"{p}: warm shade must end up yellower than the cool one (db {row['fnd_warm'][2]:.2f} vs {row['fnd_cool'][2]:.2f})")
        if float(np.linalg.norm(row["pwd_matched"])) > 3.0 or float(np.linalg.norm(row["cnc_matched"])) > 4.0:
            failures.append(f"{p}: matched powder / concealer moved the skin too much")
    return failures


# Stacking criteria (CIELAB dE76 / chroma on the cheek windows, or averaged over the face outline):
#  matched base trio    foundation + concealer + powder in this skin's own shade is nearly invisible: windows dE <= 3
#  matched full face    a full look in well-chosen shades stays natural: face-mean dE <= 7, chroma change within +-8
#  mismatched base      the fixed light-warm shades on every skin tone are visibly off but never a mask: windows dE <= 24
#                       (foundation is capped at 14, powder at 8, plus the sculpting products; the limit was set after looking
#                       at the renders), and no olive / grey cast: the resulting a* stays >= 4 (a face that is merely less
#                       red, e.g. a flushed one under a yellow foundation, is fine)
#  sculpt group         blush + bronzer + contour + highlighter together are no more than 2.2x the strongest single product
def check_stack(root):
    failures = []
    print(f"{'photo':34} {'matchedBase':>11} {'matchedFull':>11} {'dChroma':>7} | {'mismBase':>8} {'a*':>6} | {'sculpt/single':>13}")
    for p in photos(root):
        d = os.path.join(root, p)
        bare = load(d, "bare")
        pts, lm = points_for(d, bare)
        b = skin_lab(bare, pts)
        mask = face_mask((bare.shape[1], bare.shape[0]), lm)
        lab0 = srgb_to_lab(bare.astype(float))
        face = lambda name: float(np.linalg.norm(srgb_to_lab(load(d, name).astype(float)) - lab0, axis=-1)[mask].mean())
        win = lambda name: skin_lab(load(d, name), pts) - b
        m_base = float(np.linalg.norm(win("stackm_base")))
        m_full = win("stackm_full")
        m_full_face = face("stackm_full")
        chroma = math.hypot(b[1] + m_full[1], b[2] + m_full[2]) - math.hypot(b[1], b[2])
        mis = win("stack_base_plus_sculpt")
        mis_dE = float(np.linalg.norm(mis))
        sculpt = face("stack_face_sculpt")
        strongest = max(face(k) for k in ("solo_cheeks", "solo_bronzer", "solo_contour", "solo_highlighter"))
        ratio = sculpt / strongest
        print(f"{p[:34]:34} {m_base:11.2f} {m_full_face:11.2f} {chroma:7.2f} | {mis_dE:8.2f} {b[1] + mis[1]:6.1f} | {ratio:13.2f}")
        if m_base > 3:
            failures.append(f"{p}: matched foundation+concealer+powder moved the skin by dE {m_base:.2f} (> 3)")
        if m_full_face > 7 or abs(chroma) > 8:
            failures.append(f"{p}: matched full face is heavy (face-mean dE {m_full_face:.2f}, chroma {chroma:+.2f})")
        if mis_dE > 24 or b[1] + mis[1] < 4:
            failures.append(f"{p}: mismatched base stack is a mask or has a cast (dE {mis_dE:.2f}, resulting a* {b[1] + mis[1]:.1f})")
        if ratio > 2.2:
            failures.append(f"{p}: sculpt group is {ratio:.2f}x its strongest single product (> 2.2)")
    return failures


# MediaPipe lip rings: outer outline and inner outline (the opening of the mouth).
LIPS_OUTER = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185]
LIPS_INNER = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191]
EYES = [[33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],
        [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398]]
LIP_LOOKS = ("solo_lips", "solo_lips_gloss", "solo_lips_sheer", "solo_lips_nude", "solo_lips_berry", "solo_lips_red", "solo_lipLiner", "stack_lips_all", "stack_full_face")
# Teeth = bright, low-chroma pixels inside the mouth opening of the BARE photo. They must not change colour under any lip
# product: share of teeth pixels that move by more than TEETH_DE, and the mean change, are both capped. The lips
# themselves (between the outer and inner outline) must change clearly under the lipstick shades.
TEETH_DE, TEETH_MAX_SHARE, TEETH_MAX_MEAN, LIP_MIN_MEAN = 4.0, 0.08, 1.5, 5.0
# Spill: a ring of skin just outside the lips (1.5% to 7% of the mouth width beyond the outer outline, a fixed distance all
# the way round) must keep its color under lipstick. The rest of the face is untouched by lip products, so any change there
# is color bleeding past the lip edge. The first 1.5% is left out: the landmark outline is only approximately the lip edge.
SPILL_MAX_MEAN, SPILL_MAX_P95 = 2.0, 8.0
SPILL_LOOKS = ("solo_lips", "solo_lips_gloss", "solo_lips_berry", "solo_lips_red", "solo_lips_nude")


def grown(lm, ids, factor):
    pts = [lm["points"][i] for i in ids]
    cx, cy = sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)
    return [(cx + (x - cx) * factor, cy + (y - cy) * factor) for x, y in pts]


def poly_mask(size, lm, points):
    from PIL import ImageDraw
    sx, sy = size[0] / lm["w"], size[1] / lm["h"]
    img = Image.new("L", size, 0)
    ImageDraw.Draw(img).polygon([(x * sx, y * sy) for x, y in points], fill=255)
    return np.array(img) > 0


def polygon_mask(size, lm, ids):
    from PIL import ImageDraw
    sx, sy = size[0] / lm["w"], size[1] / lm["h"]
    img = Image.new("L", size, 0)
    ImageDraw.Draw(img).polygon([(lm["points"][i][0] * sx, lm["points"][i][1] * sy) for i in ids], fill=255)
    return np.array(img) > 0


def check_mouth(root):
    failures = []
    print(f"{'photo':34} {'open':>5} {'teeth px':>8} | " + " ".join(f"{k.replace('solo_', '').replace('stack_', '')[:10]:>10}" for k in LIP_LOOKS) + "   (share of teeth px changed > dE 4 / lips mean dE for lipstick)")
    for p in photos(root):
        d = os.path.join(root, p)
        bare = load(d, "bare")
        lm = json.load(open(os.path.join(d, "landmarks.json")))
        size = (bare.shape[1], bare.shape[0])
        pts = lm["points"]
        open_ratio = math.dist(pts[13], pts[14]) / math.dist(pts[61], pts[291])
        lab0 = srgb_to_lab(bare.astype(float))
        inner = polygon_mask(size, lm, LIPS_INNER)
        lips = polygon_mask(size, lm, LIPS_OUTER) & ~inner
        chroma = np.hypot(lab0[..., 1], lab0[..., 2])
        teeth = inner & (lab0[..., 0] > 55) & (chroma < 30)
        # keep clear of the lip edge and the eyes' colour spill: erode the teeth region by a couple of pixels
        from PIL import ImageFilter
        teeth = np.array(Image.fromarray((teeth * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(5))) > 0
        cells = []
        from PIL import ImageFilter
        outer_mask = Image.fromarray((poly_mask(size, lm, [lm["points"][i] for i in LIPS_OUTER]) * 255).astype(np.uint8))
        mouth_w = math.dist(lm["points"][61], lm["points"][291]) * size[0] / lm["w"]
        near, far = int(round(mouth_w * 0.015)) * 2 + 1, int(round(mouth_w * 0.07)) * 2 + 1
        ring = (np.array(outer_mask.filter(ImageFilter.MaxFilter(far))) > 0) & ~(np.array(outer_mask.filter(ImageFilter.MaxFilter(near))) > 0)
        spill_cells = []
        for look in LIP_LOOKS:
            path = os.path.join(d, look + ".png")
            if not os.path.exists(path):
                cells.append(f"{'-':>10}")
                continue
            dE = np.linalg.norm(srgb_to_lab(load(d, look).astype(float)) - lab0, axis=-1)
            share = float((dE[teeth] > TEETH_DE).mean()) if teeth.sum() >= 150 else float("nan")
            mean_t = float(dE[teeth].mean()) if teeth.sum() >= 150 else float("nan")
            lip_mean = float(dE[lips].mean())
            cells.append(f"{share:4.2f}/{lip_mean:4.1f}  ")
            if look in SPILL_LOOKS and ring.sum() > 50:
                sp_mean, sp_p95 = float(dE[ring].mean()), float(np.percentile(dE[ring], 95))
                spill_cells.append(f"{look.replace('solo_lips_', '').replace('solo_', '')}:{sp_mean:.1f}/{sp_p95:.0f}")
                if sp_mean > SPILL_MAX_MEAN or sp_p95 > SPILL_MAX_P95:
                    failures.append(f"{p}: {look} bleeds onto the skin around the lips (ring mean dE {sp_mean:.2f}, p95 {sp_p95:.1f})")
            if teeth.sum() >= 150:
                if share > TEETH_MAX_SHARE or mean_t > TEETH_MAX_MEAN:
                    failures.append(f"{p}: {look} colours the teeth ({share:.0%} of {int(teeth.sum())} px moved > dE {TEETH_DE}, mean {mean_t:.2f})")
            if look in ("solo_lips", "solo_lips_berry", "solo_lips_red") and lip_mean < LIP_MIN_MEAN:
                failures.append(f"{p}: {look} barely changes the lips (mean dE {lip_mean:.2f} < {LIP_MIN_MEAN})")
        print(f"{p[:34]:34} {open_ratio:5.2f} {int(teeth.sum()):8d} | " + " ".join(cells) + "   spill(mean/p95): " + " ".join(spill_cells))
    return failures


def check_finish(root):
    failures = []
    print(f"{'photo':34} " + " ".join(f"{r:>22}" for r in ("cheeks", "eyeshadow", "highlighter")) + "   (shimmer - matte mean dL where the product shows / matte vs default dE)")
    for p in photos(root):
        d = os.path.join(root, p)
        bare = load(d, "bare")
        lab0 = srgb_to_lab(bare.astype(float))
        cells = []
        for region in ("cheeks", "eyeshadow", "highlighter"):
            matte = srgb_to_lab(load(d, f"fin_{region}_matte").astype(float))
            shim = srgb_to_lab(load(d, f"fin_{region}_shimmer").astype(float))
            shows = np.linalg.norm(shim - lab0, axis=-1) > 1.0
            if shows.sum() < 100:
                cells.append(f"{'(too small)':>22}")
                continue
            dL = float((shim[..., 0] - matte[..., 0])[shows].mean())
            default = srgb_to_lab(load(d, f"solo_{region}").astype(float))
            same = float(np.linalg.norm(matte - default, axis=-1).mean())
            cells.append(f"{dL:+9.2f} / {same:8.3f}  ")
            if dL < 0.3:
                failures.append(f"{p}: {region} shimmer is not brighter than matte (dL {dL:+.2f})")
            # "matte" IS the default settings object (proved in arProductMap.test.js); what remains is render-to-render noise
            # (the skin estimate is a moving average, so two renders sample it at slightly different moments), about 10x
            # below what a person can see (dE ~1).
            if same > 0.15:
                failures.append(f"{p}: {region} 'matte' differs from the default look (dE {same:.3f})")
        print(f"{p[:34]:34} " + " ".join(cells))
    return failures


# MediaPipe face oval (landmark ids around the face outline).
FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149,
             150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
# Per product: (min mean change, max mean change, max p99 change) in CIELAB dE76 over the face. "Visible" means the mean
# change clears the floor on every skin tone; "natural" means it stays under the caps. "Even": the average change on deep
# skin (sampled L* below 52) must be within 0.7x-1.4x of the average on light skin (L* above 60), so no skin tone gets a
# heavier or a vanishing effect. (Per-photo spread also reflects pose, hair and headwear covering the temples, which is
# not a skin tone effect, so it is not gated.)
SOLO_LIMITS = {
    "solo_cheeks": (0.15, 4.0, 22.0),
    "solo_bronzer": (0.4, 6.0, 16.0),
    "solo_contour": (0.2, 4.0, 14.0),
    "solo_highlighter": (0.2, 4.0, 18.0),
}


def face_mask(size, lm):
    from PIL import ImageDraw
    sx, sy = size[0] / lm["w"], size[1] / lm["h"]
    img = Image.new("L", size, 0)
    ImageDraw.Draw(img).polygon([(lm["points"][i][0] * sx, lm["points"][i][1] * sy) for i in FACE_OVAL], fill=255)
    return np.array(img) > 0


DEEP_L, LIGHT_L, TONE_RATIO = 52, 60, (0.7, 1.4)


def check_solo(root):
    failures = []
    means = {name: [] for name in SOLO_LIMITS}
    tones = []
    print(f"{'photo':34} " + " ".join(f"{k[5:]:>16}" for k in SOLO_LIMITS) + "   (mean / p99 dE inside the face)")
    for p in photos(root):
        d = os.path.join(root, p)
        bare = load(d, "bare")
        lm = json.load(open(os.path.join(d, "landmarks.json")))
        mask = face_mask((bare.shape[1], bare.shape[0]), lm)
        lab0 = srgb_to_lab(bare.astype(float))
        cells = []
        tones.append(lm["skin"]["L"])
        for name, (lo, hi, cap) in SOLO_LIMITS.items():
            dE = np.linalg.norm(srgb_to_lab(load(d, name).astype(float)) - lab0, axis=-1)[mask]
            mean, p99 = float(dE.mean()), float(np.percentile(dE, 99))
            cells.append(f"{mean:7.2f} /{p99:6.1f}")
            means[name].append(mean)
            if mean < lo:
                failures.append(f"{p}: {name} is too faint (mean dE {mean:.2f} < {lo})")
            if mean > hi or p99 > cap:
                failures.append(f"{p}: {name} is overdone (mean {mean:.2f} / p99 {p99:.1f}, limits {hi} / {cap})")
        print(f"{p[:34]:34} " + " ".join(f"{c:>16}" for c in cells))
    ratios = []
    for name, v in means.items():
        deep = [m for m, t in zip(v, tones) if t < DEEP_L]
        light = [m for m, t in zip(v, tones) if t > LIGHT_L]
        ratio = (sum(deep) / len(deep)) / (sum(light) / len(light))
        ratios.append(ratio)
        if not TONE_RATIO[0] <= ratio <= TONE_RATIO[1]:
            failures.append(f"{name}: uneven across skin tones (deep {sum(deep) / len(deep):.2f} vs light {sum(light) / len(light):.2f}, ratio {ratio:.2f}, allowed {TONE_RATIO})")
    print(f"{'deep / light skin (mean)':34} " + " ".join(f"{r:16.2f}" for r in ratios) + f"   ({len(deep)} deep, {len(light)} light faces)")
    return failures


if __name__ == "__main__":
    root, mode = sys.argv[1], sys.argv[2]
    if not os.path.isdir(root) or not photos(root):
        sys.exit(f"no renders with landmarks.json in {root}: nothing was checked")
    failures = {"base": check_base, "stack": check_stack, "solo": check_solo, "mouth": check_mouth, "finish": check_finish}[mode](root)
    print("\nFAILED" if failures else "\nOK", *failures, sep="\n  " if failures else "")
    sys.exit(1 if failures else 0)
