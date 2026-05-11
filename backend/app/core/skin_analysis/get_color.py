import numpy as np
from sklearn.cluster import KMeans
from skimage import color

def get_dominant_lab_color(pil_image, mask_np, k=3):
    """
    Extracts the dominant skin color by clustering directly in LAB space.

    Args:
        pil_image: The PIL Image returned by FaceProcessor.
        mask_np: The numpy binary mask (1 for keep, 0 for ignore).
        k: Number of clusters — 3 separates shadows, midtones, highlights.

    Returns:
        numpy array: The [L, a, b] float values of the dominant skin tone.
    """

    # 1. Convert PIL image to numpy RGB array
    img_array = np.array(pil_image)

    # 2. Extract only the valid (non-masked) pixels → shape (N, 3)
    valid_pixels_rgb = img_array[mask_np == 1]

    if len(valid_pixels_rgb) == 0:
        raise ValueError("No valid pixels found in the image.")

    # 3. Convert pixels to LAB space BEFORE clustering
    #    skimage expects float64 in [0, 1], shape (N, 1, 3)
    rgb_normalized = valid_pixels_rgb.astype(np.float64) / 255.0
    lab_3d = color.rgb2lab(rgb_normalized.reshape(-1, 1, 3))
    valid_pixels_lab = lab_3d.reshape(-1, 3)  # back to (N, 3)

    # 4. K-Means clustering in LAB space
    #    Shadows/highlights now separate on perceptually meaningful distances
    kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
    kmeans.fit(valid_pixels_lab)

    # 5. The largest cluster = true mid-tone skin color
    counts = np.bincount(kmeans.labels_)
    dominant_index = np.argmax(counts)

    # Centroid is already in LAB — feed directly to CIEDE2000
    true_lab_color = kmeans.cluster_centers_[dominant_index]

    return true_lab_color