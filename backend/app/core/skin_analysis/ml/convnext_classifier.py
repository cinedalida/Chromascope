"""The Chromascope seasonal-colour classifier: hierarchical ConvNeXt-Large (the thesis model).

One season model (4 classes) and four sub-type models (3 classes each) give the 12 personal-colour types. The models are
the fine-tuned checkpoints from the thesis training runs (fp16 files, about 375 MB each, in ml/weights/convnext/).

Modes (set with the CLASSIFIER_MODE environment variable, see pipeline.py):
  hard      the season model picks one season, then only that season's sub-type model is asked.
            Smallest and fastest (2 ConvNeXt-L passes). The algorithm described in the thesis.        offline test accuracy 31.0%
  soft      all four sub-type models answer; the 12 scores are P(season) x P(sub-type | season).      offline test accuracy 31.7%
  ensemble  soft routing with 3 season models averaged (season_v1, v2, v3) and every model also run
            on the mirrored photo (flip test-time augmentation). Most accurate, slowest and heaviest
            (all 7 models stay in memory, about 5.1 GiB in fp32).                                     offline test accuracy 33.6%

Input: the RGB-M style image (hair, face skin, nose, brows, eyes and mouth on a black background), already cropped to the
region that holds them. It is padded to a square with black, resized to 224 px and normalised with the ImageNet statistics,
exactly as in training (notebook 07 of the modelling repo).
"""
import os
import threading
from collections import OrderedDict

import numpy as np
import timm
import torch
from PIL import Image

MODES = ("hard", "soft", "ensemble")

IMG_SIZE = 224
MEAN = torch.tensor((0.485, 0.456, 0.406)).view(1, 3, 1, 1)   # ImageNet statistics, as in training
STD = torch.tensor((0.229, 0.224, 0.225)).view(1, 3, 1, 1)

# Index order used in training: 12-class index = season index * 3 + sub-type index.
SEASON_ORDER = ["autunno", "primavera", "estate", "inverno"]
EN = {"autunno": "autumn", "primavera": "spring", "estate": "summer", "inverno": "winter"}
SUB_FILE = {"autunno": "autumn_v2", "primavera": "spring_v2", "estate": "summer_v2", "inverno": "winter_v2"}
SEASON_FILES = {"hard": ["season_v2"], "soft": ["season_v2"], "ensemble": ["season_v1", "season_v2", "season_v3"]}


def required_files(mode):
    """The checkpoint file names a mode needs (inside the weights directory)."""
    return [f"{n}.pt" for n in SEASON_FILES[mode] + [SUB_FILE[s] for s in SEASON_ORDER]]


def missing_files(weights_dir, mode):
    return [f for f in required_files(mode) if not os.path.exists(os.path.join(weights_dir, f))]


def crop_to_mask(image, mask):
    """Crop to the bounding box of the kept regions. The training images are tight crops (the face and hair fill the frame),
    while the app's photo can be much larger than the face, so without this the face would be far smaller than in training."""
    ys, xs = np.nonzero(mask)
    if len(ys) == 0:
        return image
    return image.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))


