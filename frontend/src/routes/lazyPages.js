import { lazy } from "react";
import { importWithReload } from "../utils/lazyWithRetry";

// Every page except the two a visitor sees first (Splash and Auth) is loaded when it is first opened, not with the app.
// The login page then downloads a fraction of the code, and the AR face-model code (MediaPipe) comes only with Try-On.
// All imports for one page live here, so the router and the background prefetch below share the same file.

const importers = {
  home: () => import("../pages/HomePage.jsx"),
  onboarding: () => import("../pages/OnboardingPage.jsx"),
  arTryOn: () => import("../pages/ARTryOnPage.jsx"),
  colorAnalysis: () => import("../pages/ColorAnalysisPage.jsx"),
  colorProcessing: () => import("../pages/ColorAnalysisProcessingPage.jsx"),
  colorSubtype: () => import("../pages/ColorAnalysisSubtypePage.jsx"),
  profile: () => import("../pages/ProfilePage.jsx"),
  catalog: () => import("../pages/CatalogPage.jsx"),
  favorites: () => import("../pages/FavoritesPage.jsx"),
  admin: () => import("../pages/AdminDatabasePage.jsx"),
  userManual: () => import("../pages/UserManualPage.jsx"),
  terms: () => import("../pages/TermsOfServicePage.jsx"),
  privacy: () => import("../pages/PrivacyPolicyPage.jsx"),
  // Dev only: written so that production builds drop it entirely (no file for the camera lab).
  ...(import.meta.env.DEV ? { arLab: () => import("../pages/ARLabPage.jsx") } : {}),
};

// The pages export named components; React.lazy wants a default export.
const page = (key, name) => lazy(() => importWithReload(importers[key]).then((module) => ({ default: module[name] })));

export const HomePage = page("home", "HomePage");
export const OnboardingPage = page("onboarding", "OnboardingPage");
export const ARTryOnPage = page("arTryOn", "ARTryOnPage");
export const ColorAnalysisPage = page("colorAnalysis", "ColorAnalysisPage");
export const ColorAnalysisProcessingPage = page("colorProcessing", "ColorAnalysisProcessingPage");
export const ColorAnalysisSubtypePage = page("colorSubtype", "ColorAnalysisSubtypePage");
export const ProfilePage = page("profile", "ProfilePage");
export const CatalogPage = page("catalog", "CatalogPage");
export const FavoritesPage = page("favorites", "FavoritesPage");
export const AdminDatabasePage = page("admin", "AdminDatabasePage");
export const UserManualPage = page("userManual", "UserManualPage");
export const TermsOfServicePage = page("terms", "TermsOfServicePage");
export const PrivacyPolicyPage = page("privacy", "PrivacyPolicyPage");
export const ARLabPage = import.meta.env.DEV ? page("arLab", "ARLabPage") : null;

/**
 * Starts downloading pages the person is likely to open next, so opening them later is instant. Failures are ignored (the
 * page then loads, or reports the failure, when it is really opened). Skipped on a data-saver connection.
 */
export function prefetchPages(keys) {
  if (typeof navigator !== "undefined" && navigator.connection?.saveData) return;
  for (const key of keys) importers[key]?.().catch(() => {});
}

/** The pages worth fetching once someone is signed in with a finished profile. */
export const SIGNED_IN_PAGES = ["arTryOn", "catalog", "favorites", "profile", "colorAnalysis"];
