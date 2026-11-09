import { Suspense, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
// Only the first pages a visitor sees are in the main file; the rest load on first visit (see lazyPages.js).
import { SplashPage } from "../pages/SplashPage.jsx";
import { AuthPage } from "../pages/AuthPage.jsx";
import {
  UserManualPage,
  TermsOfServicePage,
  PrivacyPolicyPage,
  HomePage,
  OnboardingPage,
  ARTryOnPage,
  ColorAnalysisPage,
  ColorAnalysisProcessingPage,
  ColorAnalysisSubtypePage,
  // HIDDEN — re-enable with the /palette-product route below
  // PaletteGuideProductPage,
  ProfilePage,
  CatalogPage,
  FavoritesPage,
  AdminDatabasePage,
  // DEV only: camera lab for tuning looks. null in production builds.
  ARLabPage,
  prefetchPages,
} from "./lazyPages.js";
import { MainLayout } from "../layouts/MainLayout";
import { RequireAuth } from "./RequireAuth.jsx";
import { RouteFallback } from "../components/common/RouteFallback.jsx";
import { RouteErrorBoundary } from "../components/common/RouteErrorBoundary.jsx";

// One page's area: a spinner while its code downloads, and a message with a Reload button if that fails. Used INSIDE the
// layout, so the sidebar and navbar stay on screen.
function Lazy({ children }) {
  return (
    <RouteErrorBoundary>
      <Suspense fallback={<RouteFallback />}>{children}</Suspense>
    </RouteErrorBoundary>
  );
}

export default function AppRouter() {
  // Home is where sign-in lands: fetch it while the login page is still on screen.
  useEffect(() => {
    const id = typeof requestIdleCallback === "function" ? requestIdleCallback(() => prefetchPages(["home"])) : setTimeout(() => prefetchPages(["home"]), 1500);
    return () => (typeof cancelIdleCallback === "function" && typeof id === "number" ? cancelIdleCallback(id) : clearTimeout(id));
  }, []);

  return (
    <Router>
      <Routes>
        {/* Splash & Auth Flow */}
        <Route path="/" element={<SplashPage />} />
        <Route path="/user-manual" element={<Lazy><UserManualPage /></Lazy>} />
        <Route path="/terms" element={<Lazy><TermsOfServicePage /></Lazy>} />
        <Route path="/privacy" element={<Lazy><PrivacyPolicyPage /></Lazy>} />
        <Route path="/auth" element={<AuthPage />} />
        {import.meta.env.DEV && <Route path="/dev/ar-lab" element={<Lazy><ARLabPage /></Lazy>} />}
        {/* DEV only: the real AR page without the sign-in wrapper, for browser testing of the panel. */}
        {import.meta.env.DEV && (
          <Route path="/dev/ar-page" element={<MainLayout><Lazy><ARTryOnPage /></Lazy></MainLayout>} />
        )}

        {/* Onboarding (Contains Skin Type, Concerns, Ingredients, & Ethics Flow) */}
        <Route path="/onboarding" element={<RequireAuth><Lazy><OnboardingPage /></Lazy></RequireAuth>} />

        {/* Main App Pages (With Sidebar/MainLayout) */}
        <Route
          path="/home"
          element={
            <RequireAuth>
              <MainLayout>
                <Lazy>
                  <HomePage />
                </Lazy>
              </MainLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/ar-tryon"
          element={
            <RequireAuth>
              <MainLayout>
                <Lazy>
                  <ARTryOnPage />
                </Lazy>
              </MainLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/color-analysis"
          element={
            <RequireAuth>
              <MainLayout>
                <Lazy>
                  <ColorAnalysisPage />
                </Lazy>
              </MainLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/color-analysis/processing"
          element={
            <RequireAuth>
              <MainLayout>
                <Lazy>
                  <ColorAnalysisProcessingPage />
                </Lazy>
              </MainLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/color-analysis/subtype"
          element={
            <RequireAuth>
              <MainLayout>
                <Lazy>
                  <ColorAnalysisSubtypePage />
                </Lazy>
              </MainLayout>
            </RequireAuth>
          }
        />

        {/* HIDDEN — re-enable when Palette Guide is ready
        <Route
          path="/palette-product"
          element={
            <MainLayout>
              <PaletteGuideProductPage />
            </MainLayout>
          }
        />
        */}

        {/* Old ingredient filter route: now the Compatible with me view of the merged catalog (keeps bookmarks working). */}
        <Route path="/ingredient-filter" element={<Navigate to="/catalog?view=safe" replace />} />

        <Route
          path="/profile"
          element={
            <RequireAuth>
              <MainLayout>
                <Lazy>
                  <ProfilePage />
                </Lazy>
              </MainLayout>
            </RequireAuth>
          }
        />

        {/* Old product catalog route: now the Full catalog view of the merged catalog. */}
        <Route path="/product-catalog" element={<Navigate to="/catalog?view=all" replace />} />

        {/* Merged catalog: product catalog and ingredient filter in one page (catalog plan Part A). */}
        <Route
          path="/catalog"
          element={
            <RequireAuth>
              <MainLayout>
                <Lazy>
                  <CatalogPage />
                </Lazy>
              </MainLayout>
            </RequireAuth>
          }
        />

        {/* Favorites: saved products and looks (catalog plan Part B). */}
        <Route
          path="/favorites"
          element={
            <RequireAuth>
              <MainLayout>
                <Lazy>
                  <FavoritesPage />
                </Lazy>
              </MainLayout>
            </RequireAuth>
          }
        />

        {/* Admin/Database Section */}
        {/* Signed-in only for now; wrap with an <AdminRoute> role check once roles exist */}
        <Route path="/admin" element={<RequireAuth><Lazy><AdminDatabasePage /></Lazy></RequireAuth>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
