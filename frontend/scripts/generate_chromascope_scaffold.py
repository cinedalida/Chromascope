from pathlib import Path

root = Path("c:/Users/cine/Documents/cine/projects/Chromascope/frontend")
src = root / "src"

pages = {
    "SplashPage.jsx": "SplashPage introduces Chromascope and routes users into the app flow.",
    "AuthPage.jsx": "AuthPage contains login and registration entry points for users.",
    "DataEthicsPage.jsx": "DataEthicsPage explains how Chromascope handles user data ethically.",
    "HomePage.jsx": "HomePage is the main dashboard for consumer recommendations and navigation.",
    "OnboardingPage.jsx": "OnboardingPage collects profile and beauty preferences from the user.",
    "ARTryOnPage.jsx": "ARTryOnPage hosts the augmented reality try-on interface for products.",
    "ColorAnalysisPage.jsx": "ColorAnalysisPage begins the skin tone and palette analysis flow.",
    "ColorAnalysisProcessingPage.jsx": "ColorAnalysisProcessingPage shows progress while the analysis engine runs.",
    "ColorAnalysisSubtypePage.jsx": "ColorAnalysisSubtypePage shows the subtype-specific results after analysis.",
    "PaletteGuideProductPage.jsx": "PaletteGuideProductPage presents curated cosmetic products for the user palette.",
    "IngredientFilterPage.jsx": "IngredientFilterPage enables ingredient safety filtering for cosmetic products.",
    "AdminDatabasePage.jsx": "AdminDatabasePage is an admin dashboard for managing the product database.",
}

components = {
    "common": {
        "Navbar.jsx": "Navbar navigation and brand shell for the app.",
        "Sidebar.jsx": "Sidebar navigation for feature quick links.",
        "Button.jsx": "Button component used across Chromascope UI.",
        "Modal.jsx": "Modal wrapper for overlays and confirmation dialogs.",
        "Badge.jsx": "Badge for status labels and recommendation tags.",
        "LoadingSpinner.jsx": "LoadingSpinner indicates background activity.",
        "ProgressBar.jsx": "ProgressBar displays analysis or onboarding progress.",
    },
    "auth": {
        "LoginForm.jsx": "LoginForm handles email and password entry.",
        "RegisterForm.jsx": "RegisterForm captures new user details.",
        "ConsentNotice.jsx": "ConsentNotice displays privacy and AI usage consent information.",
    },
    "onboarding": {
        "PatientProfileForm.jsx": "PatientProfileForm gathers basic profile details.",
        "SkinTypeSelector.jsx": "SkinTypeSelector lets users choose their skin type.",
        "AllergenTagInput.jsx": "AllergenTagInput captures ingredients to avoid.",
        "FitzpatrickClassifier.jsx": "FitzpatrickClassifier estimates the user’s skin phototype.",
    },
    "color-analysis": {
        "ImageUploader.jsx": "ImageUploader accepts a selfie or photo for tone analysis.",
        "ProcessingAnimation.jsx": "ProcessingAnimation shows animated progress during analysis.",
        "SeasonResult.jsx": "SeasonResult displays the identified seasonal color profile.",
        "SeasonPaletteGrid.jsx": "SeasonPaletteGrid shows a grid of recommended seasonal shades.",
        "SubtypePaletteDetail.jsx": "SubtypePaletteDetail details the chosen subtype palette.",
        "StylingChecklist.jsx": "StylingChecklist provides simple application guidance.",
    },
    "ar-tryon": {
        "CameraFeed.jsx": "CameraFeed renders the live device camera preview.",
        "AROverlayCanvas.jsx": "AROverlayCanvas shows makeup overlays on the live feed.",
        "ProductSwatchPicker.jsx": "ProductSwatchPicker chooses color swatches for AR try-on.",
        "ARControlBar.jsx": "ARControlBar surfaces controls for the AR experience.",
    },
    "palette-products": {
        "PaletteGuideCard.jsx": "PaletteGuideCard showcases a curated palette item.",
        "CuratedMatchesGrid.jsx": "CuratedMatchesGrid displays matched products.",
        "ProductCard.jsx": "ProductCard shows product details and swatches.",
        "RecommendationBadge.jsx": "RecommendationBadge highlights top picks.",
    },
    "ingredient-filter": {
        "ScientificFilterPanel.jsx": "ScientificFilterPanel lets users build ingredient filters.",
        "IngredientSafetyTag.jsx": "IngredientSafetyTag marks ingredient safety status.",
        "AllergenFlagList.jsx": "AllergenFlagList lists flagged allergens.",
        "INCIMatchTable.jsx": "INCIMatchTable displays ingredient matching details.",
    },
    "admin": {
        "ProductCatalogTable.jsx": "ProductCatalogTable lists products for admin review.",
        "DatabaseStatsCards.jsx": "DatabaseStatsCards shows admin summary metrics.",
        "AddProductModal.jsx": "AddProductModal is the form modal for new catalog items.",
        "ProductFilterBar.jsx": "ProductFilterBar provides catalog search and filters.",
    },
}

