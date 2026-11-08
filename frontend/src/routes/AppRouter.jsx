import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { SplashPage } from "../pages/SplashPage.jsx";
import { UserManualPage } from "../pages/UserManualPage.jsx";
import { TermsOfServicePage } from "../pages/TermsOfServicePage.jsx";
import { PrivacyPolicyPage } from "../pages/PrivacyPolicyPage.jsx";
import { AuthPage } from "../pages/AuthPage.jsx";
import { HomePage } from "../pages/HomePage.jsx";
import { OnboardingPage } from "../pages/OnboardingPage.jsx";
import { ARTryOnPage } from "../pages/ARTryOnPage.jsx";
import { ColorAnalysisPage } from "../pages/ColorAnalysisPage.jsx";
import { ColorAnalysisProcessingPage } from "../pages/ColorAnalysisProcessingPage.jsx";
import { ColorAnalysisSubtypePage } from "../pages/ColorAnalysisSubtypePage.jsx";
// HIDDEN — re-enable with the /palette-product route below
// import { PaletteGuideProductPage } from "../pages/PaletteGuideProductPage.jsx";
import { ProfilePage } from "../pages/ProfilePage.jsx";
import { CatalogPage } from "../pages/CatalogPage.jsx";
import { AdminDatabasePage } from "../pages/AdminDatabasePage.jsx";
import { MainLayout } from "../layouts/MainLayout";
import { RequireAuth } from "./RequireAuth.jsx";
// DEV only: camera lab for tuning looks. import.meta.env.DEV is false in production builds.
import { ARLabPage } from "../pages/ARLabPage.jsx";

export default function AppRouter() {
  return (
    <Router>
      <Routes>
        {/* Splash & Auth Flow */}
        <Route path="/" element={<SplashPage />} />
        <Route path="/user-manual" element={<UserManualPage />} />
        <Route path="/terms" element={<TermsOfServicePage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/auth" element={<AuthPage />} />
        {import.meta.env.DEV && <Route path="/dev/ar-lab" element={<ARLabPage />} />}
        {/* DEV only: the real AR page without the sign-in wrapper, for browser testing of the panel. */}
        {import.meta.env.DEV && (
          <Route path="/dev/ar-page" element={<MainLayout><ARTryOnPage /></MainLayout>} />
        )}
        
        {/* Onboarding (Contains Skin Type, Concerns, Ingredients, & Ethics Flow) */}
        <Route path="/onboarding" element={<RequireAuth><OnboardingPage /></RequireAuth>} />

        {/* Main App Pages (With Sidebar/MainLayout) */}
        <Route
          path="/home"
          element={
            <RequireAuth>
              <MainLayout>
                <HomePage />
              </MainLayout>
            </RequireAuth>
          }
        />
        
        <Route
          path="/ar-tryon"
          element={
            <RequireAuth>
              <MainLayout>
                <ARTryOnPage />
              </MainLayout>
            </RequireAuth>
          }
        />
        
        <Route
          path="/color-analysis"
          element={
            <RequireAuth>
              <MainLayout>
                <ColorAnalysisPage />
              </MainLayout>
            </RequireAuth>
          }
        />
        
        <Route
          path="/color-analysis/processing"
          element={
            <RequireAuth>
              <MainLayout>
                <ColorAnalysisProcessingPage />
              </MainLayout>
            </RequireAuth>
          }
        />
        
        <Route
          path="/color-analysis/subtype"
          element={
            <RequireAuth>
              <MainLayout>
                <ColorAnalysisSubtypePage />
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

        {/* Old ingredient filter route: now the Safe for me view of the merged catalog (keeps bookmarks working). */}
        <Route path="/ingredient-filter" element={<Navigate to="/catalog?view=safe" replace />} />
        
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <MainLayout>
                <ProfilePage />
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
                <CatalogPage />
              </MainLayout>
            </RequireAuth>
          }
        />
        
        {/* Admin/Database Section */}
        {/* Signed-in only for now; wrap with an <AdminRoute> role check once roles exist */}
        <Route path="/admin" element={<RequireAuth><AdminDatabasePage /></RequireAuth>} />
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}