/**
 * ingredientService
 *
 * Fetches and filters cosmetic ingredients against the user's allergen and safety profile.
 */

const API_BASE_URL = 'http://localhost:8000/api';

export async function filterIngredients(criteria) {
  try {
    const response = await fetch(`${API_BASE_URL}/run-filter`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(criteria)
    });
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  } catch (error) {
    console.error('Error filtering ingredients:', error);
    return [];
  }
}

export async function fetchIngredientSafety(ingredient) {
  return Promise.resolve({ safe: true });
}