hooks = {
    "useColorAnalysis.jsx": '''import { useState } from "react";

export function useColorAnalysis() {
  const [result, setResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  function analyze(imageFile) {
    setIsAnalyzing(true);
    setTimeout(() => {
      setResult({ season: "summer", palette: ["#B78BFF", "#D9A3FF"] });
      setIsAnalyzing(false);
    }, 800);
  }

  return { result, isAnalyzing, analyze };
}
''',
    "useARCamera.jsx": '''import { useState, useEffect, useRef } from "react";

export function useARCamera() {
  const [isReady, setIsReady] = useState(false);
  const cameraRef = useRef(null);

  useEffect(() => {
    setIsReady(true);
  }, []);

  return { cameraRef, isReady };
}
''',
    "useIngredientFilter.jsx": '''import { useState } from "react";

export function useIngredientFilter() {
  const [filters, setFilters] = useState([]);

  return { filters, setFilters };
}
''',
    "useUserProfile.jsx": '''import { useMemo } from "react";
import { useUserStore } from "../store/userStore.js";

export function useUserProfile() {
  const user = useUserStore((state) => state.user);
  const isAuthenticated = useMemo(() => Boolean(user?.id), [user]);

  return { user, isAuthenticated };
}
''',
    "useProductRecommendations.jsx": '''import { useState, useEffect } from "react";
import { fetchRecommendations } from "../services/productService.js";

export function useProductRecommendations() {
  const [recommendations, setRecommendations] = useState([]);

  useEffect(() => {
    fetchRecommendations().then(setRecommendations);
  }, []);

  return { recommendations };
}
''',
}

services = {
    "colorAnalysisService.js": '''export async function analyzeColorImage(imageFile) {
  return Promise.resolve({ season: "autumn", profile: "warm" });
}

export async function fetchSeasonPalette(season) {
  return Promise.resolve(["#9B5DE5", "#F15BB5", "#00BBF9"]);
}
''',
    "productService.js": '''export async function getProductCatalog() {
  return Promise.resolve([]);
}

export async function fetchRecommendations() {
  return Promise.resolve([]);
}
''',
    "ingredientService.js": '''export async function filterIngredients(criteria) {
  return Promise.resolve([]);
}

export async function fetchIngredientSafety(ingredient) {
  return Promise.resolve({ safe: true });
}
''',
    "authService.js": '''export async function login(credentials) {
  return Promise.resolve({ id: "user-1", name: "Chromascope User" });
}

export async function register(data) {
  return Promise.resolve({ id: "user-2", name: data.name });
}
''',
    "adminService.js": '''export async function fetchDatabaseStats() {
  return Promise.resolve({ products: 122, activeUsers: 4800 });
}

export async function saveProduct(product) {
  return Promise.resolve({ success: true, product });
}
''',
}

stores = {
    "userStore.js": '''import { create } from "zustand";

export const useUserStore = create((set) => ({
  user: null,
  login(user) {
    set({ user });
  },
  logout() {
    set({ user: null });
  },
  updateProfile(profile) {
    set((state) => ({ user: { ...state.user, ...profile } }));
  },
}));
''',
    "analysisStore.js": '''import { create } from "zustand";

export const useAnalysisStore = create((set) => ({
  result: null,
  progress: 0,
  setResult(result) {
    set({ result });
  },
  setProgress(progress) {
    set({ progress });
  },
}));
''',
    "productStore.js": '''import { create } from "zustand";

export const useProductStore = create((set) => ({
  products: [],
  setProducts(products) {
    set({ products });
  },
}));
''',
}

