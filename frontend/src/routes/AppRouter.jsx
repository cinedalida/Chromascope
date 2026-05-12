import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { SplashPage } from "../pages/SplashPage.jsx";
import { AuthPage } from "../pages/AuthPage.jsx";
import { HomePage } from "../pages/HomePage.jsx";
import { OnboardingPage } from "../pages/OnboardingPage.jsx";
import { ARTryOnPage } from "../pages/ARTryOnPage.jsx";
import { ColorAnalysisPage } from "../pages/ColorAnalysisPage.jsx";
import { ColorAnalysisProcessingPage } from "../pages/ColorAnalysisProcessingPage.jsx";
import { ColorAnalysisSubtypePage } from "../pages/ColorAnalysisSubtypePage.jsx";
import { PaletteGuideProductPage } from "../pages/PaletteGuideProductPage.jsx";
import { IngredientFilterPage } from "../pages/IngredientFilterPage.jsx";
import { ProfilePage } from "../pages/ProfilePage.jsx";
import { ProductCatalogPage } from "../pages/ProductCatalogPage.jsx";
import { AdminDatabasePage } from "../pages/AdminDatabasePage.jsx";
import { MainLayout } from "../layouts/MainLayout";

export default function AppRouter() {
  return (
    <Router>
      <Routes>
        {/* Splash & Auth Flow */}
        <Route path="/" element={<SplashPage />} />
        <Route path="/auth" element={<AuthPage />} />
        
        {/* Onboarding (Contains Skin Type, Concerns, Ingredients, & Ethics Flow) */}
        <Route path="/onboarding" element={<OnboardingPage />} />

        {/* Main App Pages (With Sidebar/MainLayout) */}
        <Route
          path="/home"
          element={
            <MainLayout>
              <HomePage />
            </MainLayout>
          }
        />
        
        <Route
          path="/ar-tryon"
          element={
            <MainLayout>
              <ARTryOnPage />
            </MainLayout>
          }
        />
        
        <Route
          path="/color-analysis"
          element={
            <MainLayout>
              <ColorAnalysisPage />
            </MainLayout>
          }
        />
        
        <Route
          path="/color-analysis/processing"
          element={
            <MainLayout>
              <ColorAnalysisProcessingPage />
            </MainLayout>
          }
        />
        
        <Route
          path="/color-analysis/subtype"
          element={
            <MainLayout>
              <ColorAnalysisSubtypePage />
            </MainLayout>
          }
        />
        
        <Route
          path="/palette-product"
          element={
            <MainLayout>
              <PaletteGuideProductPage />
            </MainLayout>
          }
        />
        
        <Route
          path="/ingredient-filter"
          element={
            <MainLayout>
              <IngredientFilterPage />
            </MainLayout>
          }
        />
        
        <Route
          path="/profile"
          element={
            <MainLayout>
              <ProfilePage />
            </MainLayout>
          }
        />
        
        <Route
          path="/product-catalog"
          element={
            <MainLayout>
              <ProductCatalogPage />
            </MainLayout>
          }
        />
        
        {/* Admin/Database Section */}
        {/* Note: Wrap this with <AdminRoute> once your authService role management is ready */}
        <Route path="/admin" element={<AdminDatabasePage />} />
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}