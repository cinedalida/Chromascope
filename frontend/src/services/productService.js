import { auth } from "../firebase"; 

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

export async function runFilter(payload) {
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