utils = {
    "colorConversion.js": '''export const D65_MATRIX = [95.047, 100.0, 108.883];

export function srgbToCIELAB({ r, g, b }) {
  return { l: 50, a: 0, b: 0 };
}
''',
    "deltaE.js": '''export function deltaE2000(labA, labB) {
  return Math.sqrt((labA.l - labB.l) ** 2 + (labA.a - labB.a) ** 2 + (labA.b - labB.b) ** 2);
}
''',
    "imagePreprocessing.js": '''export function applyCLAHE(imageData) {
  return imageData;
}
''',
    "validators.js": '''export function isHexColor(value) {
  return /^#[0-9A-F]{6}$/i.test(value);
}

export function validateEmail(email) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}
''',
}

styles = {
    "globals.css": '''@import "./variables.css";
@import "./components.css";

:root {
  color-scheme: dark;
}

body {
  margin: 0;
  min-height: 100vh;
  font-family: Inter, system-ui, sans-serif;
  background: radial-gradient(circle at top, rgba(138, 89, 255, 0.14), transparent 40%), #060615;
  color: var(--text-100);
}

button,
input,
textarea,
select {
  font: inherit;
}
''',
    "variables.css": '''/* Purple theme tokens for Chromascope */
:root {
  --surface-950: #05050d;
  --surface-900: #121326;
  --surface-800: #1e1f3b;
  --surface-700: #2f2f58;
  --text-100: #f7efff;
  --text-200: #d7c3ff;
  --purple-500: #a855f7;
  --purple-600: #9333ea;
  --purple-700: #7e22ce;
  --accent-500: #f472b6;
  --border-200: rgba(255, 255, 255, 0.08);
}
''',
    "components.css": '''.page-shell {
  min-height: 100vh;
  background: linear-gradient(180deg, rgba(30, 16, 68, 0.98) 0%, rgba(8, 3, 26, 1) 100%);
}

.card-base {
  background: rgba(16, 10, 42, 0.92);
  border: 1px solid var(--border-200);
  border-radius: 1.5rem;
}
''',
}

routes = {
    "AppRouter.jsx": '''import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { SplashPage } from "../pages/SplashPage.jsx";
import { AuthPage } from "../pages/AuthPage.jsx";
import { DataEthicsPage } from "../pages/DataEthicsPage.jsx";
import { HomePage } from "../pages/HomePage.jsx";
import { OnboardingPage } from "../pages/OnboardingPage.jsx";
import { ARTryOnPage } from "../pages/ARTryOnPage.jsx";
import { ColorAnalysisPage } from "../pages/ColorAnalysisPage.jsx";
import { ColorAnalysisProcessingPage } from "../pages/ColorAnalysisProcessingPage.jsx";
import { ColorAnalysisSubtypePage } from "../pages/ColorAnalysisSubtypePage.jsx";
import { PaletteGuideProductPage } from "../pages/PaletteGuideProductPage.jsx";
import { IngredientFilterPage } from "../pages/IngredientFilterPage.jsx";
import { AdminDatabasePage } from "../pages/AdminDatabasePage.jsx";
import { ProtectedRoute } from "./ProtectedRoute.jsx";
import { AdminRoute } from "./AdminRoute.jsx";

export function AppRouter() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<SplashPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/ethics" element={<DataEthicsPage />} />
        <Route path="/home" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
        <Route path="/ar-tryon" element={<ProtectedRoute><ARTryOnPage /></ProtectedRoute>} />
        <Route path="/color-analysis" element={<ProtectedRoute><ColorAnalysisPage /></ProtectedRoute>} />
        <Route path="/color-analysis/processing" element={<ProtectedRoute><ColorAnalysisProcessingPage /></ProtectedRoute>} />
        <Route path="/color-analysis/subtype" element={<ProtectedRoute><ColorAnalysisSubtypePage /></ProtectedRoute>} />
        <Route path="/palette-product" element={<ProtectedRoute><PaletteGuideProductPage /></ProtectedRoute>} />
        <Route path="/ingredient-filter" element={<ProtectedRoute><IngredientFilterPage /></ProtectedRoute>} />
        <Route path="/admin" element={<AdminRoute><AdminDatabasePage /></AdminRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
''',
    "ProtectedRoute.jsx": '''import { Navigate } from "react-router-dom";
import { useUserProfile } from "../hooks/useUserProfile.jsx";

export function ProtectedRoute({ children }) {
  const { isAuthenticated } = useUserProfile();
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }
  return children;
}
''',
    "AdminRoute.jsx": '''import { Navigate } from "react-router-dom";
import { useUserProfile } from "../hooks/useUserProfile.jsx";

export function AdminRoute({ children }) {
  const { user } = useUserProfile();
  const isAdmin = user?.role === "admin";
  if (!isAdmin) {
    return <Navigate to="/home" replace />;
  }
  return children;
}
''',
}

