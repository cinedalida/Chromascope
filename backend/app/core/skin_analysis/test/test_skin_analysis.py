import sys
from pathlib import Path
from PIL import Image
import numpy as np


# Add the parent directory to the Python path
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))
print(BASE_DIR)

from facer_processor import FaceProcessor
from get_color import get_dominant_lab_color


# def gray_world_white_balance(pil_image):
#     """
#     Neutralizes the color cast of the ambient light source.
#     Must be applied to the FULL image before any cropping or masking.
#     """
#     img = np.array(pil_image).astype(np.float32)

#     mean_r = np.mean(img[:, :, 0])
#     mean_g = np.mean(img[:, :, 1])
#     mean_b = np.mean(img[:, :, 2])

#     # The "gray" target — what each channel should average to
#     mean_gray = (mean_r + mean_g + mean_b) / 3.0

#     # Scale each channel to hit that gray target
#     img[:, :, 0] = np.clip(img[:, :, 0] * (mean_gray / mean_r), 0, 255)
#     img[:, :, 1] = np.clip(img[:, :, 1] * (mean_gray / mean_g), 0, 255)
#     img[:, :, 2] = np.clip(img[:, :, 2] * (mean_gray / mean_b), 0, 255)

#     return Image.fromarray(img.astype(np.uint8))


from scipy.ndimage import gaussian_filter

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

# Initialize the processor (This downloads/loads the models the first time)
facer_processor = FaceProcessor(device='cpu')

print("Applying white balance...")
raw_image = Image.open(f"{BASE_DIR}/test/test_images/me-2.jpg").convert("RGB")
# balanced_image = gray_world_white_balance(raw_image)  # ← on full image, before anything else
balanced_image = gray_edge_white_balance(raw_image) 

print("Processing image...")
segmented_result = facer_processor.generate_rgb_m(balanced_image, target="face_skin", save_debug=True)

# Extract the image and the mask from the dictionary
segmented_image = segmented_result["image"]
binary_mask = segmented_result["mask"]

# Feed them into the color mask function
lab_color = get_dominant_lab_color(segmented_image, binary_mask, k=3)

print(f"Extracted LAB Color: {lab_color}")
print("Done! Check the debug_output folder.")