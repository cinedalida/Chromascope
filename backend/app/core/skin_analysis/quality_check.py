import cv2
import numpy as np

# Thresholds — plain image statistics, no model involved. Tune against real photos.
MIN_SKIN_PIXELS = 500       # fewer skin pixels than this = face too small / covered
BLUR_CROP_WIDTH = 512       # face crop is resized to this width before measuring sharpness
BLUR_THRESHOLD = 3.0        # Laplacian variance below this = blurry (smooth skin scores low, so keep it lenient)
DARK_L_THRESHOLD = 30.0     # mean skin L* (0-100) below this = too dark
BRIGHT_L_THRESHOLD = 85.0   # mean skin L* (0-100) above this = washed out

# Confidence is the 12-class score P(season) x P(sub-type | season), which is small even for a good photo (median 36% on the
# official test set). 30 flagged 28.5% of test photos, and more real selfies; 25 flags 13% and still separates right from wrong.
LOW_CONFIDENCE_THRESHOLD = 25.0  # 12-class confidence (%) below this = low confidence


class PhotoQualityError(Exception):
    """Raised when a photo can't be analyzed reliably. `code` is sent to the frontend."""

    def __init__(self, code, message):
        super().__init__(message)
        self.code = code
        self.message = message


def skin_brightness(image_np, mask_np):
    """Mean L* (0-100) of the skin pixels."""
    skin_pixels = image_np[mask_np == 1].reshape(-1, 1, 3)
    lab = cv2.cvtColor(skin_pixels, cv2.COLOR_RGB2LAB)
    # OpenCV scales 8-bit L* to 0-255
    return float(lab[:, :, 0].mean()) * 100.0 / 255.0


def face_sharpness(image_np, mask_np):
    """Laplacian variance over skin pixels only, measured at a fixed width so
    the score doesn't depend on the photo's resolution."""
    ys, xs = np.nonzero(mask_np)
    crop = image_np[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    mask = mask_np[ys.min():ys.max() + 1, xs.min():xs.max() + 1].astype(np.uint8)
    scale = min(1.0, BLUR_CROP_WIDTH / crop.shape[1])  # never upscale
    if scale < 1.0:
        size = (BLUR_CROP_WIDTH, max(1, round(crop.shape[0] * scale)))
        crop = cv2.resize(crop, size, interpolation=cv2.INTER_AREA)
        mask = cv2.resize(mask, size, interpolation=cv2.INTER_NEAREST)
    gray = cv2.cvtColor(crop, cv2.COLOR_RGB2GRAY)
    lap = cv2.Laplacian(gray, cv2.CV_64F)
    # Erode so mask borders (eyes, lips, hair edges) don't count
    inner = cv2.erode(mask, np.ones((5, 5), np.uint8)).astype(bool)
    if inner.sum() < 100:
        inner = mask.astype(bool)
    return float(lap[inner].var())


def check_photo_quality(pil_image, skin_mask):
    """
    Runs on the original (non white-balanced) photo using the face-skin mask.
    Raises PhotoQualityError on the first problem found.
    """
    if skin_mask.sum() < MIN_SKIN_PIXELS:
        raise PhotoQualityError(
            "face_unclear",
            "Not enough of the face is visible to read the skin tone.",
        )

    image_np = np.array(pil_image.convert("RGB"))

    brightness = skin_brightness(image_np, skin_mask)
    if brightness < DARK_L_THRESHOLD:
        raise PhotoQualityError("too_dark", "The photo is too dark to read the skin tone.")
    if brightness > BRIGHT_L_THRESHOLD:
        raise PhotoQualityError("too_bright", "The photo is overexposed and the skin tone is washed out.")

    sharpness = face_sharpness(image_np, skin_mask)
    print(f"[quality] sharpness={sharpness:.2f} (threshold {BLUR_THRESHOLD}) brightness={brightness:.1f}")
    if sharpness < BLUR_THRESHOLD:
        raise PhotoQualityError("too_blurry", "The face in the photo is out of focus.")