app = {
    "App.jsx": '''import "./App.css";
import AppRouter from "./routes/AppRouter.jsx";

export function App() {
  return <AppRouter />;
}

export default App;
''',
}

main_content = '''import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./styles/globals.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
'''

page_body = {
    "SplashPage.jsx": '''<p className="text-lg text-slate-300">Welcome to Chromascope — your AI-driven mobile cosmetic recommendation experience.</p>\n        <button className="rounded-full bg-purple-600 px-6 py-3 text-white">Continue</button>''',
    "AuthPage.jsx": '''<p className="text-slate-400">Sign in, register, or review consent to continue.</p>\n        <div className="grid gap-4 md:grid-cols-2"><div className="rounded-xl bg-slate-900 p-4"><strong>Login</strong></div><div className="rounded-xl bg-slate-900 p-4"><strong>Register</strong></div></div>''',
    "DataEthicsPage.jsx": '''<p className="text-slate-400">We use responsible AI and privacy-first design for makeup recommendations.</p>\n        <p className="text-slate-400">Your biometric and skin data stays secure, and consent is always optional.</p>''',
    "HomePage.jsx": '''<p className="text-slate-400">Explore your personalized color profile, season palette, and AR try-on tools.</p>''',
    "OnboardingPage.jsx": '''<p className="text-slate-400">Set up your skin profile, allergens, and shade preferences to personalize suggestions.</p>''',
    "ARTryOnPage.jsx": '''<p className="text-slate-400">Use your camera to preview cosmetics in real time with AI overlays.</p>''',
    "ColorAnalysisPage.jsx": '''<p className="text-slate-400">Upload a photo to analyze undertones, season, and personalized matches.</p>''',
    "ColorAnalysisProcessingPage.jsx": '''<p className="text-slate-400">Analyzing your image and refining the ideal palette now.</p>''',
    "ColorAnalysisSubtypePage.jsx": '''<p className="text-slate-400">Explore your subtype palette with tailored color recommendations.</p>''',
    "PaletteGuideProductPage.jsx": '''<p className="text-slate-400">Discover product matches tuned to your season and style profile.</p>''',
    "IngredientFilterPage.jsx": '''<p className="text-slate-400">Filter by allergens, safety ratings, and INCI categories.</p>''',
    "AdminDatabasePage.jsx": '''<p className="text-slate-400">Review catalog entries, statistics, and product moderation tools.</p>''',
}

