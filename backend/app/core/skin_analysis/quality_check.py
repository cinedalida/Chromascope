import cv2
import numpy as np

# Thresholds — plain image statistics, no model involved. Tune against real photos.
MIN_SKIN_PIXELS = 500       # fewer skin pixels than this = face too small / covered
BLUR_CROP_WIDTH = 256       # face crop is resized to this width before measuring sharpness
BLUR_THRESHOLD = 15.0       # Laplacian variance below this = blurry
DARK_L_THRESHOLD = 30.0     # mean skin L* (0-100) below this = too dark
BRIGHT_L_THRESHOLD = 85.0   # mean skin L* (0-100) above this = washed out

LOW_CONFIDENCE_THRESHOLD = 30.0  # season confidence (%) below this = low confidence


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
    """Laplacian variance of the face region, measured at a fixed width so
    the score doesn't depend on the photo's resolution."""
    ys, xs = np.nonzero(mask_np)
    crop = image_np[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    scale = BLUR_CROP_WIDTH / crop.shape[1]
    crop = cv2.resize(crop, (BLUR_CROP_WIDTH, max(1, round(crop.shape[0] * scale))))
    gray = cv2.cvtColor(crop, cv2.COLOR_RGB2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


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

    if face_sharpness(image_np, skin_mask) < BLUR_THRESHOLD:
        raise PhotoQualityError("too_blurry", "The face in the photo is out of focus.")
