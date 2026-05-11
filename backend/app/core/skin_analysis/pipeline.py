import torch
from PIL import Image
import os
import sys
from pathlib import Path
from scipy.ndimage import gaussian_filter
import numpy as np

# Add the parent directory to the Python path
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))
print(BASE_DIR)

from ml.model import ArmocromiaModel
from ml.transforms import get_test_transform
from facer_processor import FaceProcessor
from get_color import get_dominant_lab_color

# Configuration
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
FARL_PATH = str(BASE_DIR / "ml" / "weights" / "FaRL-Base-Patch16-LAIONFace20M-ep64.pth")
# CKPT_PATH = str(BASE_DIR / "ml" / "weights" / "final_model.pth") <-- Model for Season Only
CKPT_PATH = str(BASE_DIR / "ml" / "weights" / "final_sub_class_model.pth")

# SEASON_TO_IDX = {"autunno": 0, "primavera": 1, "estate": 2, "inverno": 3}
# SEASON_TO_IDX = {"autunno": 0, "primavera": 1, "estate": 2, "inverno": 3}
# IDX_TO_SEASON = {v: k for k, v in SEASON_TO_IDX.items()}
# UPDATED: 12-Season Mapping
IDX_TO_SEASON = {
    0: "Deep Autumn",
    1: "Soft Autumn",
    2: "Warm Autumn",
    3: "Cool Summer",
    4: "Light Summer",
    5: "Soft Summer",
    6: "Bright Winter",
    7: "Cool Winter",
    8: "Deep Winter",
    9: "Bright Spring",
    10: "Light Spring",
    11: "Warm Spring"
}


def gray_edge_white_balance(pil_image, sigma=1):
    """
    Uses color gradients (edges) instead of raw pixel averages.
    Robust when the face dominates the frame — avoids the green skin problem.
    """
    img = np.array(pil_image).astype(np.float32)
    edge_means = []

    for c in range(3):
        smoothed = gaussian_filter(img[:, :, c], sigma=sigma)
        dx = np.abs(np.gradient(smoothed, axis=1))
        dy = np.abs(np.gradient(smoothed, axis=0))
        edge_means.append(np.mean(dx + dy))

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
        self.model = self._load_model()
        
    def _load_model(self):
        """Initializes the classification model and loads weights."""
        print("Loading classification model architecture and weights...")
        
        # CRITICAL UPDATE: Explicitly set num_classes=12 so the new head weights match!
        model = ArmocromiaModel(farl_path=FARL_PATH, num_classes=12)
        
        if not os.path.exists(CKPT_PATH):
            raise FileNotFoundError(f"Missing trained weights at {CKPT_PATH}")
        
        ckpt = torch.load(CKPT_PATH, map_location=DEVICE, weights_only=True)
        # model.head.load_state_dict(ckpt["head_state"])
        model.head.load_state_dict(ckpt["twelve_head_state"]) 
        model.to(DEVICE)
        model.eval() # Set to evaluation mode
        return model

    def analyze(self, image_source):
        """
        Processes an image and returns the season, confidence, and skin shade.
        Accepts either a file path (str) or a PIL Image.
        """
        # 1. Handle Image Loading
        try:
            if isinstance(image_source, str):
                image = Image.open(image_source).convert("RGB")
            else:
                image = image_source.convert("RGB")
        except Exception as e:
            return {"error": f"Error loading image: {e}"}

        # Apply gray edge white balance
        balanced_image = gray_edge_white_balance(image)

        # 2. Segment Face for Skin Color Extraction (Skin Only)
        skin_data = self.facer.generate_rgb_m(balanced_image, target='face_skin')
        
        # 3. Segment Face for Season Model (General Head: Hair, Eyes, Lips, etc.)
        head_data = self.facer.generate_rgb_m(balanced_image, target='general_head')

        # 4. Extract Dominant Skin Color (LAB space) using the skin mask
        try:
            lab_color = get_dominant_lab_color(skin_data['image'], skin_data['mask'])
            # Convert numpy array to standard Python list for easy API serialization
            lab_color_list = lab_color.tolist() 
        except ValueError as e:
            # Fallback if masking completely fails
            print(f"Color extraction error: {e}")
            lab_color_list = [0.0, 0.0, 0.0] 

        # 5. Predict Season using the general head mask
        tensor = get_test_transform(head_data['image']).unsqueeze(0).to(DEVICE)
        
        with torch.no_grad():
            logits = self.model(tensor)
            probs = logits.softmax(dim=1)
            confidence, pred_idx = torch.max(probs, dim=1)
            
        season = IDX_TO_SEASON[pred_idx.item()]
        confidence_score = confidence.item() * 100

        # 6. Return Unified Result
        return {
            "season": season,
            "confidence": confidence_score,
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
            print(f"✅ Season: {result['season']}")
            print(f"📊 Confidence: {result['confidence']:.2f}%")
            print(f"🎨 Dominant Face Color (LAB): [L: {result['lab_color'][0]:.2f}, a: {result['lab_color'][1]:.2f}, b: {result['lab_color'][2]:.2f}]")
    else:
        print(f"❌ Please place an image at '{test_img}' to test.")