/**
 * productService
 *
 * Fetches the product catalog and palette-matched recommendations.
 */

const API_BASE_URL = 'http://localhost:8000/api';

export async function getProductCatalog() {
  try {
    const response = await fetch(`${API_BASE_URL}/products`);
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  } catch (error) {
    console.error('Error fetching catalog:', error);
    return [];
  }
}

export async function fetchRecommendations() {
  return Promise.resolve([]);
}