component_templates = {
    "Navbar.jsx": '''// Navbar navigation and brand shell for the app.
export function Navbar() {
  return (
    <nav className="flex items-center justify-between rounded-3xl bg-slate-900 p-4 shadow-xl shadow-slate-950/40">
      <span className="text-lg font-semibold text-purple-100">Chromascope</span>
      <button className="rounded-full bg-purple-600 px-4 py-2 text-sm text-white">Explore</button>
    </nav>
  );
}
''',
    "Sidebar.jsx": '''// Sidebar navigation for feature quick links.
export function Sidebar() {
  return (
    <aside className="space-y-4 rounded-3xl bg-slate-950 p-4">
      <p className="text-xs uppercase tracking-[0.3em] text-purple-300">Navigation</p>
      <ul className="space-y-2 text-sm text-slate-300">
        <li>Home</li>
        <li>Analysis</li>
        <li>Try-On</li>
      </ul>
    </aside>
  );
}
''',
    "Button.jsx": '''// Button component used across Chromascope UI.
export function Button({ label = "Button", type = "button" }) {
  return (
    <button type={type} className="rounded-full bg-purple-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/20 hover:bg-purple-500">
      {label}
    </button>
  );
}
''',
    "Modal.jsx": '''// Modal wrapper for overlays and confirmation dialogs.
export function Modal({ children }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-3xl bg-slate-950 p-6 shadow-2xl">{children}</div>
    </div>
  );
}
''',
    "Badge.jsx": '''// Badge for status labels and recommendation tags.
export function Badge({ text = "Badge" }) {
  return <span className="inline-flex rounded-full bg-purple-600 px-3 py-1 text-xs uppercase tracking-wide text-white">{text}</span>;
}
''',
    "LoadingSpinner.jsx": '''// LoadingSpinner indicates background activity.
export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
    </div>
  );
}
''',
    "ProgressBar.jsx": '''// ProgressBar displays analysis or onboarding progress.
export function ProgressBar({ progress = 0 }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
      <div className="h-full rounded-full bg-purple-500" style={{ width: `${progress}%` }} />
    </div>
  );
}
''',
    "LoginForm.jsx": '''// LoginForm handles email and password entry.
export function LoginForm() {
  return (
    <form className="space-y-4 rounded-3xl bg-slate-900 p-5 text-slate-200">
      <label className="block text-sm">
        Email
        <input type="email" className="mt-2 w-full rounded-2xl bg-slate-800 p-3 text-white" placeholder="you@example.com" />
      </label>
      <label className="block text-sm">
        Password
        <input type="password" className="mt-2 w-full rounded-2xl bg-slate-800 p-3 text-white" placeholder="••••••••" />
      </label>
      <button type="submit" className="w-full rounded-full bg-purple-600 py-3 text-white">Log in</button>
    </form>
  );
}
''',
    "RegisterForm.jsx": '''// RegisterForm captures new user details.
export function RegisterForm() {
  return (
    <form className="space-y-4 rounded-3xl bg-slate-900 p-5 text-slate-200">
      <label className="block text-sm">
        Name
        <input type="text" className="mt-2 w-full rounded-2xl bg-slate-800 p-3 text-white" placeholder="Full name" />
      </label>
      <label className="block text-sm">
        Email
        <input type="email" className="mt-2 w-full rounded-2xl bg-slate-800 p-3 text-white" placeholder="you@example.com" />
      </label>
      <button type="submit" className="w-full rounded-full bg-purple-600 py-3 text-white">Register</button>
    </form>
  );
}
''',
    "ConsentNotice.jsx": '''// ConsentNotice displays privacy and AI usage consent information.
export function ConsentNotice() {
  return (
    <div className="rounded-3xl border border-purple-700/40 bg-slate-900 p-5 text-slate-300">
      <h2 className="text-lg font-semibold text-purple-100">Data ethics notice</h2>
      <p className="mt-3 text-sm">Chromascope protects your image data and only uses it for personalized cosmetic guidance.</p>
    </div>
  );
}
''',
    "PatientProfileForm.jsx": '''// PatientProfileForm gathers basic profile details.
export function PatientProfileForm() {
  return (
    <form className="space-y-4 rounded-3xl bg-slate-900 p-5 text-slate-200">
      <label className="block text-sm">
        Birthday
        <input className="mt-2 w-full rounded-2xl bg-slate-800 p-3 text-white" />
      </label>
    </form>
  );
}
''',
    "SkinTypeSelector.jsx": '''// SkinTypeSelector lets users choose their skin type.
export function SkinTypeSelector() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <button className="rounded-3xl bg-slate-800 p-4 text-left text-slate-200">Dry</button>
      <button className="rounded-3xl bg-slate-800 p-4 text-left text-slate-200">Oily</button>
    </div>
  );
}
''',
    "AllergenTagInput.jsx": '''// AllergenTagInput captures ingredients to avoid.
export function AllergenTagInput() {
  return (
    <div className="space-y-3">
      <input className="w-full rounded-2xl bg-slate-900 p-3 text-white" placeholder="Enter allergen tag" />
      <div className="flex flex-wrap gap-2"><span className="rounded-full bg-purple-600 px-3 py-1 text-xs text-white">Fragrance</span></div>
    </div>
  );
}
''',
    "FitzpatrickClassifier.jsx": '''// FitzpatrickClassifier estimates the user’s skin phototype.
export function FitzpatrickClassifier() {
  return (
    <div className="rounded-3xl bg-slate-900 p-5 text-slate-300">
      <p>Select the Fitzpatrick skin type that best matches your natural response to sunlight.</p>
    </div>
  );
}
''',
    "ImageUploader.jsx": '''// ImageUploader accepts a selfie or photo for tone analysis.
export function ImageUploader() {
  return (
    <div className="rounded-3xl bg-slate-900 p-5 text-slate-300">
      <label className="block text-sm">Choose image
        <input type="file" className="mt-3 w-full rounded-2xl bg-slate-800 p-3 text-white" />
      </label>
    </div>
  );
}
''',
    "ProcessingAnimation.jsx": '''// ProcessingAnimation shows animated progress during analysis.
export function ProcessingAnimation() {
  return (
    <div className="rounded-3xl bg-slate-900 p-6 text-center text-slate-300">
      <div className="mx-auto mb-4 h-24 w-24 animate-spin rounded-full border-8 border-purple-500 border-t-transparent" />
      <p>Analyzing tone and palette...</p>
    </div>
  );
}
''',
    "SeasonResult.jsx": '''// SeasonResult displays the identified seasonal color profile.
export function SeasonResult() {
  return (
    <div className="rounded-3xl bg-slate-900 p-5 text-slate-300">
      <h3 className="text-xl font-semibold text-purple-100">Season result</h3>
      <p className="mt-2">Your best palette is cool and muted.</p>
    </div>
  );
}
''',
    "SeasonPaletteGrid.jsx": '''// SeasonPaletteGrid shows a grid of recommended seasonal shades.
export function SeasonPaletteGrid() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="h-24 rounded-3xl bg-purple-500" />
      <div className="h-24 rounded-3xl bg-fuchsia-500" />
      <div className="h-24 rounded-3xl bg-slate-500" />
    </div>
  );
}
''',
    "SubtypePaletteDetail.jsx": '''// SubtypePaletteDetail details the chosen subtype palette.
export function SubtypePaletteDetail() {
  return (
    <div className="rounded-3xl bg-slate-900 p-5 text-slate-300">
      <p>Subtype palette detail explains the color families suited for your undertone.</p>
    </div>
  );
}
''',
    "StylingChecklist.jsx": '''// StylingChecklist provides simple application guidance.
export function StylingChecklist() {
  return (
    <ul className="space-y-2 text-slate-300">
      <li>• Choose a balanced blush tone</li>
      <li>• Use the palette swatch as edge guidance</li>
    </ul>
  );
}
''',
    "CameraFeed.jsx": '''// CameraFeed renders the live device camera preview.
export function CameraFeed() {
  return (
    <div className="rounded-3xl bg-slate-900 p-6 text-center text-slate-300">Camera feed placeholder</div>
  );
}
''',
    "AROverlayCanvas.jsx": '''// AROverlayCanvas shows makeup overlays on the live feed.
export function AROverlayCanvas() {
  return (
    <div className="rounded-3xl bg-slate-900 p-6 text-center text-slate-300">AR overlay canvas placeholder</div>
  );
}
''',
    "ProductSwatchPicker.jsx": '''// ProductSwatchPicker chooses color swatches for AR try-on.
export function ProductSwatchPicker() {
  return (
    <div className="flex gap-3 overflow-x-auto">
      <button className="h-12 w-12 rounded-full bg-purple-500" />
    </div>
  );
}
''',
    "ARControlBar.jsx": '''// ARControlBar surfaces controls for the AR experience.
export function ARControlBar() {
  return (
    <div className="rounded-3xl bg-slate-950 p-4 text-slate-300 flex items-center justify-between">
      <button className="rounded-full bg-slate-800 px-4 py-2">Capture</button>
      <button className="rounded-full bg-purple-600 px-4 py-2">Reset</button>
    </div>
  );
}
''',
    "PaletteGuideCard.jsx": '''// PaletteGuideCard showcases a curated palette item.
export function PaletteGuideCard() {
  return (
    <article className="rounded-3xl bg-slate-900 p-5 text-slate-300">
      <h3 className="font-semibold text-purple-100">Palette guide</h3>
    </article>
  );
}
''',
    "CuratedMatchesGrid.jsx": '''// CuratedMatchesGrid displays matched products.
export function CuratedMatchesGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-3xl bg-slate-900 p-4">Match 1</div>
      <div className="rounded-3xl bg-slate-900 p-4">Match 2</div>
    </div>
  );
}
''',
    "ProductCard.jsx": '''// ProductCard shows product details and swatches.
export function ProductCard() {
  return (
    <div className="rounded-3xl bg-slate-900 p-5 text-slate-300">
      <h4 className="font-semibold">Product name</h4>
    </div>
  );
}
''',
    "RecommendationBadge.jsx": '''// RecommendationBadge highlights top picks.
export function RecommendationBadge() {
  return <span className="rounded-full bg-purple-600 px-3 py-1 text-xs text-white">Top pick</span>;
}
''',
    "ScientificFilterPanel.jsx": '''// ScientificFilterPanel lets users build ingredient filters.
export function ScientificFilterPanel() {
  return (
    <div className="rounded-3xl bg-slate-900 p-5 text-slate-300">
      <p>Build your safety filter and allergen profile.</p>
    </div>
  );
}
''',
    "IngredientSafetyTag.jsx": '''// IngredientSafetyTag marks ingredient safety status.
export function IngredientSafetyTag() {
  return <span className="rounded-full bg-emerald-500 px-3 py-1 text-xs text-slate-950">Safe</span>;
}
''',
    "AllergenFlagList.jsx": '''// AllergenFlagList lists flagged allergens.
export function AllergenFlagList() {
  return (
    <ul className="space-y-2 text-slate-300">
      <li>Fragrance</li>
      <li>Essential oils</li>
    </ul>
  );
}
''',
    "INCIMatchTable.jsx": '''// INCIMatchTable displays ingredient matching details.
export function INCIMatchTable() {
  return (
    <div className="overflow-x-auto rounded-3xl bg-slate-900 p-4 text-slate-300">
      <table className="w-full"><tbody><tr><td>Ingredient</td><td>Match</td></tr></tbody></table>
    </div>
  );
}
''',
    "ProductCatalogTable.jsx": '''// ProductCatalogTable lists products for admin review.
export function ProductCatalogTable() {
  return (
    <div className="overflow-x-auto rounded-3xl bg-slate-900 p-4 text-slate-300">Admin product catalog placeholder</div>
  );
}
''',
    "DatabaseStatsCards.jsx": '''// DatabaseStatsCards shows admin summary metrics.
export function DatabaseStatsCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-3xl bg-slate-900 p-5">Stats card</div>
    </div>
  );
}
''',
    "AddProductModal.jsx": '''// AddProductModal is the form modal for new catalog items.
export function AddProductModal() {
  return (
    <div className="rounded-3xl bg-slate-900 p-5 text-slate-300">Add product modal placeholder</div>
  );
}
''',
    "ProductFilterBar.jsx": '''// ProductFilterBar provides catalog search and filters.
export function ProductFilterBar() {
  return (
    <div className="rounded-3xl bg-slate-900 p-4 text-slate-300">Filter bar placeholder</div>
  );
}
''',
}


