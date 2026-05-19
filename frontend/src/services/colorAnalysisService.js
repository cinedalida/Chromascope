const API_BASE_URL = 'http://localhost:8000/api';

/**
 * Sends a selfie to the backend for ML analysis.
 * Returns: { seasonal_label, user_lab, ... }
 */
export async function analyzeColorImage(imageFile) {
  try {
    const formData = new FormData();
    formData.append('file', imageFile);

    const response = await fetch(`${API_BASE_URL}/analyze-color`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) throw new Error('Analysis failed');
    return await response.json();
  } catch (error) {
    console.error('Error in color analysis:', error);
    return { error: error.message };
  }
}