"""The season classifier's preprocessing and routing, tested without the 375 MB checkpoints (stand-in models give fixed outputs).

The accuracy of the real checkpoints is checked separately: tools/verify_app_classifier.py in the modelling repo runs the real
models on official test images and compares them with the saved offline results."""
import importlib.util
import os
import tempfile
import threading
import unittest
from collections import OrderedDict

import numpy as np
import torch
from PIL import Image

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_spec = importlib.util.spec_from_file_location(
    "convnext_classifier", os.path.join(BACKEND, "app", "core", "skin_analysis", "ml", "convnext_classifier.py"))
cc = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(cc)

SUB_NAMES = {"autunno": ["deep", "soft", "warm"], "primavera": ["bright", "light", "warm"],
             "estate": ["cool", "light", "soft"], "inverno": ["bright", "cool", "deep"]}


class Fixed(torch.nn.Module):
    """Ignores the image and always answers with the same logits."""
    def __init__(self, logits):
        super().__init__()
        self.logits = torch.tensor([logits], dtype=torch.float32)

    def forward(self, x):
        return self.logits.expand(len(x), -1)


def make_classifier(mode, season_logits, sub_logits, n_season_models=1):
    """A classifier object with stand-in models (no files are read)."""
    clf = cc.ConvNeXtClassifier.__new__(cc.ConvNeXtClassifier)
    clf.mode, clf.device, clf.lock = mode, torch.device("cpu"), threading.Lock()
    clf.sub_names = SUB_NAMES
    clf.season_models = [Fixed(season_logits) for _ in range(n_season_models)]
    clf.sub_models = OrderedDict((sea, Fixed(sub_logits[sea])) for sea in cc.SEASON_ORDER)
    clf.sub_capacity = 4
    return clf


BLANK = [np.zeros((cc.IMG_SIZE, cc.IMG_SIZE, 3), np.uint8)]


class PreprocessingTests(unittest.TestCase):
    def test_crop_to_mask_keeps_the_bounding_box_of_the_kept_regions(self):
        image = Image.new("RGB", (100, 80), (255, 255, 255))
        mask = np.zeros((80, 100), np.uint8)
        mask[20:60, 30:70] = 1
        self.assertEqual(cc.crop_to_mask(image, mask).size, (40, 40))

    def test_crop_to_mask_with_nothing_kept_returns_the_image_unchanged(self):
        image = Image.new("RGB", (100, 80), (255, 255, 255))
        self.assertEqual(cc.crop_to_mask(image, np.zeros((80, 100), np.uint8)).size, (100, 80))

    def test_pad_to_square_pads_with_black_and_does_not_squash(self):
        wide = Image.new("RGB", (200, 100), (255, 255, 255))
        out = cc.pad_to_square(wide)
        self.assertEqual(out.shape, (224, 224, 3))
        self.assertEqual(out.dtype, np.uint8)
        self.assertEqual(int(out[0].max()), 0)             # top and bottom rows are padding
        self.assertEqual(int(out[-1].max()), 0)
        self.assertEqual(int(out[112, 112].min()), 255)    # the picture is in the middle
        tall = cc.pad_to_square(Image.new("RGB", (100, 200), (255, 255, 255)))
        self.assertEqual(int(tall[:, 0].max()), 0)         # left and right columns are padding

    def test_to_tensor_uses_the_imagenet_statistics(self):
        x = cc.to_tensor([np.zeros((224, 224, 3), np.uint8), np.full((224, 224, 3), 255, np.uint8)])
        self.assertEqual(tuple(x.shape), (2, 3, 224, 224))
        mean, std = torch.tensor([0.485, 0.456, 0.406]), torch.tensor([0.229, 0.224, 0.225])
        self.assertTrue(torch.allclose(x[0, :, 0, 0], -mean / std, atol=1e-5))
        self.assertTrue(torch.allclose(x[1, :, 0, 0], (1 - mean) / std, atol=1e-5))


