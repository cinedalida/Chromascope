// Backend API address (no trailing slash), e.g. https://chromascope-api-xxxx.a.run.app/api
// Set VITE_API_URL in the Vercel project settings for production and in frontend/.env.local for development.
// Only the local dev server falls back to localhost; a production build never calls http://localhost.
const configured = import.meta.env.VITE_API_URL?.replace(/\/+$/, "");

export const API_BASE_URL = configured || (import.meta.env.DEV ? "http://localhost:8000/api" : "");

if (!API_BASE_URL) {
  console.error("VITE_API_URL is not set: color analysis, the safety filter and the catalog cannot reach the backend.");
}

export const apiUrl = (path) => `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

// Product photos served by the backend are stored as "/catalog-images/<file>"; full links are used as they are.
export const assetUrl = (url) =>
  typeof url === "string" && url.startsWith("/catalog-images/") ? `${API_BASE_URL.replace(/\/api$/, "")}${url}` : url;
