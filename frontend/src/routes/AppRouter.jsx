import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
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
import { ProfilePage } from "../pages/ProfilePage.jsx";
import { ProductCatalogPage } from "../pages/ProductCatalogPage.jsx";
import { AdminDatabasePage } from "../pages/AdminDatabasePage.jsx";
// import { ProtectedRoute } from "./ProtectedRoute.jsx";
// import { AdminRoute } from "./AdminRoute.jsx";
import { MainLayout } from "../layouts/MainLayout";

export default function AppRouter() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<SplashPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/ethics" element={<DataEthicsPage />} />
        <Route
          path="/home"
          element={
            <MainLayout>
              <HomePage />
            </MainLayout>
          }
        />
        <Route
          path="/onboarding"
          element={
            // <ProtectedRoute>
            <OnboardingPage />
            // </ProtectedRoute>
          }
        />
        <Route
          path="/ar-tryon"
          element={
            // <ProtectedRoute>
            <MainLayout>
              <ARTryOnPage />
            </MainLayout>
            // </ProtectedRoute>
          }
        />
        <Route
          path="/color-analysis"
          element={
            // <ProtectedRoute>
            <MainLayout>
              <ColorAnalysisPage />
            </MainLayout>
            // </ProtectedRoute>
          }
        />
        <Route
          path="/color-analysis/processing"
          element={
            // <ProtectedRoute>
            <MainLayout>
              <ColorAnalysisProcessingPage />
            </MainLayout>
            // </ProtectedRoute>
          }
        />
        <Route
          path="/color-analysis/subtype"
          element={
            // <ProtectedRoute>
            <MainLayout>
              <ColorAnalysisSubtypePage />
            </MainLayout>
            // </ProtectedRoute>
          }
        />
        <Route
          path="/palette-product"
          element={
            // <ProtectedRoute>
            <MainLayout>
              <PaletteGuideProductPage />
            </MainLayout>
            // </ProtectedRoute>
          }
        />
        <Route
          path="/ingredient-filter"
          element={
            // <ProtectedRoute>
            <MainLayout>
              <IngredientFilterPage />
            </MainLayout>
            // </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            // <ProtectedRoute>
            <MainLayout>
              <ProfilePage />
            </MainLayout>
            // </ProtectedRoute>
          }
        />
        <Route
          path="/product-catalog"
          element={
            // <ProtectedRoute>
            <MainLayout>
              <ProductCatalogPage />
            </MainLayout>
            // </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            // <AdminRoute>
            <AdminDatabasePage />
            // </AdminRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
