import torch
from PIL import Image
import os
import sys
from pathlib import Path
from scipy.ndimage import gaussian_filter
import numpy as np
from concurrent.futures import ThreadPoolExecutor

# Add the parent directory to the Python path
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))
print(BASE_DIR)

from ml.convnext_classifier import MODES, ConvNeXtClassifier, missing_files
from facer_processor import FaceProcessor
from get_color import get_dominant_lab_color
from quality_check import PhotoQualityError, check_photo_quality, LOW_CONFIDENCE_THRESHOLD

# Configuration
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# The season classifier is the thesis model: hierarchical ConvNeXt-Large (see ml/convnext_classifier.py).
#   CLASSIFIER_MODE=hard      season model, then one sub-type model (2 passes; 31.0% on the official test set) - the default
#   CLASSIFIER_MODE=soft      all four sub-type models (31.7%)
#   CLASSIFIER_MODE=ensemble  3 season models + mirrored photo (33.6%); needs about 8 GiB of memory
WEIGHTS_DIR = str(BASE_DIR / "ml" / "weights" / "convnext")
CLASSIFIER_MODE = os.getenv("CLASSIFIER_MODE", "hard").strip().lower()
if CLASSIFIER_MODE not in MODES:
    raise ValueError(f"CLASSIFIER_MODE must be one of {MODES}, not {CLASSIFIER_MODE!r}")


def classifier_weights_missing():
    """The checkpoint files the chosen mode needs but that are not in WEIGHTS_DIR (empty list = all there)."""
    return missing_files(WEIGHTS_DIR, CLASSIFIER_MODE)


def gray_edge_white_balance(pil_image, sigma=1):
    """
    Uses color gradients (edges) instead of raw pixel averages.
    Robust when the face dominates the frame — avoids the green skin problem.
    """
    img = np.array(pil_image).astype(np.float32)

    def channel_edge_mean(c):
        smoothed = gaussian_filter(img[:, :, c], sigma=sigma)
        dx = np.abs(np.gradient(smoothed, axis=1))
        dy = np.abs(np.gradient(smoothed, axis=0))
        return np.mean(dx + dy)

    # the three channels are independent (and scipy/numpy release the GIL), so they run side by side; same numbers
    with ThreadPoolExecutor(max_workers=3) as pool:
        edge_means = list(pool.map(channel_edge_mean, range(3)))

    mean_gray = np.mean(edge_means)

    for c in range(3):
        img[:, :, c] = np.clip(img[:, :, c] * (mean_gray / (edge_means[c] + 1e-6)), 0, 255)

    return Image.fromarray(img.astype(np.uint8))

class AnalyzerPipeline:
    def __init__(self):
        print("Initializing unified pipeline...")
        # 1. Load the Face Processor (Segmentation & Masking)
        self.facer = FaceProcessor(device=DEVICE)
        
        # 2. Load the Classification Model (Season Prediction)
        print(f"Loading the ConvNeXt season classifier (mode: {CLASSIFIER_MODE})...")
        self.classifier = ConvNeXtClassifier(WEIGHTS_DIR, mode=CLASSIFIER_MODE, device=DEVICE)

    def warm_up(self):
        """
        Runs each network on a dummy input so the first real photo doesn't pay the one-off setup cost (the TorchScript
        parser optimises itself over its first calls). Output is unaffected. Safe to skip.
        """
        with torch.inference_mode():
            noise = torch.from_numpy(np.random.RandomState(0).randint(0, 255, (3, 448, 448), dtype=np.uint8))
            for _ in range(3):  # TorchScript optimises itself after its first two calls
                self.facer.face_detector(noise.unsqueeze(0).to(DEVICE))
                self.facer.face_parser.forward_warped(torch.zeros(1, 3, 448, 448, device=DEVICE), return_preds=False)

        self.classifier.warm_up()

        # the colour step's libraries (scikit-learn, scikit-image, OpenCV) also do their one-off setup on first use
        rng = np.random.RandomState(0)
        tile = Image.fromarray(rng.randint(0, 255, (64, 64, 3), dtype=np.uint8))
        mask = np.ones((64, 64), dtype=np.uint8)
        get_dominant_lab_color(tile, mask)
        try:
            check_photo_quality(tile, mask)
        except PhotoQualityError:
            pass

    def analyze(self, image_source):
        """
        Processes an image and returns the season, confidence, and skin shade.
        Accepts either a file path (str) or a PIL Image.
        On failure returns {"error": message, "error_code": code}.
        """
        # 1. Handle Image Loading
        try:
            if isinstance(image_source, str):
                image = Image.open(image_source).convert("RGB")
            else:
                image = image_source.convert("RGB")
        except Exception as e:
            return {"error": f"Error loading image: {e}", "error_code": "invalid_image"}

        # Apply gray edge white balance
        balanced_image = gray_edge_white_balance(image)

        # 2. Detect + parse the face once; both masks below come from this single parse
        try:
            parsed = self.facer.parse(balanced_image)
        except ValueError as e:
            return {"error": str(e), "error_code": "no_face"}

        # Segment Face for Skin Color Extraction (Skin Only)
        skin_data = self.facer.apply_mask(parsed, target='face_skin')

        # 3. Reject blurry / too dark / too bright photos before predicting
        try:
            check_photo_quality(image, skin_data['mask'])
        except PhotoQualityError as e:
            return {"error": e.message, "error_code": e.code}

        # 4. The regions the season model was trained on (hair, face skin, nose, brows, eyes, mouth) on a black background
        regions = self.facer.apply_mask(parsed, target='season_regions')

        # 5. Extract Dominant Skin Color (LAB space) using the skin mask
        try:
            lab_color = get_dominant_lab_color(skin_data['image'], skin_data['mask'])
            # Convert numpy array to standard Python list for easy API serialization
            lab_color_list = lab_color.tolist()
        except ValueError as e:
            print(f"Color extraction error: {e}")
            return {"error": "Could not read the skin tone from the photo.", "error_code": "face_unclear"}

        # 6. Predict the season from the ORIGINAL photo (no white balance: the model never saw one) cut to those regions.
        # The classifier crops to the regions' bounding box, pads to a square and resizes to 224 px, as in training.
        mask = regions['mask']
        season_input = Image.fromarray((np.asarray(image) * mask[..., None]).astype(np.uint8))
        prediction = self.classifier.predict(season_input, mask)

        season = prediction["label"]
        confidence_score = prediction["confidence"] * 100

        # 7. Return Unified Result
        return {
            "season": season,
            "confidence": confidence_score,
            "low_confidence": confidence_score < LOW_CONFIDENCE_THRESHOLD,
            "lab_color": lab_color_list
        }


if __name__ == "__main__":
    # Test the unified pipeline
    pipeline = AnalyzerPipeline()
    
    test_img = str(BASE_DIR / "test" / "test_images" / "659.jpg")
    
    if os.path.exists(test_img):
        result = pipeline.analyze(test_img)
        
        if "error" in result:
            print(result["error"])
        else:
            print("\n--- Analysis Complete ---")
            print(f"Season: {result['season']}")
            print(f"Confidence: {result['confidence']:.2f}%")
            print(f"Dominant Face Color (LAB): [L: {result['lab_color'][0]:.2f}, a: {result['lab_color'][1]:.2f}, b: {result['lab_color'][2]:.2f}]")
    else:
        print(f"Please place an image at '{test_img}' to test.")