def pad_to_square(image):
    """Pad with the black background to a square, so the face is not squashed (as in training), then resize to 224 px."""
    image = image.convert("RGB")
    w, h = image.size
    if w != h:
        s = max(w, h)
        canvas = Image.new("RGB", (s, s), (0, 0, 0))
        canvas.paste(image, ((s - w) // 2, (s - h) // 2))
        image = canvas
    return np.asarray(image.resize((IMG_SIZE, IMG_SIZE), Image.BICUBIC))


def to_tensor(arrays):
    """uint8 (N, 224, 224, 3) -> normalised float tensor (N, 3, 224, 224)."""
    x = torch.from_numpy(np.stack(arrays)).permute(0, 3, 1, 2).float().div(255)
    return ((x - MEAN) / STD).contiguous(memory_format=torch.channels_last)


class ConvNeXtClassifier:
    def __init__(self, weights_dir, mode="hard", sub_cache=2, device="cpu"):
        if mode not in MODES:
            raise ValueError(f"mode must be one of {MODES}, not {mode!r}")
        absent = missing_files(weights_dir, mode)
        if absent:
            raise FileNotFoundError(f"Missing ConvNeXt checkpoints in {weights_dir}: {absent}")
        self.dir, self.mode, self.device = weights_dir, mode, torch.device(device)
        self.lock = threading.Lock()
        self.sub_names = {}                                    # season -> the 3 sub-type names, in index order
        self.season_models = [self._load(n)[0] for n in SEASON_FILES[mode]]
        # hard routing asks one sub-type model per photo, so only a few are kept in memory and the rest are read from disk
        # when needed. soft and ensemble ask all four every time, so all four stay in memory.
        self.sub_capacity = sub_cache if mode == "hard" else len(SEASON_ORDER)
        self.sub_models = OrderedDict()
        for sea in SEASON_ORDER:                               # read every sub-type file's class names now (cheap, mmap)
            ck = self._read(SUB_FILE[sea])
            self.sub_names[sea] = list(ck["classes"])
        if mode != "hard":
            for sea in SEASON_ORDER:
                self._sub(sea)

    # ------------------------------------------------------------------ loading
    def _read(self, name):
        # weights_only=True: only tensors and plain data are read, no code is run. mmap keeps the file out of memory.
        return torch.load(os.path.join(self.dir, name + ".pt"), map_location="cpu", weights_only=True, mmap=True)

    def _load(self, name):
        ck = self._read(name)
        classes = list(ck["classes"])
        model = timm.create_model(ck["model_name"], pretrained=False, num_classes=len(classes))
        model.load_state_dict({k: (v.float() if v.is_floating_point() else v) for k, v in ck["model"].items()})
        model = model.to(self.device).eval().to(memory_format=torch.channels_last)
        if name.startswith("season"):
            assert classes == SEASON_ORDER, f"{name}: unexpected class order {classes}"
        return model, classes

    def _sub(self, season):
        """The sub-type model of a season (kept in memory according to the mode's capacity)."""
        if season in self.sub_models:
            self.sub_models.move_to_end(season)
            return self.sub_models[season]
        model, classes = self._load(SUB_FILE[season])
        assert classes == self.sub_names[season]
        self.sub_models[season] = model
        while len(self.sub_models) > self.sub_capacity:
            self.sub_models.popitem(last=False)
        return model

    # ------------------------------------------------------------------ inference
    @torch.inference_mode()
    def _probs(self, model, x, tta):
        p = model(x).float().softmax(1)
        if tta:
            p = (p + model(torch.flip(x, dims=[3])).float().softmax(1)) / 2
        return p

    def label(self, idx):
        sea, sub = SEASON_ORDER[idx // 3], self.sub_names[SEASON_ORDER[idx // 3]][idx % 3]
        return f"{sub.capitalize()} {EN[sea].capitalize()}"

    def names12(self):
        return [self.label(i) for i in range(12)]

    @torch.inference_mode()
    def predict_batch(self, arrays):
        """arrays: list of uint8 (224, 224, 3). Returns a dict with season probabilities (N, 4), the 12 scores (N, 12,
        P(season) x P(sub-type | season); in hard mode only the chosen class is filled) and the predicted 12-class index."""
        with self.lock:
            tta = self.mode == "ensemble"
            x = to_tensor(arrays).to(self.device)
            ps = torch.stack([self._probs(m, x, tta) for m in self.season_models]).mean(0)       # (N, 4)
            s_hat = ps.argmax(1)
            joint = torch.zeros(len(arrays), 12)
            if self.mode == "hard":
                pred = torch.zeros(len(arrays), dtype=torch.long)
                for s in s_hat.unique().tolist():                                                # one sub-type model per season asked
                    rows = (s_hat == s).nonzero().flatten()
                    sub = self._probs(self._sub(SEASON_ORDER[s]), x[rows], False)                # (n, 3)
                    k = sub.argmax(1)
                    pred[rows] = s * 3 + k
                    joint[rows, s * 3 + k] = ps[rows, s] * sub[torch.arange(len(rows)), k]
            else:
                sub = torch.stack([self._probs(self._sub(sea), x, tta) for sea in SEASON_ORDER], dim=1)   # (N, 4, 3)
                joint = (ps[:, :, None] * sub).reshape(len(arrays), 12)
                pred = joint.argmax(1)
            return dict(season_probs=ps.numpy(), scores=joint.numpy(), pred12=pred.numpy(), season=s_hat.numpy())

    def predict(self, image, mask=None):
        """image: PIL RGB-M style image (black background). mask: optional array, nonzero where the kept regions are
        (used to crop to them). Returns the label, its confidence (the 12-class score of the answer, 0..1) and the season."""
        if mask is not None:
            image = crop_to_mask(image, mask)
        out = self.predict_batch([pad_to_square(image)])
        i = int(out["pred12"][0])
        return dict(label=self.label(i), index=i, confidence=float(out["scores"][0, i]),
                    season_confidence=float(out["season_probs"][0, out["season"][0]]), mode=self.mode)

    def warm_up(self):
        """Run once on a blank image so the first real photo does not pay the one-off setup cost."""
        self.predict_batch([np.zeros((IMG_SIZE, IMG_SIZE, 3), np.uint8)])
