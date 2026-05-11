import torch
from PIL import Image
import os
import sys
from pathlib import Path

# Add the parent directory to the Python path
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))
print(BASE_DIR)

from ml.model import ArmocromiaModel
from ml.transforms import get_test_transform
from facer_processor import FaceProcessor

# Configuration
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
FARL_PATH = str(BASE_DIR / "ml" / "weights" / "FaRL-Base-Patch16-LAIONFace20M-ep64.pth")
CKPT_PATH = str(BASE_DIR / "ml" / "weights" / "final_model.pth")

SEASON_TO_IDX = {"autunno": 0, "primavera": 1, "estate": 2, "inverno": 3}
IDX_TO_SEASON = {v: k for k, v in SEASON_TO_IDX.items()}

def load_model():
    """Initializes the model and loads your trained weights."""
    print("Loading model architecture and weights...")
    model = ArmocromiaModel(farl_path=FARL_PATH)
    
    if not os.path.exists(CKPT_PATH):
        raise FileNotFoundError(f"Missing trained weights at {CKPT_PATH}")
    
    # Load your custom trained head
    ckpt = torch.load(CKPT_PATH, map_location=DEVICE, weights_only=True)
    model.head.load_state_dict(ckpt["head_state"])
    
    model.to(DEVICE)
    model.eval() # Set to evaluation mode
    return model

# Load globally so it only happens once
model = load_model()
facer_processor = FaceProcessor(device=DEVICE)

def predict(image_path: str):
    """Predicts the season of a single image."""
    try:
        image = Image.open(image_path).convert("RGB")
    except Exception as e:
        return f"Error loading image: {e}", 0.0

    segmented_result = facer_processor.generate_rgb_m(image_path)
    tensor = get_test_transform(segmented_result["image"]).unsqueeze(0).to(DEVICE)
    
    with torch.no_grad():
        logits = model(tensor)
        probs = logits.softmax(dim=1)
        confidence, pred_idx = torch.max(probs, dim=1)
        
    predicted_season = IDX_TO_SEASON[pred_idx.item()]
    confidence_score = confidence.item() * 100
    
    return predicted_season.capitalize(), confidence_score

if __name__ == "__main__":
    # Test an image from the test folder
    test_img = str(BASE_DIR / "test" / "test_images" / "me-6.jpg")
    
    if os.path.exists(test_img):
        season, conf = predict(test_img)
        print(f"\n✅ Result: {season}")
        print(f"📊 Confidence: {conf:.2f}%")
    else:
        print(f"❌ Please place an image at '{test_img}' to test.")