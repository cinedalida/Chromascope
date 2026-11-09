import { auth } from "../firebase"; 

import { API_BASE_URL } from "../config";

export async function getProductCatalog() {
  try {
    const token = await auth.currentUser?.getIdToken();
    const response = await fetch(`${API_BASE_URL}/products`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  } catch (error) {
    console.error('Error fetching catalog:', error);
    return [];
  }
}

// timeoutMs: give up (and return the empty result) instead of waiting forever on a slow or sleeping backend.
export async function runFilter(payload, { timeoutMs } = {}) {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("Authentication required");
    
    const token = await user.getIdToken();

    const response = await fetch(`${API_BASE_URL}/run-filter`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify(payload),
      signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error('Unauthorized: Please re-login');
      throw new Error('Filtering failed');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error running filter:', error);
    return { safety_results: [], color_matched: [] };
  }
}
// Real verdict counts over the whole catalog for the signed-in user's profile (catalog page statistics).
export async function getCatalogSummary() {
  try {
    const token = await auth.currentUser?.getIdToken();
    const response = await fetch(`${API_BASE_URL}/catalog/summary`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new Error(`Summary failed (${response.status})`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching catalog summary:', error);
    return null;
  }
}