class FilesAndModesTests(unittest.TestCase):
    def test_each_mode_needs_the_right_checkpoints(self):
        self.assertEqual(len(cc.required_files("hard")), 5)
        self.assertEqual(len(cc.required_files("soft")), 5)
        ensemble = cc.required_files("ensemble")
        self.assertEqual(len(ensemble), 7)
        for name in ("season_v1.pt", "season_v2.pt", "season_v3.pt", "spring_v2.pt", "summer_v2.pt", "autumn_v2.pt", "winter_v2.pt"):
            self.assertIn(name, ensemble)
        self.assertNotIn("season_v1.pt", cc.required_files("hard"))

    def test_missing_files_and_errors(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertEqual(sorted(cc.missing_files(d, "hard")), sorted(cc.required_files("hard")))
            with self.assertRaises(FileNotFoundError):
                cc.ConvNeXtClassifier(d, mode="hard")
            with self.assertRaises(ValueError):
                cc.ConvNeXtClassifier(d, mode="nonsense")

    def test_twelve_names_follow_the_training_order(self):
        names = make_classifier("hard", [0, 0, 0, 0], {s: [0, 0, 0] for s in cc.SEASON_ORDER}).names12()
        self.assertEqual(names[0], "Deep Autumn")
        self.assertEqual(names[3], "Bright Spring")
        self.assertEqual(names[6], "Cool Summer")
        self.assertEqual(names[11], "Deep Winter")
        self.assertEqual(len(set(names)), 12)


class RoutingTests(unittest.TestCase):
    SEASON = [0.0, 3.0, 0.0, 0.0]     # the season model prefers primavera (index 1)
    SUB = {"autunno": [5.0, 0.0, 0.0], "primavera": [0.0, 1.0, 0.0], "estate": [0.0, 0.0, 0.0], "inverno": [0.0, 0.0, 2.0]}

    def expected(self):
        ps = torch.tensor(self.SEASON).softmax(0)
        subs = {s: torch.tensor(v).softmax(0) for s, v in self.SUB.items()}
        return ps, subs

    def test_hard_routing_asks_only_the_chosen_season_and_scores_the_answer(self):
        clf = make_classifier("hard", self.SEASON, self.SUB)
        out = clf.predict_batch(BLANK)
        ps, subs = self.expected()
        self.assertEqual(int(out["season"][0]), 1)
        self.assertEqual(int(out["pred12"][0]), 1 * 3 + 1)          # primavera / light
        self.assertAlmostEqual(float(out["scores"][0, 4]), float(ps[1] * subs["primavera"][1]), places=5)
        self.assertEqual(int((out["scores"][0] > 0).sum()), 1)       # only the answer is scored in hard mode

    def test_soft_routing_multiplies_season_by_sub_type_over_all_twelve(self):
        clf = make_classifier("soft", self.SEASON, self.SUB)
        out = clf.predict_batch(BLANK)
        ps, subs = self.expected()
        want = torch.stack([ps[i] * subs[s] for i, s in enumerate(cc.SEASON_ORDER)]).flatten().numpy()
        np.testing.assert_allclose(out["scores"][0], want, atol=1e-5)
        self.assertAlmostEqual(float(out["scores"][0].sum()), 1.0, places=5)
        self.assertEqual(int(out["pred12"][0]), int(want.argmax()))

    def test_soft_can_overrule_the_season_when_a_sub_type_model_is_very_sure(self):
        # the season model prefers primavera a little (0.4 vs 0.3), but the autunno sub-type model is nearly certain
        clf = make_classifier("soft", [0.3, 0.7, 0.0, 0.0], {"autunno": [9.0, 0.0, 0.0], "primavera": [0.0, 0.0, 0.0],
                                                           "estate": [0.0, 0.0, 0.0], "inverno": [0.0, 0.0, 0.0]})
        self.assertEqual(int(clf.predict_batch(BLANK)["pred12"][0]), 0)   # autunno / deep
        hard = make_classifier("hard", [0.3, 0.7, 0.0, 0.0], {"autunno": [9.0, 0.0, 0.0], "primavera": [0.0, 0.0, 0.0],
                                                             "estate": [0.0, 0.0, 0.0], "inverno": [0.0, 0.0, 0.0]})
        self.assertEqual(int(hard.predict_batch(BLANK)["season"][0]), 1)  # hard commits to primavera first

    def test_ensemble_averages_season_models_and_the_mirrored_photo(self):
        # identical stand-ins make the average equal to one model, so the ensemble must agree with soft routing
        soft = make_classifier("soft", self.SEASON, self.SUB).predict_batch(BLANK)
        ens = make_classifier("ensemble", self.SEASON, self.SUB, n_season_models=3).predict_batch(BLANK)
        np.testing.assert_allclose(ens["scores"], soft["scores"], atol=1e-5)
        self.assertEqual(int(ens["pred12"][0]), int(soft["pred12"][0]))


if __name__ == "__main__":
    unittest.main()