def make_file(path: Path, content: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")

make_file(src / "App.jsx", app["App.jsx"])
make_file(src / "main.jsx", main_content)
for name, content in routes.items():
    make_file(src / "routes" / name, content)
for name, desc in pages.items():
    body = page_body[name]
    component_name = name.replace('.jsx', '')
    page = f'''// {desc}
import {{ Navbar }} from "../components/common/Navbar.jsx";

export function {component_name}() {{
  return (
    <main className="page-shell p-6 min-h-screen bg-slate-950 text-slate-100">
      <Navbar />
      <section className="max-w-5xl mx-auto space-y-4">
        <h1 className="text-3xl font-semibold text-purple-100">{component_name.replace('Page', ' Page')}</h1>
        {body}
      </section>
    </main>
  );
}}
'''
    make_file(src / "pages" / name, page)
for folder, items in components.items():
    for name in items.keys():
        make_file(src / "components" / folder / name, component_templates[name])
for name, code in hooks.items():
    make_file(src / "hooks" / name, code)
for name, code in services.items():
    make_file(src / "services" / name, code)
for name, code in stores.items():
    make_file(src / "store" / name, code)
for name, code in utils.items():
    make_file(src / "utils" / name, code)
for name, code in styles.items():
    make_file(src / "styles" / name, code)

print("Scaffold created successfully.")
